/**
 * useBabyLogs — 일일 로그 CRUD + Realtime 구독
 *
 * - 채널 토픽: baby_daily_logs:{babyId}
 * - 모듈 레벨 ref 브리지 패턴 (useFamilyTasks.ts 동일)
 */

import { useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { waitForSupabaseSession } from '@/lib/supabase-session-ready';
import { acquireRealtimeChannel } from '@/lib/realtime-channel-lease';
import type { BabyDailyLog, BabyDailyLogDraft, BabyRecentStatus } from '../types';

const LOG_SELECT_COLS = [
  'id', 'baby_id', 'group_id', 'log_type', 'logged_at',
  'feeding_type', 'feeding_amount_ml', 'feeding_duration_min',
  'breast_left_min', 'breast_right_min', 'solid_ingredients', 'allergy_reaction',
  'sleep_end_at',
  'diaper_type', 'diaper_color', 'diaper_consistency',
  'temperature_celsius',
  'medication_name', 'medication_dose_mg',
  'activity_type', 'activity_duration_min', 'pump_amount_ml',
  'notes', 'created_by', 'created_at',
  'sleep_start_recorded', 'sleep_end_recorded', 'symptom_tags',
].join(', ');

// ---------------------------------------------------------------------------
// 모듈 레벨 ref 브리지
// ---------------------------------------------------------------------------
const logsRt = {
  logs: { current: [] as BabyDailyLog[] },
  onLogsChange: { current: ((_l: BabyDailyLog[]) => {}) as (logs: BabyDailyLog[]) => void },
  reload: { current: (() => {}) as () => void },
  realtime: { babyId: '', live: false, reloadOnNextSubscribe: false },
};

interface UseBabyLogsProps {
  babyId: string | null;
  currentGroupId: string | null;
  userId: string;
  /** 최근 로그 변경 시 콜백 */
  onLogsChange: (logs: BabyDailyLog[]) => void;
  /** 로드할 최대 건수 (기본: 최근 50건) */
  limit?: number;
}

export function useBabyLogs({
  babyId,
  currentGroupId,
  userId,
  onLogsChange,
  limit = 50,
}: UseBabyLogsProps) {
  logsRt.onLogsChange.current = onLogsChange;

  useEffect(() => {
    if (!babyId || !currentGroupId || !userId) return;
    const bid = babyId;
    let cancelled = false;

    const loadLogs = async (): Promise<void> => {
      const session = await waitForSupabaseSession(supabase);
      if (cancelled || !session?.access_token) return;

      const { data, error } = await supabase
        .from('baby_daily_logs')
        .select(LOG_SELECT_COLS)
        .eq('baby_id', bid)
        .order('logged_at', { ascending: false })
        .limit(limit);

      if (cancelled) return;
      if (error) {
        console.error('[useBabyLogs] 로그 로드 오류:', error);
        return;
      }
      const rows = (data ?? []) as unknown as BabyDailyLog[];
      logsRt.logs.current = rows;
      logsRt.onLogsChange.current(rows);
    };

    logsRt.reload.current = loadLogs;
    void loadLogs();

    const release = acquireRealtimeChannel(
      `baby_daily_logs:${bid}`,
      (channel) =>
        channel.on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'baby_daily_logs', filter: `baby_id=eq.${bid}` },
          (payload: any) => {
            const publish = (next: BabyDailyLog[]) => {
              logsRt.logs.current = next;
              logsRt.onLogsChange.current(next);
            };
            const current = logsRt.logs.current;
            if (payload.eventType === 'INSERT') {
              const row = payload.new as BabyDailyLog;
              const without = current.filter((l) => l.id !== row.id);
              publish([row, ...without].slice(0, limit));
            } else if (payload.eventType === 'UPDATE') {
              publish(current.map((l) => (l.id === payload.new.id ? (payload.new as BabyDailyLog) : l)));
            } else if (payload.eventType === 'DELETE') {
              publish(current.filter((l) => l.id !== payload.old.id));
            }
          }
        ),
      (status) => {
        if (
          (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') &&
          logsRt.realtime.live
        ) {
          logsRt.realtime.reloadOnNextSubscribe = true;
        }
        if (status === 'SUBSCRIBED') {
          logsRt.realtime.live = true;
          if (logsRt.realtime.reloadOnNextSubscribe) {
            logsRt.realtime.reloadOnNextSubscribe = false;
            void logsRt.reload.current();
          }
        }
      }
    );

    return () => {
      cancelled = true;
      release();
    };
  }, [babyId, currentGroupId, userId, limit]);

  // ---------------------------------------------------------------------------
  // CRUD
  // ---------------------------------------------------------------------------

  async function addLog(draft: BabyDailyLogDraft): Promise<BabyDailyLog> {
    if (!currentGroupId || !babyId) throw new Error('babyId 또는 groupId 없음');
    const { data, error } = await supabase
      .from('baby_daily_logs')
      .insert({ ...draft, group_id: currentGroupId, baby_id: babyId, created_by: userId })
      .select()
      .single();
    if (error) throw error;
    const row = data as BabyDailyLog;
    const without = logsRt.logs.current.filter((l) => l.id !== row.id);
    const next = [row, ...without].slice(0, limit);
    logsRt.logs.current = next;
    logsRt.onLogsChange.current(next);
    return row;
  }

  async function updateLog(id: string, patch: Partial<BabyDailyLogDraft>): Promise<void> {
    const { data, error } = await supabase
      .from('baby_daily_logs')
      .update(patch)
      .eq('id', id)
      .select(LOG_SELECT_COLS)
      .single();
    if (error) throw error;
    const row = data as unknown as BabyDailyLog;
    const next = logsRt.logs.current.map((l) => (l.id === id ? row : l));
    logsRt.logs.current = next;
    logsRt.onLogsChange.current(next);
  }

  return { addLog, updateLog };
}

// ---------------------------------------------------------------------------
// 유틸: 최근 상태 요약 계산
// ---------------------------------------------------------------------------
export function calcRecentStatus(logs: BabyDailyLog[]): BabyRecentStatus {
  const findLast = (type: BabyDailyLog['log_type']) =>
    logs.find((l) => l.log_type === type) ?? null;
  return {
    lastFeeding: findLast('feeding'),
    lastSleep: findLast('sleep'),
    lastDiaper: findLast('diaper'),
    lastTemperature: findLast('temperature'),
  };
}
