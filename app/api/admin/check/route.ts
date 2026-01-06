import { NextRequest, NextResponse } from 'next/server';
import { authenticateUser, getSupabaseServerClient } from '@/lib/api-helpers';
import { isSystemAdmin } from '@/lib/permissions';

export async function GET(request: NextRequest) {
  try {
    // 인증 확인
    const authResult = await authenticateUser(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }
    const { user } = authResult;

    // 시스템 관리자 확인
    const admin = await isSystemAdmin(user.id);

    return NextResponse.json({
      isAdmin: admin,
    });
  } catch (error: any) {
    console.error('관리자 확인 오류:', error);
    return NextResponse.json(
      { error: error.message || '관리자 확인 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

