import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { sendWebPushToUser } from './send-web-push';
import type { NotifiableWidgetKey, NotifyFamilyInput, NotifyFamilyResult } from './types';
import { isNotifiableWidgetKey } from './types';
import { CURRENT_APP_ID } from '@/lib/apps';
import {
  normalizeAlertPreferences,
  resolveAlertMode,
  type NotificationAlertPreferences,
} from './alert-modes';

function getServiceSupabase(): SupabaseClient {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL과 SUPABASE_SERVICE_ROLE_KEY가 필요합니다.');
  }
  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

/** 그룹 멤버(+ owner) user id 목록 */
export async function getGroupMemberUserIds(
  groupId: string,
  supabaseClient?: SupabaseClient,
): Promise<string[]> {
  const supabase = supabaseClient ?? getServiceSupabase();
  const [{ data: members }, { data: group }] = await Promise.all([
    supabase.from('memberships').select('user_id').eq('group_id', groupId),
    supabase.from('groups').select('owner_id').eq('id', groupId).maybeSingle(),
  ]);

  const ids = new Set<string>();
  for (const row of members || []) {
    if (row.user_id) ids.add(String(row.user_id));
  }
  if (group?.owner_id) ids.add(String(group.owner_id));
  return Array.from(ids);
}

/** 그룹 관리자(+ owner) user id 목록 */
export async function getGroupAdminUserIds(
  groupId: string,
  supabaseClient?: SupabaseClient,
): Promise<string[]> {
  const supabase = supabaseClient ?? getServiceSupabase();
  const [{ data: admins }, { data: group }] = await Promise.all([
    supabase.from('memberships').select('user_id').eq('group_id', groupId).eq('role', 'ADMIN'),
    supabase.from('groups').select('owner_id').eq('id', groupId).maybeSingle(),
  ]);

  const ids = new Set<string>();
  for (const row of admins || []) {
    if (row.user_id) ids.add(String(row.user_id));
  }
  if (group?.owner_id) ids.add(String(group.owner_id));
  return Array.from(ids);
}

async function loadPreferenceMap(
  supabase: SupabaseClient,
  groupId: string,
  userIds: string[],
  widgetKey: NotifiableWidgetKey,
): Promise<Map<string, { push_enabled: boolean; inapp_enabled: boolean }>> {
  const map = new Map<string, { push_enabled: boolean; inapp_enabled: boolean }>();
  if (userIds.length === 0) return map;

  const { data } = await supabase
    .from('notification_preferences')
    .select('user_id, push_enabled, inapp_enabled')
    .eq('group_id', groupId)
    .eq('widget_key', widgetKey)
    .in('user_id', userIds);

  for (const row of data || []) {
    map.set(String(row.user_id), {
      push_enabled: row.push_enabled !== false,
      inapp_enabled: row.inapp_enabled !== false,
    });
  }
  return map;
}

async function loadAlertPreferenceMap(
  supabase: SupabaseClient,
  userIds: string[],
  appId: string,
): Promise<Map<string, NotificationAlertPreferences>> {
  const map = new Map<string, NotificationAlertPreferences>();
  if (userIds.length === 0) return map;

  const { data } = await supabase
    .from('notification_alert_preferences')
    .select('user_id, first_mode, subsequent_mode')
    .eq('app_id', appId)
    .in('user_id', userIds);

  for (const row of data || []) {
    map.set(String(row.user_id), normalizeAlertPreferences(row));
  }
  return map;
}

function buildPushOptions(mode: string, groupId: string, isFirst: boolean) {
  const bundleTag = `hearth-unread:${groupId}`;
  if (mode === 'voice') {
    return {
      silent: false,
      vibrate: undefined as number[] | undefined,
      tag: isFirst ? undefined : bundleTag,
      renotify: !isFirst,
    };
  }
  if (mode === 'vibrate') {
    return {
      silent: true,
      vibrate: [180, 80, 180],
      tag: bundleTag,
      renotify: true,
    };
  }
  // silent
  return {
    silent: true,
    vibrate: undefined as number[] | undefined,
    tag: bundleTag,
    renotify: false,
  };
}

/**
 * 가족 알림 공통 진입점.
 * - preferences 반영 (없으면 기본 on)
 * - notifications 인앱 기록
 * - Web Push: 첫 미확인은 first_mode, 이후는 subsequent_mode
 *   (subsequent silent = 푸시 생략·목록만, vibrate = 무음+진동 푸시)
 * 실패해도 throw하지 않고 결과/로그만 반환 (본 기능 성공 유지).
 */
export async function notifyFamily(input: NotifyFamilyInput): Promise<NotifyFamilyResult> {
  const result: NotifyFamilyResult = { notified: 0, skipped: 0, pushSent: 0, pushFailed: 0 };

  try {
    if (!isNotifiableWidgetKey(input.widgetKey)) {
      console.warn('[notifyFamily] 제외/미지원 위젯:', input.widgetKey);
      return result;
    }

    const supabase = getServiceSupabase();
    const uniqueRecipients = Array.from(
      new Set(
        (input.recipientUserIds || [])
          .map((id) => String(id))
          .filter((id) => id && id !== input.actorUserId),
      ),
    );

    if (uniqueRecipients.length === 0) {
      return result;
    }

    const prefs = await loadPreferenceMap(supabase, input.groupId, uniqueRecipients, input.widgetKey);

    const inappRecipients: string[] = [];
    const pushCandidates: string[] = [];

    for (const userId of uniqueRecipients) {
      const pref = prefs.get(userId) || { push_enabled: true, inapp_enabled: true };
      if (!pref.inapp_enabled && !pref.push_enabled) {
        result.skipped += 1;
        continue;
      }
      if (pref.inapp_enabled) inappRecipients.push(userId);
      if (pref.push_enabled) pushCandidates.push(userId);
    }

    if (inappRecipients.length > 0) {
      const appId = input.appId || CURRENT_APP_ID;
      const rows = inappRecipients.map((recipientUserId) => ({
        group_id: input.groupId,
        recipient_user_id: recipientUserId,
        actor_user_id: input.actorUserId,
        widget_key: input.widgetKey,
        event_type: input.eventType,
        title: input.title,
        body: input.body,
        url: input.url,
        entity_id: input.entityId ?? null,
        payload: input.payload ?? null,
        app_id: appId,
      }));

      const { error: insertError } = await supabase.from('notifications').insert(rows);
      if (insertError) {
        console.error('[notifyFamily] notifications insert 실패:', insertError.message);
        return result;
      }
      result.notified = inappRecipients.length;
    }

    const pushAppId = input.appId || CURRENT_APP_ID;
    const alertPrefs = await loadAlertPreferenceMap(supabase, pushCandidates, pushAppId);

    type PushJob = {
      userId: string;
      isFirst: boolean;
      mode: string;
    };
    const pushJobs: PushJob[] = [];

    if (pushCandidates.length > 0) {
      const { data: unreadRows } = await supabase
        .from('notifications')
        .select('recipient_user_id')
        .eq('group_id', input.groupId)
        .in('recipient_user_id', pushCandidates)
        .is('read_at', null);

      const unreadCounts = new Map<string, number>();
      for (const row of unreadRows || []) {
        const uid = String(row.recipient_user_id);
        unreadCounts.set(uid, (unreadCounts.get(uid) || 0) + 1);
      }

      for (const userId of pushCandidates) {
        const unreadAfter = unreadCounts.get(userId) || 0;
        // insert 직후: inapp 켠 유저는 unread>=1. 이번이 첫 미확인이면 unread===1
        const isFirst = inappRecipients.includes(userId)
          ? unreadAfter === 1
          : unreadAfter === 0;
        const mode = resolveAlertMode(
          isFirst,
          alertPrefs.get(userId) || normalizeAlertPreferences(null),
        );

        // subsequent silent: OS 푸시 생략 (인앱 목록·배지만)
        if (!isFirst && mode === 'silent') {
          result.skipped += 1;
          continue;
        }
        // first silent: 무음 배너는 보내되 소리 없음
        pushJobs.push({ userId, isFirst, mode });
      }
    }

    await Promise.all(
      pushJobs.map(async ({ userId, isFirst, mode }) => {
        const opts = buildPushOptions(mode, input.groupId, isFirst);
        const tag =
          opts.tag ||
          input.tag ||
          input.entityId ||
          input.eventType;
        const pushResult = await sendWebPushToUser(
          userId,
          {
            title: input.title,
            body: input.body,
            tag,
            silent: opts.silent,
            vibrate: opts.vibrate,
            renotify: opts.renotify,
            data: {
              type: input.eventType,
              widgetKey: input.widgetKey,
              entityId: input.entityId,
              url: input.url,
              appId: pushAppId,
              alertMode: mode,
              isFirstUnread: isFirst,
              ...(input.payload || {}),
            },
          },
          supabase,
          pushAppId,
        );
        result.pushSent += pushResult.sent || 0;
        result.pushFailed += pushResult.failed || 0;
      }),
    );

    return result;
  } catch (error) {
    console.error('[notifyFamily] 오류:', error);
    return result;
  }
}
