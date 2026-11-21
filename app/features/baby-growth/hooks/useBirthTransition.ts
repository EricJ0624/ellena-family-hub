/**
 * 「출산했어요」→ baby_birth_events insert + baby_profiles write-through
 */

import { useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import type { BabyBirthEventDraft, BabyBloodType, BabyProfile } from '../types';
import { estimateGestationalWeeksAtBirth } from '../utils/prenatal';

const PROFILE_SELECT =
  'id, group_id, created_by, name, birth_date, due_date, birth_time, birth_place, fetal_name, birth_weight_kg, birth_height_cm, birth_head_cm, gestational_weeks, blood_type, birth_source, birth_event_id, gender, country_code, notes, usual_bedtime, usual_wake_time, created_at, updated_at';

const EVENT_SELECT =
  'id, baby_id, group_id, delivered_at, legal_name, birth_weight_kg, birth_height_cm, birth_head_cm, birth_place, blood_type, gestational_weeks, created_by, created_at';

export interface BirthTransitionInput {
  legalName: string;
  deliveredAt: string; // ISO datetime
  birthWeightKg: number;
  birthHeightCm?: number | null;
  birthHeadCm?: number | null;
  birthPlace?: string | null;
  bloodType?: BabyBloodType | null;
  gestationalWeeks?: number | null;
}

interface UseBirthTransitionProps {
  profile: BabyProfile;
  currentGroupId: string | null;
  userId: string;
  onProfileUpdated: (profile: BabyProfile) => void;
}

export function useBirthTransition({
  profile,
  currentGroupId,
  userId,
  onProfileUpdated,
}: UseBirthTransitionProps) {
  const completeBirth = useCallback(
    async (input: BirthTransitionInput): Promise<BabyProfile> => {
      if (!currentGroupId) throw new Error('그룹 ID가 없습니다.');
      if (!profile.id) throw new Error('아기 프로필이 없습니다.');

      const delivered = new Date(input.deliveredAt);
      if (!Number.isFinite(delivered.getTime())) throw new Error('출생일시가 올바르지 않습니다.');

      // datetime-local → ISO(UTC) 변환 후 slice(0,10) 하면 KST 등에서 날짜가 하루 밀릴 수 있음
      // birth_date / birth_time 은 로컬 캘린더 기준으로 저장
      const birthDate = `${delivered.getFullYear()}-${String(delivered.getMonth() + 1).padStart(2, '0')}-${String(delivered.getDate()).padStart(2, '0')}`;
      const birthTime = `${String(delivered.getHours()).padStart(2, '0')}:${String(delivered.getMinutes()).padStart(2, '0')}:00`;
      const gw =
        input.gestationalWeeks ??
        estimateGestationalWeeksAtBirth(profile.due_date, birthDate);

      const eventDraft: BabyBirthEventDraft = {
        baby_id: profile.id,
        group_id: currentGroupId,
        delivered_at: delivered.toISOString(),
        legal_name: input.legalName.trim(),
        birth_weight_kg: input.birthWeightKg,
        birth_height_cm: input.birthHeightCm ?? null,
        birth_head_cm: input.birthHeadCm ?? null,
        birth_place: input.birthPlace?.trim() || null,
        blood_type: input.bloodType ?? null,
        gestational_weeks: gw,
      };

      const { data: eventRow, error: eventErr } = await supabase
        .from('baby_birth_events')
        .insert({ ...eventDraft, created_by: userId })
        .select(EVENT_SELECT)
        .single();
      if (eventErr) throw eventErr;

      const { data: updated, error: updErr } = await supabase
        .from('baby_profiles')
        .update({
          name: input.legalName.trim(),
          // fetal_name 은 유지(컬럼 미포함) — 태명 영구 보존
          birth_date: birthDate,
          birth_time: birthTime,
          birth_weight_kg: input.birthWeightKg,
          birth_height_cm: input.birthHeightCm ?? null,
          birth_head_cm: input.birthHeadCm ?? null,
          birth_place: input.birthPlace?.trim() || null,
          blood_type: input.bloodType ?? null,
          gestational_weeks: gw,
          birth_source: 'birth_event',
          birth_event_id: (eventRow as { id: string }).id,
          updated_at: new Date().toISOString(),
        })
        .eq('id', profile.id)
        .select(PROFILE_SELECT)
        .single();
      if (updErr) throw updErr;

      // 선택: 성장 측정 첫 포인트
      if (input.birthWeightKg != null || input.birthHeightCm != null) {
        await supabase.from('baby_growth_records').insert({
          baby_id: profile.id,
          group_id: currentGroupId,
          measured_at: birthDate,
          weight_kg: input.birthWeightKg ?? null,
          height_cm: input.birthHeightCm ?? null,
          head_cm: input.birthHeadCm ?? null,
          created_by: userId,
        });
      }

      const next = updated as BabyProfile;
      onProfileUpdated(next);
      return next;
    },
    [currentGroupId, onProfileUpdated, profile.due_date, profile.id, userId],
  );

  return { completeBirth };
}
