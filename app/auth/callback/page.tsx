'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { getValidatedUserWithSessionFallback } from '@/lib/auth-session-resilience';
import { isRecoveryAuthCallback } from '@/lib/auth-callback-routing';
import {
  fetchAuthBootstrap,
  invalidateCachedAuthBootstrap,
} from '@/lib/auth-bootstrap';
import { resolvePostAuthPath } from '@/lib/app-enrollment-routing';
import { useLanguage } from '@/app/contexts/LanguageContext';
import { getAuthCallbackTranslation } from '@/lib/translations/authCallback';
import { takePendingGoogleSignupMeta } from '@/lib/google-oauth-signup';
import { isValidLang } from '@/lib/language-fonts';
import {
  getSessionStoredInviteCode,
  isValidInviteCodeFormat,
  setSessionStoredInviteCode,
} from '@/lib/family-auth-routing';

export default function AuthCallbackPage() {
  const router = useRouter();
  const { lang, setLanguage } = useLanguage();
  const act = (key: keyof import('@/lib/translations/authCallback').AuthCallbackTranslations) => getAuthCallbackTranslation(lang, key);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const callbackStartedRef = useRef(false);

  useEffect(() => {
    const handleAuthCallback = async () => {
      if (callbackStartedRef.current) return;
      callbackStartedRef.current = true;
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
          if (verifyError) {
            const { data: { session: sessionAfterVerifyError } } = await supabase.auth.getSession();
            if (!sessionAfterVerifyError?.access_token) throw verifyError;
          }
        }

        try {
          window.history.replaceState({}, '', '/auth/callback');
        } catch (_) {}

        // 실제로 요청에 붙을 세션(access_token)이 있는지 확인 후 리다이렉트
        const { data: { session } } = await supabase.auth.getSession();
        const { user } = await getValidatedUserWithSessionFallback(supabase, session);
        if (!session?.access_token || !user) {
          router.push('/');
          return;
        }

        // 이후 로그인 탭에 이전 계정이 뜨지 않도록 방금 인증한 이메일 기억
        if (user.email) {
          try {
            window.localStorage.setItem('SFH_LAST_EMAIL', user.email.trim().toLowerCase());
          } catch (_) {}
        }

        // Google 가입 탭에서 저장한 별명·언어·국가 반영 (있을 때만). 기존 이메일 콜백 분기는 유지.
        const pendingGoogleMeta = takePendingGoogleSignupMeta();
        if (pendingGoogleMeta) {
          try {
            const syncRes = await fetch(`${window.location.origin}/api/auth/complete-oauth-signup`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${session.access_token}`,
              },
              body: JSON.stringify({
                nickname: pendingGoogleMeta.nickname,
                language: pendingGoogleMeta.language,
                country_code: pendingGoogleMeta.country_code,
              }),
            });
            if (!syncRes.ok) {
              console.warn('[Auth callback] complete-oauth-signup failed:', syncRes.status);
            } else if (isValidLang(pendingGoogleMeta.language)) {
              void setLanguage(pendingGoogleMeta.language);
            }
          } catch (syncErr) {
            console.warn('[Auth callback] complete-oauth-signup failed (ignored):', syncErr);
          }

          // 초대 코드가 있으면 이메일 가입과 같이 pending 저장 (다른 기기 인증 대비)
          const inviteForStore = getSessionStoredInviteCode();
          if (inviteForStore && user.email) {
            try {
              await fetch(`${window.location.origin}/api/invite/store-pending`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  email: user.email.trim().toLowerCase(),
                  invite_code: inviteForStore,
                }),
              });
            } catch (_) {}
          }
        }

        // 비밀번호 재설정: onboarding/admin 분기 전에 reset-password로만 보냄
        if (isRecoveryAuthCallback(hashParams, searchParams)) {
          router.replace('/reset-password');
          return;
        }

        // 시스템 관리자·그룹·앱 가입 동의는 bootstrap 1회 조회로 판정
        invalidateCachedAuthBootstrap(user.id);
        let bootstrap = await fetchAuthBootstrap(session.access_token);

        // 이메일 신규 가입 인증(type=signup): 현재 앱 enrollment 자동 보장
        const authType =
          hashParams.get('type') ||
          searchParams.get('type') ||
          '';
        if (
          authType === 'signup' &&
          bootstrap &&
          !bootstrap.hasAppEnrollment &&
          !(bootstrap.isSystemAdmin && !bootstrap.hasGroups)
        ) {
          try {
            const enrollRes = await fetch(
              `${window.location.origin}/api/auth/ensure-signup-enrollment`,
              {
                method: 'POST',
                headers: { Authorization: `Bearer ${session.access_token}` },
              },
            );
            if (enrollRes.ok) {
              invalidateCachedAuthBootstrap(user.id);
              bootstrap = await fetchAuthBootstrap(session.access_token);
            } else {
              console.warn(
                '[Auth callback] ensure-signup-enrollment failed:',
                enrollRes.status,
              );
            }
          } catch (enrollErr) {
            console.warn('[Auth callback] ensure-signup-enrollment error:', enrollErr);
          }
        }

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
        if (invite) {
          setSessionStoredInviteCode(invite);
        }

        if (!bootstrap) {
          router.push('/');
          return;
        }

        router.push(resolvePostAuthPath(bootstrap, invite));
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
        <p className="text-base text-[#64748b]">{act('processing')}</p>
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
