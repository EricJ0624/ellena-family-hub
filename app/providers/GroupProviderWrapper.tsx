'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { GroupProvider } from '@/app/contexts/GroupContext';

export function GroupProviderWrapper({ children }: { children: React.ReactNode }) {
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUserId(user?.id || null);
    };

    getUser();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUserId(session?.user?.id || null);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // Always wrap with GroupProvider so LanguageProvider and useGroup/useLanguage are available during SSR/prerender.
  return <GroupProvider userId={userId}>{children}</GroupProvider>;
}

