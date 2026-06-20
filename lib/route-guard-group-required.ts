import type { SupabaseClient } from '@supabase/supabase-js';
import { getValidatedUserWithSessionFallback } from '@/lib/auth-session-resilience';
import { resolveUserHasGroups } from '@/lib/family-auth-routing';
import { AUTH_STORAGE_KEY, clearAuthStorage, supabase } from '@/lib/supabase';
import { isValidUUID } from '@/lib/validation';

export type GroupRequiredGuardResult =
  | { ok: true }
  | { ok: false; redirectTo: string };

function sanitizeAuthStorage(): void {
  if (typeof window === 'undefined') return;
  try {
    for (const storage of [localStorage, sessionStorage]) {
      const stored = storage.getItem(AUTH_STORAGE_KEY);
      if (stored) {
        try {
          JSON.parse(stored);
        } catch {
          storage.removeItem(AUTH_STORAGE_KEY);
        }
      }
    }
  } catch {
    // ignore
  }
}

async function applyOpenGroupIfValid(
  client: SupabaseClient,
  userId: string,
  hasGroups: boolean,
  setCurrentGroupId?: (groupId: string) => void
): Promise<boolean> {
  if (typeof window === 'undefined') return hasGroups;

  try {
    const qs = new URLSearchParams(window.location.search);
    const openGroup = qs.get('openGroup')?.trim().toLowerCase() ?? '';
    if (!openGroup || !isValidUUID(openGroup)) return hasGroups;

    const [mRes, oRes] = await Promise.all([
      client
        .from('memberships')
        .select('group_id')
        .eq('user_id', userId)
        .eq('group_id', openGroup)
        .maybeSingle(),
      client
        .from('groups')
        .select('id')
        .eq('id', openGroup)
        .eq('owner_id', userId)
        .maybeSingle(),
    ]);

    if ((!mRes.error && mRes.data) || (!oRes.error && oRes.data)) {
      try {
        setCurrentGroupId?.(openGroup);
      } catch {
        // ignore
      }
      try {
        localStorage.setItem('currentGroupId', openGroup);
      } catch {
        // ignore
      }
      window.history.replaceState({}, '', window.location.pathname);
      return true;
    }
  } catch {
    // ignore
  }

  return hasGroups;
}

/**
 * /dashboard checkAuth와 동일 순서·정책.
 * PR-3: 기능 페이지 공통 그룹 가드.
 */
export async function runGroupRequiredRouteGuard(options?: {
  setCurrentGroupId?: (groupId: string) => void;
}): Promise<GroupRequiredGuardResult> {
  sanitizeAuthStorage();

  const {
    data: { session },
    error,
  } = await supabase.auth.getSession();

  if (error) {
    if (error.message?.includes('Refresh Token') || error.message?.includes('refresh_token')) {
      if (typeof window !== 'undefined') clearAuthStorage();
      try {
        await supabase.auth.signOut();
      } catch {
        // ignore
      }
      return { ok: false, redirectTo: '/' };
    }
    console.error('인증 확인 오류:', error);
    return { ok: false, redirectTo: '/' };
  }

  if (!session) {
    return { ok: false, redirectTo: '/' };
  }

  const { user: serverUser, error: userError } = await getValidatedUserWithSessionFallback(
    supabase,
    session
  );

  if (userError || !serverUser) {
    if (typeof window !== 'undefined') clearAuthStorage();
    try {
      await supabase.auth.signOut();
    } catch {
      // ignore
    }
    return { ok: false, redirectTo: '/' };
  }

  const { data: isAdmin } = await supabase.rpc('is_system_admin', {
    user_id_param: serverUser.id,
  });

  let { hasGroups } = await resolveUserHasGroups(supabase, serverUser.id, {
    flakyRetry: true,
    isSystemAdmin: Boolean(isAdmin),
  });

  hasGroups = await applyOpenGroupIfValid(
    supabase,
    serverUser.id,
    hasGroups,
    options?.setCurrentGroupId
  );

  if (isAdmin && !hasGroups) {
    return { ok: false, redirectTo: '/admin' };
  }

  if (!isAdmin && !hasGroups) {
    return { ok: false, redirectTo: '/onboarding' };
  }

  return { ok: true };
}
