'use client';

import { useCallback, useEffect, useState } from 'react';
import type { PictureFindSharedPuzzle } from '@/lib/picture-find/puzzle-types';
import { fetchPictureFindPuzzles } from '@/lib/picture-find/puzzle-api';

export function usePictureFindPuzzles(groupId: string | null, enabled: boolean) {
  const [puzzles, setPuzzles] = useState<PictureFindSharedPuzzle[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!groupId || !enabled) {
      setPuzzles([]);
      setError(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await fetchPictureFindPuzzles(groupId);
      setPuzzles(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : '가족 퍼즐을 불러오지 못했습니다.');
      setPuzzles([]);
    } finally {
      setLoading(false);
    }
  }, [groupId, enabled]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { puzzles, loading, error, reload };
}
