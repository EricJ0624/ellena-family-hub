import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@/lib/api-helpers';
import { requireAuthUser, requireGroupMember } from '@/lib/api-guards';
import { DB_TABLES } from '@/lib/db-table-names';
import { deleteS3IfUnreferenced } from '@/lib/storage-object-refs';
import {
  FAMILY_LOG_CARD_COLUMNS,
  normalizeFamilyLogCard,
  parseFamilyLogCardPatch,
} from '@/app/features/family-log/card-record';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const authResult = await requireAuthUser(request);
    if (authResult instanceof NextResponse) return authResult;
    const { user } = authResult;

    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const groupId = typeof body.groupId === 'string' ? body.groupId.trim() : '';
    if (!groupId || !id) {
      return NextResponse.json({ error: 'groupId는 필수입니다.' }, { status: 400 });
    }
    const parsed = parseFamilyLogCardPatch(body as Record<string, unknown>);
    if (parsed.error || !parsed.patch) {
      return NextResponse.json({ error: parsed.error || '저장할 내용이 없습니다.' }, { status: 400 });
    }
    const memberCheck = await requireGroupMember(user.id, groupId);
    if (memberCheck instanceof NextResponse) return memberCheck;

    const supabase = getSupabaseServerClient();
    const { data, error } = await supabase
      .from('family_log_cards')
      .update(parsed.patch)
      .eq('id', id)
      .eq('group_id', groupId)
      .select(FAMILY_LOG_CARD_COLUMNS)
      .single();
    if (error) {
      console.error('PATCH family-log card:', error);
      return NextResponse.json({ error: '기록을 저장하지 못했습니다.' }, { status: 500 });
    }
    return NextResponse.json({
      success: true,
      data: normalizeFamilyLogCard(data as Record<string, unknown>),
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : '서버 오류';
    console.error('PATCH family-log card:', e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const authResult = await requireAuthUser(request);
    if (authResult instanceof NextResponse) return authResult;
    const { user } = authResult;

    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const groupId = typeof body.groupId === 'string' ? body.groupId.trim() : '';
    if (!groupId || !id) {
      return NextResponse.json({ error: 'groupId는 필수입니다.' }, { status: 400 });
    }
    const memberCheck = await requireGroupMember(user.id, groupId);
    if (memberCheck instanceof NextResponse) return memberCheck;

    const supabase = getSupabaseServerClient();
    const { data: existing, error: existingError } = await supabase
      .from('family_log_cards')
      .select('id')
      .eq('id', id)
      .eq('group_id', groupId)
      .maybeSingle();
    if (existingError) {
      console.error('DELETE family-log card lookup:', existingError);
      return NextResponse.json({ error: '기록을 삭제하지 못했습니다.' }, { status: 500 });
    }
    if (!existing) {
      return NextResponse.json({ error: '기록을 찾을 수 없습니다.' }, { status: 404 });
    }

    const { error: cardError } = await supabase
      .from('family_log_cards')
      .delete()
      .eq('id', id)
      .eq('group_id', groupId);
    if (cardError) {
      console.error('DELETE family-log card:', cardError);
      return NextResponse.json({ error: '기록을 삭제하지 못했습니다.' }, { status: 500 });
    }

    const { data: files } = await supabase
      .from(DB_TABLES.ATTACHMENTS)
      .select('id, s3_key, thumbnail_s3_key')
      .eq('group_id', groupId)
      .eq('entity_id', id)
      .in('entity_type', ['family_log_card', 'family_log_receipt'])
      .is('deleted_at', null);
    for (const file of files ?? []) {
      const attachmentId = String(file.id);
      if (file.s3_key) {
        await deleteS3IfUnreferenced(supabase, groupId, String(file.s3_key), {
          ignoreAttachmentId: attachmentId,
        });
      }
      if (file.thumbnail_s3_key) {
        await deleteS3IfUnreferenced(supabase, groupId, String(file.thumbnail_s3_key), {
          ignoreAttachmentId: attachmentId,
        });
      }
    }
    const fileIds = (files ?? []).map((file) => String(file.id));
    if (fileIds.length > 0) {
      await supabase
        .from(DB_TABLES.ATTACHMENTS)
        .update({ deleted_at: new Date().toISOString() })
        .eq('group_id', groupId)
        .in('id', fileIds);
    }

    return NextResponse.json({ success: true });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : '서버 오류';
    console.error('DELETE family-log card:', e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
