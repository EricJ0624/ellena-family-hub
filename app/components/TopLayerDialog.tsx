'use client';

import { useEffect, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

type TopLayerDialogProps = {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
};

/**
 * native dialog / html 클래스 / overflow 잠금 / blur 토글은
 * Windows Chrome에서 메인스레드·CQ 루프를 만든다. body 포탈만 사용한다.
 */
export function TopLayerDialog({ open, onClose, children }: TopLayerDialogProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open || typeof document === 'undefined') return null;

  return createPortal(
    <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4" role="presentation">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} aria-hidden />
      <div className="relative z-10">{children}</div>
    </div>,
    document.body,
  );
}
