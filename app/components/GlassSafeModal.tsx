'use client';

import { createPortal } from 'react-dom';
import type { ReactNode } from 'react';

type GlassSafeModalProps = {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  maxWidthClass?: string;
};

/**
 * glass-panel(backdrop-filter + overflow-hidden) 안에서 fixed 모달이 잘리는 문제를
 * document.body portal + 오버레이 스크롤로 해결합니다.
 */
export function GlassSafeModal({
  open,
  onClose,
  children,
  maxWidthClass = 'max-w-[600px]',
}: GlassSafeModalProps) {
  if (!open || typeof document === 'undefined') return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] overflow-y-auto overscroll-contain bg-black/50 p-4 sm:p-6"
      onClick={onClose}
      role="presentation"
    >
      <div className="flex min-h-full items-start justify-center py-2 sm:py-4">
        <div
          role="dialog"
          aria-modal="true"
          className={`w-[90%] ${maxWidthClass} rounded-xl bg-white p-6 shadow-xl`}
          onClick={(e) => e.stopPropagation()}
        >
          {children}
        </div>
      </div>
    </div>,
    document.body,
  );
}
