import { getSupabaseServerClient } from '@/lib/api-helpers';
import { verifyAccountPassword } from '@/lib/verify-account-password';

const MAX_FAILS = 5;
const LOCK_MS = 15 * 60 * 1000;

export class AdminStepUpError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'AdminStepUpError';
    this.status = status;
  }
}

export function isAdminStepUpError(error: unknown): error is AdminStepUpError {
  return error instanceof AdminStepUpError;
}

/** 시스템 관리자 민감 작업: 본인 비밀번호 확인 + 실패 횟수 제한. 로그인 페이지는 사용하지 않는다. */
export async function requireAdminStepUpPassword(params: {
  userId: string;
  email?: string;
  password: unknown;
}): Promise<void> {
  const password = typeof params.password === 'string' ? params.password : '';
  if (!password) {
    throw new AdminStepUpError('비밀번호가 필요합니다.', 400);
  }
  const email = typeof params.email === 'string' ? params.email.trim() : '';
  if (!email) {
    throw new AdminStepUpError('계정 이메일을 확인할 수 없어 비밀번호를 검증하지 못했습니다.', 400);
  }

  const supabase = getSupabaseServerClient();
  const { data: row } = await supabase
    .from('admin_stepup_attempts')
    .select('fail_count, locked_until')
    .eq('user_id', params.userId)
    .maybeSingle();

  const lockedUntil = row?.locked_until ? new Date(String(row.locked_until)) : null;
  if (lockedUntil && lockedUntil.getTime() > Date.now()) {
    throw new AdminStepUpError('비밀번호 입력이 잠시 제한되었습니다. 잠시 후 다시 시도해 주세요.', 429);
  }

  const ok = await verifyAccountPassword({
    email,
    password,
    expectedUserId: params.userId,
  });

  const now = new Date().toISOString();
  const previousFails =
    lockedUntil && lockedUntil.getTime() <= Date.now() ? 0 : Number(row?.fail_count || 0);
  if (!ok) {
    const nextFail = previousFails + 1;
    const nextLock = nextFail >= MAX_FAILS ? new Date(Date.now() + LOCK_MS).toISOString() : null;
    await supabase.from('admin_stepup_attempts').upsert({
      user_id: params.userId,
      fail_count: nextFail,
      locked_until: nextLock,
      updated_at: now,
    });
    if (nextLock) {
      throw new AdminStepUpError('비밀번호 입력이 잠시 제한되었습니다. 잠시 후 다시 시도해 주세요.', 429);
    }
    throw new AdminStepUpError('비밀번호가 올바르지 않습니다.', 403);
  }

  await supabase.from('admin_stepup_attempts').upsert({
    user_id: params.userId,
    fail_count: 0,
    locked_until: null,
    updated_at: now,
  });
}
