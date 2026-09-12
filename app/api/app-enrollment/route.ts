import { NextRequest, NextResponse } from 'next/server';
import { requireAuthUser } from '@/lib/api-guards';
import { CURRENT_APP_ID } from '@/lib/apps';
import { loadSignupAvailability } from '@/lib/signup-settings-query';
import { enrollUserInAppAsService } from '@/lib/app-enrollment';

export const dynamic = 'force-dynamic';

/**
 * 현재 앱 가입 동의(enrollment).
 * body: { acceptedTerms: true }
 */
export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuthUser(request);
    if (authResult instanceof NextResponse) return authResult;
    const { user } = authResult;

    const body = await request.json().catch(() => ({}));
    if (body.acceptedTerms !== true) {
      return NextResponse.json(
        { error: '약관 및 개인정보 처리방침에 동의해 주세요.' },
        { status: 400 },
      );
    }

    const availability = await loadSignupAvailability(CURRENT_APP_ID);
    if (!availability.allowed) {
      return NextResponse.json(
        {
          error:
            availability.reason === 'cap_reached'
              ? '이 앱의 가입 한도에 도달했습니다.'
              : '이 앱의 신규 가입이 중단되었습니다.',
          reason: availability.reason,
        },
        { status: 403 },
      );
    }

    try {
      const data = await enrollUserInAppAsService({
        userId: user.id,
        appId: CURRENT_APP_ID,
        source: 'cross_app_consent',
      });
      return NextResponse.json({
        success: true,
        data,
        appId: CURRENT_APP_ID,
      });
    } catch (enrollErr) {
      const msg = enrollErr instanceof Error ? enrollErr.message : '';
      if (msg.includes('signups not allowed')) {
        return NextResponse.json(
          { error: '이 앱에 가입할 수 없습니다.', reason: 'disabled' },
          { status: 403 },
        );
      }
      throw enrollErr;
    }
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : '가입 동의 처리 중 오류가 발생했습니다.';
    console.error('app-enrollment 오류:', error);
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
