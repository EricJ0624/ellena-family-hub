'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { getValidatedUserWithSessionFallback } from '@/lib/auth-session-resilience';
import {
  buildOnboardingPath,
  getSessionStoredInviteCode,
  isValidInviteCodeFormat,
  resolveUserHasGroups,
} from '@/lib/family-auth-routing';
import { useLanguage } from '@/app/contexts/LanguageContext';
import { getAuthCallbackTranslation } from '@/lib/translations/authCallback';

export default function AuthCallbackPage() {
  const router = useRouter();
  const { lang } = useLanguage();
  const act = (key: keyof import('@/lib/translations/authCallback').AuthCallbackTranslations) => getAuthCallbackTranslation(lang, key);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const handleAuthCallback = async () => {
      try {
        // SSR 안전성: 클라이언트 사이드에서만 실행
        if (typeof window === 'undefined') return;

        // URL에서 해시 파라미터 확인
        const hashParams = new URLSearchParams(window.location.hash.substring(1));
        const accessToken = hashParams.get('access_token');
        const refreshToken = hashParams.get('refresh_token');
        const searchParams = new URLSearchParams(window.location.search);
        const code = searchParams.get('code');
        const tokenHash = searchParams.get('token_hash');
        const callbackType = (hashParams.get('type') || searchParams.get('type') || '').trim();

        if (accessToken && refreshToken) {
          const { error: sessionError } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
          if (sessionError) throw sessionError;
        } else if (code) {
          // PKCE callback: ?code=...
          const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
          if (exchangeError) throw exchangeError;
        } else if (tokenHash && callbackType) {
          // Email OTP callback: ?token_hash=...&type=signup|recovery|invite|magiclink|email_change
          const otpType = callbackType as 'signup' | 'recovery' | 'invite' | 'magiclink' | 'email_change';
          const { error: verifyError } = await supabase.auth.verifyOtp({
            type: otpType,
            token_hash: tokenHash,
          });
          if (verifyError) throw verifyError;
        }

        // 실제로 요청에 붙을 세션(access_token)이 있는지 확인 후 리다이렉트
        const { data: { session } } = await supabase.auth.getSession();
        const { user } = await getValidatedUserWithSessionFallback(supabase, session);
        if (!session?.access_token || !user) {
          router.push('/');
          return;
        }

        // 시스템 관리자 확인
        const { data: isAdmin } = await supabase.rpc('is_system_admin', {
          user_id_param: user.id,
        });

        const { hasGroups } = await resolveUserHasGroups(supabase, user.id, {
          flakyRetry: true,
          isSystemAdmin: Boolean(isAdmin),
        });
        // 초대 링크로 가입한 경우: API에 임시 저장된 코드 우선 사용 (다른 탭/기기에서 인증해도 동작)
        let invite: string | null = null;
        try {
          if (session?.access_token) {
            const res = await fetch(`${window.location.origin}/api/invite/my-pending`, {
              headers: { Authorization: `Bearer ${session.access_token}` },
            });
            const json = await res.json().catch(() => ({}));
            const fromApi = json?.invite_code;
            if (fromApi && isValidInviteCodeFormat(String(fromApi))) invite = String(fromApi);
          }
        } catch (_) {}
        if (!invite) {
          const fromMeta = user?.user_metadata?.pending_invite_code;
          const fromStorage = getSessionStoredInviteCode();
          if (fromMeta && isValidInviteCodeFormat(String(fromMeta))) invite = String(fromMeta);
          else if (fromStorage) invite = fromStorage;
        }
        const onboardingPath = buildOnboardingPath(invite);

        if (isAdmin) {
          // 시스템 관리자: 그룹이 있으면 온보딩(그룹 선택)으로, 없으면 관리자 페이지로
          router.push(hasGroups ? onboardingPath : '/admin');
        } else {
          // 일반 사용자: 그룹이 있든 없든 항상 온보딩으로 (온보딩에서 그룹 선택/생성/가입 처리)
          router.push(onboardingPath);
        }
      } catch (err: any) {
        console.error('Auth callback error:', err);
        setError(err.message || act('error_message'));
        setTimeout(() => {
          router.push('/');
        }, 3000);
      } finally {
        setLoading(false);
      }
    };

    if (typeof window !== 'undefined') {
      handleAuthCallback();
    }
  }, [router]);

  if (loading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[#f5f7fa]">
        <div
          className="h-12 w-12 animate-spin rounded-full border-4 border-[#e2e8f0] border-t-[#9333ea]"
          aria-hidden
        />
        <p className="text-base text-[#64748b]">인증 처리 중...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[#f5f7fa] p-5">
        <div className="rounded-lg border border-[#fecaca] bg-[#fee2e2] p-4 text-[#991b1b]">
          {error}
        </div>
        <p className="text-sm text-[#64748b]">{act('redirect_message')}</p>
      </div>
    );
  }

  return null;
}
