/**
 * POST /api/ai/key-share/redeem
 * 같은 그룹 멤버가 1회만 키를 수령 → 서버 레코드 즉시 삭제
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuthUser, requireGroupMember } from '@/lib/api-guards';
import { getSupabaseServerClient } from '@/lib/api-helpers';
import {
  decryptApiKeyFromShare,
  resolveShareTokenFromBody,
} from '@/lib/ai-key-share-server';
import type { AiUserProvider } from '@/lib/ai-user-key';

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
  if (!token) {
    return NextResponse.json({ error: '유효하지 않은 QR/토큰입니다.' }, { status: 400 });
  }

  const supabase = getSupabaseServerClient();
  const { data: row, error: fetchError } = await supabase
    .from('ai_key_share_tokens')
    .select(
      'token, group_id, owner_user_id, provider, api_key_ciphertext, base_url, model, expires_at',
    )
    .eq('token', token)
    .maybeSingle();

  if (fetchError || !row) {
    return NextResponse.json(
      { error: '만료되었거나 이미 사용된 QR입니다.' },
      { status: 410 },
    );
  }

  if (new Date(row.expires_at).getTime() <= Date.now()) {
    await supabase.from('ai_key_share_tokens').delete().eq('token', token);
    return NextResponse.json({ error: 'QR이 만료되었습니다. 다시 생성해 주세요.' }, { status: 410 });
  }

  if (row.group_id !== groupId) {
    return NextResponse.json(
      { error: '같은 가족 그룹에서만 등록할 수 있습니다.' },
      { status: 403 },
    );
  }

  if (row.owner_user_id === user.id) {
    return NextResponse.json(
      { error: '본인이 만든 QR은 다른 가족 구성원이 스캔해야 합니다.' },
      { status: 400 },
    );
  }

  let plainKey: string;
  try {
    plainKey = decryptApiKeyFromShare(row.api_key_ciphertext);
  } catch {
    await supabase.from('ai_key_share_tokens').delete().eq('token', token);
    return NextResponse.json({ error: '키 복호화에 실패했습니다.' }, { status: 500 });
  }

  // 1회용: 삭제에 성공한 요청만 키 반환 (동시 redeem 레이스 방지)
  const { data: deleted, error: deleteError } = await supabase
    .from('ai_key_share_tokens')
    .delete()
    .eq('token', token)
    .gt('expires_at', new Date().toISOString())
    .select('token');

  if (deleteError || !deleted?.length) {
    return NextResponse.json(
      { error: '만료되었거나 이미 사용된 QR입니다.' },
      { status: 410 },
    );
  }

  const provider = row.provider as AiUserProvider;
  return NextResponse.json({
    provider,
    apiKey: plainKey,
    baseUrl: row.base_url ?? undefined,
    model: row.model ?? undefined,
  });
}
