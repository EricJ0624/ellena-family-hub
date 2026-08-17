import { NextRequest, NextResponse } from 'next/server';
import { requireAuthUser, requireSystemAdmin } from '@/lib/api-guards';
import { listUserGroupsForSuspend, parseUuid } from '@/lib/admin-suspend-query';

/** 회원 정지 모달용: 가입/소유 그룹과 현재 정지 여부 */
export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuthUser(request);
    if (authResult instanceof NextResponse) return authResult;
    const adminCheck = await requireSystemAdmin(authResult.user.id);
    if (adminCheck instanceof NextResponse) return adminCheck;

    const userId = parseUuid(new URL(request.url).searchParams.get('user_id'));
    if (!userId) {
      return NextResponse.json({ error: '사용자 ID가 필요합니다.' }, { status: 400 });
    }

    const data = await listUserGroupsForSuspend(userId);
    return NextResponse.json({ success: true, data });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : '그룹 목록 조회 중 오류가 발생했습니다.';
    console.error('회원 그룹 정지 목록 조회 오류:', error);
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
