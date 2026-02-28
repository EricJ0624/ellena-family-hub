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
      : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
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

  return (
    <div style={{
      minHeight: '100dvh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)',
      padding: '20px',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
      position: 'relative',
      overflow: 'hidden'
    }}>
      {/* 배경 장식 요소 */}
      <div style={{
        position: 'absolute',
        top: '-50%',
        right: '-20%',
        width: '500px',
        height: '500px',
        borderRadius: '50%',
        background: 'linear-gradient(135deg, rgba(102, 126, 234, 0.1) 0%, rgba(118, 75, 162, 0.1) 100%)',
        zIndex: 0
      }} />
      <div style={{
        position: 'absolute',
        bottom: '-30%',
        left: '-15%',
        width: '400px',
        height: '400px',
        borderRadius: '50%',
        background: 'linear-gradient(135deg, rgba(118, 75, 162, 0.1) 0%, rgba(102, 126, 234, 0.1) 100%)',
        zIndex: 0
      }} />

      <div style={{ 
        width: '100%', 
        maxWidth: '420px', 
        textAlign: 'center',
        position: 'relative',
        zIndex: 1
      }}>
        {/* 로고 영역 */}
        <div style={{ 
          marginBottom: '40px',
          animation: 'fadeInDown 0.6s ease-out'
        }}>
          <div style={{ 
            fontSize: '100px', 
            marginBottom: '20px',
            filter: 'drop-shadow(0 4px 8px rgba(0,0,0,0.1))'
          }}>🔐</div>
          
          <h1 style={{ 
            fontSize: '42px', 
            fontWeight: '800', 
            color: '#1a202c', 
            margin: '0 0 12px 0',
            letterSpacing: '-1.5px',
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text'
          }}>
            {rpt('title')}
          </h1>
          
          <p style={{ 
            fontSize: '17px', 
            color: '#64748b', 
            fontWeight: '500', 
            lineHeight: '1.6',
            margin: 0,
            letterSpacing: '0.3px'
          }}>
            {rpt('subtitle').split('\n').map((line, i, arr) => (
              <span key={i}>{line}{i < arr.length - 1 && <br />}</span>
            ))}
          </p>
        </div>

        {/* 입력 폼 영역 */}
        <form 
          onSubmit={handleResetPassword} 
          className="fade-in"
          style={{ 
            display: 'flex', 
            flexDirection: 'column', 
            gap: '20px',
            animation: 'fadeInUp 0.6s ease-out 0.2s both'
          }}
        >
          {/* 새 비밀번호 입력 */}
          <div style={{ position: 'relative' }}>
            <input
              type="password"
              placeholder={rpt('placeholder_new_password')}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              style={{
                ...inputStyle,
                letterSpacing: '2px'
              }}
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

          {/* 비밀번호 확인 입력 */}
          <div style={{ position: 'relative' }}>
            <input
              type="password"
              placeholder={rpt('placeholder_confirm')}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              style={{
                ...inputStyle,
                letterSpacing: '2px'
              }}
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

          {/* 성공 메시지 */}
          {successMsg && (
            <div style={{ 
              color: '#10b981', 
              fontSize: '14px', 
              marginTop: '-8px',
              padding: '12px 16px',
              backgroundColor: '#f0fdf4',
              borderRadius: '12px',
              border: '1px solid #86efac',
              animation: 'fadeIn 0.5s ease-in-out'
            }}>
              {successMsg}
            </div>
          )}

          {/* 에러 메시지 */}
          {errorMsg && (
            <div style={{ 
              color: '#ef4444', 
              fontSize: '14px', 
              marginTop: '-8px',
              padding: '12px 16px',
              backgroundColor: '#fef2f2',
              borderRadius: '12px',
              border: '1px solid #fecaca',
              animation: 'shake 0.5s ease-in-out'
            }}>
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
              <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                <span>{rpt('btn_loading')}</span>
                <span style={{
                  width: '16px',
                  height: '16px',
                  border: '2px solid rgba(255,255,255,0.3)',
                  borderTop: '2px solid #ffffff',
                  borderRadius: '50%',
                  animation: 'spin 0.8s linear infinite',
                  display: 'inline-block'
                }} />
              </span>
            ) : (
              <>{rpt('btn_submit')}</>
            )}
          </button>
        </form>
        
        {/* 하단 여백 */}
        <div style={{ height: '40px' }} />
      </div>
    </div>
  );
}

