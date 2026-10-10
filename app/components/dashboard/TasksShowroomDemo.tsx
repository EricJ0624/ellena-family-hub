'use client';

import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { getCommonTranslation } from '@/lib/translations/common';
import { getDashboardTranslation } from '@/lib/translations/dashboard';
import type { LangCode } from '@/lib/language-fonts';
import { getFamilyRoleLabel } from '@/lib/translations/memberManagement';
import { getWidgetPreviewTranslation } from '@/lib/translations/widgetPreview';

const FOCUS = 'outline outline-2 outline-offset-2 outline-white';

function TypedTaskField({ text, placeholder }: { text: string; placeholder: string }) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    const id = window.setInterval(() => {
      setCount((n) => (n >= text.length ? n : n + 1));
    }, 90);
    return () => window.clearInterval(id);
  }, [text]);

  return (
    <input readOnly tabIndex={-1} className="chalkboard-form-input" value={text.slice(0, count)} placeholder={placeholder} />
  );
}

function DeleteConfirmFlash({ lang }: { lang: LangCode }) {
  const [open, setOpen] = useState(true);

  useEffect(() => {
    const id = window.setTimeout(() => setOpen(false), 1500);
    return () => window.clearTimeout(id);
  }, []);

  if (!open) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="absolute inset-0 z-10 flex items-center justify-center bg-slate-950/30 p-4"
    >
      <div className="w-full max-w-xs rounded-2xl bg-white/95 px-4 py-3 text-slate-900 shadow-xl">
        <p className="m-0 text-sm font-semibold">{getCommonTranslation(lang, 'delete_confirm')}</p>
        <div className="mt-3 flex justify-end gap-4">
          <span className="text-sm font-semibold text-sky-700">{getCommonTranslation(lang, 'cancel')}</span>
          <span className="text-sm font-semibold text-sky-700">{getCommonTranslation(lang, 'confirm')}</span>
        </div>
      </div>
    </motion.div>
  );
}

type Row = {
  text: string;
  assignee: string;
  claim: boolean;
  done: boolean;
  focus: 'check' | 'assignee' | 'claim' | 'delete' | null;
};

/**
 * 할 일 쇼룸 미리보기. 실저장·담당·삭제는 하지 않고, 칠판 UI만 단계별로 보여 준다.
 */
export function TasksShowroomDemo({ lang, step }: { lang: LangCode; step: number }) {
  const dt = (key: Parameters<typeof getDashboardTranslation>[1]) => getDashboardTranslation(lang, key);
  const wp = (key: Parameters<typeof getWidgetPreviewTranslation>[1]) =>
    getWidgetPreviewTranslation(lang, key);
  const mom = getFamilyRoleLabel(lang, 'mom');
  const dad = getFamilyRoleLabel(lang, 'dad');
  const anyone = getCommonTranslation(lang, 'anyone');
  const newTask = wp('preview_task_2');
  const claimLabel = lang === 'ko' ? '내가 할게요' : "I'll do it";
  const scene = step === 1 || step === 2 ? 'form' : 'board';
  const showNew = step >= 3;
  const claimed = step >= 4;
  const done = step >= 5;

  const rows: Row[] = [
    ...(showNew
      ? [
          {
            text: newTask,
            assignee: claimed ? mom : anyone,
            claim: !claimed,
            done,
            focus:
              step === 3 ? 'claim' : step === 4 ? 'assignee' : step === 5 ? 'check' : step === 6 ? 'delete' : null,
          },
        ]
      : []),
    { text: wp('preview_task_1'), assignee: mom, claim: false, done: false, focus: null },
    { text: wp('preview_task_4'), assignee: dad, claim: false, done: false, focus: null },
  ];

  return (
    <div className="relative flex w-full items-center justify-center">
      <svg aria-hidden="true" focusable="false" width={0} height={0} className="pointer-events-none absolute overflow-hidden">
        <defs>
          <filter
            id="chalkboard-chalk-texture"
            x="-20%"
            y="-30%"
            width="140%"
            height="160%"
            colorInterpolationFilters="sRGB"
          >
            <feTurbulence type="fractalNoise" baseFrequency="1.05" numOctaves="3" seed="5" stitchTiles="stitch" result="noise" />
            <feColorMatrix in="noise" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -0.85 1.08" result="dustAlpha" />
            <feComposite in="SourceGraphic" in2="dustAlpha" operator="in" result="dusty" />
            <feDisplacementMap in="dusty" in2="noise" scale="1.15" xChannelSelector="R" yChannelSelector="G" result="rough" />
            <feGaussianBlur in="rough" stdDeviation="0.18" />
          </filter>
        </defs>
      </svg>

      <AnimatePresence mode="wait">
        {scene === 'form' ? (
          <motion.div
            key="form"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.25 }}
            className="mx-auto w-[min(100%,15rem)] [aspect-ratio:467/558]"
          >
            <div className="chalkboard-modal-frame !h-full !w-full !max-h-none !max-w-none">
              <div className="chalkboard-modal-container">
                <h2 className="chalkboard-modal-heading">{dt('todo_modal_title')}</h2>
                <div className="chalkboard-modal-form">
                  <div className={`chalkboard-modal-field chalkboard-modal-field--what ${step === 1 ? FOCUS : ''}`}>
                    <label className="chalkboard-modal-field-label">{dt('todo_what_label')}</label>
                    {step === 1 ? (
                      <TypedTaskField text={newTask} placeholder={dt('todo_what_placeholder')} />
                    ) : (
                      <input readOnly tabIndex={-1} className="chalkboard-form-input" value={newTask} placeholder={dt('todo_what_placeholder')} />
                    )}
                  </div>
                  <div className="chalkboard-modal-field chalkboard-modal-field--who">
                    <label className="chalkboard-modal-field-label">{dt('todo_who_label')}</label>
                    <select className="chalkboard-form-input" value={step >= 2 ? 'mom' : ''} onChange={() => {}} tabIndex={-1}>
                      <option value="">{dt('todo_who_placeholder')}</option>
                      <option value="mom">{mom}</option>
                    </select>
                  </div>
                </div>
                <div className="chalkboard-modal-actions">
                  <span className="chalkboard-btn-secondary">{getCommonTranslation(lang, 'cancel')}</span>
                  <span className={`chalkboard-btn-primary ${step === 2 ? FOCUS : ''}`}>{dt('todo_register_btn')}</span>
                </div>
              </div>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="board"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.25 }}
            className="relative w-full"
          >
            <div className="chalkboard-frame flex w-full flex-col">
              <section className="chalkboard-container flex min-h-[13rem] flex-col">
                <div className="chalkboard-top-bar">
                  <h3 className="chalkboard-title chalkboard-title--sr-only">{dt('todo_section_title')}</h3>
                  <div className="chalkboard-top-actions">
                    <span className={`chalkboard-btn-add ${step === 0 ? FOCUS : ''}`}>{dt('todo_add_btn')}</span>
                  </div>
                </div>
                <div className="todo-list">
                  {rows.map((row) => (
                    <div key={row.text} className="todo-item">
                      <div className="todo-content">
                        <div className={`todo-checkbox${row.done ? ' todo-checkbox-checked' : ''} ${row.focus === 'check' ? FOCUS : ''}`}>
                          {row.done ? (
                            <svg className="todo-checkmark" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                            </svg>
                          ) : null}
                        </div>
                        <div className="todo-text-wrapper">
                          <span className={`todo-text${row.done ? ' todo-text-done' : ''}`}>{row.text}</span>
                          <span className={`todo-assignee ${row.focus === 'assignee' ? FOCUS : ''}`}>{row.assignee}</span>
                        </div>
                      </div>
                      {row.claim ? (
                        <span className={`chalkboard-btn-claim ${row.focus === 'claim' ? FOCUS : ''}`}>{claimLabel}</span>
                      ) : null}
                      <span className={`chalkboard-btn-delete ${row.focus === 'delete' ? FOCUS : ''}`} aria-hidden>
                        <svg className="chalkboard-icon-delete" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </span>
                    </div>
                  ))}
                </div>
              </section>
            </div>
            <AnimatePresence>
              {step === 6 ? <DeleteConfirmFlash key="delete-confirm" lang={lang} /> : null}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
