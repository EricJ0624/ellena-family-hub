import { NextRequest, NextResponse } from 'next/server';
import { authenticateUser, getSupabaseServerClient } from '@/lib/api-helpers';

/**
 * 인증된 사용자의 대기 중인 초대 코드 조회 후 삭제.
 * auth callback에서 이메일 인증 직후 호출하여 /onboarding?invite=... 리다이렉트에 사용.
 */
export async function GET(request: NextRequest) {
  try {
    const authResult = await authenticateUser(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }
    const { user } = authResult;
    const email = user?.email?.trim()?.toLowerCase();
    if (!email) {
      return NextResponse.json({ invite_code: null });
    }

    const supabase = getSupabaseServerClient();
    const { data: row, error: selectError } = await supabase
      .from('pending_invite_signups')
      .select('invite_code')
      .eq('email', email)
      .maybeSingle();

    if (selectError || !row?.invite_code) {
      return NextResponse.json({ invite_code: null });
    }

    await supabase.from('pending_invite_signups').delete().eq('email', email);
    return NextResponse.json({ invite_code: row.invite_code });
  } catch (err) {
    console.error('my-pending invite error:', err);
    return NextResponse.json({ invite_code: null });
  }
}
