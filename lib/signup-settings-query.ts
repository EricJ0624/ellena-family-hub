import { getSupabaseServerClient } from '@/lib/api-helpers';
import {
  coerceSignupInteger,
  computeSignupAvailability,
  isSignupBlockReason,
  type SignupAvailability,
} from '@/lib/signup-settings';

type SignupAvailabilityRow = {
  signup_enabled?: boolean;
  signup_max_users?: number | null;
  current_user_count?: number;
  allowed?: boolean;
  reason?: string;
};

function parseAvailabilityPayload(raw: unknown): SignupAvailability | null {
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
  const row = (parsed && typeof parsed === 'object' ? parsed : null) as SignupAvailabilityRow | null;
  if (!row) return null;
  const signupEnabled = row.signup_enabled === true;
  const signupMaxUsers = coerceSignupInteger(row.signup_max_users);
  const coercedCount = coerceSignupInteger(row.current_user_count);
  const currentUserCount = coercedCount != null && coercedCount >= 0 ? coercedCount : 0;
  const parsedMax =
    signupMaxUsers != null && signupMaxUsers >= 1 ? signupMaxUsers : null;
  const computed = computeSignupAvailability(signupEnabled, parsedMax, currentUserCount);
  if (typeof row.allowed === 'boolean' && isSignupBlockReason(row.reason)) {
    return {
      ...computed,
      allowed: row.allowed,
      reason: row.reason,
    };
  }
  return computed;
}

export async function loadSignupAvailability(): Promise<SignupAvailability> {
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase.rpc('get_signup_availability');
  if (error) throw error;
  const parsed = parseAvailabilityPayload(data);
  if (!parsed) {
    throw new Error('가입 설정을 불러오지 못했습니다.');
  }
  return parsed;
}
