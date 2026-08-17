import { NextRequest, NextResponse } from 'next/server';
import { requireAuthUser, requireSystemAdmin } from '@/lib/api-guards';
import { isSystemAdmin } from '@/lib/permissions';
import { insertModerationMessage } from '@/lib/moderation-query';
import { parseUuid } from '@/lib/admin-suspend-query';

/** 정지 안내 문의 실에 답장. 회원 또는 시스템 관리자. */
export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuthUser(request);
    if (authResult instanceof NextResponse) return authResult;
    const { user } = authResult;

    const body = await request.json().catch(() => ({}));
    const threadId = parseUuid(typeof body.threadId === 'string' ? body.threadId : null);
    if (!threadId) {
      return NextResponse.json({ error: '문의 실이 필요합니다.' }, { status: 400 });
    }

    const authorKind = (await isSystemAdmin(user.id)) ? 'system_admin' : 'member';
    if (authorKind === 'system_admin') {
      const adminCheck = await requireSystemAdmin(user.id);
      if (adminCheck instanceof NextResponse) return adminCheck;
    }

    const data = await insertModerationMessage({
      threadId,
      authorId: user.id,
      authorKind,
      body: body.message,
    });
    return NextResponse.json({ success: true, data });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : '답장 저장 중 오류가 발생했습니다.';
    const status = errorMessage.includes('답장할 수 없습니다')
      ? 403
      : errorMessage.includes('1~500자')
        ? 400
        : 500;
    console.error('정지 문의 답장 오류:', error);
    return NextResponse.json({ error: errorMessage }, { status });
  }
}
