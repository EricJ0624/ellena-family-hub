'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useLanguage } from '@/app/contexts/LanguageContext';
import { getMfaTranslation, type MfaTranslations } from '@/lib/translations/mfa';
import { fetchAuthBootstrapWithCache } from '@/lib/auth-bootstrap';
import { resolvePostAuthPath } from '@/lib/app-enrollment-routing';
import { buildOnboardingPath, resolveInviteFromUrlOrSession } from '@/lib/family-auth-routing';
import { getAppBrandName } from '@/lib/apps';

type Phase = 'loading' | 'enroll' | 'verify';

function qrImageSrc(qrCode: string): string {
  if (qrCode.startsWith('data:')) return qrCode;
  if (qrCode.trimStart().startsWith('<svg')) {
    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(qrCode)}`;
  }
  return qrCode;
}

export default function SystemAdminMfaPage() {
  const router = useRouter();
  const { lang } = useLanguage();
  const t = (key: keyof MfaTranslations) => getMfaTranslation(lang, key);

  const [phase, setPhase] = useState<Phase>('loading');
  const [factorId, setFactorId] = useState('');
  const [qrSrc, setQrSrc] = useState('');
  const [secret, setSecret] = useState('');
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [errorKey, setErrorKey] = useState<keyof MfaTranslations | ''>('');

  const goNext = async (accessToken: string, userId: string) => {
    const params = new URLSearchParams(window.location.search);
    const invite = resolveInviteFromUrlOrSession(params);
    const resume = params.get('resume') === '1';
    const bootstrap = await fetchAuthBootstrapWithCache(accessToken, userId);
    if (!bootstrap) {
      router.replace(buildOnboardingPath(invite));
      return;
    }
    router.replace(
      resolvePostAuthPath(bootstrap, invite, resume ? { preferLastDashboard: true } : undefined),
    );
  };

  useEffect(() => {
    let cancelled = false;

    const prepare = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.access_token || !session.user) {
        if (!cancelled) router.replace('/');
        return;
      }

      const { data: aalData, error: aalError } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      if (cancelled) return;
      if (!aalError && aalData?.currentLevel === 'aal2') {
        if (!cancelled) await goNext(session.access_token, session.user.id);
        return;
      }

      const bootstrap = await fetchAuthBootstrapWithCache(session.access_token, session.user.id);
      if (cancelled) return;
      if (!bootstrap?.isSystemAdmin) {
        await goNext(session.access_token, session.user.id);
        return;
      }

      const { data: factors, error: factorsError } = await supabase.auth.mfa.listFactors();
      if (cancelled) return;
      if (factorsError) {
        setErrorKey('error_setup_failed');
        setPhase('enroll');
        return;
      }

      const verifiedId = factors?.totp?.[0]?.id;
      if (verifiedId) {
        setFactorId(verifiedId);
        setPhase('verify');
        return;
      }

      setPhase('enroll');
    };

    void prepare();
    return () => {
      cancelled = true;
    };
    // 언어 변경으로 등록 절차를 다시 시작하지 않는다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  const handleEnroll = async () => {
    if (loading) return;
    setLoading(true);
    setErrorKey('');
    try {
      const { data: factors, error: factorsError } = await supabase.auth.mfa.listFactors();
      if (factorsError) throw factorsError;
      for (const factor of factors?.all ?? []) {
        if (factor.factor_type === 'totp' && factor.status !== 'verified') {
          const { error: unenrollError } = await supabase.auth.mfa.unenroll({ factorId: factor.id });
          if (unenrollError) throw unenrollError;
        }
      }

      const { data, error } = await supabase.auth.mfa.enroll({
        factorType: 'totp',
        friendlyName: getAppBrandName(),
        issuer: getAppBrandName(),
      });
      if (error || !data?.id || !data.totp?.secret) {
        throw error || new Error('enroll_failed');
      }
      setFactorId(data.id);
      setSecret(data.totp.secret);
      setQrSrc(data.totp.qr_code ? qrImageSrc(data.totp.qr_code) : '');
      setPhase('verify');
    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
        console.error('MFA enroll error:', error);
      }
      setErrorKey('error_setup_failed');
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async (event: React.FormEvent) => {
    event.preventDefault();
    if (loading) return;
    const normalized = code.replace(/\s/g, '');
    if (!/^\d{6}$/.test(normalized) || !factorId) {
      setErrorKey('error_invalid_code');
      return;
    }
    setLoading(true);
    setErrorKey('');
    try {
      const { data, error } = await supabase.auth.mfa.challengeAndVerify({
        factorId,
        code: normalized,
      });
      if (error || !data?.access_token || !data.refresh_token) {
        throw error || new Error('verify_failed');
      }
      const { error: sessionError } = await supabase.auth.setSession({
        access_token: data.access_token,
        refresh_token: data.refresh_token,
      });
      if (sessionError) throw sessionError;
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.access_token || !session.user) {
        router.replace('/');
        return;
      }
      await goNext(session.access_token, session.user.id);
    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
        console.error('MFA verify error:', error);
      }
      setErrorKey('error_invalid_code');
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.replace('/');
  };

  const handleCopySecret = async () => {
    if (!secret) return;
    try {
      await navigator.clipboard.writeText(secret);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  const inputClassName =
    'box-border h-[60px] w-full rounded-2xl border-2 border-[#e2e8f0] bg-white px-5 text-center text-lg tracking-[0.4em] text-[#1a202c] shadow-[0_4px_12px_rgba(0,0,0,0.08)] outline-none transition-all duration-300 ease-in-out focus:border-[rgb(var(--brand-primary))] focus:shadow-[0_4px_16px_rgba(102,126,234,0.2)]';

  const buttonClassName = [
    'relative mt-2 h-[60px] w-full overflow-hidden rounded-2xl border-none text-lg font-bold text-white transition-all duration-300 ease-in-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/60',
    loading
      ? 'cursor-not-allowed bg-[linear-gradient(135deg,#94a3b8_0%,#64748b_100%)] shadow-[0_4px_12px_rgba(0,0,0,0.1)]'
      : 'cursor-pointer bg-[linear-gradient(135deg,rgb(var(--brand-primary))_0%,rgb(var(--brand-secondary))_100%)] shadow-[0_8px_24px_rgba(102,126,234,0.4)] active:scale-[0.98] active:shadow-[0_4px_12px_rgba(102,126,234,0.3)]',
  ].join(' ');

  return (
    <div className="relative flex min-h-dvh flex-col items-center justify-center overflow-hidden bg-[linear-gradient(135deg,#f5f7fa_0%,#c3cfe2_100%)] p-5 font-[-apple-system,BlinkMacSystemFont,Segoe_UI,Roboto,Helvetica_Neue,Arial,sans-serif]">
      <div className="relative z-[1] w-full max-w-[420px] rounded-[28px] bg-white/90 p-7 shadow-[0_20px_50px_rgba(15,23,42,0.12)]">
        <h1 className="m-0 text-center text-2xl font-bold text-[#1a202c]">{t('title')}</h1>

        {phase === 'loading' ? (
          <p className="mt-6 text-center text-base text-[#64748b]" role="status">
            {t('loading')}
          </p>
        ) : (
          <>
            <p className="mt-4 text-sm leading-6 text-[#475569]">
              {secret ? t('enroll_hint') : phase === 'verify' ? t('verify_body') : t('enroll_body')}
            </p>

            {qrSrc ? (
              <div className="mt-5 flex justify-center">
                {/* 인증 앱 등록용 QR. Supabase가 발급한 SVG data URL */}
                <img src={qrSrc} alt="" width={180} height={180} className="h-[180px] w-[180px] rounded-xl bg-white" />
              </div>
            ) : null}

            {secret ? (
              <div className="mt-4">
                <p className="mb-2 text-xs font-semibold text-[#64748b]">{t('secret_label')}</p>
                <p className="break-all rounded-xl bg-[#f8fafc] px-3 py-3 text-center font-mono text-sm tracking-wider text-[#1a202c]">
                  {secret}
                </p>
                <button
                  type="button"
                  onClick={() => void handleCopySecret()}
                  className="mt-2 w-full cursor-pointer rounded-xl border border-[#e2e8f0] bg-white py-3 text-sm font-semibold text-[#334155]"
                >
                  {copied ? t('copied') : t('copy_secret')}
                </button>
              </div>
            ) : null}

            {phase === 'enroll' && !secret ? (
              <button type="button" className={buttonClassName} onClick={() => void handleEnroll()} disabled={loading}>
                {loading ? t('btn_loading') : t('enroll_button')}
              </button>
            ) : null}

            {phase === 'verify' && factorId ? (
              <form className="mt-5" onSubmit={(event) => void handleVerify(event)}>
                <input
                  className={inputClassName}
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  placeholder={t('code_placeholder')}
                  value={code}
                  onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
                  aria-label={t('code_placeholder')}
                />
                <button type="submit" className={buttonClassName} disabled={loading}>
                  {loading ? t('btn_loading') : t('btn_confirm')}
                </button>
              </form>
            ) : null}

            {errorKey ? (
              <p className="mt-4 rounded-xl bg-[#fee2e2] px-3 py-3 text-sm text-[#991b1b]" role="alert">
                {t(errorKey)}
              </p>
            ) : null}

            <button
              type="button"
              onClick={() => void handleSignOut()}
              className="mt-4 w-full cursor-pointer border-none bg-transparent py-2 text-sm font-semibold text-[#64748b]"
            >
              {t('btn_sign_out')}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
