import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@/lib/api-helpers';
import { requireAuthUser, requireSystemAdmin } from '@/lib/api-guards';

/**
 * 멤버↔그룹관리자 문의 전체 목록 (시스템 관리자)
 */
export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuthUser(request);
    if (authResult instanceof NextResponse) return authResult;
    const { user } = authResult;

    const adminCheck = await requireSystemAdmin(user.id);
    if (adminCheck instanceof NextResponse) return adminCheck;

    const supabase = getSupabaseServerClient();

    const { data: tickets, error } = await supabase
      .from('member_support_tickets')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('멤버 문의 전체 조회 오류:', error);
      return NextResponse.json(
        { error: '문의 조회에 실패했습니다.' },
        { status: 500 }
      );
    }

    const groupIds = [
      ...new Set((tickets || []).map((t: { group_id: string }) => t.group_id).filter(Boolean)),
    ];
    const groupMap = new Map<string, string>();
    if (groupIds.length > 0) {
      const { data: groups, error: gErr } = await supabase
        .from('groups')
        .select('id, name')
        .in('id', groupIds);
      if (!gErr && groups) {
        groups.forEach((g: { id: string; name: string }) => groupMap.set(g.id, g.name));
      }
    }

    const data = (tickets || []).map((t: Record<string, unknown>) => ({
      ...t,
      groups: {
        id: t.group_id as string,
        name: groupMap.get(t.group_id as string) || String(t.group_id),
      },
    }));

    return NextResponse.json({ success: true, data });
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : '문의 조회 중 오류가 발생했습니다.';
    console.error('멤버 문의 전체 조회 오류:', error);
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
