import { NextRequest, NextResponse } from 'next/server';
import { requireAuthUser } from '@/lib/api-guards';
import { enrollUserInAppAsService } from '@/lib/app-enrollment';
import { CURRENT_APP_ID } from '@/lib/apps';
import { getSupabaseServerClient } from '@/lib/api-helpers';

export const dynamic = 'force-dynamic';

/**
 * 이메일 인증(type=signup) 직후 현재 앱 enrollment 보장.
 * 교차 앱 동의 UI 대신, 이 앱에서 신규 가입·인증을 마친 경우만 호출한다.
 */
export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuthUser(request);
    if (authResult instanceof NextResponse) return authResult;
    const { user } = authResult;

    const admin = getSupabaseServerClient();
    const { data: userData, error } = await admin.auth.admin.getUserById(user.id);
    if (error || !userData?.user) {
      return NextResponse.json({ error: 'user_not_found' }, { status: 404 });
    }
    if (!userData.user.email_confirmed_at) {
      return NextResponse.json({ error: 'email_not_confirmed' }, { status: 403 });
    }

    try {
      const data = await enrollUserInAppAsService({
        userId: user.id,
        appId: CURRENT_APP_ID,
        source: 'signup',
      });
      return NextResponse.json({ success: true, data, appId: CURRENT_APP_ID });
    } catch (enrollErr) {
      const msg = enrollErr instanceof Error ? enrollErr.message : '';
      if (msg.includes('signups not allowed')) {
        return NextResponse.json(
          { error: 'signups_not_allowed', reason: 'disabled' },
          { status: 403 },
        );
      }
      throw enrollErr;
    }
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'enrollment_failed';
    console.error('ensure-signup-enrollment 오류:', error);
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
