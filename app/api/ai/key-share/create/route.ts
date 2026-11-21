/**
 * POST /api/ai/key-share/create
 * 오너가 AI API 키를 3분·1회용 토큰으로 등록 (서버에 영구 저장 없음)
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuthUser, requireGroupMember } from '@/lib/api-guards';
import { getSupabaseServerClient } from '@/lib/api-helpers';
import {
  AI_KEY_SHARE_TTL_MS,
  buildShareQrPayload,
  createShareToken,
  encryptApiKeyForShare,
  isShareProvider,
} from '@/lib/ai-key-share-server';

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

  if (body.consent !== true) {
    return NextResponse.json(
      { error: '공유 안내 동의가 필요합니다.' },
      { status: 400 },
    );
  }

  const groupId = typeof body.groupId === 'string' ? body.groupId.trim() : '';
  if (!groupId) {
    return NextResponse.json({ error: 'groupId가 필요합니다.' }, { status: 400 });
  }

  const memberCheck = await requireGroupMember(user.id, groupId);
  if (memberCheck instanceof NextResponse) return memberCheck;

  if (!isShareProvider(body.provider)) {
    return NextResponse.json({ error: '지원하지 않는 provider입니다.' }, { status: 400 });
  }
  const provider = body.provider;

  const apiKey = typeof body.apiKey === 'string' ? body.apiKey.trim() : '';
  if (!apiKey || apiKey.length < 8) {
    return NextResponse.json({ error: '유효한 API 키가 필요합니다.' }, { status: 400 });
  }

  const baseUrl =
    provider === 'custom' && typeof body.baseUrl === 'string'
      ? body.baseUrl.trim().replace(/\/+$/, '')
      : null;
  const model =
    provider === 'custom' && typeof body.model === 'string' ? body.model.trim() || null : null;

  if (provider === 'custom' && !baseUrl) {
    return NextResponse.json(
      { error: '기타(OpenAI 호환)는 Base URL이 필요합니다.' },
      { status: 400 },
    );
  }

  const token = createShareToken();
  const expiresAt = new Date(Date.now() + AI_KEY_SHARE_TTL_MS).toISOString();
  let ciphertext: string;
  try {
    ciphertext = encryptApiKeyForShare(apiKey);
  } catch {
    return NextResponse.json({ error: '키 암호화에 실패했습니다.' }, { status: 500 });
  }

  const supabase = getSupabaseServerClient();
  // 동일 오너·그룹의 미사용 토큰 정리 (새 QR 하나만 유지)
  await supabase
    .from('ai_key_share_tokens')
    .delete()
    .eq('owner_user_id', user.id)
    .eq('group_id', groupId);

  const { error } = await supabase.from('ai_key_share_tokens').insert({
    token,
    group_id: groupId,
    owner_user_id: user.id,
    provider,
    api_key_ciphertext: ciphertext,
    base_url: baseUrl,
    model,
    expires_at: expiresAt,
  });

  if (error) {
    console.error('[ai-key-share/create] insert failed');
    return NextResponse.json({ error: '공유 토큰 생성에 실패했습니다.' }, { status: 500 });
  }

  return NextResponse.json({
    token,
    qrPayload: buildShareQrPayload(token),
    expiresAt,
    ttlMs: AI_KEY_SHARE_TTL_MS,
    provider,
  });
}
