'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

export default function AuthCallbackPage() {
  const router = useRouter();
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
        const type = hashParams.get('type');

        if (accessToken && refreshToken) {
          // 세션 설정
          const { error: sessionError } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });

          if (sessionError) throw sessionError;

          // 실제로 요청에 붙을 세션(access_token)이 있는지 확인 후 리다이렉트
          const { data: { session } } = await supabase.auth.getSession();
          if (!session?.access_token) {
            router.push('/');
            return;
          }

          const { data: { user } } = await supabase.auth.getUser();
          if (!user) {
            router.push('/');
            return;
          }

          // 시스템 관리자 확인
          const { data: isAdmin } = await supabase.rpc('is_system_admin', {
            user_id_param: user.id,
          });

          // 그룹이 있는지 확인
          const { data: memberships } = await supabase
            .from('memberships')
            .select('group_id')
            .eq('user_id', user.id)
            .limit(1);

          const { data: ownedGroups } = await supabase
            .from('groups')
            .select('id')
            .eq('owner_id', user.id)
            .limit(1);

          const hasGroups = (memberships && memberships.length > 0) || (ownedGroups && ownedGroups.length > 0);

          if (isAdmin) {
            // 시스템 관리자: 그룹이 있으면 대시보드, 없으면 관리자 페이지
            router.push(hasGroups ? '/dashboard' : '/admin');
          } else {
            // 일반 사용자: 그룹이 없으면 온보딩으로, 있으면 대시보드로
            router.push(hasGroups ? '/dashboard' : '/onboarding');
          }
        } else {
          // 토큰이 없으면 로그인 페이지로 리다이렉트
          router.push('/');
        }
      } catch (err: any) {
        console.error('Auth callback error:', err);
        setError(err.message || '인증 처리 중 오류가 발생했습니다.');
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
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#f5f7fa',
        flexDirection: 'column',
        gap: '16px',
      }}>
        <div style={{
          width: '48px',
          height: '48px',
          border: '4px solid #e2e8f0',
          borderTop: '4px solid #9333ea',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite',
        }} />
        <p style={{ color: '#64748b', fontSize: '16px' }}>인증 처리 중...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#f5f7fa',
        flexDirection: 'column',
        gap: '16px',
        padding: '20px',
      }}>
        <div style={{
          padding: '16px',
          backgroundColor: '#fee2e2',
          border: '1px solid #fecaca',
          borderRadius: '8px',
          color: '#991b1b',
        }}>
          {error}
        </div>
        <p style={{ color: '#64748b', fontSize: '14px' }}>잠시 후 로그인 페이지로 이동합니다...</p>
      </div>
    );
  }

  return null;
}
