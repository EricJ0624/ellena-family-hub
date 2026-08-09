import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { sendWebPushToUser } from './send-web-push';
import type { NotifiableWidgetKey, NotifyFamilyInput, NotifyFamilyResult } from './types';
import { isNotifiableWidgetKey } from './types';

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

/**
 * 가족 알림 공통 진입점.
 * - preferences 반영 (없으면 기본 on)
 * - notifications 인앱 기록
 * - Web Push 발송 (해당 그룹에 미확인 알림이 있으면 푸시 생략 — 목록만 추가)
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
      }));

      const { error: insertError } = await supabase.from('notifications').insert(rows);
      if (insertError) {
        console.error('[notifyFamily] notifications insert 실패:', insertError.message);
      } else {
        result.notified = inappRecipients.length;
      }
    }

    // 미확인 알림이 이미 있는 수신자에게는 OS 푸시를 보내지 않음 (인앱 목록만 누적)
    const pushRecipients: string[] = [];
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
        // insert 직후이므로 inapp 켠 유저는 unread >= 1. 푸시는 "이번이 첫 미확인"일 때만.
        // = 이번 insert 전 unread가 0이었으면, insert 후 unread === 1 → 푸시
        const unreadAfter = unreadCounts.get(userId) || 0;
        const hadPriorUnread = inappRecipients.includes(userId) ? unreadAfter > 1 : unreadAfter > 0;
        if (hadPriorUnread) {
          result.skipped += 1;
          continue;
        }
        pushRecipients.push(userId);
      }
    }

    await Promise.all(
      pushRecipients.map(async (userId) => {
        const pushResult = await sendWebPushToUser(
          userId,
          {
            title: input.title,
            body: input.body,
            tag: input.tag || input.entityId || input.eventType,
            data: {
              type: input.eventType,
              widgetKey: input.widgetKey,
              entityId: input.entityId,
              url: input.url,
              ...(input.payload || {}),
            },
          },
          supabase,
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
