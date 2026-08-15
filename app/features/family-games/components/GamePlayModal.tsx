'use client';

import type { ReactNode } from 'react';
import { X } from 'lucide-react';
import { TopLayerDialog } from '@/app/components/TopLayerDialog';

export interface GamePlayModalProps {
  open: boolean;
  title: string;
  closeLabel: string;
  onClose: () => void;
  children: ReactNode;
}

export function GamePlayModal({ open, title, closeLabel, onClose, children }: GamePlayModalProps) {
  return (
    <TopLayerDialog open={open} onClose={onClose}>
      <div
        className="flex max-h-[92dvh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-[0_20px_60px_rgba(0,0,0,0.35)]"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-slate-200 px-4 py-3 sm:px-5">
          <h3 className="m-0 text-base font-semibold text-slate-800 sm:text-lg">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/60"
            aria-label={closeLabel}
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>
        <div
          className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 sm:px-5 sm:py-5"
          style={{ containerType: 'inline-size' }}
        >
          {children}
        </div>
      </div>
    </TopLayerDialog>
  );
}
