import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@/lib/api-helpers';
import { requireAuthUser, requireGroupMember } from '@/lib/api-guards';
import { DB_TABLES } from '@/lib/db-table-names';
import { canWriteDiary } from '@/lib/modules/travel-planner/diary-eligibility';

const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/heic']);
const MAX_FILE_SIZE = 20 * 1024 * 1024;

function normalizeMime(raw: unknown): string {
  const value = String(raw || '').trim().toLowerCase();
  if (value === 'image/jpg' || value === 'image/heif') return 'image/jpeg';
  if (ALLOWED_MIME.has(value)) return value;
  if (value.startsWith('image/')) return 'image/jpeg';
  return 'image/jpeg';
}

function clampSize(raw: unknown): number {
  const n = typeof raw === 'number' ? raw : Number(raw);
  if (!Number.isFinite(n) || n <= 0) return 1;
  return Math.min(Math.floor(n), MAX_FILE_SIZE);
}

/** POST: attach existing family-album photos to a diary entry (no re-upload). */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const authResult = await requireAuthUser(request);
    if (authResult instanceof NextResponse) return authResult;
    const { user } = authResult;

    const { id: entryId } = await params;
    const body = await request.json().catch(() => ({}));
    const groupId = String(body.groupId || '').trim();
    const albumItemIds = Array.isArray(body.albumItemIds)
      ? body.albumItemIds.map((x: unknown) => String(x).trim()).filter(Boolean)
      : [];

    if (!groupId || !entryId) {
      return NextResponse.json({ error: 'groupId와 id가 필요합니다.' }, { status: 400 });
    }
    if (albumItemIds.length === 0) {
      return NextResponse.json({ error: '선택할 사진이 없습니다.' }, { status: 400 });
    }

    const memberCheck = await requireGroupMember(user.id, groupId);
    if (memberCheck instanceof NextResponse) return memberCheck;

    const supabase = getSupabaseServerClient();
    const { data: entry, error: entryErr } = await supabase
      .from('travel_diary_entries')
      .select('id, trip_id')
      .eq('id', entryId)
      .eq('group_id', groupId)
      .is('deleted_at', null)
      .single();

    if (entryErr || !entry) {
      return NextResponse.json({ error: '다이어리 항목을 찾을 수 없습니다.' }, { status: 404 });
    }

    const { data: tripRow } = await supabase
      .from('travel_trips')
      .select('diary_enabled')
      .eq('id', (entry as { trip_id: string }).trip_id)
      .eq('group_id', groupId)
      .single();

    if (!tripRow || !canWriteDiary(tripRow as { diary_enabled?: boolean })) {
      return NextResponse.json({ error: '다이어리 작성 권한이 없습니다.' }, { status: 403 });
    }

    const { data: albumRows, error: albumErr } = await supabase
      .from(DB_TABLES.FAMILY_ALBUM_ITEMS)
      .select('id, image_url, s3_key, mime_type, original_filename, original_file_size, file_type')
      .eq('group_id', groupId)
      .in('id', albumItemIds);

    if (albumErr) {
      return NextResponse.json({ error: '가족 앨범을 불러오지 못했습니다.' }, { status: 500 });
    }

    const photos = (albumRows ?? []).filter((row) => {
      const fileType = String((row as { file_type?: string | null }).file_type || 'photo');
      return fileType !== 'video';
    });

    const { data: existingAtt } = await supabase
      .from(DB_TABLES.ATTACHMENTS)
      .select('s3_key')
      .eq('group_id', groupId)
      .eq('entity_type', 'travel_diary_entry')
      .eq('entity_id', entryId)
      .is('deleted_at', null);

    const existingKeys = new Set(
      (existingAtt ?? []).map((row) => String((row as { s3_key: string }).s3_key)),
    );

    const toInsert = photos
      .map((row) => {
        const s3Key = String((row as { s3_key?: string | null }).s3_key || '').trim();
        const imageUrl = String((row as { image_url?: string }).image_url || '').trim();
        if (!s3Key || !imageUrl || existingKeys.has(s3Key)) return null;
        existingKeys.add(s3Key);
        return {
          group_id: groupId,
          uploader_id: user.id,
          feature_type: 'travel',
          entity_type: 'travel_diary_entry',
          entity_id: entryId,
          original_filename:
            String((row as { original_filename?: string | null }).original_filename || '').trim() ||
            'album.jpg',
          mime_type: normalizeMime((row as { mime_type?: string | null }).mime_type),
          size_bytes: clampSize((row as { original_file_size?: number | null }).original_file_size),
          s3_key: s3Key,
          image_url: imageUrl,
          thumbnail_s3_key: null,
          thumbnail_url: imageUrl,
        };
      })
      .filter((row): row is NonNullable<typeof row> => row != null);

    if (toInsert.length === 0) {
      return NextResponse.json({ success: true, data: [] });
    }

    const { data, error } = await supabase
      .from(DB_TABLES.ATTACHMENTS)
      .insert(toInsert)
      .select('*');

    if (error) {
      console.error('from-album insert:', error);
      return NextResponse.json({ error: '앨범 사진을 연결하지 못했습니다.' }, { status: 500 });
    }

    return NextResponse.json({ success: true, data: data ?? [] });
  } catch (e: unknown) {
    console.error('POST diary from-album:', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : '서버 오류' },
      { status: 500 },
    );
  }
}
