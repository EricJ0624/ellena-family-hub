/**
 * useBabyGrowthRecords — 성장 측정 + 마일스톤 + 예방접종 CRUD
 *
 * Realtime 구독 없이 단순 fetch (변경 빈도가 낮음)
 * 모달/뷰 오픈 시 호출, 결과는 props 콜백으로 전달
 */

import { useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { waitForSupabaseSession } from '@/lib/supabase-session-ready';
import type {
  BabyGrowthRecord,
  BabyGrowthRecordDraft,
  BabyMilestone,
  BabyMilestoneDraft,
  BabyVaccination,
  BabyVaccinationDraft,
  BabyCheckup,
  BabyCheckupDraft,
} from '../types';

interface UseBabyGrowthRecordsProps {
  babyId: string | null;
  currentGroupId: string | null;
  userId: string;
}

export function useBabyGrowthRecords({
  babyId,
  currentGroupId,
  userId,
}: UseBabyGrowthRecordsProps) {
  // ---------------------------------------------------------------------------
  // Growth Records
  // ---------------------------------------------------------------------------

  const fetchGrowthRecords = useCallback(async (): Promise<BabyGrowthRecord[]> => {
    if (!babyId) return [];
    const session = await waitForSupabaseSession(supabase);
    if (!session?.access_token) return [];

    const { data, error } = await supabase
      .from('baby_growth_records')
      .select('id, baby_id, group_id, measured_at, weight_kg, height_cm, head_cm, notes, created_by, created_at')
      .eq('baby_id', babyId)
      .order('measured_at', { ascending: true });

    if (error) {
      console.error('[useBabyGrowthRecords] 성장기록 로드 오류:', error);
      return [];
    }
    return (data ?? []) as BabyGrowthRecord[];
  }, [babyId]);

  const addGrowthRecord = useCallback(async (draft: BabyGrowthRecordDraft): Promise<BabyGrowthRecord> => {
    if (!currentGroupId || !babyId) throw new Error('babyId 또는 groupId 없음');
    const { data, error } = await supabase
      .from('baby_growth_records')
      .insert({ ...draft, baby_id: babyId, group_id: currentGroupId, created_by: userId })
      .select()
      .single();
    if (error) throw error;
    return data as BabyGrowthRecord;
  }, [babyId, currentGroupId, userId]);

  // ---------------------------------------------------------------------------
  // Milestones
  // ---------------------------------------------------------------------------

  const fetchMilestones = useCallback(async (): Promise<BabyMilestone[]> => {
    if (!babyId) return [];
    const session = await waitForSupabaseSession(supabase);
    if (!session?.access_token) return [];

    const { data, error } = await supabase
      .from('baby_milestones')
      .select('id, baby_id, group_id, category, milestone_key, achieved_at, notes, created_by, created_at')
      .eq('baby_id', babyId)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('[useBabyGrowthRecords] 마일스톤 로드 오류:', error);
      return [];
    }
    return (data ?? []) as BabyMilestone[];
  }, [babyId]);

  const upsertMilestone = useCallback(async (draft: BabyMilestoneDraft): Promise<BabyMilestone> => {
    if (!currentGroupId || !babyId) throw new Error('babyId 또는 groupId 없음');
    const { data, error } = await supabase
      .from('baby_milestones')
      .upsert(
        { ...draft, baby_id: babyId, group_id: currentGroupId, created_by: userId },
        { onConflict: 'baby_id,milestone_key' }
      )
      .select()
      .single();
    if (error) throw error;
    return data as BabyMilestone;
  }, [babyId, currentGroupId, userId]);

  // ---------------------------------------------------------------------------
  // Vaccinations
  // ---------------------------------------------------------------------------

  const fetchVaccinations = useCallback(async (): Promise<BabyVaccination[]> => {
    if (!babyId) return [];
    const session = await waitForSupabaseSession(supabase);
    if (!session?.access_token) return [];

    const { data, error } = await supabase
      .from('baby_vaccinations')
      .select('id, baby_id, group_id, vaccine_key, scheduled_at, administered_at, facility_name, product_name, custom_label, notes, created_by, created_at')
      .eq('baby_id', babyId)
      .order('scheduled_at', { ascending: true });

    if (error) {
      console.error('[useBabyGrowthRecords] 예방접종 로드 오류:', error);
      return [];
    }
    return (data ?? []) as BabyVaccination[];
  }, [babyId]);

  const upsertVaccination = useCallback(async (draft: BabyVaccinationDraft): Promise<BabyVaccination> => {
    if (!currentGroupId || !babyId) throw new Error('babyId 또는 groupId 없음');
    const { data, error } = await supabase
      .from('baby_vaccinations')
      .upsert(
        { ...draft, baby_id: babyId, group_id: currentGroupId, created_by: userId },
        { onConflict: 'baby_id,vaccine_key' }
      )
      .select()
      .single();
    if (error) throw error;
    return data as BabyVaccination;
  }, [babyId, currentGroupId, userId]);

  // ---------------------------------------------------------------------------
  // Checkups
  // ---------------------------------------------------------------------------

  const fetchCheckups = useCallback(async (): Promise<BabyCheckup[]> => {
    if (!babyId) return [];
    const session = await waitForSupabaseSession(supabase);
    if (!session?.access_token) return [];

    const { data, error } = await supabase
      .from('baby_checkups')
      .select('id, baby_id, group_id, checkup_type, checkup_date, weight_kg, height_cm, head_cm, vision_ok, hearing_ok, dev_notes, doctor_notes, created_by, created_at')
      .eq('baby_id', babyId)
      .order('checkup_date', { ascending: true });

    if (error) {
      console.error('[useBabyGrowthRecords] 검진 로드 오류:', error);
      return [];
    }
    return (data ?? []) as unknown as BabyCheckup[];
  }, [babyId]);

  const addCheckup = useCallback(async (draft: BabyCheckupDraft): Promise<BabyCheckup> => {
    if (!currentGroupId || !babyId) throw new Error('babyId 또는 groupId 없음');
    const { data, error } = await supabase
      .from('baby_checkups')
      .insert({ ...draft, baby_id: babyId, group_id: currentGroupId, created_by: userId })
      .select()
      .single();
    if (error) throw error;
    return data as unknown as BabyCheckup;
  }, [babyId, currentGroupId, userId]);

  const updateCheckup = useCallback(async (id: string, patch: Partial<BabyCheckupDraft>): Promise<BabyCheckup> => {
    const { data, error } = await supabase
      .from('baby_checkups')
      .update(patch)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data as unknown as BabyCheckup;
  }, []);

  const deleteCheckup = useCallback(async (id: string): Promise<void> => {
    const { error } = await supabase.from('baby_checkups').delete().eq('id', id);
    if (error) throw error;
  }, []);

  return {
    fetchGrowthRecords,
    addGrowthRecord,
    fetchMilestones,
    upsertMilestone,
    fetchVaccinations,
    upsertVaccination,
    fetchCheckups,
    addCheckup,
    updateCheckup,
    deleteCheckup,
  };
}
