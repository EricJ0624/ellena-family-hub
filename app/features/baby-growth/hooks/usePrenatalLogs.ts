/**
 * prenatal_logs CRUD
 */

import { useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import type { PrenatalLog, PrenatalLogDraft } from '../types';

const PRENATAL_SELECT =
  'id, baby_id, group_id, log_type, logged_at, weight_kg, systolic, diastolic, symptom_tags, notes, fetal_size_label, checkup_at, hospital_name, next_checkup_at, kick_count, kick_duration_min, fundal_height_cm, fetal_weight_est_g, medication_name, lab_name, lab_result_text, created_by, created_at';

interface UsePrenatalLogsProps {
  babyId: string | null;
  currentGroupId: string | null;
  userId: string;
}

export function usePrenatalLogs({ babyId, currentGroupId, userId }: UsePrenatalLogsProps) {
  const fetchLogs = useCallback(async (limit = 90): Promise<PrenatalLog[]> => {
    if (!babyId || !currentGroupId) return [];
    const { data, error } = await supabase
      .from('prenatal_logs')
      .select(PRENATAL_SELECT)
      .eq('baby_id', babyId)
      .eq('group_id', currentGroupId)
      .order('logged_at', { ascending: false })
      .limit(limit);
    if (error) {
      console.error('[usePrenatalLogs] fetch:', error);
      return [];
    }
    return (data ?? []) as PrenatalLog[];
  }, [babyId, currentGroupId]);

  const addLog = useCallback(
    async (draft: PrenatalLogDraft): Promise<PrenatalLog | null> => {
      if (!currentGroupId) return null;
      const { data, error } = await supabase
        .from('prenatal_logs')
        .insert({
          ...draft,
          group_id: currentGroupId,
          created_by: userId,
          logged_at: draft.logged_at ?? new Date().toISOString(),
        })
        .select(PRENATAL_SELECT)
        .single();
      if (error) {
        console.error('[usePrenatalLogs] insert:', error);
        throw error;
      }
      return data as PrenatalLog;
    },
    [currentGroupId, userId],
  );

  return { fetchLogs, addLog };
}
