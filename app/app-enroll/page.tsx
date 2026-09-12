'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useLanguage } from '@/app/contexts/LanguageContext';
import { APP_ID_LABELS, CURRENT_APP_ID } from '@/lib/apps';
import {
  fetchAuthBootstrap,
  invalidateCachedAuthBootstrap,
  setCachedAuthBootstrap,
} from '@/lib/auth-bootstrap';
import { resolvePostAuthPath } from '@/lib/app-enrollment-routing';
import { resolveInviteFromUrlOrSession } from '@/lib/family-auth-routing';
import { getValidatedUserWithSessionFallback } from '@/lib/auth-session-resilience';

export const dynamic = 'force-dynamic';

export default function AppEnrollPage() {
  const router = useRouter();
  const { lang } = useLanguage();
  const isKo = lang === 'ko';
  const appLabel = APP_ID_LABELS[CURRENT_APP_ID] ?? CURRENT_APP_ID;

  const [checking, setChecking] = useState(true);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [blockedReason, setBlockedReason] = useState<string | null>(null);

  const goNext = useCallback(
    async (accessToken: string, userId: string) => {
      invalidateCachedAuthBootstrap(userId);
      const bootstrap = await fetchAuthBootstrap(accessToken);
      if (!bootstrap) {
        router.replace('/');
        return;
      }
      setCachedAuthBootstrap(userId, bootstrap);
      const params =
        typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
      let invite = resolveInviteFromUrlOrSession(params);
      if (!invite) {
        try {
          const res = await fetch('/api/invite/my-pending', {
            headers: { Authorization: `Bearer ${accessToken}` },
          });
          const json = await res.json().catch(() => ({}));
          const fromApi = json?.invite_code;
          if (typeof fromApi === 'string' && fromApi.trim()) invite = fromApi.trim();
        } catch {
          // ignore
        }
      }
      router.replace(resolvePostAuthPath(bootstrap, invite));
    },
    [router],
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (!session?.access_token || !session.user) {
          router.replace('/');
          return;
        }
        const { user, error: userErr } = await getValidatedUserWithSessionFallback(
          supabase,
          session,
        );
        if (cancelled) return;
        if (userErr || !user) {
          router.replace('/');
          return;
        }
        const bootstrap = await fetchAuthBootstrap(session.access_token);
        if (cancelled) return;
        if (bootstrap?.hasAppEnrollment) {
          await goNext(session.access_token, user.id);
          return;
        }
        if (bootstrap?.isSystemAdmin && !bootstrap.hasGroups) {
          router.replace('/admin');
          return;
        }
      } catch {
        if (!cancelled) router.replace('/');
      } finally {
        if (!cancelled) setChecking(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [goNext, router]);

  const handleSubmit = async () => {
    if (!acceptedTerms || submitting) return;
    setSubmitting(true);
    setError(null);
    setBlockedReason(null);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.access_token || !session.user) {
        router.replace('/');
        return;
      }
      const res = await fetch('/api/app-enrollment', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ acceptedTerms: true }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (json.reason === 'cap_reached' || json.reason === 'disabled') {
          setBlockedReason(json.reason);
        }
        setError(
          typeof json.error === 'string'
            ? json.error
            : isKo
              ? '가입 동의 처리에 실패했습니다.'
              : 'Could not complete app enrollment.',
        );
        return;
      }
      await goNext(session.access_token, session.user.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : isKo ? '오류가 발생했습니다.' : 'Something went wrong.');
    } finally {
      setSubmitting(false);
    }
  };

  if (checking) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <Loader2 className="h-8 w-8 animate-spin text-purple-600" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="m-0 text-xl font-semibold text-slate-900">
          {isKo ? `${appLabel} 앱 가입` : `Join ${appLabel}`}
        </h1>
        <p className="mt-3 mb-0 text-sm leading-relaxed text-slate-600">
          {isKo
            ? `같은 계정으로 로그인했습니다. ${appLabel}을(를) 이용하려면 약관에 동의해야 합니다. 동의 후 이 앱의 가입 인원에 포함됩니다.`
            : `You are signed in with a shared account. To use ${appLabel}, accept the terms. After consent you count toward this app’s membership limit.`}
        </p>

        <label className="mt-5 flex cursor-pointer items-start gap-3 text-sm text-slate-700">
          <input
            type="checkbox"
            className="mt-1 h-4 w-4"
            checked={acceptedTerms}
            onChange={(e) => setAcceptedTerms(e.target.checked)}
          />
          <span>
            {isKo ? (
              <>
                <Link href="/legal/terms" className="font-medium text-purple-700 underline">
                  이용약관
                </Link>
                {' 및 '}
                <Link href="/legal/privacy" className="font-medium text-purple-700 underline">
                  개인정보 처리방침
                </Link>
                에 동의합니다.
              </>
            ) : (
              <>
                I agree to the{' '}
                <Link href="/legal/terms" className="font-medium text-purple-700 underline">
                  Terms
                </Link>{' '}
                and{' '}
                <Link href="/legal/privacy" className="font-medium text-purple-700 underline">
                  Privacy Policy
                </Link>
                .
              </>
            )}
          </span>
        </label>

        {blockedReason === 'cap_reached' && (
          <p className="mt-3 text-sm text-amber-700">
            {isKo
              ? '이 앱의 가입 한도에 도달했습니다.'
              : 'This app has reached its enrollment limit.'}
          </p>
        )}
        {blockedReason === 'disabled' && (
          <p className="mt-3 text-sm text-amber-700">
            {isKo
              ? '이 앱의 신규 가입이 중단되었습니다.'
              : 'New enrollments for this app are paused.'}
          </p>
        )}
        {error && !blockedReason && <p className="mt-3 text-sm text-red-600">{error}</p>}

        <button
          type="button"
          disabled={!acceptedTerms || submitting}
          onClick={() => void handleSubmit()}
          className="mt-6 w-full rounded-lg bg-purple-600 px-4 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
        >
          {submitting ? (
            <span className="inline-flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              …
            </span>
          ) : isKo ? (
            '동의하고 계속'
          ) : (
            'Agree and continue'
          )}
        </button>

        <button
          type="button"
          className="mt-3 w-full rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm text-slate-600"
          onClick={() => {
            void supabase.auth.signOut().finally(() => router.replace('/'));
          }}
        >
          {isKo ? '다른 계정으로 로그인' : 'Sign in with another account'}
        </button>
      </div>
    </div>
  );
}
