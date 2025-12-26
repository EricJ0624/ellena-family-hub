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
        console.log('Login successful, session:', !!session);
        
        if (session) {
          router.push('/dashboard');
        } else {
          setErrorMsg('세션 저장에 실패했습니다. 다시 시도해주세요.');
        }
      }
    } catch (error: any) {
      console.error('Login error:', error);
      setErrorMsg('로그인 실패: 정보를 확인해주세요.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0, left: 0, right: 0, bottom: 0,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#f8f9fa',
      padding: '0 40px',
      zIndex: 9999,
      fontFamily: '-apple-system, sans-serif'
    }}>
      <div style={{ width: '100%', maxWidth: '360px', textAlign: 'center' }}>
        
        {/* 원본의 집 이모지 크기 복구 */}
        <div style={{ fontSize: '80px', marginBottom: '24px' }}>🏠</div>

        {/* 타이틀 및 텍스트 굵기 복구 */}
        <div style={{ marginBottom: '48px' }}>
          <h1 style={{ 
            fontSize: '36px', 
            fontWeight: '900', 
            color: '#000', 
            margin: '0 0 10px 0',
            letterSpacing: '-1px'
          }}>
            Family Hub
          </h1>
          <p style={{ 
            fontSize: '18px', 
            color: '#8e8e93', 
            fontWeight: '500', 
            lineHeight: '1.4',
            margin: 0
          }}>
            우리 가족만의 안전한 공간입<br />니다.
          </p>
        </div>

        {/* 입력창: 원본과 동일한 높이와 둥근 모서리 */}
        <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <input
            type="email"
            placeholder="이메일"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            style={{
              width: '100%',
              height: '74px',
              backgroundColor: '#fff',
              border: '1px solid #efeff4',
              borderRadius: '30px',
              textAlign: 'center',
              fontSize: '18px',
              boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
              outline: 'none',
              color: '#000'
            }}
          />
          <input
            type="password"
            placeholder="········"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            style={{
              width: '100%',
              height: '74px',
              backgroundColor: '#fff',
              border: '1px solid #efeff4',
              borderRadius: '30px',
              textAlign: 'center',
              fontSize: '32px',
              letterSpacing: '0.3em',
              boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
              outline: 'none',
              color: '#000'
            }}
          />

          {errorMsg && (
            <p style={{ color: '#ff3b30', fontSize: '14px', marginTop: '4px' }}>{errorMsg}</p>
          )}

          {/* 버튼: 원본의 짙은 네이비와 볼륨감 */}
          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              height: '74px',
              backgroundColor: '#0f172a',
              color: '#fff',
              border: 'none',
              borderRadius: '30px',
              fontSize: '20px',
              fontWeight: '700',
              marginTop: '12px',
              boxShadow: '0 8px 16px rgba(15,23,42,0.15)',
              cursor: 'pointer'
            }}
          >
            {loading ? '접속 중...' : '접속하기'}
          </button>
        </form>
        
        {/* 하단 툴바 여백 */}
        <div style={{ height: '80px' }} />
      </div>
    </div>
  );
}