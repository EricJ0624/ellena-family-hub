/**
 * useBabyGrowth — 아기 프로필 CRUD + Realtime 구독
 * 그룹당 최대 3명. 목록은 created_at 오름차순.
 */

import { useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { waitForSupabaseSession } from '@/lib/supabase-session-ready';
import { acquireRealtimeChannel } from '@/lib/realtime-channel-lease';
import type { BabyProfile, BabyProfileDraft } from '../types';

export const BABY_PROFILE_MAX = 3;

const PROFILE_SELECT =
  'id, group_id, created_by, name, birth_date, gender, avatar_url, country_code, notes, usual_bedtime, usual_wake_time, created_at, updated_at';

function profilesSignature(list: BabyProfile[]): string {
  if (list.length === 0) return 'empty';
  return list.map((p) => `${p.id}:${p.updated_at}:${p.name}`).join('|');
}

const babyGrowthRt = {
  profiles: { current: [] as BabyProfile[] },
  onProfilesChange: {
    current: ((_p: BabyProfile[]) => {}) as (p: BabyProfile[]) => void,
  },
  reload: { current: (() => {}) as () => void },
  realtime: { groupId: '', live: false, reloadOnNextSubscribe: false },
  lastSig: { current: '' },
};

function publishProfiles(next: BabyProfile[]) {
  const sorted = [...next].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
  );
  const capped = sorted.slice(0, BABY_PROFILE_MAX);
  const sig = profilesSignature(capped);
  if (sig === babyGrowthRt.lastSig.current) return;
  babyGrowthRt.lastSig.current = sig;
  babyGrowthRt.profiles.current = capped;
  babyGrowthRt.onProfilesChange.current(capped);
}

interface UseBabyGrowthProps {
  currentGroupId: string | null;
  userId: string;
  onProfilesChange: (profiles: BabyProfile[]) => void;
}

export function useBabyGrowth({ currentGroupId, userId, onProfilesChange }: UseBabyGrowthProps) {
  babyGrowthRt.onProfilesChange.current = onProfilesChange;

  useEffect(() => {
    if (!currentGroupId || !userId) return;
    const gid = currentGroupId;
    let cancelled = false;

    const loadProfiles = async (): Promise<void> => {
      const session = await waitForSupabaseSession(supabase);
      if (cancelled || !session?.access_token) return;

      const { data, error } = await supabase
        .from('baby_profiles')
        .select(PROFILE_SELECT)
        .eq('group_id', gid)
        .order('created_at', { ascending: true })
        .limit(BABY_PROFILE_MAX);

      if (cancelled) return;
      if (error) {
        console.error('[useBabyGrowth] 프로필 로드 오류:', error);
        babyGrowthRt.lastSig.current = '';
        babyGrowthRt.profiles.current = [];
        babyGrowthRt.onProfilesChange.current([]);
        return;
      }
      publishProfiles((data ?? []) as BabyProfile[]);
    };

    babyGrowthRt.reload.current = loadProfiles;
    void loadProfiles();

    const release = acquireRealtimeChannel(
      `baby_profiles:${gid}`,
      (channel) =>
        channel.on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'baby_profiles', filter: `group_id=eq.${gid}` },
          () => {
            void babyGrowthRt.reload.current();
          },
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
      },
    );

    return () => {
      cancelled = true;
      release();
    };
  }, [currentGroupId, userId]);

  async function addProfile(draft: BabyProfileDraft): Promise<BabyProfile> {
    if (!currentGroupId) throw new Error('그룹 ID가 없습니다.');
    if (babyGrowthRt.profiles.current.length >= BABY_PROFILE_MAX) {
      throw new Error('BABY_PROFILE_LIMIT');
    }
    const { data, error } = await supabase
      .from('baby_profiles')
      .insert({ ...draft, group_id: currentGroupId, created_by: userId })
      .select(PROFILE_SELECT)
      .single();
    if (error) throw error;
    const row = data as BabyProfile;
    publishProfiles([...babyGrowthRt.profiles.current, row]);
    return row;
  }

  async function updateProfile(id: string, patch: Partial<BabyProfileDraft>): Promise<void> {
    const { data, error } = await supabase
      .from('baby_profiles')
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select(PROFILE_SELECT)
      .single();
    if (error) throw error;
    const row = data as BabyProfile;
    publishProfiles(
      babyGrowthRt.profiles.current.map((p) => (p.id === id ? row : p)),
    );
  }

  async function deleteProfile(id: string): Promise<void> {
    const { error } = await supabase.from('baby_profiles').delete().eq('id', id);
    if (error) throw error;
    publishProfiles(babyGrowthRt.profiles.current.filter((p) => p.id !== id));
  }

  return { addProfile, updateProfile, deleteProfile };
}
