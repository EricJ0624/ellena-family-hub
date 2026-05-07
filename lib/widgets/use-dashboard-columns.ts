'use client';

import { useLayoutEffect, useState } from 'react';
import { getDashboardColumnCount } from './grid';

/** 대시보드 그리드 열 수 (viewport; SSR·초기값 1) */
export function useDashboardColumnCount(): number {
  const [cols, setCols] = useState(1);

  useLayoutEffect(() => {
    const read = () => setCols(getDashboardColumnCount(window.innerWidth));
    read();
    window.addEventListener('resize', read);
    return () => window.removeEventListener('resize', read);
  }, []);

  return cols;
}
