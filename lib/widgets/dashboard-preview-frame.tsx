'use client';

import type { ReactNode } from 'react';
import type { AppPreviewOrientation } from './preview-orientation';
import { detectDashboardShell } from './layout-shell';
/**
 * 대시보드와 동일한 그리드 실측 너비(430px 세로 프레임·main-content 패딩)를 맞추기 위한 래퍼.
 * app-container 전체(h-dvh)는 모달·인라인 편집기에 부적합하므로 프레임 너비만 재현한다.
 */
export function DashboardPreviewFrame({
  previewOrientation,
  children,
}: {
  previewOrientation: AppPreviewOrientation;
  children: ReactNode;
}) {
  const shell = typeof window !== 'undefined' ? detectDashboardShell() : 'web-preview';

  if (shell === 'desktop') {
    return <div className="mx-auto w-full max-w-6xl">{children}</div>;
  }

  if (shell === 'mobile') {
    return <div className="w-full min-w-0">{children}</div>;
  }

  const frameWidthClass =
    previewOrientation === 'portrait'
      ? 'w-[430px] max-w-[430px]'
      : 'w-full max-w-[900px]';

  return (
    <div
      className={`mx-auto shrink-0 min-w-0 ${frameWidthClass}`}
      data-shell="web-preview"
      data-preview-orientation={previewOrientation}
    >
      <div className="main-content flex min-w-0 w-full flex-col gap-[var(--spacing-lg)] overflow-x-hidden px-[var(--spacing-md)] py-[var(--spacing-xl)] md:px-[var(--spacing-lg)]">
        {children}
      </div>
    </div>
  );
}
