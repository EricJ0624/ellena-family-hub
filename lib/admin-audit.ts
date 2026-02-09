import type { SupabaseClient } from '@supabase/supabase-js';

export type AdminAuditLogParams = {
  adminId: string;
  action: string;
  resourceType: string;
  resourceId?: string | null;
  groupId?: string | null;
  targetUserId?: string | null;
  details?: Record<string, unknown> | null;
  ipAddress?: string | null;
  userAgent?: string | null;
};

/**
 * 시스템 관리자 작업 감사 로그 기록 (admin_audit_log 테이블)
 * API 라우트에서 성공 처리 후 호출. Service Role 클라이언트 사용.
 */
export async function writeAdminAuditLog(
  supabase: SupabaseClient,
  params: AdminAuditLogParams
): Promise<void> {
  try {
    await supabase.from('admin_audit_log').insert({
      admin_id: params.adminId,
      action: params.action,
      resource_type: params.resourceType,
      resource_id: params.resourceId ?? null,
      group_id: params.groupId ?? null,
      target_user_id: params.targetUserId ?? null,
      details: params.details ?? null,
      ip_address: params.ipAddress ?? null,
      user_agent: params.userAgent ?? null,
    });
  } catch (err) {
    console.error('admin_audit_log 기록 실패:', err);
    // 로그 실패가 메인 비즈니스 로직을 실패시키지 않도록 에러는 삼킴
  }
}

/**
 * NextRequest에서 클라이언트 IP와 User-Agent 추출
 */
export function getAuditRequestMeta(request: Request): {
  ipAddress: string | null;
  userAgent: string | null;
} {
  const headers = request.headers;
  const ip =
    headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    headers.get('x-real-ip') ??
    null;
  const userAgent = headers.get('user-agent') ?? null;
  return { ipAddress: ip, userAgent };
}
