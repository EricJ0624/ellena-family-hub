/**
 * POST /api/ai/key-share/cancel
 * 오너가 미사용 공유 토큰을 취소(삭제)
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuthUser, requireGroupMember } from '@/lib/api-guards';
import { getSupabaseServerClient } from '@/lib/api-helpers';
import { resolveShareTokenFromBody } from '@/lib/ai-key-share-server';

export async function POST(request: NextRequest) {
  const authResult = await requireAuthUser(request);
  if (authResult instanceof NextResponse) return authResult;
  const { user } = authResult;

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: '요청 본문이 올바른 JSON이 아닙니다.' }, { status: 400 });
  }

  const groupId = typeof body.groupId === 'string' ? body.groupId.trim() : '';
  if (!groupId) {
    return NextResponse.json({ error: 'groupId가 필요합니다.' }, { status: 400 });
  }

  const memberCheck = await requireGroupMember(user.id, groupId);
  if (memberCheck instanceof NextResponse) return memberCheck;

  const token = resolveShareTokenFromBody(body);
  const supabase = getSupabaseServerClient();

  if (token) {
    const { error } = await supabase
      .from('ai_key_share_tokens')
      .delete()
      .eq('token', token)
      .eq('owner_user_id', user.id)
      .eq('group_id', groupId);
    if (error) {
      console.error('[ai-key-share/cancel] delete failed');
      return NextResponse.json({ error: '공유 취소에 실패했습니다.' }, { status: 500 });
    }
  } else {
    const { error } = await supabase
      .from('ai_key_share_tokens')
      .delete()
      .eq('owner_user_id', user.id)
      .eq('group_id', groupId);
    if (error) {
      console.error('[ai-key-share/cancel] delete-all failed');
      return NextResponse.json({ error: '공유 취소에 실패했습니다.' }, { status: 500 });
    }
  }

  return NextResponse.json({ ok: true });
}
