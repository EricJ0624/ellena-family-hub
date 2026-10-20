'use client';

import type { ReactNode } from 'react';
import { TopLayerDialog } from '@/app/components/TopLayerDialog';

type GlassSafeModalProps = {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  maxWidthClass?: string;
  frameClassName?: string;
  panelClassName?: string;
};

export const photoGalleryFrameClassName =
  'fixed inset-0 z-[10050] flex items-center justify-center p-1.5 sm:p-4';

export const photoGalleryPanelClassName =
  'max-h-[calc(100dvh-0.75rem)] w-[calc(100vw-0.75rem)] max-w-3xl p-3 sm:max-h-[90vh] sm:w-[90%] sm:p-6';

/**
 * glass-panel(backdrop-filter + overflow-hidden) 안에서 모달이 잘리거나
 * PC Chrome이 멈추는 문제를 native dialog top-layer로 해결합니다.
 */
export function GlassSafeModal({
  open,
  onClose,
  children,
  maxWidthClass = 'max-w-[600px]',
  frameClassName,
  panelClassName,
}: GlassSafeModalProps) {
  const panel =
    panelClassName ??
    `max-h-[90vh] w-[90%] ${maxWidthClass} p-6`;
  return (
    <TopLayerDialog open={open} onClose={onClose} frameClassName={frameClassName}>
      <div
        role="dialog"
        aria-modal="true"
        className={`${panel} overflow-y-auto overscroll-contain rounded-xl bg-white shadow-xl`}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </TopLayerDialog>
  );
}
