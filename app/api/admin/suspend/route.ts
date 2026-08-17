import { NextRequest, NextResponse } from 'next/server';
import { requireAuthUser, requireSystemAdmin } from '@/lib/api-guards';
import {
  isSuspendAction,
  isSuspendScope,
  normalizeSuspendMessage,
} from '@/lib/admin-suspend';
import { applySuspendAction, loadSuspendSummary, parseUuid } from '@/lib/admin-suspend-query';
import { isAdminStepUpError, requireAdminStepUpPassword } from '@/lib/admin-stepup';

/** 활성 정지 요약 (목록 배지용) */
export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuthUser(request);
    if (authResult instanceof NextResponse) return authResult;
    const adminCheck = await requireSystemAdmin(authResult.user.id);
    if (adminCheck instanceof NextResponse) return adminCheck;

    const data = await loadSuspendSummary();
    return NextResponse.json({ success: true, data });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : '정지 현황 조회 중 오류가 발생했습니다.';
    console.error('정지 현황 조회 오류:', error);
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

/** 정지 또는 해제 + 필수 메시지를 문의 실에 기록 */
export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuthUser(request);
    if (authResult instanceof NextResponse) return authResult;
    const { user } = authResult;
    const adminCheck = await requireSystemAdmin(user.id);
    if (adminCheck instanceof NextResponse) return adminCheck;

    const body = await request.json().catch(() => ({}));
    const actionRaw = typeof body.action === 'string' ? body.action : '';
    const scopeRaw = typeof body.scope === 'string' ? body.scope : '';
    if (!isSuspendAction(actionRaw) || !isSuspendScope(scopeRaw)) {
      return NextResponse.json({ error: '잘못된 요청입니다.' }, { status: 400 });
    }

    const message = normalizeSuspendMessage(body.message);
    if (!message) {
      return NextResponse.json({ error: '메시지는 1~500자로 입력해야 합니다.' }, { status: 400 });
    }

    await requireAdminStepUpPassword({
      userId: user.id,
      email: user.email,
      password: body.password,
    });

    const userId = parseUuid(typeof body.userId === 'string' ? body.userId : null);
    const groupIds: string[] = [];
    if (Array.isArray(body.groupIds)) {
      for (const raw of body.groupIds) {
        const parsed = parseUuid(typeof raw === 'string' ? raw : null);
        if (parsed) groupIds.push(parsed);
      }
    }

    const result = await applySuspendAction({
      action: actionRaw,
      scope: scopeRaw,
      adminId: user.id,
      userId: scopeRaw === 'user_in_group' ? userId : null,
      groupIds,
      message,
      request,
    });

    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    if (isAdminStepUpError(error)) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    const errorMessage = error instanceof Error ? error.message : '정지 처리 중 오류가 발생했습니다.';
    console.error('정지 처리 오류:', error);
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
