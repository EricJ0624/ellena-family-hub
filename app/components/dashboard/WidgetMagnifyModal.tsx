'use client';

import { useEffect, type ReactNode } from 'react';

/**
 * WidgetMagnifyModal — 돋보기 백드롭만 담당.
 * 위젯 본문은 그리드 인스턴스를 position:fixed 로 올리므로 여기서 다시 렌더하지 않는다.
 * (재마운트 시 Realtime CLOSED + 모달 프리즈 방지)
 */

export interface WidgetMagnifyModalProps {
  open: boolean;
  widgetLabel: string;
  isChatWidget?: boolean;
  closeLabel?: string;
  onClose: () => void;
  children?: ReactNode;
}

export function WidgetMagnifyModal({
  open,
  onClose,
}: WidgetMagnifyModalProps) {
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[8000] bg-neutral-950"
      aria-hidden="true"
      onClick={onClose}
    />
  );
}
