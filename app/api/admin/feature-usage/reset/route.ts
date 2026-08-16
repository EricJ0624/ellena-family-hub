import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@/lib/api-helpers';
import { requireAuthUser, requireSystemAdmin } from '@/lib/api-guards';
import { getAuditRequestMeta, writeAdminAuditLog } from '@/lib/admin-audit';

/**
 * 위젯 활동량 집계 기준점 초기화.
 * 가족 콘텐츠는 삭제하지 않고, 이후 조회는 이 시각 이후만 센다.
 */
export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuthUser(request);
    if (authResult instanceof NextResponse) return authResult;
    const { user } = authResult;
    const adminCheck = await requireSystemAdmin(user.id);
    if (adminCheck instanceof NextResponse) return adminCheck;

    const body = await request.json().catch(() => ({}));
    const note = typeof body.note === 'string' ? body.note.trim().slice(0, 200) : '';

    const supabase = getSupabaseServerClient();
    const { data, error } = await supabase
      .from('feature_usage_resets')
      .insert({
        reset_by: user.id,
        note: note || null,
      })
      .select('id, reset_at')
      .single();

    if (error) throw error;

    const meta = getAuditRequestMeta(request);
    await writeAdminAuditLog(supabase, {
      adminId: user.id,
      action: 'UPDATE',
      resourceType: 'feature_usage_reset',
      resourceId: data?.id ?? null,
      details: { reset_at: data?.reset_at ?? null },
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return NextResponse.json({ success: true, data });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : '활동량 초기화 중 오류가 발생했습니다.';
    console.error('활동량 초기화 오류:', error);
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
