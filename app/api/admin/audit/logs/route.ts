import { NextRequest, NextResponse } from 'next/server';
import { authenticateUser, getSupabaseServerClient } from '@/lib/api-helpers';
import { isSystemAdmin } from '@/lib/permissions';

/**
 * 감사 로그 조회 (시스템 관리자 전용)
 * GET ?from=ISO date &to=ISO date &admin_id= &group_id= &resource_type= &page=1 &limit=50
 */
export async function GET(request: NextRequest) {
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

    const { searchParams } = new URL(request.url);
    const from = searchParams.get('from'); // ISO date
    const to = searchParams.get('to');
    const adminId = searchParams.get('admin_id');
    const groupId = searchParams.get('group_id');
    const resourceType = searchParams.get('resource_type');
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '50', 10)));
    const offset = (page - 1) * limit;

    const supabase = getSupabaseServerClient();
    let query = supabase
      .from('admin_audit_log')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (from) {
      query = query.gte('created_at', from);
    }
    if (to) {
      // to 날짜 끝까지 포함 (해당일 23:59:59.999)
      const toEnd = to.includes('T') ? to : `${to}T23:59:59.999Z`;
      query = query.lte('created_at', toEnd);
    }
    if (adminId) {
      query = query.eq('admin_id', adminId);
    }
    if (groupId) {
      query = query.eq('group_id', groupId);
    }
    if (resourceType) {
      query = query.eq('resource_type', resourceType);
    }

    const { data, error, count } = await query;

    if (error) {
      console.error('감사 로그 조회 오류:', error);
      return NextResponse.json(
        { error: '감사 로그 조회에 실패했습니다.' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: data ?? [],
      total: count ?? 0,
      page,
      limit,
    });
  } catch (error: any) {
    console.error('감사 로그 API 오류:', error);
    return NextResponse.json(
      { error: error.message || '처리 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
