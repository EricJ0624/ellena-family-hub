import { NextRequest, NextResponse } from 'next/server';
import { requireAuthUser } from '@/lib/api-guards';
import { isSystemAdmin } from '@/lib/permissions';

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuthUser(request);
    if (authResult instanceof NextResponse) return authResult;
    const { user } = authResult;

    const admin = await isSystemAdmin(user.id);

    return NextResponse.json({
      isAdmin: admin,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : '관리자 확인 중 오류가 발생했습니다.';
    console.error('관리자 확인 오류:', error);
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}

