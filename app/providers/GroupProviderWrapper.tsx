'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { GroupProvider } from '@/app/contexts/GroupContext';

export function GroupProviderWrapper({ children }: { children: React.ReactNode }) {
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 현재 사용자 ID 가져오기
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUserId(user?.id || null);
      setLoading(false);
    };

    getUser();

    // 인증 상태 변경 감지
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUserId(session?.user?.id || null);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  if (loading) {
    return <>{children}</>;
  }

  return <GroupProvider userId={userId}>{children}</GroupProvider>;
}

