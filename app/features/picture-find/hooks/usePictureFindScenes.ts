'use client';

import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { DEFAULT_PICTURE_FIND_SCENES } from '@/lib/picture-find/default-scenes';
import type { PictureFindScene } from '@/lib/picture-find/types';

async function getAccessToken(): Promise<string | null> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return session?.access_token ?? null;
}

export function usePictureFindScenes(groupId: string | null) {
  const [scenes, setScenes] = useState<PictureFindScene[]>(DEFAULT_PICTURE_FIND_SCENES);
  const [loading, setLoading] = useState(false);
  const [usingFallback, setUsingFallback] = useState(true);

  const reload = useCallback(async () => {
    if (!groupId) {
      setScenes(DEFAULT_PICTURE_FIND_SCENES);
      setUsingFallback(true);
      return;
    }

    setLoading(true);
    try {
      const token = await getAccessToken();
      if (!token) {
        setScenes(DEFAULT_PICTURE_FIND_SCENES);
        setUsingFallback(true);
        return;
      }

      const response = await fetch(
        `/api/v1/picture-find/scenes?groupId=${encodeURIComponent(groupId)}`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      const result = await response.json();

      if (!response.ok || !Array.isArray(result.data) || result.data.length === 0) {
        setScenes(DEFAULT_PICTURE_FIND_SCENES);
        setUsingFallback(true);
        return;
      }

      setScenes(result.data as PictureFindScene[]);
      setUsingFallback(Boolean(result.fallback));
    } catch {
      setScenes(DEFAULT_PICTURE_FIND_SCENES);
      setUsingFallback(true);
    } finally {
      setLoading(false);
    }
  }, [groupId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { scenes, loading, usingFallback, reload };
}
