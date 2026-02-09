import { NextRequest, NextResponse } from 'next/server';
import { authenticateUser, getSupabaseServerClient } from '@/lib/api-helpers';
import { isSystemAdmin } from '@/lib/permissions';
import { getAuditRequestMeta } from '@/lib/admin-audit';

/**
 * 시스템 관리자가 그룹 대시보드(그룹 데이터)에 접근한 시점을 감사 로그에 기록
 * POST body: { group_id: string, access_request_id?: string }
 */
export async function POST(request: NextRequest) {
  try {
    const authResult = await authenticateUser(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }
    const { user } = authResult;

    const admin = await isSystemAdmin(user.id);
    if (!admin) {
      return NextResponse.json(
        { error: '시스템 관리자 권한이 필요합니다.' },
        { status: 403 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const groupId = body?.group_id;

    if (!groupId) {
      return NextResponse.json(
        { error: 'group_id가 필요합니다.' },
        { status: 400 }
      );
    }

    const { ipAddress, userAgent } = getAuditRequestMeta(request);
    const supabase = getSupabaseServerClient();

    const { error } = await supabase.from('dashboard_access_logs').insert({
      system_admin_id: user.id,
      group_id: groupId,
      access_request_id: body.access_request_id ?? null,
      ip_address: ipAddress,
      user_agent: userAgent,
    });

    if (error) {
      console.error('dashboard_access_logs 기록 오류:', error);
      return NextResponse.json(
        { error: '접근 로그 기록에 실패했습니다.' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('대시보드 접근 로그 API 오류:', error);
    return NextResponse.json(
      { error: error.message || '처리 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
