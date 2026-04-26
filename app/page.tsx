'use client';

import { useState, useEffect, useRef } from 'react';
import { supabase, PERSIST_SESSION_FLAG_KEY } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import { useLanguage } from '@/app/contexts/LanguageContext';
import { getFontStyle } from '@/lib/language-fonts';
import { getLoginTranslation, type LoginTranslations } from '@/lib/translations/login';
import { getCommonTranslation } from '@/lib/translations/common';
import { AppTitleContent } from '@/app/components/AppTitleContent';
import { cn } from '@/lib/ui/cn';
import {
  buildOnboardingPath,
  getSessionStoredInviteCode,
  isValidInviteCodeFormat,
  resolveInviteFromUrlOrSession,
  resolveUserHasGroups,
  setSessionStoredInviteCode,
} from '@/lib/family-auth-routing';
import { formatSupabaseAuthErrorForLog, isSupabaseAuthRateLimitError } from '@/lib/auth-signup-errors';

type Mode = 'login' | 'signup' | 'forgot';

const LAST_EMAIL_KEY = 'SFH_LAST_EMAIL';

export default function LoginPage() {
  const router = useRouter();
  const { lang } = useLanguage();
  const t = (key: keyof LoginTranslations) => getLoginTranslation(lang, key);
  const ct = (key: keyof import('@/lib/translations/common').CommonTranslations) => getCommonTranslation(lang, key);
  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [nickname, setNickname] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [isMounted, setIsMounted] = useState(false);
  const [lastEmailFromStorage, setLastEmailFromStorage] = useState<string | null>(null);
  const [keepLoggedIn, setKeepLoggedIn] = useState(true); // 로그인 상태 유지 (기본 체크)
  const loginTitleRef = useRef<HTMLHeadingElement>(null);
  /** 가입 처리 중 이중 submit 방지 */
  const signupSubmitLockRef = useRef(false);
  /** 이메일별 가입 쿨다운(전역이면 다른 이메일로 바꿔도 막히는 버그 방지) */
  const signupCooldownByEmailRef = useRef<Record<string, number>>({});
  const [loginTitleFontSize, setLoginTitleFontSize] = useState<number | null>(null);

  // Hydration 오류 방지: 마운트 후에만 클라이언트 사이드 로직 실행
  useEffect(() => {
    setIsMounted(true);
  }, []);

  // 초대 링크(?invite= 또는 ?invite_code=) 쿼리 읽어서 sessionStorage에 저장 후 URL에서 제거 (Referrer/히스토리 노출 방지)
  // 형식 검증: 영숫자 1~20자만 저장.
  // A안: 이 기기에서 예전에 로그인한 이메일이 있으면 로그인 탭으로, 아니면 가입하기 탭으로 전환
  useEffect(() => {
    if (!isMounted || typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const raw = params.get('invite')?.trim() || params.get('invite_code')?.trim();
    if (raw) {
      try {
        if (isValidInviteCodeFormat(raw)) {
          setSessionStoredInviteCode(raw);
          const lastEmail = window.localStorage.getItem(LAST_EMAIL_KEY);
          if (lastEmail) {
            setEmail(lastEmail);
            setMode('login');
          } else {
            setMode('signup');
          }
        }
        params.delete('invite');
        params.delete('invite_code');
        const newSearch = params.toString();
        const newUrl = window.location.pathname + (newSearch ? `?${newSearch}` : '');
        window.history.replaceState({}, '', newUrl);
      } catch (_) {}
    } else if (getSessionStoredInviteCode()) {
      const lastEmail = window.localStorage.getItem(LAST_EMAIL_KEY);
      if (lastEmail) {
        setEmail(lastEmail);
        setMode('login');
      } else {
        setMode('signup');
      }
    }
  }, [isMounted]);

  // 로그인 타이틀 한 줄 맞춤: 넘치면 폰트 자동 축소, 리사이즈 시 재계산 (대시보드와 동일 방식)
  useEffect(() => {
    if (!isMounted) return;
    const MAX_FS = 48;
    const MIN_FS = 14;
    const fit = (el: HTMLHeadingElement) => {
      let fs = MAX_FS;
      el.style.fontSize = `${fs}px`;
      void el.offsetHeight;
      while (el.scrollWidth > el.clientWidth && fs > MIN_FS) {
        fs -= 2;
        el.style.fontSize = `${fs}px`;
        void el.offsetHeight;
      }
      setLoginTitleFontSize(fs);
    };
    let ro: ResizeObserver | null = null;
    const tryRun = (retryCount: number) => {
      const el = loginTitleRef.current;
      if (el) {
        fit(el);
        ro = new ResizeObserver(() => fit(el));
        ro.observe(el);
        document.fonts.ready.then(() => fit(el));
        return;
      }
      if (retryCount < 10) requestAnimationFrame(() => tryRun(retryCount + 1));
    };
    const rafId = requestAnimationFrame(() => requestAnimationFrame(() => tryRun(0)));
    return () => {
      cancelAnimationFrame(rafId);
      ro?.disconnect();
    };
  }, [lang, isMounted]);

  // 이미 로그인되어 있으면 자동 리다이렉트
  useEffect(() => {
    if (!isMounted) return;
    
    const checkExistingSession = async () => {
      try {
        // 자동 이동은 "서버에서 검증된 로그인"일 때만. getSession+세션 완화(getValidated…)를 쓰면
        // 만료·유령 세션으로도 user가 있어 보여 가입(/) 화면에서 /onboarding 으로 빼앗길 수 있음 → 가입 불가 체감.
        const { data: { user }, error } = await supabase.auth.getUser();
        if (error || !user) return;

        const params = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
        const invite = resolveInviteFromUrlOrSession(params);
        router.push(buildOnboardingPath(invite));
      } catch {
        // ignore
      }
    };
    
    checkExistingSession();
  }, [isMounted, router]);

  // 이전 이메일 불러오기
  useEffect(() => {
    if (isMounted && mode === 'login') {
      const lastEmail = localStorage.getItem(LAST_EMAIL_KEY);
      if (lastEmail) {
        setEmail(lastEmail);
        setLastEmailFromStorage(lastEmail);
      } else {
        setLastEmailFromStorage(null);
      }
    }
  }, [mode, isMounted]);

  /** 로그인/서버가입 후 이메일이 이미 확인된 사용자만 — 온보딩·관리자 라우팅 */
  const completeAuthRoutingAfterConfirmedUser = async (emailForStorage: string) => {
    if (emailForStorage && isMounted) {
      localStorage.setItem(LAST_EMAIL_KEY, emailForStorage);
      setLastEmailFromStorage(emailForStorage);
    }

    await new Promise((resolve) => setTimeout(resolve, 500));

    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.user) {
      setErrorMsg(t('error_session_failed'));
      return;
    }

    if (!session.user.email_confirmed_at) {
      await supabase.auth.signOut();
      setErrorMsg(t('error_email_verification'));
      return;
    }

    const params = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
    const invite = resolveInviteFromUrlOrSession(params);
    const onboardingPath = buildOnboardingPath(invite);

    try {
      const { data: isAdmin, error: isAdminError } = await supabase.rpc('is_system_admin', {
        user_id_param: session.user.id,
      });
      if (isAdminError) {
        console.warn('[Login] 시스템 관리자 판정 실패, 일반 라우팅으로 폴백:', isAdminError);
      }

      const { hasGroups } = await resolveUserHasGroups(supabase, session.user.id, {
        flakyRetry: true,
        isSystemAdmin: Boolean(isAdmin),
      });

      if (isAdmin) {
        router.push(hasGroups ? onboardingPath : '/admin');
        return;
      }

      router.push(onboardingPath);
    } catch (routingError) {
      // 로그인은 성공했지만 후속 권한/그룹 판정이 일시 실패한 경우, 로그인 실패처럼 보이지 않도록 온보딩으로 폴백
      console.warn('[Login] 후속 라우팅 판정 실패, 온보딩으로 폴백:', routingError);
      router.push(onboardingPath);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    setLoading(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      const normalizedEmail = email.trim().toLowerCase();
      if (!normalizedEmail) {
        setErrorMsg(t('error_login_failed'));
        return;
      }
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(PERSIST_SESSION_FLAG_KEY, keepLoggedIn ? '1' : '0');
      }

      const { error, data } = await supabase.auth.signInWithPassword({
        email: normalizedEmail,
        password,
      });
      if (error) throw error;

      if (!data.user) {
        setErrorMsg(t('error_login_failed'));
        return;
      }
      if (!data.user.email_confirmed_at) {
        await supabase.auth.signOut();
        setErrorMsg(t('error_email_verification'));
        return;
      }

      try {
        await completeAuthRoutingAfterConfirmedUser(normalizedEmail);
      } catch (routingError: any) {
        console.warn('[Login] 인증 후 라우팅 처리 오류:', routingError);
        setErrorMsg('로그인은 되었지만 후속 처리 중 오류가 발생했습니다. 새로고침 후 다시 시도해 주세요.');
      }
    } catch (error: any) {
      // 보안: 프로덕션 환경에서는 상세 에러 정보 노출 방지
      if (process.env.NODE_ENV === 'development') {
        console.error('Login error:', error);
      }
      const message = String(error?.message || '').toLowerCase();
      const code = String(error?.code || '').toLowerCase();
      if (
        message.includes('invalid login credentials') ||
        code === 'invalid_credentials' ||
        code === 'email_not_confirmed'
      ) {
        setErrorMsg(t('error_login_failed'));
      } else if (isSupabaseAuthRateLimitError(error)) {
        setErrorMsg('요청이 많아 일시적으로 로그인 제한 중입니다. 1~2분 후 다시 시도해 주세요.');
      } else if (message.includes('email not confirmed') || message.includes('email_not_confirmed')) {
        setErrorMsg(t('error_email_verification'));
      } else {
        setErrorMsg(t('error_login_failed'));
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    if (signupSubmitLockRef.current) return;
    signupSubmitLockRef.current = true;
    setLoading(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
    // 비밀번호 확인
    if (password !== confirmPassword) {
      setErrorMsg(t('error_password_mismatch'));
      return;
    }

    // 비밀번호 강도 검증 (최소 8자)
    if (password.length < 8) {
      setErrorMsg(t('error_password_min'));
      return;
    }

    // 별명 필수 검증
    const trimmedNickname = nickname.trim();
    if (!trimmedNickname) {
      setErrorMsg(t('error_nickname_required'));
      return;
    }
    if (trimmedNickname.length < 2 || trimmedNickname.length > 20) {
      setErrorMsg(t('error_nickname_length'));
      return;
    }

    let normalizedEmail = '';
    try {
      normalizedEmail = email.trim().toLowerCase();

      const cooldownUntil = signupCooldownByEmailRef.current[normalizedEmail];
      if (cooldownUntil && Date.now() < cooldownUntil) {
        const sec = Math.ceil((cooldownUntil - Date.now()) / 1000);
        setErrorMsg(`같은 이메일로는 ${sec}초 후에 다시 시도할 수 있습니다.`);
        return;
      }

      // 다른 계정 세션이 남아 있을 때만 signOut (없을 때 불필요한 GoTrue 호출 제거 → rate limit 완화)
      try {
        const { data: { session: existing } } = await supabase.auth.getSession();
        if (existing) {
          try {
            await supabase.auth.signOut();
          } catch (signOutErr) {
            if (process.env.NODE_ENV === 'development') {
              console.warn('[Sign up] pre-signout ignored:', signOutErr);
            }
          }
        }
      } catch (_) {}

      const signupNickname = trimmedNickname;
      const pendingInviteCode = typeof window !== 'undefined' ? getSessionStoredInviteCode() : null;

      // 이메일 인증 후 가입: Supabase signUp(확인 메일) → 링크의 /auth/callback 에서 세션 확정
      const redirectTo =
        typeof window !== 'undefined'
          ? `${window.location.origin}/auth/callback`
          : '/auth/callback';

      const { error, data } = await supabase.auth.signUp({
        email: normalizedEmail,
        password,
        options: {
          emailRedirectTo: redirectTo,
          data: {
            nickname: signupNickname,
            full_name: signupNickname,
          },
        },
      });

      if (error) {
        const firstMsg = String(error.message || '');
        const isRateLimited = isSupabaseAuthRateLimitError(error);
        if (
          !isRateLimited &&
          /redirect|email redirect|invalid redirect|not allowed/i.test(firstMsg)
        ) {
          setErrorMsg(
            `인증 메일 링크를 쓰려면 Supabase 대시보드 → Authentication → URL Configuration → Redirect URLs에 다음 주소를 추가해야 합니다: ${redirectTo}`
          );
          return;
        }
        throw error;
      }

      if (data.user) {
        if (pendingInviteCode && typeof window !== 'undefined') {
          try {
            await fetch(`${window.location.origin}/api/invite/store-pending`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ email: normalizedEmail, invite_code: pendingInviteCode }),
            });
          } catch (_) {}
        }

        const isEmailConfirmed = data.user.email_confirmed_at !== null;

        try {
          await supabase.from('profiles').upsert(
            {
              id: data.user.id,
              email: normalizedEmail,
              nickname: signupNickname,
            },
            { onConflict: 'id' }
          );
        } catch (profileError) {
          console.warn('profiles 테이블 업데이트 실패 (무시):', profileError);
        }

        if (!isEmailConfirmed) {
          setSuccessMsg(t('success_signup_check_email'));
          setTimeout(() => {
            setMode('login');
            setEmail('');
            setPassword('');
            setConfirmPassword('');
            setNickname('');
            setSuccessMsg('');
          }, 3000);
          return;
        }

        const session = data.session;
        const isNewUserSession = session?.user?.id === data.user?.id;
        if (session && isNewUserSession) {
          await new Promise((resolve) => setTimeout(resolve, 100));
          const params =
            typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
          const invite = resolveInviteFromUrlOrSession(params);
          router.push(buildOnboardingPath(invite));
        } else {
          setSuccessMsg(t('success_signup_done'));
          setTimeout(() => {
            setMode('login');
            setEmail('');
            setPassword('');
            setConfirmPassword('');
            setNickname('');
            setSuccessMsg('');
          }, 3000);
        }
      }
    } catch (error: any) {
      // 프로덕션에서도 코드·상태만 로그(이메일은 넣지 않음) — 실제 원인 파악용
      console.warn('[Sign up] failed:', formatSupabaseAuthErrorForLog(error));

      const message = String(error?.message || '');
      const code = String((error as { code?: string })?.code || '').trim();

      if (/already registered|already exists|already been registered|user already registered/i.test(message)) {
        setErrorMsg(t('error_email_taken'));
      } else if (/invalid email|email.*invalid|email_address_invalid/i.test(message + ' ' + code)) {
        setErrorMsg('이메일 형식이 올바르지 않습니다.');
      } else if (/password/i.test(message) && /weak|short|minimum|at least/i.test(message)) {
        setErrorMsg(t('error_password_min'));
      } else if (isSupabaseAuthRateLimitError(error)) {
        if (normalizedEmail) {
          signupCooldownByEmailRef.current[normalizedEmail] = Date.now() + 180_000;
        }
        setErrorMsg('잠시 후 다시 시도해 주세요. (요청이 많아 일시적으로 제한되었습니다.)');
      } else if (/signups not allowed|signup_disabled/i.test(message + ' ' + code)) {
        setErrorMsg('현재 이메일 가입이 비활성화되어 있습니다. 관리자에게 문의해주세요.');
      } else {
        const hint = code && !message.includes('@') ? ` (${code})` : '';
        setErrorMsg(`${t('error_signup_failed')}${hint}`);
      }
    }
    } finally {
      signupSubmitLockRef.current = false;
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    setLoading(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      // SSR 안전성: window 객체가 있을 때만 origin 사용
      const redirectTo = typeof window !== 'undefined' 
        ? `${window.location.origin}/reset-password`
        : '/reset-password';
      
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo
      });

      if (error) throw error;

      setSuccessMsg(t('success_reset_sent'));
      // 3초 후 로그인 모드로 전환
      setTimeout(() => {
        setMode('login');
        setEmail('');
        setSuccessMsg('');
      }, 3000);
    } catch (error: any) {
      // 보안: 프로덕션 환경에서는 상세 에러 정보 노출 방지
      if (process.env.NODE_ENV === 'development') {
        console.error('Forgot password error:', error);
      }
      setErrorMsg(t('error_send_failed'));
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    if (mode === 'login') {
      handleLogin(e);
    } else if (mode === 'signup') {
      handleSignup(e);
    } else if (mode === 'forgot') {
      handleForgotPassword(e);
    }
  };

  const switchMode = (newMode: Mode) => {
    setMode(newMode);
    setErrorMsg('');
    setSuccessMsg('');
    setPassword('');
    setConfirmPassword('');
    setNickname('');
  };

  const inputStyle = {
    width: '100%',
    height: '60px',
    backgroundColor: '#ffffff',
    border: '2px solid #e2e8f0',
    borderRadius: '16px',
    padding: '0 20px',
    fontSize: '16px',
    boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
    outline: 'none',
    color: '#1a202c',
    transition: 'all 0.3s ease',
    boxSizing: 'border-box' as const
  };

  const buttonStyle = {
    width: '100%',
    height: '60px',
    background: loading 
      ? 'linear-gradient(135deg, #94a3b8 0%, #64748b 100%)'
      : 'linear-gradient(135deg, rgb(var(--brand-primary)) 0%, rgb(var(--brand-secondary)) 100%)',
    color: '#ffffff',
    border: 'none',
    borderRadius: '16px',
    fontSize: '18px',
    fontWeight: '700',
    marginTop: '8px',
    boxShadow: loading
      ? '0 4px 12px rgba(0,0,0,0.1)'
      : '0 8px 24px rgba(102, 126, 234, 0.4)',
    cursor: loading ? 'not-allowed' as const : 'pointer' as const,
    transition: 'all 0.3s ease',
    position: 'relative' as const,
    overflow: 'hidden' as const
  };
  const passwordInputStyle = {
    ...inputStyle,
    letterSpacing: '2px',
  };

  return (
    <div
      className="relative flex min-h-dvh flex-col items-center justify-center overflow-x-hidden overflow-y-auto bg-[linear-gradient(135deg,#f5f7fa_0%,#c3cfe2_100%)] p-5"
      style={{ fontFamily: getFontStyle(lang, 'body').fontFamily }}
    >
      {/* 배경 장식 요소 */}
      <div className="absolute -right-[20%] -top-1/2 z-0 h-[500px] w-[500px] rounded-full bg-[linear-gradient(135deg,rgba(102,126,234,0.1)_0%,rgba(118,75,162,0.1)_100%)]" />
      <div className="absolute -bottom-[30%] -left-[15%] z-0 h-[400px] w-[400px] rounded-full bg-[linear-gradient(135deg,rgba(118,75,162,0.1)_0%,rgba(102,126,234,0.1)_100%)]" />

      <div className="relative z-[1] w-full max-w-[420px] text-center">
        {/* 로고 영역 */}
        <div className="mb-10 [animation:fadeInDown_0.6s_ease-out]">
          <div className="mb-5 text-[100px] [filter:drop-shadow(0_4px_8px_rgba(0,0,0,0.1))]">
            🏠
          </div>
          <h1
            ref={loginTitleRef}
            className="mb-3 overflow-hidden whitespace-nowrap bg-[linear-gradient(135deg,rgb(var(--brand-primary))_0%,rgb(var(--brand-secondary))_100%)] text-ellipsis tracking-[-0.5px] [background-clip:text] [color:transparent] [text-fill-color:transparent] [-webkit-background-clip:text] [-webkit-text-fill-color:transparent]"
            style={{
              fontSize: loginTitleFontSize != null ? `${loginTitleFontSize}px` : '48px',
              fontFamily: getFontStyle(lang, 'title').fontFamily,
              fontWeight: getFontStyle(lang, 'title').fontWeight,
            }}
          >
            <AppTitleContent title={ct('app_title')} />
          </h1>
          <p
            className="text-base font-medium leading-[1.6] text-slate-500"
          >
            {t('subtitle')}
          </p>
        </div>

        {/* 모드 전환 탭 */}
        <div className="mb-6 flex justify-center gap-2">
          <button
            type="button"
            onClick={() => switchMode('login')}
            className={cn(
              'cursor-pointer rounded-xl border-none px-5 py-2.5 text-sm font-semibold transition-all duration-300',
              mode === 'login'
                ? 'bg-[linear-gradient(135deg,rgb(var(--brand-primary))_0%,rgb(var(--brand-secondary))_100%)] text-white shadow-[0_4px_12px_rgba(102,126,234,0.3)]'
                : 'bg-white text-slate-500 shadow-[0_2px_8px_rgba(0,0,0,0.08)]',
            )}
          >
            {t('tab_login')}
          </button>
          <button
            type="button"
            onClick={() => switchMode('signup')}
            className={cn(
              'cursor-pointer rounded-xl border-none px-5 py-2.5 text-sm font-semibold transition-all duration-300',
              mode === 'signup'
                ? 'bg-[linear-gradient(135deg,rgb(var(--brand-primary))_0%,rgb(var(--brand-secondary))_100%)] text-white shadow-[0_4px_12px_rgba(102,126,234,0.3)]'
                : 'bg-white text-slate-500 shadow-[0_2px_8px_rgba(0,0,0,0.08)]',
            )}
          >
            {t('tab_signup')}
          </button>
          <button
            type="button"
            onClick={() => switchMode('forgot')}
            className={cn(
              'cursor-pointer rounded-xl border-none px-5 py-2.5 text-sm font-semibold transition-all duration-300',
              mode === 'forgot'
                ? 'bg-[linear-gradient(135deg,rgb(var(--brand-primary))_0%,rgb(var(--brand-secondary))_100%)] text-white shadow-[0_4px_12px_rgba(102,126,234,0.3)]'
                : 'bg-white text-slate-500 shadow-[0_2px_8px_rgba(0,0,0,0.08)]',
            )}
          >
            {t('tab_forgot')}
          </button>
        </div>

        {/* 입력 폼 영역 */}
        <form 
          onSubmit={handleSubmit} 
          className="fade-in flex flex-col gap-5 [animation:fadeInUp_0.6s_ease-out_0.2s_both]"
        >
          {/* 별명 입력 (가입 모드에서만) */}
          {mode === 'signup' && (
            <div className="relative">
              <input
                type="text"
                placeholder={t('placeholder_nickname')}
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                maxLength={20}
                style={inputStyle}
                onFocus={(e) => {
                  e.target.style.borderColor = '#667eea';
                  e.target.style.boxShadow = '0 4px 16px rgba(102, 126, 234, 0.2)';
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = '#e2e8f0';
                  e.target.style.boxShadow = '0 4px 12px rgba(0,0,0,0.08)';
                }}
              />
            </div>
          )}

          {/* 이메일 입력 */}
          <div className="relative">
            <input
              type="email"
              placeholder={t('placeholder_email')}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              style={inputStyle}
              onFocus={(e) => {
                e.target.style.borderColor = '#667eea';
                e.target.style.boxShadow = '0 4px 16px rgba(102, 126, 234, 0.2)';
                if (!email && mode === 'login' && isMounted && lastEmailFromStorage) {
                  setEmail(lastEmailFromStorage);
                }
              }}
              onBlur={(e) => {
                e.target.style.borderColor = '#e2e8f0';
                e.target.style.boxShadow = '0 4px 12px rgba(0,0,0,0.08)';
              }}
            />
            {/* 이전 이메일 투명 오버레이 (입력 필드가 비어있을 때만) */}
            {isMounted && mode === 'login' && !email && lastEmailFromStorage && (
              <div className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[15px] font-normal text-[rgba(100,116,139,0.4)]">
                {lastEmailFromStorage}
              </div>
            )}
          </div>

          {/* 비밀번호 입력 (로그인/가입 모드에서만) */}
          {(mode === 'login' || mode === 'signup') && (
            <div className="relative">
              <input
                type="password"
                placeholder={t('placeholder_password')}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                style={passwordInputStyle}
                onFocus={(e) => {
                  e.target.style.borderColor = '#667eea';
                  e.target.style.boxShadow = '0 4px 16px rgba(102, 126, 234, 0.2)';
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = '#e2e8f0';
                  e.target.style.boxShadow = '0 4px 12px rgba(0,0,0,0.08)';
                }}
              />
            </div>
          )}

          {/* 로그인 상태 유지 (로그인 모드에서만) */}
          {mode === 'login' && (
            <label className="-mt-1 flex cursor-pointer select-none items-center gap-2.5 text-sm text-slate-500">
              <input
                type="checkbox"
                checked={keepLoggedIn}
                onChange={(e) => setKeepLoggedIn(e.target.checked)}
                className="h-[18px] w-[18px] cursor-pointer accent-[#667eea]"
              />
              <span>{t('keep_logged_in')}</span>
            </label>
          )}

          {/* 비밀번호 확인 입력 (가입 모드에서만) */}
          {mode === 'signup' && (
            <div className="relative">
              <input
                type="password"
                placeholder={t('placeholder_confirm_password')}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                style={passwordInputStyle}
                onFocus={(e) => {
                  e.target.style.borderColor = '#667eea';
                  e.target.style.boxShadow = '0 4px 16px rgba(102, 126, 234, 0.2)';
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = '#e2e8f0';
                  e.target.style.boxShadow = '0 4px 12px rgba(0,0,0,0.08)';
                }}
              />
            </div>
          )}

          {/* 성공 메시지 */}
          {successMsg && (
            <div className="-mt-2 rounded-xl border border-green-300 bg-green-50 px-4 py-3 text-sm text-green-500 [animation:fadeIn_0.5s_ease-in-out]">
              {successMsg}
            </div>
          )}

          {/* 에러 메시지 */}
          {errorMsg && (
            <div className="-mt-2 whitespace-pre-line rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-500 [animation:shake_0.5s_ease-in-out]">
              {errorMsg}
            </div>
          )}

          {/* 제출 버튼 */}
          <button
            type="submit"
            disabled={loading}
            style={buttonStyle}
            onMouseDown={(e) => {
              if (!loading) {
                e.currentTarget.style.transform = 'scale(0.98)';
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(102, 126, 234, 0.3)';
              }
            }}
            onMouseUp={(e) => {
              e.currentTarget.style.transform = 'scale(1)';
              e.currentTarget.style.boxShadow = '0 8px 24px rgba(102, 126, 234, 0.4)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'scale(1)';
              e.currentTarget.style.boxShadow = '0 8px 24px rgba(102, 126, 234, 0.4)';
            }}
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <span>{mode === 'login' ? t('btn_loading_login') : mode === 'signup' ? t('btn_loading_signup') : t('btn_loading_send')}</span>
                <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
              </span>
            ) : (
              mode === 'login' ? t('btn_submit_login') : mode === 'signup' ? t('btn_submit_signup') : t('btn_submit_reset')
            )}
          </button>
        </form>
        
        {/* 하단 여백 */}
        <div className="h-10" />
      </div>

    </div>
  );
}
