import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClientForAccessToken } from '@/lib/api-helpers';
import { requireAuthUser } from '@/lib/api-guards';

type RouteContext = { params: Promise<{ id: string }> };

/**
 * 이메일 초대 거절
 */
export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const authResult = await requireAuthUser(request);
    if (authResult instanceof NextResponse) return authResult;

    const { id } = await context.params;
    const inviteId = id?.trim();
    if (!inviteId) {
      return NextResponse.json({ error: '초대 ID가 필요합니다.' }, { status: 400 });
    }

    const authHeader = request.headers.get('authorization');
    const token = authHeader?.replace(/^Bearer\s+/i, '').trim();
    if (!token) {
      return NextResponse.json({ error: '인증 토큰이 필요합니다.' }, { status: 401 });
    }

    const supabase = getSupabaseClientForAccessToken(token);
    const { error } = await supabase.rpc('reject_group_email_invite', {
      p_invite_id: inviteId,
    });

    if (error) {
      console.error('reject_group_email_invite error:', error);
      return NextResponse.json({ error: '초대 거절에 실패했습니다.' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('group email invite reject error:', err);
    return NextResponse.json({ error: '초대 거절 중 오류가 발생했습니다.' }, { status: 500 });
  }
}
