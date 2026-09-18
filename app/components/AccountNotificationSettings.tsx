'use client';

import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import {
  DEFAULT_FIRST_ALERT_MODE,
  DEFAULT_SUBSEQUENT_ALERT_MODE,
  normalizeAlertPreferences,
  NOTIFIABLE_WIDGET_LABELS,
  NOTIFICATION_ALERT_PREFS_UPDATED_EVENT,
  type FirstAlertMode,
  type NotificationAlertPreferences,
  type SubsequentAlertMode,
} from '@/lib/notifications/alert-modes';
import { unlockAlertAudio } from '@/lib/notifications/alert-feedback';
import {
  NOTIFIABLE_WIDGET_KEYS,
  type NotifiableWidgetKey,
} from '@/lib/notifications/types';

interface PrefRow {
  widget_key: NotifiableWidgetKey;
  push_enabled: boolean;
  inapp_enabled: boolean;
}

interface AccountNotificationSettingsProps {
  groupId: string | null;
  /** 모달이 열릴 때 true → 설정 로드 */
  active: boolean;
}

async function authHeaders(): Promise<HeadersInit | null> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.access_token) return null;
  return {
    Authorization: `Bearer ${session.access_token}`,
    'Content-Type': 'application/json',
  };
}

/**
 * 내 계정 모달용 알림 설정.
 * - 하쓰/진동/무음: 유저 전역
 * - 위젯 푸시/앱안: 현재 그룹
 */
export default function AccountNotificationSettings({
  groupId,
  active,
}: AccountNotificationSettingsProps) {
  const [prefs, setPrefs] = useState<PrefRow[]>([]);
  const [alertPrefs, setAlertPrefs] = useState<NotificationAlertPreferences>({
    first_mode: DEFAULT_FIRST_ALERT_MODE,
    subsequent_mode: DEFAULT_SUBSEQUENT_ALERT_MODE,
  });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const loadPrefs = useCallback(async () => {
    if (!groupId) return;
    const headers = await authHeaders();
    if (!headers) return;
    setLoading(true);
    try {
      const res = await fetch(
        `/api/notifications/preferences?groupId=${encodeURIComponent(groupId)}`,
        { headers },
      );
      if (!res.ok) return;
      const json = await res.json();
      setPrefs(json.data || []);
      setAlertPrefs(normalizeAlertPreferences(json.alertPreferences));
    } catch (e) {
      console.warn('[AccountNotificationSettings] load 실패:', e);
    } finally {
      setLoading(false);
    }
  }, [groupId]);

  useEffect(() => {
    if (active && groupId) void loadPrefs();
  }, [active, groupId, loadPrefs]);

  const togglePref = (widgetKey: NotifiableWidgetKey, field: 'push_enabled' | 'inapp_enabled') => {
    setPrefs((prev) => {
      const existing = prev.find((p) => p.widget_key === widgetKey);
      if (existing) {
        return prev.map((p) =>
          p.widget_key === widgetKey ? { ...p, [field]: !p[field] } : p,
        );
      }
      const base: PrefRow = {
        widget_key: widgetKey,
        push_enabled: true,
        inapp_enabled: true,
      };
      return [...prev, { ...base, [field]: false }];
    });
  };

  const savePrefs = async () => {
    if (!groupId) return;
    const headers = await authHeaders();
    if (!headers) return;
    setSaving(true);
    unlockAlertAudio();
    try {
      const merged = NOTIFIABLE_WIDGET_KEYS.map((key) => {
        const found = prefs.find((p) => p.widget_key === key);
        return {
          widget_key: key,
          push_enabled: found ? found.push_enabled !== false : true,
          inapp_enabled: found ? found.inapp_enabled !== false : true,
        };
      });
      const res = await fetch('/api/notifications/preferences', {
        method: 'PUT',
        headers,
        body: JSON.stringify({
          groupId,
          preferences: merged,
          alertPreferences: alertPrefs,
        }),
      });
      if (!res.ok) {
        const text = await res.text();
        alert('알림 설정 저장 실패: ' + text);
        return;
      }
      const json = await res.json().catch(() => ({}));
      setPrefs(merged);
      if (json.alertPreferences) {
        setAlertPrefs(normalizeAlertPreferences(json.alertPreferences));
      }
      window.dispatchEvent(
        new CustomEvent(NOTIFICATION_ALERT_PREFS_UPDATED_EVENT, {
          detail: normalizeAlertPreferences(json.alertPreferences ?? alertPrefs),
        }),
      );
      alert('알림 설정을 저장했습니다.');
    } finally {
      setSaving(false);
    }
  };

  if (!groupId) {
    return (
      <div className="form-field mt-2 border-t border-slate-200 pt-3">
        <p className="text-[12px] text-slate-500">
          그룹에 접속한 뒤 알림(위젯) 설정을 변경할 수 있습니다. 하쓰/진동/무음은 계정 전역입니다.
        </p>
      </div>
    );
  }

  return (
    <div className="form-field mt-2 border-t border-slate-200 pt-3">
      <label className="form-label">알림</label>
      <p className="mb-2 text-[11px] leading-snug text-slate-500">
        하쓰/진동/무음은 모든 그룹에 동일하게 적용됩니다. 위젯 on/off는 현재 그룹만 적용됩니다.
      </p>
      {loading ? (
        <p className="text-[12px] text-slate-400">불러오는 중…</p>
      ) : (
        <>
          <label className="mb-2 flex flex-col gap-1 text-[12px] text-slate-700">
            <span className="font-medium">첫 알림 (전역)</span>
            <select
              className="form-input"
              value={alertPrefs.first_mode}
              onChange={(e) =>
                setAlertPrefs((prev) => ({
                  ...prev,
                  first_mode: e.target.value as FirstAlertMode,
                }))
              }
            >
              <option value="voice">하쓰 알림음</option>
              <option value="vibrate">진동</option>
              <option value="silent">무음</option>
            </select>
          </label>
          <label className="mb-3 flex flex-col gap-1 text-[12px] text-slate-700">
            <span className="font-medium">이후 알림 (전역)</span>
            <select
              className="form-input"
              value={alertPrefs.subsequent_mode}
              onChange={(e) =>
                setAlertPrefs((prev) => ({
                  ...prev,
                  subsequent_mode: e.target.value as SubsequentAlertMode,
                }))
              }
            >
              <option value="vibrate">진동</option>
              <option value="silent">무음 (배지만)</option>
            </select>
          </label>
          <p className="mb-1.5 text-[11px] font-medium text-slate-600">위젯별 (현재 그룹)</p>
          <ul className="mb-2 max-h-40 space-y-1.5 overflow-y-auto">
            {NOTIFIABLE_WIDGET_KEYS.map((key) => {
              const pref = prefs.find((p) => p.widget_key === key) || {
                widget_key: key,
                push_enabled: true,
                inapp_enabled: true,
              };
              return (
                <li
                  key={key}
                  className="rounded-md border border-slate-100 bg-slate-50/80 px-2 py-1.5"
                >
                  <div className="mb-1 text-[11px] font-semibold text-slate-800">
                    {NOTIFIABLE_WIDGET_LABELS[key]}
                  </div>
                  <div className="flex gap-3 text-[11px] text-slate-600">
                    <label className="inline-flex cursor-pointer items-center gap-1">
                      <input
                        type="checkbox"
                        checked={pref.push_enabled}
                        onChange={() => togglePref(key, 'push_enabled')}
                      />
                      푸시
                    </label>
                    <label className="inline-flex cursor-pointer items-center gap-1">
                      <input
                        type="checkbox"
                        checked={pref.inapp_enabled}
                        onChange={() => togglePref(key, 'inapp_enabled')}
                      />
                      앱 안
                    </label>
                  </div>
                </li>
              );
            })}
          </ul>
          <button
            type="button"
            disabled={saving}
            onClick={() => void savePrefs()}
            className="w-full rounded-lg bg-slate-800 py-2 text-xs font-semibold text-white disabled:opacity-50"
          >
            {saving ? '저장 중…' : '알림 설정 저장'}
          </button>
        </>
      )}
    </div>
  );
}
