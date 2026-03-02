'use client';

import React from 'react';

/**
 * 앱 타이틀 통합 렌더링: "(허쓰)" 등 괄호 발음은 0.65em, ": " 뒤 부제는 0.333em.
 * 로그인·대시보드 등 동일한 타이틀 표시에 사용.
 */
export function AppTitleContent({ title }: { title: string }): React.ReactNode {
  if (!title) return null;
  const colon = title.indexOf(': ');
  if (colon < 0) return title;
  const mainStr = title.slice(0, colon + 2);
  const sub = title.slice(colon + 2);
  const parenMatch = mainStr.match(/^(.*?)(\s*\([^)]+\))(.*)$/);
  const main: React.ReactNode = parenMatch ? (
    <>
      {parenMatch[1]}
      <span style={{ fontSize: '0.65em', verticalAlign: 'baseline' }}>{parenMatch[2]}</span>
      {parenMatch[3]}
    </>
  ) : (
    mainStr
  );
  return (
    <>
      {main}
      <span style={{ fontSize: '0.333em', verticalAlign: 'baseline' }}>{sub}</span>
    </>
  );
}
