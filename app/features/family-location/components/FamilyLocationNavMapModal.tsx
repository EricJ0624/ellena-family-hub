'use client';

import React, { useEffect, useState } from 'react';
import type { NavMapApp } from '@/lib/nav-map-apps';
import { getDefaultNavMapApp, saveNavMapAppPreference } from '@/lib/nav-map-apps';

export type NavMapModalTranslations = {
  title: string;
  google: string;
  kakao: string;
  naver: string;
  start: string;
  cancel: string;
};

type Props = {
  open: boolean;
  lang: string;
  onCancel: () => void;
  onConfirm: (app: NavMapApp) => void;
  t: NavMapModalTranslations;
};

export function FamilyLocationNavMapModal({
  open,
  lang,
  onCancel,
  onConfirm,
  t,
}: Props) {
  const [selected, setSelected] = useState<NavMapApp>('google');

  useEffect(() => {
    if (open) {
      setSelected(getDefaultNavMapApp(lang));
    }
  }, [open, lang]);

  if (!open) return null;

  const options: { id: NavMapApp; label: string }[] = [
    { id: 'google', label: t.google },
    { id: 'kakao', label: t.kakao },
    { id: 'naver', label: t.naver },
  ];

  return (
    <div
      className="fixed inset-0 z-[1100] flex items-center justify-center bg-black/50"
      onClick={onCancel}
    >
      <div
        className="w-[90%] max-w-[400px] rounded-xl bg-white p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="mb-4 text-lg font-semibold text-slate-800">{t.title}</h3>
        <div className="mb-5 flex flex-col gap-2">
          {options.map((opt) => (
            <label
              key={opt.id}
              className={`flex cursor-pointer items-center gap-3 rounded-lg border p-3 ${
                selected === opt.id
                  ? 'border-emerald-500 bg-emerald-50'
                  : 'border-slate-200 bg-slate-50'
              }`}
            >
              <input
                type="radio"
                name="nav-map-app"
                value={opt.id}
                checked={selected === opt.id}
                onChange={() => setSelected(opt.id)}
                className="h-4 w-4 accent-emerald-600"
              />
              <span className="font-medium text-slate-800">{opt.label}</span>
            </label>
          ))}
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 cursor-pointer rounded-lg border-0 bg-slate-200 p-2.5 text-sm font-medium text-slate-800"
          >
            {t.cancel}
          </button>
          <button
            type="button"
            onClick={() => {
              saveNavMapAppPreference(selected);
              onConfirm(selected);
            }}
            className="flex-1 cursor-pointer rounded-lg border-0 bg-emerald-500 p-2.5 text-sm font-medium text-white hover:bg-emerald-600"
          >
            {t.start}
          </button>
        </div>
      </div>
    </div>
  );
}
