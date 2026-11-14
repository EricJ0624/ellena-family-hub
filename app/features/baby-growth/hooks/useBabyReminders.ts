/**
 * useBabyReminders — 성장 기록·검진·접종 입력 알림 CRUD
 *
 * baby_reminders 테이블을 대상으로 한다.
 * is_dismissed=false 인 알림만 목록에 표시.
 */

import { useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { waitForSupabaseSession } from '@/lib/supabase-session-ready';
import type { BabyReminder } from '../types';

interface UseBabyRemindersProps {
  babyId: string | null;
  currentGroupId: string | null;
}

export function useBabyReminders({
  babyId,
  currentGroupId,
}: UseBabyRemindersProps) {
  const [reminders, setReminders] = useState<BabyReminder[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchReminders = useCallback(async () => {
    if (!babyId || !currentGroupId) {
      setReminders([]);
      return;
    }
    setLoading(true);
    try {
      const session = await waitForSupabaseSession(supabase);
      if (!session?.access_token) return;

      const { data, error } = await supabase
        .from('baby_reminders')
        .select('id, baby_id, group_id, reminder_type, remind_at, reference_key, is_dismissed, created_by, created_at')
        .eq('baby_id', babyId)
        .eq('group_id', currentGroupId)
        .eq('is_dismissed', false)
        .order('remind_at', { ascending: true });

      if (error) {
        console.error('[useBabyReminders] 알림 로드 오류:', error);
        return;
      }
      setReminders((data ?? []) as unknown as BabyReminder[]);
    } finally {
      setLoading(false);
    }
  }, [babyId, currentGroupId]);

  const dismissReminder = useCallback(async (id: string): Promise<void> => {
    const { error } = await supabase
      .from('baby_reminders')
      .update({ is_dismissed: true })
      .eq('id', id);
    if (error) throw error;
    setReminders((prev) => prev.filter((r) => r.id !== id));
  }, []);

  /** 다음 알림까지 D-Day (일수) — 가장 임박한 알림 기준 */
  const nextReminderDays = reminders.length > 0
    ? Math.round((new Date(reminders[0].remind_at).getTime() - Date.now()) / 86_400_000)
    : null;

  return {
    reminders,
    loading,
    nextReminderDays,
    fetchReminders,
    dismissReminder,
  };
}
