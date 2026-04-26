'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import { useLanguage } from '@/app/contexts/LanguageContext';
import { getLoginTranslation } from '@/lib/translations/login';
import { getResetPasswordTranslation, type ResetPasswordTranslations } from '@/lib/translations/resetPassword';

export default function ResetPasswordPage() {
  const router = useRouter();
  const { lang } = useLanguage();
  const rpt = (key: keyof ResetPasswordTranslations) => getResetPasswordTranslation(lang, key);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  useEffect(() => {
    // SSR 안전성: 클라이언트 사이드에서만 실행
    if (typeof window === 'undefined') return;
    
    // URL에서 토큰 확인
    const hashParams = new URLSearchParams(window.location.hash.substring(1));
    const accessToken = hashParams.get('access_token');
    const type = hashParams.get('type');

    if (type === 'recovery' && accessToken) {
      // 토큰이 있으면 세션 설정
      supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: hashParams.get('refresh_token') || ''
      });
    }
  }, []);

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    setLoading(true);
    setErrorMsg('');
    setSuccessMsg('');

    // 비밀번호 확인
    if (password !== confirmPassword) {
      setErrorMsg(getLoginTranslation(lang, 'error_password_mismatch'));
      setLoading(false);
      return;
    }

    // 비밀번호 강도 검증 (최소 8자)
    if (password.length < 8) {
      setErrorMsg(getLoginTranslation(lang, 'error_password_min'));
      setLoading(false);
      return;
    }

    try {
      const { error } = await supabase.auth.updateUser({
        password: password
      });

      if (error) throw error;

      setSuccessMsg(rpt('success_reset'));
      // 2초 후 로그인 페이지로 이동
      setTimeout(() => {
        router.push('/');
      }, 2000);
    } catch (error: any) {
      // 보안: 프로덕션 환경에서는 상세 에러 정보 노출 방지
      if (process.env.NODE_ENV === 'development') {
        console.error('Reset password error:', error);
      }
      setErrorMsg(rpt('error_reset_failed'));
    } finally {
      setLoading(false);
    }
  };

  const inputClassName =
    'box-border h-[60px] w-full rounded-2xl border-2 border-[#e2e8f0] bg-white px-5 text-base text-[#1a202c] shadow-[0_4px_12px_rgba(0,0,0,0.08)] outline-none transition-all duration-300 ease-in-out tracking-[2px] focus:border-[rgb(var(--brand-primary))] focus:shadow-[0_4px_16px_rgba(102,126,234,0.2)]';

  const buttonClassName = [
    'relative mt-2 h-[60px] w-full overflow-hidden rounded-2xl border-none text-lg font-bold text-white transition-all duration-300 ease-in-out',
    loading
      ? 'cursor-not-allowed bg-[linear-gradient(135deg,#94a3b8_0%,#64748b_100%)] shadow-[0_4px_12px_rgba(0,0,0,0.1)]'
      : 'cursor-pointer bg-[linear-gradient(135deg,rgb(var(--brand-primary))_0%,rgb(var(--brand-secondary))_100%)] shadow-[0_8px_24px_rgba(102,126,234,0.4)] active:scale-[0.98] active:shadow-[0_4px_12px_rgba(102,126,234,0.3)]',
  ].join(' ');

  return (
    <div className="relative flex min-h-dvh flex-col items-center justify-center overflow-hidden bg-[linear-gradient(135deg,#f5f7fa_0%,#c3cfe2_100%)] p-5 font-[-apple-system,BlinkMacSystemFont,Segoe_UI,Roboto,Helvetica_Neue,Arial,sans-serif]">
      {/* 배경 장식 요소 */}
      <div
        className="pointer-events-none absolute -top-1/2 -right-[20%] z-0 h-[500px] w-[500px] rounded-full bg-[linear-gradient(135deg,rgba(102,126,234,0.1)_0%,rgba(118,75,162,0.1)_100%)]"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -bottom-[30%] -left-[15%] z-0 h-[400px] w-[400px] rounded-full bg-[linear-gradient(135deg,rgba(118,75,162,0.1)_0%,rgba(102,126,234,0.1)_100%)]"
        aria-hidden
      />

      <div className="relative z-[1] w-full max-w-[420px] text-center">
        {/* 로고 영역 */}
        <div className="mb-10 animate-[fadeInDown_0.6s_ease-out]">
          <div className="mb-5 text-[100px] drop-shadow-[0_4px_8px_rgba(0,0,0,0.1)]">🔐</div>
          
          <h1 className="m-0 mb-3 bg-[linear-gradient(135deg,rgb(var(--brand-primary))_0%,rgb(var(--brand-secondary))_100%)] bg-clip-text text-[42px] font-extrabold tracking-[-1.5px] text-transparent">
            {rpt('title')}
          </h1>
          
          <p className="m-0 text-[17px] font-medium leading-[1.6] tracking-[0.3px] text-[#64748b]">
            {rpt('subtitle').split('\n').map((line, i, arr) => (
              <span key={i}>{line}{i < arr.length - 1 && <br />}</span>
            ))}
          </p>
        </div>

        {/* 입력 폼 영역 */}
        <form
          onSubmit={handleResetPassword}
          className="fade-in flex flex-col gap-5 [animation:fadeInUp_0.6s_ease-out_0.2s_both]"
        >
          {/* 새 비밀번호 입력 */}
          <div className="relative">
            <input
              type="password"
              placeholder={rpt('placeholder_new_password')}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className={inputClassName}
            />
          </div>

          {/* 비밀번호 확인 입력 */}
          <div className="relative">
            <input
              type="password"
              placeholder={rpt('placeholder_confirm')}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              className={inputClassName}
            />
          </div>

          {/* 성공 메시지 */}
          {successMsg && (
            <div className="-mt-2 animate-[fadeIn_0.5s_ease-in-out] rounded-xl border border-[#86efac] bg-[#f0fdf4] px-4 py-3 text-sm text-[#10b981]">
              {successMsg}
            </div>
          )}

          {/* 에러 메시지 */}
          {errorMsg && (
            <div className="-mt-2 animate-[shake_0.5s_ease-in-out] rounded-xl border border-[#fecaca] bg-[#fef2f2] px-4 py-3 text-sm text-[#ef4444]">
              {errorMsg}
            </div>
          )}

          {/* 제출 버튼 */}
          <button type="submit" disabled={loading} className={buttonClassName}>
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <span>{rpt('btn_loading')}</span>
                <span
                  className="inline-block h-4 w-4 animate-[spin_0.8s_linear_infinite] rounded-full border-2 border-[rgba(255,255,255,0.3)] border-t-white"
                  aria-hidden
                />
              </span>
            ) : (
              <>{rpt('btn_submit')}</>
            )}
          </button>
        </form>
        
        {/* 하단 여백 */}
        <div className="h-10" />
      </div>
    </div>
  );
}
