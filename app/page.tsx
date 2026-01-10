'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase'; 
import { useRouter } from 'next/navigation';

type Mode = 'login' | 'signup' | 'forgot';

const LAST_EMAIL_KEY = 'SFH_LAST_EMAIL';

export default function LoginPage() {
  const router = useRouter();
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

  // Hydration 오류 방지: 마운트 후에만 클라이언트 사이드 로직 실행
  useEffect(() => {
    setIsMounted(true);
  }, []);

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

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    setLoading(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      // signInWithPassword는 단일 인자만 받습니다
      // 세션 지속은 lib/supabase.ts에서 이미 persistSession: true로 설정되어 있습니다
      const { error, data } = await supabase.auth.signInWithPassword({ 
        email, 
        password 
      });
      if (error) throw error;
      
      if (data.user) {
        // 이메일 저장 (다음 로그인 시 자동완성용)
        if (email && isMounted) {
          localStorage.setItem(LAST_EMAIL_KEY, email);
          setLastEmailFromStorage(email);
        }
        
        // 세션이 저장되도록 약간의 지연 후 리다이렉트
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // 세션 확인
        const { data: { session } } = await supabase.auth.getSession();
        // 보안: 프로덕션 환경에서는 콘솔 로그 제거
        if (process.env.NODE_ENV === 'development') {
          console.log('Login successful, session:', !!session);
        }
        
        if (session && session.user) {
          // 시스템 관리자는 바로 대시보드로
          const { data: isAdmin } = await supabase.rpc('is_system_admin', {
            user_id_param: session.user.id,
          });

          if (isAdmin) {
            router.push('/dashboard');
            return;
          }

          // 그룹이 있는지 확인
          const { data: memberships } = await supabase
            .from('memberships')
            .select('group_id')
            .eq('user_id', session.user.id)
            .limit(1);

          // 그룹 소유자 확인
          const { data: ownedGroups } = await supabase
            .from('groups')
            .select('id')
            .eq('owner_id', session.user.id)
            .limit(1);

          // 그룹이 없으면 온보딩으로, 있으면 대시보드로
          if ((!memberships || memberships.length === 0) && (!ownedGroups || ownedGroups.length === 0)) {
            router.push('/onboarding');
          } else {
            router.push('/dashboard');
          }
        } else {
          setErrorMsg('세션 저장에 실패했습니다. 다시 시도해주세요.');
        }
      }
    } catch (error: any) {
      // 보안: 프로덕션 환경에서는 상세 에러 정보 노출 방지
      if (process.env.NODE_ENV === 'development') {
        console.error('Login error:', error);
      }
      setErrorMsg('로그인 실패: 정보를 확인해주세요.');
    } finally {
      setLoading(false);
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    setLoading(true);
    setErrorMsg('');
    setSuccessMsg('');

    // 비밀번호 확인
    if (password !== confirmPassword) {
      setErrorMsg('비밀번호가 일치하지 않습니다.');
      setLoading(false);
      return;
    }

    // 비밀번호 강도 검증 (최소 8자)
    if (password.length < 8) {
      setErrorMsg('비밀번호는 최소 8자 이상이어야 합니다.');
      setLoading(false);
      return;
    }

    try {
      const signupNickname = nickname || email.split('@')[0];
      
      const { error, data } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            nickname: signupNickname,
            full_name: signupNickname
          }
        }
      });

      if (error) throw error;

      if (data.user) {
        // profiles 테이블에 nickname 저장 (비동기, 실패해도 가입은 성공)
        try {
          await supabase
            .from('profiles')
            .upsert({
              id: data.user.id,
              email: email,
              nickname: signupNickname
            }, {
              onConflict: 'id'
            });
        } catch (profileError) {
          console.warn('profiles 테이블 업데이트 실패 (무시):', profileError);
          // 가입은 성공했으므로 계속 진행
        }

        // 세션이 저장되도록 약간의 지연 후 온보딩 페이지로 리다이렉트
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // 세션 확인
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          // 온보딩 페이지로 리다이렉트
          router.push('/onboarding');
        } else {
          setSuccessMsg('가입이 완료되었습니다! 이메일을 확인해주세요. (이메일 인증이 설정된 경우)');
          // 3초 후 로그인 모드로 전환
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
      // 보안: 프로덕션 환경에서는 상세 에러 정보 노출 방지
      if (process.env.NODE_ENV === 'development') {
        console.error('Signup error:', error);
      }
      if (error.message?.includes('already registered')) {
        setErrorMsg('이미 등록된 이메일입니다.');
      } else {
        setErrorMsg('가입 실패: 정보를 확인해주세요.');
      }
    } finally {
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

      setSuccessMsg('비밀번호 재설정 링크를 이메일로 발송했습니다. 이메일을 확인해주세요.');
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
      setErrorMsg('이메일 발송 실패: 이메일을 확인해주세요.');
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
      minHeight: '100dvh', // 모바일 뷰포트 높이 지원
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
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
          }}>🏠</div>
          
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
            Family Hub
          </h1>
          
          <p style={{ 
            fontSize: '17px', 
            color: '#64748b', 
            fontWeight: '500', 
            lineHeight: '1.6',
            margin: 0,
            letterSpacing: '0.3px'
          }}>
            우리 가족만의<br />안전한 공간입니다
          </p>
        </div>

        {/* 모드 전환 탭 */}
        <div style={{
          display: 'flex',
          gap: '8px',
          marginBottom: '24px',
          justifyContent: 'center'
        }}>
          <button
            type="button"
            onClick={() => switchMode('login')}
            style={{
              padding: '10px 20px',
              borderRadius: '12px',
              border: 'none',
              background: mode === 'login' 
                ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
                : '#ffffff',
              color: mode === 'login' ? '#ffffff' : '#64748b',
              fontSize: '14px',
              fontWeight: '600',
              cursor: 'pointer',
              transition: 'all 0.3s ease',
              boxShadow: mode === 'login' 
                ? '0 4px 12px rgba(102, 126, 234, 0.3)'
                : '0 2px 8px rgba(0,0,0,0.08)'
            }}
          >
            로그인
          </button>
          <button
            type="button"
            onClick={() => switchMode('signup')}
            style={{
              padding: '10px 20px',
              borderRadius: '12px',
              border: 'none',
              background: mode === 'signup' 
                ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
                : '#ffffff',
              color: mode === 'signup' ? '#ffffff' : '#64748b',
              fontSize: '14px',
              fontWeight: '600',
              cursor: 'pointer',
              transition: 'all 0.3s ease',
              boxShadow: mode === 'signup' 
                ? '0 4px 12px rgba(102, 126, 234, 0.3)'
                : '0 2px 8px rgba(0,0,0,0.08)'
            }}
          >
            가입하기
          </button>
          <button
            type="button"
            onClick={() => switchMode('forgot')}
            style={{
              padding: '10px 20px',
              borderRadius: '12px',
              border: 'none',
              background: mode === 'forgot' 
                ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
                : '#ffffff',
              color: mode === 'forgot' ? '#ffffff' : '#64748b',
              fontSize: '14px',
              fontWeight: '600',
              cursor: 'pointer',
              transition: 'all 0.3s ease',
              boxShadow: mode === 'forgot' 
                ? '0 4px 12px rgba(102, 126, 234, 0.3)'
                : '0 2px 8px rgba(0,0,0,0.08)'
            }}
          >
            비밀번호 찾기
          </button>
        </div>

        {/* 입력 폼 영역 */}
        <form 
          onSubmit={handleSubmit} 
          className="fade-in"
          style={{ 
            display: 'flex', 
            flexDirection: 'column', 
            gap: '20px',
            animation: 'fadeInUp 0.6s ease-out 0.2s both'
          }}
        >
          {/* 닉네임 입력 (가입 모드에서만) */}
          {mode === 'signup' && (
            <div style={{ position: 'relative' }}>
              <input
                type="text"
                placeholder="닉네임 (선택사항)"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
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
          <div style={{ position: 'relative' }}>
            <input
              type="email"
              placeholder="이메일 주소"
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
              <div style={{
                position: 'absolute',
                left: '16px',
                top: '50%',
                transform: 'translateY(-50%)',
                pointerEvents: 'none',
                color: 'rgba(100, 116, 139, 0.4)',
                fontSize: '15px',
                fontWeight: '400'
              }}>
                {lastEmailFromStorage}
              </div>
            )}
          </div>

          {/* 비밀번호 입력 (로그인/가입 모드에서만) */}
          {(mode === 'login' || mode === 'signup') && (
            <div style={{ position: 'relative' }}>
              <input
                type="password"
                placeholder="비밀번호"
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
          )}

          {/* 비밀번호 확인 입력 (가입 모드에서만) */}
          {mode === 'signup' && (
            <div style={{ position: 'relative' }}>
              <input
                type="password"
                placeholder="비밀번호 확인"
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
          )}

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
                <span>{mode === 'login' ? '접속 중' : mode === 'signup' ? '가입 중' : '발송 중'}</span>
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
              mode === 'login' ? '접속하기' : mode === 'signup' ? '가입하기' : '재설정 링크 발송'
            )}
          </button>
        </form>
        
        {/* 하단 여백 */}
        <div style={{ height: '40px' }} />
      </div>

    </div>
  );
}
