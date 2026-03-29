import { NextRequest, NextResponse } from 'next/server';
import { requireAuthUser, requireGroupAdmin } from '@/lib/api-guards';
import { getGroupMembers } from '@/lib/piggy-bank';

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuthUser(request);
    if (authResult instanceof NextResponse) return authResult;
    const { user } = authResult;

    const { searchParams } = new URL(request.url);
    const groupId = searchParams.get('group_id');

    if (!groupId) {
      return NextResponse.json({ error: 'group_id가 필요합니다.' }, { status: 400 });
    }

    const adminCheck = await requireGroupAdmin(user.id, groupId);
    if (adminCheck instanceof NextResponse) return adminCheck;

    const members = await getGroupMembers(groupId);
    return NextResponse.json({ success: true, data: members });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : '멤버 목록을 불러오지 못했습니다.';
    console.error('Piggy members 오류:', error);
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
