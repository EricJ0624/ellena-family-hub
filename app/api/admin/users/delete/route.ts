import { NextRequest, NextResponse } from 'next/server';
import { authenticateUser, getSupabaseServerClient } from '@/lib/api-helpers';
import { isSystemAdmin } from '@/lib/permissions';
import { writeAdminAuditLog, getAuditRequestMeta } from '@/lib/admin-audit';

export async function DELETE(request: NextRequest) {
  try {
    // 인증 확인
    const authResult = await authenticateUser(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }
    const { user } = authResult;

    // 시스템 관리자 확인
    const admin = await isSystemAdmin(user.id);
    if (!admin) {
      return NextResponse.json(
        { error: '시스템 관리자 권한이 필요합니다.' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { userId } = body;

    if (!userId) {
      return NextResponse.json(
        { error: '사용자 ID가 필요합니다.' },
        { status: 400 }
      );
    }

    // 자신은 삭제 불가
    if (userId === user.id) {
      return NextResponse.json(
        { error: '자신의 계정은 삭제할 수 없습니다.' },
        { status: 400 }
      );
    }

    const supabase = getSupabaseServerClient();

    // 사용자 삭제 (auth.users에서 삭제하면 CASCADE로 관련 데이터도 삭제됨)
    const { error: deleteError } = await supabase.auth.admin.deleteUser(userId);

    if (deleteError) {
      throw deleteError;
    }

    const { ipAddress, userAgent } = getAuditRequestMeta(request);
    await writeAdminAuditLog(supabase, {
      adminId: user.id,
      action: 'DELETE',
      resourceType: 'user',
      resourceId: userId,
      targetUserId: userId,
      ipAddress,
      userAgent,
    });

    return NextResponse.json({
      success: true,
      message: '사용자가 삭제되었습니다.',
    });
  } catch (error: any) {
    console.error('사용자 삭제 오류:', error);
    return NextResponse.json(
      { error: error.message || '사용자 삭제 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

