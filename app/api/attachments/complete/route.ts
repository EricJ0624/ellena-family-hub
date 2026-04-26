import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@/lib/api-helpers';
import { requireAuthUser, requireGroupMember } from '@/lib/api-guards';
import { DB_TABLES } from '@/lib/db-table-names';

const ALLOWED_ENTITY_TYPES = new Set([
  'chat_message',
  'piggy_wallet_tx',
  'piggy_bank_tx',
  'travel_trip',
  'travel_expense',
]);

const ALLOWED_FEATURE_TYPES = new Set(['chat', 'piggy', 'travel']);

const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
]);

function normalizeClientMime(m: string): string {
  const s = String(m || '').trim().toLowerCase();
  if (s === 'image/jpg') return 'image/jpeg';
  return s;
}

const MAX_FILE_SIZE = 20 * 1024 * 1024;

export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuthUser(request);
    if (authResult instanceof NextResponse) return authResult;
    const { user } = authResult;

    const body = await request.json();
    const {
      groupId,
      featureType,
      entityType,
      entityId,
      originalFilename,
      mimeType,
      sizeBytes,
      s3Key,
      imageUrl,
      thumbnailS3Key,
      thumbnailUrl,
    } = body ?? {};

    if (!groupId || !featureType || !entityType || !entityId || !originalFilename || !mimeType || !sizeBytes || !s3Key || !imageUrl) {
      return NextResponse.json({ error: '필수 파라미터가 누락되었습니다.' }, { status: 400 });
    }
    if (!ALLOWED_FEATURE_TYPES.has(String(featureType))) {
      return NextResponse.json({ error: '지원하지 않는 featureType 입니다.' }, { status: 400 });
    }
    if (!ALLOWED_ENTITY_TYPES.has(String(entityType))) {
      return NextResponse.json({ error: '지원하지 않는 entityType 입니다.' }, { status: 400 });
    }
    const mimeNorm = normalizeClientMime(String(mimeType || ''));
    if (!ALLOWED_MIME_TYPES.has(mimeNorm)) {
      return NextResponse.json({ error: '지원하지 않는 파일 형식입니다.' }, { status: 400 });
    }
    if (typeof sizeBytes !== 'number' || sizeBytes <= 0 || sizeBytes > MAX_FILE_SIZE) {
      return NextResponse.json({ error: '파일 크기는 1B~20MB여야 합니다.' }, { status: 400 });
    }

    const memberCheck = await requireGroupMember(user.id, String(groupId));
    if (memberCheck instanceof NextResponse) return memberCheck;

    const supabase = getSupabaseServerClient();
    const { data, error } = await supabase
      .from(DB_TABLES.ATTACHMENTS)
      .insert({
        group_id: String(groupId),
        uploader_id: user.id,
        feature_type: String(featureType),
        entity_type: String(entityType),
        entity_id: String(entityId),
        original_filename: String(originalFilename),
        mime_type: mimeNorm,
        size_bytes: sizeBytes,
        s3_key: String(s3Key),
        image_url: String(imageUrl),
        thumbnail_s3_key: thumbnailS3Key ? String(thumbnailS3Key) : null,
        thumbnail_url: thumbnailUrl ? String(thumbnailUrl) : null,
      })
      .select('*')
      .single();

    if (error) {
      return NextResponse.json({ error: '첨부 저장에 실패했습니다.' }, { status: 500 });
    }

    return NextResponse.json({ success: true, data });
  } catch (error) {
    const message = error instanceof Error ? error.message : '첨부 저장 중 오류가 발생했습니다.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
