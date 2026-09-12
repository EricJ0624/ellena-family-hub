import { CURRENT_APP_ID, type AppId } from '@/lib/apps';
import {
  coerceSignupInteger,
  computeSignupAvailability,
  isSignupBlockReason,
  type SignupAvailability,
} from '@/lib/signup-settings';
import { getSupabaseServerClient } from '@/lib/api-helpers';

export type SignupAvailabilityWithApp = SignupAvailability & { appId: AppId };

type SignupAvailabilityRow = {
  app_id?: string;
  signup_enabled?: boolean;
  signup_max_users?: number | null;
  current_user_count?: number;
  allowed?: boolean;
  reason?: string;
};

function parseAvailabilityPayload(
  raw: unknown,
  fallbackAppId: AppId,
): SignupAvailabilityWithApp | null {
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
  const parsedMax = signupMaxUsers != null && signupMaxUsers >= 1 ? signupMaxUsers : null;
  const computed = computeSignupAvailability(signupEnabled, parsedMax, currentUserCount);
  const appId =
    typeof row.app_id === 'string' && row.app_id.length > 0
      ? (row.app_id as AppId)
      : fallbackAppId;
  if (typeof row.allowed === 'boolean' && isSignupBlockReason(row.reason)) {
    return {
      ...computed,
      allowed: row.allowed,
      reason: row.reason,
      appId,
    };
  }
  return { ...computed, appId };
}

export async function loadSignupAvailability(
  appId: AppId = CURRENT_APP_ID,
): Promise<SignupAvailabilityWithApp> {
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase.rpc('get_signup_availability', {
    p_app_id: appId,
  });
  if (error) throw error;
  const parsed = parseAvailabilityPayload(data, appId);
  if (!parsed) {
    throw new Error('가입 설정을 불러오지 못했습니다.');
  }
  return parsed;
}

export async function loadAllSignupAvailabilities(
  appIds: readonly AppId[],
): Promise<SignupAvailabilityWithApp[]> {
  const results = await Promise.all(appIds.map((id) => loadSignupAvailability(id)));
  return results;
}
