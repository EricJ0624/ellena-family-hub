'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase'; 
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    setLoading(true);
    setErrorMsg('');

    try {
      const { error, data } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      
      if (data.user) {
        // 세션이 저장되도록 약간의 지연 후 리다이렉트
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // 세션 확인
        const { data: { session } } = await supabase.auth.getSession();
        // 보안: 프로덕션 환경에서는 콘솔 로그 제거
        if (process.env.NODE_ENV === 'development') {
          console.log('Login successful, session:', !!session);
        }
        
        if (session) {
          router.push('/dashboard');
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

        {/* 입력 폼 영역 */}
        <form 
          onSubmit={handleLogin} 
          className="fade-in"
          style={{ 
            display: 'flex', 
            flexDirection: 'column', 
            gap: '20px',
            animation: 'fadeInUp 0.6s ease-out 0.2s both'
          }}
        >
          {/* 이메일 입력 */}
          <div style={{ position: 'relative' }}>
            <input
              type="email"
              placeholder="이메일 주소"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              style={{
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
                boxSizing: 'border-box'
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

          {/* 비밀번호 입력 */}
          <div style={{ position: 'relative' }}>
            <input
              type="password"
              placeholder="비밀번호"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              style={{
                width: '100%',
                height: '60px',
                backgroundColor: '#ffffff',
                border: '2px solid #e2e8f0',
                borderRadius: '16px',
                padding: '0 20px',
                fontSize: '16px',
                letterSpacing: '2px',
                boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
                outline: 'none',
                color: '#1a202c',
                transition: 'all 0.3s ease',
                boxSizing: 'border-box'
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

          {/* 로그인 버튼 */}
          <button
            type="submit"
            disabled={loading}
            style={{
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
              cursor: loading ? 'not-allowed' : 'pointer',
              transition: 'all 0.3s ease',
              position: 'relative',
              overflow: 'hidden'
            }}
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
                <span>접속 중</span>
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
              '접속하기'
            )}
          </button>
        </form>
        
        {/* 하단 여백 */}
        <div style={{ height: '40px' }} />
      </div>

    </div>
  );
}