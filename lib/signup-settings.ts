export type SignupBlockReason = 'ok' | 'disabled' | 'cap_reached';

export type SignupAvailability = {
  signupEnabled: boolean;
  signupMaxUsers: number | null;
  currentUserCount: number;
  allowed: boolean;
  reason: SignupBlockReason;
};

export function isSignupBlockReason(value: unknown): value is SignupBlockReason {
  return value === 'ok' || value === 'disabled' || value === 'cap_reached';
}

export function computeSignupAvailability(
  signupEnabled: boolean,
  signupMaxUsers: number | null,
  currentUserCount: number,
): SignupAvailability {
  if (!signupEnabled) {
    return {
      signupEnabled,
      signupMaxUsers,
      currentUserCount,
      allowed: false,
      reason: 'disabled',
    };
  }
  if (signupMaxUsers != null && currentUserCount >= signupMaxUsers) {
    return {
      signupEnabled,
      signupMaxUsers,
      currentUserCount,
      allowed: false,
      reason: 'cap_reached',
    };
  }
  return {
    signupEnabled,
    signupMaxUsers,
    currentUserCount,
    allowed: true,
    reason: 'ok',
  };
}

export function parseSignupMaxUsers(raw: unknown): { ok: true; value: number | null } | { ok: false } {
  if (raw === null || raw === '') {
    return { ok: true, value: null };
  }
  if (typeof raw === 'number' && Number.isInteger(raw) && raw >= 1) {
    return { ok: true, value: raw };
  }
  if (typeof raw === 'string' && /^\d+$/.test(raw.trim())) {
    const parsed = Number.parseInt(raw.trim(), 10);
    if (parsed >= 1) return { ok: true, value: parsed };
  }
  return { ok: false };
}

export function coerceSignupInteger(raw: unknown): number | null {
  if (typeof raw === 'number' && Number.isInteger(raw) && Number.isFinite(raw)) {
    return raw;
  }
  if (typeof raw === 'string' && /^-?\d+$/.test(raw.trim())) {
    return Number.parseInt(raw.trim(), 10);
  }
  return null;
}
