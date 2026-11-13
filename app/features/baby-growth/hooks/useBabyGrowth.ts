/**
 * useBabyGrowth — 아기 프로필 CRUD + Realtime 구독
 *
 * 패턴: useFamilyTasks.ts 와 동일한 모듈 레벨 ref 브리지 + acquireRealtimeChannel
 */

import { useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { waitForSupabaseSession } from '@/lib/supabase-session-ready';
import { acquireRealtimeChannel } from '@/lib/realtime-channel-lease';
import type { BabyProfile, BabyProfileDraft } from '../types';

// ---------------------------------------------------------------------------
// 모듈 레벨 ref 브리지 (useEffect deps 불필요한 재실행 방지)
// ---------------------------------------------------------------------------
const babyGrowthRt = {
  profile: { current: null as BabyProfile | null },
  onProfileChange: { current: ((_p: BabyProfile | null) => {}) as (p: BabyProfile | null) => void },
  reload: { current: (() => {}) as () => void },
  realtime: { groupId: '', live: false, reloadOnNextSubscribe: false },
};

interface UseBabyGrowthProps {
  currentGroupId: string | null;
  userId: string;
  onProfileChange: (profile: BabyProfile | null) => void;
}

export function useBabyGrowth({ currentGroupId, userId, onProfileChange }: UseBabyGrowthProps) {
  // ref 최신화
  babyGrowthRt.onProfileChange.current = onProfileChange;

  useEffect(() => {
    if (!currentGroupId || !userId) return;
    const gid = currentGroupId;
    let cancelled = false;

    const loadProfile = async (): Promise<void> => {
      const session = await waitForSupabaseSession(supabase);
      if (cancelled || !session?.access_token) return;

      const { data, error } = await supabase
        .from('baby_profiles')
        .select('id, group_id, created_by, name, birth_date, gender, avatar_url, country_code, notes, created_at, updated_at')
        .eq('group_id', gid)
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle();

      if (cancelled) return;
      if (error) {
        console.error('[useBabyGrowth] 프로필 로드 오류:', error);
        babyGrowthRt.onProfileChange.current(null);
        return;
      }
      babyGrowthRt.profile.current = data ?? null;
      babyGrowthRt.onProfileChange.current(data ?? null);
    };

    babyGrowthRt.reload.current = loadProfile;
    void loadProfile();

    // Realtime 구독
    const release = acquireRealtimeChannel(
      `baby_profiles:${gid}`,
      (channel) =>
        channel.on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'baby_profiles', filter: `group_id=eq.${gid}` },
          (payload: any) => {
            const publish = (next: BabyProfile | null) => {
              babyGrowthRt.profile.current = next;
              babyGrowthRt.onProfileChange.current(next);
            };
            if (payload.eventType === 'DELETE') {
              publish(null);
            } else {
              publish(payload.new as BabyProfile);
            }
          }
        ),
      (status) => {
        if (
          (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') &&
          babyGrowthRt.realtime.live
        ) {
          babyGrowthRt.realtime.reloadOnNextSubscribe = true;
        }
        if (status === 'SUBSCRIBED') {
          babyGrowthRt.realtime.live = true;
          if (babyGrowthRt.realtime.reloadOnNextSubscribe) {
            babyGrowthRt.realtime.reloadOnNextSubscribe = false;
            void babyGrowthRt.reload.current();
          }
        }
      }
    );

    return () => {
      cancelled = true;
      release();
    };
  }, [currentGroupId, userId]);

  // ---------------------------------------------------------------------------
  // CRUD
  // ---------------------------------------------------------------------------

  async function addProfile(draft: BabyProfileDraft): Promise<BabyProfile> {
    if (!currentGroupId) throw new Error('그룹 ID가 없습니다.');
    const { data, error } = await supabase
      .from('baby_profiles')
      .insert({ ...draft, group_id: currentGroupId, created_by: userId })
      .select()
      .single();
    if (error) throw error;
    return data as BabyProfile;
  }

  async function updateProfile(id: string, patch: Partial<BabyProfileDraft>): Promise<void> {
    const { error } = await supabase
      .from('baby_profiles')
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq('id', id);
    if (error) throw error;
  }

  async function deleteProfile(id: string): Promise<void> {
    const { error } = await supabase.from('baby_profiles').delete().eq('id', id);
    if (error) throw error;
  }

  return { addProfile, updateProfile, deleteProfile };
}
