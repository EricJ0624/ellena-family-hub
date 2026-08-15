'use client';

import type { ReactNode } from 'react';
import { TopLayerDialog } from '@/app/components/TopLayerDialog';

type GlassSafeModalProps = {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  maxWidthClass?: string;
};

/**
 * glass-panel(backdrop-filter + overflow-hidden) 안에서 모달이 잘리거나
 * PC Chrome이 멈추는 문제를 native dialog top-layer로 해결합니다.
 */
export function GlassSafeModal({
  open,
  onClose,
  children,
  maxWidthClass = 'max-w-[600px]',
}: GlassSafeModalProps) {
  return (
    <TopLayerDialog open={open} onClose={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        className={`max-h-[90vh] w-[90%] ${maxWidthClass} overflow-y-auto overscroll-contain rounded-xl bg-white p-6 shadow-xl`}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </TopLayerDialog>
  );
}
