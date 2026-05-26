'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'framer-motion';

/**
 * WidgetMagnifyModal — 위젯 돋보기(팝업) 다이얼로그 (Phase 5)
 *
 * 설계 원칙:
 *  - children은 page.tsx의 renderWidgetSection() 결과 — 독립 fetch/구독 금지
 *  - open=false → 언마운트 (AnimatePresence) → 그리드 위젯 복원
 *  - chat 위젯: isChatWidget=true → max-height 100dvh + safe-area padding
 *  - Focus trap: 다이얼로그 내부 Tab 순환, ESC·backdrop 클릭으로 닫기
 *  - framer-motion v12 AnimatePresence Enter/Leave 애니메이션
 */

export interface WidgetMagnifyModalProps {
  open: boolean;
  widgetLabel: string;
  /** 채팅 위젯 여부 — max-height 100dvh + safe-area-inset-bottom 적용 */
  isChatWidget?: boolean;
  closeLabel?: string;
  onClose: () => void;
  children: ReactNode;
}

const FOCUSABLE =
  'a[href],area[href],input:not([disabled]),select:not([disabled]),textarea:not([disabled]),button:not([disabled]),iframe,object,embed,[tabindex]:not([tabindex="-1"]),[contenteditable]';

export function WidgetMagnifyModal({
  open,
  widgetLabel,
  isChatWidget = false,
  closeLabel = '닫기',
  onClose,
  children,
}: WidgetMagnifyModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  // 다이얼로그 열릴 때 닫기 버튼에 포커스
  useEffect(() => {
    if (open) {
      // 애니메이션 프레임 후 포커스 (AnimatePresence 렌더 대기)
      const id = requestAnimationFrame(() => {
        closeButtonRef.current?.focus();
      });
      return () => cancelAnimationFrame(id);
    }
  }, [open]);

  // ESC 키 닫기
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

  // Body 스크롤 잠금
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  // Focus trap: Tab / Shift+Tab 순환
  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'Tab') return;
    const el = dialogRef.current;
    if (!el) return;
    const focusable = Array.from(el.querySelectorAll<HTMLElement>(FOCUSABLE));
    if (focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (e.shiftKey) {
      if (document.activeElement === first) {
        e.preventDefault();
        last.focus();
      }
    } else {
      if (document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            key="wm-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
            aria-hidden="true"
            onClick={onClose}
          />

          {/* Dialog */}
          <motion.div
            key="wm-dialog"
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-label={widgetLabel}
            tabIndex={-1}
            initial={{ opacity: 0, scale: 0.96, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 16 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            onKeyDown={handleKeyDown}
            className={[
              'fixed inset-x-3 z-50 mx-auto flex flex-col overflow-hidden rounded-2xl bg-white shadow-2xl',
              'top-[4dvh]',
              isChatWidget
                ? 'bottom-0 rounded-b-none pb-[env(safe-area-inset-bottom,0px)]'
                : 'max-h-[88dvh]',
              'sm:inset-x-auto sm:w-full sm:max-w-lg',
            ].join(' ')}
          >
            {/* Header */}
            <div className="flex shrink-0 items-center justify-between border-b border-slate-200 px-4 py-3">
              <h2 className="text-sm font-semibold text-slate-800">{widgetLabel}</h2>
              <button
                ref={closeButtonRef}
                type="button"
                onClick={onClose}
                className="rounded-lg p-1.5 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500"
                aria-label={closeLabel}
              >
                <svg
                  className="h-4 w-4"
                  viewBox="0 0 16 16"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  aria-hidden="true"
                >
                  <path d="M2 2l12 12M14 2L2 14" />
                </svg>
              </button>
            </div>

            {/* Content */}
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4">
              {children}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
