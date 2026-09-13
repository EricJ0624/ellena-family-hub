/**
 * Field target picker: create new trip/itinerary vs attach to existing.
 * Renders via TopLayerDialog so glass/widget overflow does not clip the list.
 */

'use client';

import React from 'react';
import { TopLayerDialog } from '@/app/components/TopLayerDialog';

export type FieldTargetOption = {
  id: string;
  title: string;
  day_date: string;
  start_time?: string | null;
};

export type FieldTargetPickLabels = {
  title: string;
  create: string;
  attach_hint: string;
  cancel: string;
};

type Props = {
  open: boolean;
  options: FieldTargetOption[];
  labels: FieldTargetPickLabels;
  onCreate: () => void;
  onAttach: (itineraryId: string) => void;
  onCancel: () => void;
};

export function TravelFieldTargetPicker({
  open,
  options,
  labels,
  onCreate,
  onAttach,
  onCancel,
}: Props) {
  return (
    <TopLayerDialog open={open} onClose={onCancel}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={labels.title}
        className="flex max-h-[min(80vh,36rem)] w-[min(100vw-2rem,28rem)] flex-col overflow-hidden rounded-xl bg-white p-4 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="m-0 shrink-0 text-base font-bold text-slate-800">{labels.title}</h2>
        <button
          type="button"
          onClick={onCreate}
          className="mt-3 flex w-full shrink-0 cursor-pointer items-center justify-center rounded-lg border-0 bg-emerald-600 px-3 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700"
        >
          {labels.create}
        </button>
        {options.length > 0 ? (
          <>
            <p className="mb-2 mt-4 shrink-0 text-xs font-medium text-slate-500">
              {labels.attach_hint}
            </p>
            <ul className="m-0 flex min-h-0 flex-1 list-none flex-col gap-2 overflow-y-auto overscroll-contain p-0 [-webkit-overflow-scrolling:touch]">
              {options.map((opt) => (
                <li key={opt.id} className="shrink-0">
                  <button
                    type="button"
                    onClick={() => onAttach(opt.id)}
                    className="flex w-full cursor-pointer flex-col rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-left hover:border-violet-300 hover:bg-violet-50"
                  >
                    <span className="text-sm font-semibold text-slate-800">{opt.title}</span>
                    <span className="mt-0.5 text-[11px] text-slate-500">
                      {opt.day_date}
                      {opt.start_time ? ` · ${String(opt.start_time).slice(0, 5)}` : ''}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </>
        ) : null}
        <button
          type="button"
          onClick={onCancel}
          className="mt-3 w-full shrink-0 cursor-pointer rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
        >
          {labels.cancel}
        </button>
      </div>
    </TopLayerDialog>
  );
}
