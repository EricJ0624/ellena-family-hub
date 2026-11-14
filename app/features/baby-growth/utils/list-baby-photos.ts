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

type AttachmentRow = {
  id: string;
  image_url: string | null;
  thumbnail_url: string | null;
  mime_type: string | null;
  feature_type: string | null;
  created_at: string;
  taken_at: string | null;
};

export const BABY_PHOTOS_CHANGED = 'sfh:baby-photos-changed';

export function notifyBabyPhotosChanged(babyId: string) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(BABY_PHOTOS_CHANGED, { detail: { babyId } }));
}

/** baby_growth 첨부 사진 목록. 표시 주소는 첨부 API가 발급한 짧은 주소를 쓴다. */
export async function listBabyPhotos(opts: ListBabyPhotosOptions): Promise<BabyPhoto[]> {
  const session = await waitForSupabaseSession(supabase);
  if (!session?.access_token) return [];

  const params = new URLSearchParams({
    groupId: opts.groupId,
    entityType: 'baby_profile',
    entityId: opts.babyId,
  });
  const response = await fetch(`/api/attachments?${params}`, {
    headers: { Authorization: `Bearer ${session.access_token}` },
  });
  if (!response.ok) return [];
  const json = (await response.json().catch(() => ({}))) as { data?: AttachmentRow[] };
  const rows = Array.isArray(json.data) ? json.data : [];

  const todayStart = opts.todayOnly ? new Date() : null;
  if (todayStart) todayStart.setHours(0, 0, 0, 0);
  const todayEnd = opts.todayOnly ? new Date() : null;
  if (todayEnd) todayEnd.setHours(23, 59, 59, 999);

  const photos = rows
    .filter((row) => {
      if (row.feature_type && row.feature_type !== 'baby_growth') return false;
      if (!row.mime_type?.startsWith('image/')) return false;
      if (!row.image_url || row.image_url === 'expired') return false;
      if (!todayStart || !todayEnd) return true;
      const uploadedAt = new Date(row.created_at).getTime();
      return uploadedAt >= todayStart.getTime() && uploadedAt <= todayEnd.getTime();
    })
    .map((row) => {
      const shotAt = row.taken_at && !Number.isNaN(new Date(row.taken_at).getTime()) ? row.taken_at : null;
      return {
        id: row.id,
        imageUrl: row.image_url ?? '',
        thumbnailUrl: row.thumbnail_url?.startsWith('/api/media/file') ? row.thumbnail_url : null,
        takenAt: shotAt,
        monthAge: shotAt && opts.birthDate ? monthAgeAt(opts.birthDate, shotAt) : null,
      } satisfies BabyPhoto;
    })
    .reverse();

  return photos.slice(0, opts.limit ?? 200);
}
