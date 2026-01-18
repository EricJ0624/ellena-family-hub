import { NextRequest, NextResponse } from 'next/server';
import { authenticateUser } from '@/lib/api-helpers';
import { checkPermission } from '@/lib/permissions';
import { getGroupMembers } from '@/lib/piggy-bank';

export async function GET(request: NextRequest) {
  try {
    const authResult = await authenticateUser(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }
    const { user } = authResult;

    const { searchParams } = new URL(request.url);
    const groupId = searchParams.get('group_id');

    if (!groupId) {
      return NextResponse.json({ error: 'group_id가 필요합니다.' }, { status: 400 });
    }

    const permissionResult = await checkPermission(user.id, groupId, 'ADMIN', user.id);
    if (!permissionResult.success) {
      return NextResponse.json({ error: '관리자 권한이 필요합니다.' }, { status: 403 });
    }

    const members = await getGroupMembers(groupId);
    return NextResponse.json({ success: true, data: members });
  } catch (error: any) {
    console.error('Piggy members 오류:', error);
    return NextResponse.json(
      { error: error.message || '멤버 목록을 불러오지 못했습니다.' },
      { status: 500 }
    );
  }
}
