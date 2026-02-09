import { NextRequest, NextResponse } from 'next/server';
import { authenticateUser } from '@/lib/api-helpers';
import { checkPermission } from '@/lib/permissions';
import { ensurePiggyAccountForUser } from '@/lib/piggy-bank';

/** 관리자 전용: 아이별 저금통 추가(생성). 이미 있으면 기존 반환. */
export async function POST(request: NextRequest) {
  try {
    const authResult = await authenticateUser(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }
    const { user } = authResult;

    const body = await request.json();
    const { groupId, childId } = body;

    if (!groupId || !childId) {
      return NextResponse.json({ error: 'groupId와 childId가 필요합니다.' }, { status: 400 });
    }

    const permissionResult = await checkPermission(user.id, groupId, 'ADMIN', user.id);
    if (!permissionResult.success) {
      return NextResponse.json({ error: '관리자 권한이 필요합니다.' }, { status: 403 });
    }

    const account = await ensurePiggyAccountForUser(groupId, childId);

    return NextResponse.json({
      success: true,
      data: account,
    });
  } catch (error: any) {
    console.error('Piggy accounts create 오류:', error);
    return NextResponse.json(
      { error: error.message || '저금통 추가에 실패했습니다.' },
      { status: 500 }
    );
  }
}
