import { NextRequest, NextResponse } from 'next/server';
import { deleteFromS3, getSupabaseServerClient } from '@/lib/api-helpers';
import { requireAuthUser, requireGroupMember } from '@/lib/api-guards';

const ALLOWED_ENTITY_TYPES = new Set([
  'chat_message',
  'piggy_wallet_tx',
  'piggy_bank_tx',
  'travel_trip',
  'travel_expense',
]);

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuthUser(request);
    if (authResult instanceof NextResponse) return authResult;
    const { user } = authResult;

    const groupId = request.nextUrl.searchParams.get('groupId');
    const entityType = request.nextUrl.searchParams.get('entityType');
    const entityId = request.nextUrl.searchParams.get('entityId');
    if (!groupId || !entityType || !entityId) {
      return NextResponse.json({ error: 'groupId, entityType, entityId는 필수입니다.' }, { status: 400 });
    }
    if (!ALLOWED_ENTITY_TYPES.has(entityType)) {
      return NextResponse.json({ error: '지원하지 않는 entityType 입니다.' }, { status: 400 });
    }

    const memberCheck = await requireGroupMember(user.id, groupId);
    if (memberCheck instanceof NextResponse) return memberCheck;

    const supabase = getSupabaseServerClient();
    const { data, error } = await supabase
      .from('feature_attachments')
      .select('*')
      .eq('group_id', groupId)
      .eq('entity_type', entityType)
      .eq('entity_id', entityId)
      .is('deleted_at', null)
      .order('created_at', { ascending: true });

    if (error) return NextResponse.json({ error: '첨부 조회에 실패했습니다.' }, { status: 500 });
    return NextResponse.json({ success: true, data: data ?? [] });
  } catch (error) {
    const message = error instanceof Error ? error.message : '첨부 조회 중 오류가 발생했습니다.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuthUser(request);
    if (authResult instanceof NextResponse) return authResult;
    const { user } = authResult;

    const body = await request.json();
    const { groupId, entityType, entityIds } = body ?? {};
    if (!groupId || !entityType || !Array.isArray(entityIds)) {
      return NextResponse.json({ error: 'groupId, entityType, entityIds는 필수입니다.' }, { status: 400 });
    }
    if (!ALLOWED_ENTITY_TYPES.has(String(entityType))) {
      return NextResponse.json({ error: '지원하지 않는 entityType 입니다.' }, { status: 400 });
    }
    const ids = entityIds.map((id: unknown) => String(id)).filter(Boolean);
    if (ids.length === 0) return NextResponse.json({ success: true, data: [] });

    const memberCheck = await requireGroupMember(user.id, String(groupId));
    if (memberCheck instanceof NextResponse) return memberCheck;

    const supabase = getSupabaseServerClient();
    const { data, error } = await supabase
      .from('feature_attachments')
      .select('*')
      .eq('group_id', String(groupId))
      .eq('entity_type', String(entityType))
      .in('entity_id', ids)
      .is('deleted_at', null)
      .order('created_at', { ascending: true });

    if (error) return NextResponse.json({ error: '첨부 조회에 실패했습니다.' }, { status: 500 });
    return NextResponse.json({ success: true, data: data ?? [] });
  } catch (error) {
    const message = error instanceof Error ? error.message : '첨부 일괄 조회 중 오류가 발생했습니다.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const authResult = await requireAuthUser(request);
    if (authResult instanceof NextResponse) return authResult;
    const { user } = authResult;

    const body = await request.json();
    const { groupId, attachmentId } = body ?? {};
    if (!groupId || !attachmentId) {
      return NextResponse.json({ error: 'groupId, attachmentId는 필수입니다.' }, { status: 400 });
    }

    const memberCheck = await requireGroupMember(user.id, String(groupId));
    if (memberCheck instanceof NextResponse) return memberCheck;
    const { role, isOwner } = memberCheck;

    const supabase = getSupabaseServerClient();
    const { data: row, error: fetchError } = await supabase
      .from('feature_attachments')
      .select('id, group_id, uploader_id, s3_key, thumbnail_s3_key')
      .eq('id', String(attachmentId))
      .eq('group_id', String(groupId))
      .is('deleted_at', null)
      .maybeSingle();

    if (fetchError || !row) {
      return NextResponse.json({ error: '첨부를 찾을 수 없습니다.' }, { status: 404 });
    }

    const canDelete = row.uploader_id === user.id || role === 'ADMIN' || isOwner;
    if (!canDelete) {
      return NextResponse.json({ error: '첨부를 삭제할 권한이 없습니다.' }, { status: 403 });
    }

    if (row.s3_key) await deleteFromS3(row.s3_key);
    if (row.thumbnail_s3_key) await deleteFromS3(row.thumbnail_s3_key);

    const { error: delError } = await supabase
      .from('feature_attachments')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', String(attachmentId))
      .eq('group_id', String(groupId));

    if (delError) return NextResponse.json({ error: '첨부 삭제에 실패했습니다.' }, { status: 500 });

    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : '첨부 삭제 중 오류가 발생했습니다.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
