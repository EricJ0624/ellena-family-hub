import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@/lib/api-helpers';
import { requireAuthUser, requireGroupMember } from '@/lib/api-guards';
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
