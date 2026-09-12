import { getSupabaseServerClient } from '@/lib/api-helpers';
import { CURRENT_APP_ID, type AppId } from '@/lib/apps';

export type EnrollmentSource = 'signup' | 'cross_app_consent' | 'backfill';

export type EnrollResult = {
  ok: boolean;
  alreadyEnrolled: boolean;
  appId: string;
  userId: string;
  source?: string;
};

function parseEnrollPayload(raw: unknown): EnrollResult | null {
  const parsed =
    typeof raw === 'string'
      ? (() => {
          try {
            return JSON.parse(raw) as unknown;
          } catch {
            return null;
          }
        })()
      : raw;
  if (!parsed || typeof parsed !== 'object') return null;
  const row = parsed as Record<string, unknown>;
  if (row.ok !== true) return null;
  return {
    ok: true,
    alreadyEnrolled: row.already_enrolled === true,
    appId: String(row.app_id ?? ''),
    userId: String(row.user_id ?? ''),
    source: typeof row.source === 'string' ? row.source : undefined,
  };
}

/** service_role로 특정 사용자·앱 enrollment 생성 (가입 직후 등) */
export async function enrollUserInAppAsService(params: {
  userId: string;
  appId?: AppId;
  source?: EnrollmentSource;
}): Promise<EnrollResult> {
  const supabase = getSupabaseServerClient();
  const appId = params.appId ?? CURRENT_APP_ID;
  const source = params.source ?? 'signup';
  const { data, error } = await supabase.rpc('enroll_user_in_app', {
    p_app_id: appId,
    p_source: source,
    p_user_id: params.userId,
  });
  if (error) {
    const detail = (error as { details?: string; message?: string }).details || error.message || '';
    const err = new Error(
      detail.includes('signups not allowed') || error.message.includes('signups not allowed')
        ? 'signups not allowed'
        : error.message || 'enrollment_failed',
    );
    (err as Error & { code?: string }).code = 'ENROLLMENT_FAILED';
    throw err;
  }
  const parsed = parseEnrollPayload(data);
  if (!parsed) throw new Error('enrollment_parse_failed');
  return parsed;
}

/** 서버/폴백 게이트용 enrollment 존재 여부 */
export async function userHasAppEnrollment(
  userId: string,
  appId: AppId = CURRENT_APP_ID,
): Promise<boolean> {
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from('user_app_enrollments')
    .select('user_id')
    .eq('user_id', userId)
    .eq('app_id', appId)
    .maybeSingle();
  if (error) {
    console.error('userHasAppEnrollment 오류:', error);
    // fail-closed: 조회 실패 시 미동의로 취급
    return false;
  }
  return Boolean(data?.user_id);
}
