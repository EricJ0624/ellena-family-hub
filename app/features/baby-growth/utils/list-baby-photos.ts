import { supabase } from '@/lib/supabase';
import { waitForSupabaseSession } from '@/lib/supabase-session-ready';
import type { BabyPhoto } from '../types';

export type ListBabyPhotosOptions = {
  groupId: string;
  babyId: string;
  birthDate?: string | null;
  /** 오늘만 조회 */
  todayOnly?: boolean;
  limit?: number;
};

function monthAgeAt(birthDate: string, takenAt: string): number {
  const birth = new Date(birthDate);
  const taken = new Date(takenAt);
  let months = (taken.getFullYear() - birth.getFullYear()) * 12;
  months += taken.getMonth() - birth.getMonth();
  if (taken.getDate() < birth.getDate()) months -= 1;
  return Math.max(0, months);
}

/** baby_growth 첨부 사진 목록 (삭제분·타 아기 제외) */
export async function listBabyPhotos(opts: ListBabyPhotosOptions): Promise<BabyPhoto[]> {
  const session = await waitForSupabaseSession(supabase);
  if (!session?.access_token) return [];

  let q = supabase
    .from('attachments')
    .select('id, image_url, thumbnail_url, created_at')
    .eq('group_id', opts.groupId)
    .eq('feature_type', 'baby_growth')
    .eq('entity_id', opts.babyId)
    .is('deleted_at', null)
    .like('mime_type', 'image/%')
    .order('created_at', { ascending: false })
    .limit(opts.limit ?? 200);

  if (opts.todayOnly) {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);
    q = q.gte('created_at', todayStart.toISOString()).lte('created_at', todayEnd.toISOString());
  }

  const { data, error } = await q;
  if (error || !data) return [];

  return data.map((row: {
    id: string;
    image_url: string | null;
    thumbnail_url: string | null;
    created_at: string;
  }) => {
    const takenAt = row.created_at;
    return {
      id: row.id,
      imageUrl: row.image_url ?? row.thumbnail_url ?? '',
      thumbnailUrl: row.thumbnail_url ?? null,
      takenAt,
      monthAge: opts.birthDate ? monthAgeAt(opts.birthDate, takenAt) : null,
    } satisfies BabyPhoto;
  });
}
