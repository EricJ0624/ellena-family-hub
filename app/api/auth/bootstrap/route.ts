import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@/lib/api-helpers';
import { computeAuthBootstrap } from '@/lib/auth-bootstrap-server';

export const dynamic = 'force-dynamic';

/**
 * 로그인 critical path용. Bearer JWT로 사용자 검증 후 그룹·정지·관리자 판정을 한 번에 반환.
 * RLS·정지 정책은 변경하지 않으며, 서버 service role로 동일 데이터를 조회한다.
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
  }

  const token = authHeader.slice('Bearer '.length).trim();
  if (!token) {
    return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
  }

  try {
    const supabase = getSupabaseServerClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return NextResponse.json(
        { error: '인증에 실패했습니다.' },
        { status: 401, headers: { 'Cache-Control': 'no-store' } },
      );
    }

    const payload = await computeAuthBootstrap({
      id: user.id,
      email: user.email,
      email_confirmed_at: user.email_confirmed_at,
    });

    return NextResponse.json(payload, {
      headers: { 'Cache-Control': 'private, no-store' },
    });
  } catch (error) {
    console.error('auth bootstrap 오류:', error);
    return NextResponse.json(
      { error: '부트스트랩 처리 중 오류가 발생했습니다.' },
      { status: 500, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}
