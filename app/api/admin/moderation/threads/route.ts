import { NextRequest, NextResponse } from 'next/server';
import { requireAuthUser, requireSystemAdmin } from '@/lib/api-guards';
import { listModerationThreadsForAdmin, softDeleteModerationThread } from '@/lib/moderation-query';
import { parseUuid } from '@/lib/admin-suspend-query';
import { getSupabaseServerClient } from '@/lib/api-helpers';
import { writeAdminAuditLog, getAuditRequestMeta } from '@/lib/admin-audit';

/** 시스템 관리자: 정지 안내 문의 실 목록 */
export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuthUser(request);
    if (authResult instanceof NextResponse) return authResult;
    const adminCheck = await requireSystemAdmin(authResult.user.id);
    if (adminCheck instanceof NextResponse) return adminCheck;

    const data = await listModerationThreadsForAdmin();
    return NextResponse.json({ success: true, data });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : '정지 문의 조회 중 오류가 발생했습니다.';
    console.error('정지 문의 목록 조회 오류:', error);
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

/** 시스템 관리자: 문의 실 전체 삭제 (정지 해제 후에도 가능) */
export async function DELETE(request: NextRequest) {
  try {
    const authResult = await requireAuthUser(request);
    if (authResult instanceof NextResponse) return authResult;
    const adminCheck = await requireSystemAdmin(authResult.user.id);
    if (adminCheck instanceof NextResponse) return adminCheck;

    const threadId = parseUuid(new URL(request.url).searchParams.get('threadId'));
    if (!threadId) {
      return NextResponse.json({ error: '문의 실이 필요합니다.' }, { status: 400 });
    }

    await softDeleteModerationThread({ threadId, adminId: authResult.user.id });
    const supabase = getSupabaseServerClient();
    const meta = getAuditRequestMeta(request);
    await writeAdminAuditLog(supabase, {
      adminId: authResult.user.id,
      action: 'DELETE',
      resourceType: 'moderation_thread',
      resourceId: threadId,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : '문의 실 삭제 중 오류가 발생했습니다.';
    console.error('정지 문의 실 삭제 오류:', error);
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
