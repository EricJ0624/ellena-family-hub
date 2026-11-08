'use client';

import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Pencil, Star, Trash2 } from 'lucide-react';
import { FAMILY_LOG_BASIC_MOODS } from '@/app/features/family-log/card-record';
import { getFamilyLogLabels } from '@/app/features/family-log/labels';
import { getWidgetShowroomTranslation } from '@/lib/translations/widgetShowroom';
import type { LangCode } from '@/lib/language-fonts';

const RING = 'ring-2 ring-violet-500 ring-offset-1';
const BG_SRC = '/family-log/family-log-title.png';
const DEMO_DATE = '2026-11-08';
const DEMO_MOODS = ['😊', '🍜', '❤️', '☀️'] as const;

function TypedField({
  text,
  className,
  multiline,
}: {
  text: string;
  className: string;
  multiline?: boolean;
}) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    setCount(0);
    const id = window.setInterval(() => {
      setCount((n) => (n >= text.length ? n : n + 1));
    }, 55);
    return () => window.clearInterval(id);
  }, [text]);

  const value = text.slice(0, count);
  if (multiline) {
    return <div className={className}>{value}</div>;
  }
  return (
    <input readOnly tabIndex={-1} className={className} value={value} />
  );
}

function FakeMap({ hint }: { hint: string }) {
  return (
    <div className="overflow-hidden rounded-xl border border-[#ead7b2] bg-[#e8f0e4]">
      <div className="relative h-16 bg-[linear-gradient(135deg,#d7e8d0_0%,#c5d9ef_55%,#efe6c8_100%)]">
        <span className="absolute left-1/2 top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-full rounded-full bg-rose-500 shadow" />
        <span className="absolute left-1/2 top-1/2 h-2 w-2 -translate-x-1/2 rounded-full bg-rose-600" />
      </div>
      <p className="m-0 px-2 py-1 text-[9px] text-[#8a7355]">{hint}</p>
    </div>
  );
}

function FakePhotos({ selected }: { selected: boolean }) {
  if (!selected) {
    return (
      <div className="flex h-24 items-center justify-center rounded-xl border border-dashed border-[#d8c4a0] bg-[#fffaf0] text-sm text-[#a48458]">
        사진
      </div>
    );
  }
  return (
    <div className="grid h-24 grid-cols-2 gap-1.5 overflow-hidden rounded-xl">
      <div className="flex items-center justify-center bg-[linear-gradient(160deg,#fde68a,#f9a8d4)] text-2xl">
        🌡️
      </div>
      <div className="relative flex items-center justify-center bg-[linear-gradient(160deg,#fed7aa,#86efac)] text-2xl">
        🍣
        <span className="absolute bottom-1 right-1 flex h-5 w-5 items-center justify-center rounded-full bg-sky-500 text-[10px] font-bold text-white">
          ✓
        </span>
      </div>
    </div>
  );
}

function FakeReceipt({ compact }: { compact?: boolean }) {
  return (
    <div
      className={`rounded-md border border-slate-200 bg-white shadow-sm ${
        compact ? 'h-12 w-10 p-1' : 'w-full p-2'
      }`}
    >
      <div className={`space-y-0.5 ${compact ? '' : 'text-[9px] text-slate-500'}`}>
        <div className={`rounded-sm bg-slate-200 ${compact ? 'h-1' : 'h-1.5 w-3/4'}`} />
        <div className={`rounded-sm bg-slate-100 ${compact ? 'h-1' : 'h-1.5 w-full'}`} />
        <div className={`rounded-sm bg-slate-100 ${compact ? 'h-1' : 'h-1.5 w-2/3'}`} />
        {!compact ? (
          <p className="m-0 pt-1 font-semibold text-slate-700">₩100,000</p>
        ) : null}
      </div>
    </div>
  );
}

/**
 * 가족 로그 쇼룸 미리보기. 실저장·업로드·지도 API는 쓰지 않고 참고 영상 순서만 보여 준다.
 * 1 빈 위젯 → 2 제목 → 3 사진 → 4 메모·기분 → 5 별점·스타일 → 6 영수증 → 7 경비·업로드 → 8 저장 → 9 카드
 */
export function FamilyLogShowroomDemo({ lang, step }: { lang: LangCode; step: number }) {
  const labels = getFamilyLogLabels(lang);
  const t = (key: Parameters<typeof getWidgetShowroomTranslation>[1]) =>
    getWidgetShowroomTranslation(lang, key);
  const title = t('demo_family_log_title');
  const note = t('demo_family_log_note');
  const revisit = t('demo_family_log_revisit');
  const mapHint = t('demo_family_log_map_hint');
  const scene = step === 0 ? 'widget' : step === 8 ? 'card' : 'editor';
  const typingTitle = step === 1;
  const showPhotos = step >= 2;
  const typingNote = step === 3;
  const showNote = step >= 3;
  const showMoods = step >= 3;
  const showRatingPanel = step === 4;
  const showReceiptPick = step === 5;
  const filledMeta = step >= 6;
  const showReceipt = step >= 7;
  const saveReady = step >= 7;
  const uploading = step === 6;
  const moodSelected = new Set<string>(DEMO_MOODS);

  return (
    <div className="relative mx-auto w-full max-w-[22rem]">
      <AnimatePresence mode="wait">
        {scene === 'widget' ? (
          <motion.section
            key="widget"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.22 }}
            className="family-log-widget flex min-h-[16rem] flex-col overflow-hidden rounded-[1.25rem] bg-[#fbf6ec] shadow-lg"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={BG_SRC} alt="" draggable={false} className="block h-auto w-full" />
            <div className="flex min-h-0 flex-1 flex-col px-3 pb-3 pt-1">
              <div className="flex gap-1">
                {([labels.recent, labels.day, labels.month, labels.year] as const).map((text, i) => (
                  <span
                    key={text}
                    className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${
                      i === 0
                        ? 'border-[#8a7355] bg-white text-[#5c4630]'
                        : 'border-[#ead7b2] bg-white/80 text-[#a48458]'
                    }`}
                  >
                    {text}
                  </span>
                ))}
              </div>
              <p className="m-0 flex flex-1 items-center justify-center text-center text-sm text-[#8a7355]">
                {labels.empty}
              </p>
              <div className="flex gap-2">
                <span className={`min-w-0 flex-1 rounded-full bg-[#7d9a6a] px-1.5 py-2 text-center text-[11px] font-bold text-white ${RING}`}>
                  {labels.checkin}
                </span>
                <span className="min-w-0 flex-1 rounded-full bg-[#d08a4c] px-1.5 py-2 text-center text-[11px] font-bold text-white">
                  {labels.route}
                </span>
              </div>
            </div>
          </motion.section>
        ) : scene === 'card' ? (
          <motion.div
            key="card"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.22 }}
            className={`overflow-hidden rounded-[1.25rem] border-2 border-[#ead7b2] bg-[#fffaf0] p-3 shadow-lg ${RING}`}
          >
            <h3 className="m-0 text-base font-bold text-[#5c4630]">{title}</h3>
            <p className="m-0 mt-0.5 text-xs text-[#a48458]">{DEMO_DATE}</p>
            <div className="mt-2 flex h-28 items-center justify-center rounded-xl bg-[linear-gradient(160deg,#fed7aa,#86efac,#f9a8d4)] text-4xl">
              🍣
            </div>
            <p className="m-0 mt-2 text-sm leading-snug text-[#5c4630]">{note}</p>
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              {DEMO_MOODS.map((mood) => (
                <span
                  key={mood}
                  className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-[#f3e7d3] text-sm"
                >
                  {mood}
                </span>
              ))}
              <span className="inline-flex items-center gap-0.5 text-amber-500">
                {Array.from({ length: 5 }, (_, i) => (
                  <Star key={i} className="h-3.5 w-3.5 fill-current" aria-hidden />
                ))}
              </span>
              <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-semibold text-violet-700">
                {revisit}
              </span>
            </div>
            <div className="mt-2">
              <FakeMap hint={mapHint} />
            </div>
            <div className="mt-2 flex items-center justify-between gap-2">
              <span className="inline-flex items-center gap-1 rounded-lg border border-[#ead7b2] bg-white px-2 py-1 text-[11px] font-semibold text-[#5c4630]">
                <Pencil className="h-3 w-3" aria-hidden />
                {labels.edit}
              </span>
              <span className="inline-flex items-center gap-1 rounded-lg border border-[#ead7b2] bg-white px-2 py-1 text-[11px] font-semibold text-rose-600">
                <Trash2 className="h-3 w-3" aria-hidden />
                {labels.delete}
              </span>
            </div>
            <div className="mt-2 flex items-end justify-between gap-2">
              <p className="m-0 text-xs font-semibold text-[#5c4630]">
                {labels.expense} 100000 KRW
              </p>
              <FakeReceipt compact />
            </div>
          </motion.div>
        ) : (
          <motion.div
            key={`editor-${step}`}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.22 }}
            className="relative space-y-2 overflow-hidden rounded-[1.25rem] border border-[#ead7b2] bg-[#fffaf0] p-3 shadow-lg"
          >
            <label className="block text-xs font-semibold text-[#8a7355]">{t('demo_family_log_title_label')}</label>
            {typingTitle ? (
              <TypedField
                text={title}
                className={`w-full rounded-lg border border-sky-300 bg-white px-2 py-1.5 text-sm text-[#5c4630] outline-none ${RING}`}
              />
            ) : (
              <input
                readOnly
                tabIndex={-1}
                className="w-full rounded-lg border border-[#e4d3b0] bg-white px-2 py-1.5 text-sm text-[#5c4630]"
                value={title}
              />
            )}
            <p className="m-0 text-[11px] text-[#a48458]">{DEMO_DATE}</p>

            <div className={step === 2 ? RING : ''}>
              <FakePhotos selected={showPhotos} />
            </div>

            <label className="block text-xs font-semibold text-[#8a7355]">{labels.note}</label>
            {typingNote ? (
              <TypedField
                text={note}
                multiline
                className={`min-h-[2.5rem] rounded-lg border border-sky-300 bg-white px-2 py-1.5 text-sm text-[#5c4630] ${RING}`}
              />
            ) : (
              <div className="min-h-[2.5rem] rounded-lg border border-[#e4d3b0] bg-white px-2 py-1.5 text-sm text-[#5c4630]">
                {showNote ? note : ''}
              </div>
            )}

            <div className="grid grid-cols-[1fr_0.9fr] gap-2">
              <div>
                <p className="m-0 mb-1 text-xs font-semibold text-[#8a7355]">{labels.mood}</p>
                <div className={`flex flex-wrap gap-1 ${step === 3 ? RING : ''} rounded-lg p-0.5`}>
                  {FAMILY_LOG_BASIC_MOODS.map((mood) => {
                    const on = showMoods && moodSelected.has(mood);
                    return (
                      <span
                        key={mood}
                        className={`inline-flex h-7 w-7 items-center justify-center rounded-full text-sm ${
                          on ? 'bg-violet-100 ring-1 ring-violet-300' : 'bg-white'
                        }`}
                      >
                        {mood}
                      </span>
                    );
                  })}
                </div>
              </div>
              <FakeMap hint={mapHint} />
            </div>

            {step >= 4 ? (
              <div className="space-y-2">
                <div className="flex flex-wrap gap-1.5">
                  <span className="rounded-lg bg-violet-100 px-2 py-1 text-[10px] font-semibold text-violet-800">
                    {labels.mapAdd}
                  </span>
                  <span className="rounded-lg bg-violet-100 px-2 py-1 text-[10px] font-semibold text-violet-800">
                    {labels.photoStyleFilm}
                  </span>
                </div>
                <div className={`relative ${showRatingPanel ? RING : ''} rounded-lg`}>
                  <p className="m-0 text-xs font-semibold text-[#8a7355]">{labels.rating}</p>
                  <div className="mt-1 inline-flex min-w-[3.5rem] items-center justify-between rounded-lg border border-[#e4d3b0] bg-white px-2 py-1 text-sm text-[#5c4630]">
                    {filledMeta ? '5' : '—'}
                    <span aria-hidden>▾</span>
                  </div>
                  {showRatingPanel ? (
                    <div className="absolute left-0 top-full z-10 mt-1 w-24 overflow-hidden rounded-xl border border-[#ead7b2] bg-white shadow-lg">
                      {['—', '1', '2', '3', '4', '5'].map((n) => (
                        <div
                          key={n}
                          className={`px-3 py-1.5 text-sm ${n === '—' ? 'bg-violet-50 font-semibold text-violet-800' : 'text-[#5c4630]'}`}
                        >
                          {n}
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
                <label className="flex items-center gap-2 text-xs text-[#5c4630]">
                  <span
                    className={`inline-flex h-4 w-4 items-center justify-center rounded border ${
                      filledMeta
                        ? 'border-sky-500 bg-sky-500 text-[10px] text-white'
                        : 'border-[#d8c4a0] bg-white'
                    }`}
                  >
                    {filledMeta ? '✓' : ''}
                  </span>
                  {revisit}
                </label>
                <div>
                  <p className="m-0 text-xs font-semibold text-[#8a7355]">{labels.expense}</p>
                  <input
                    readOnly
                    tabIndex={-1}
                    className="mt-1 w-full rounded-lg border border-[#e4d3b0] bg-white px-2 py-1.5 text-sm text-[#5c4630]"
                    value={filledMeta ? '100000' : ''}
                  />
                  {filledMeta ? (
                    <p className="m-0 mt-1 text-[10px] text-[#8a7355]">KRW ({lang === 'ko' ? '대한민국 원' : 'Korean Won'})</p>
                  ) : (
                    <p className="m-0 mt-1 text-[10px] text-[#a48458]">{labels.currencyRequired}</p>
                  )}
                </div>
              </div>
            ) : null}

            {step >= 5 ? (
              <div className={`${showReceiptPick ? RING : ''} rounded-lg p-0.5`}>
                {showReceiptPick ? (
                  <div className="grid grid-cols-2 gap-2">
                    <div className="relative">
                      <FakeReceipt />
                      <span className="absolute bottom-1 right-1 flex h-5 w-5 items-center justify-center rounded-full bg-sky-500 text-[10px] font-bold text-white">
                        ✓
                      </span>
                    </div>
                    <FakeReceipt />
                  </div>
                ) : showReceipt ? (
                  <div className="flex items-center gap-2">
                    <span className="rounded-lg border border-[#ead7b2] bg-white px-2 py-1.5 text-[11px] font-semibold text-[#5c4630]">
                      {labels.receiptUpload}
                    </span>
                    <FakeReceipt compact />
                  </div>
                ) : (
                  <span className="inline-flex rounded-lg border border-[#ead7b2] bg-white px-2 py-1.5 text-[11px] font-semibold text-[#a48458]">
                    {labels.receiptUpload}
                  </span>
                )}
              </div>
            ) : null}

            {uploading ? (
              <span className="inline-flex rounded-lg bg-sky-100 px-2 py-1 text-[11px] font-semibold text-sky-800">
                {labels.photosUploading}
              </span>
            ) : null}

            <div className="flex flex-wrap gap-1.5 pt-1">
              <span
                className={`rounded-lg px-2.5 py-1.5 text-[11px] font-bold text-white ${
                  saveReady ? `bg-[#7d9a6a] ${RING}` : 'bg-slate-400'
                }`}
              >
                {labels.save}
              </span>
              <span className="rounded-lg border border-[#ead7b2] bg-white px-2 py-1.5 text-[11px] font-semibold text-[#5c4630]">
                {labels.photos}
              </span>
              <span className="rounded-lg border border-[#ead7b2] bg-white px-2 py-1.5 text-[11px] font-semibold text-[#5c4630]">
                {labels.photosAlbum}
              </span>
              <span className="rounded-lg border border-[#ead7b2] bg-white px-2 py-1.5 text-[11px] font-semibold text-[#5c4630]">
                {labels.cancel}
              </span>
              <span className="inline-flex items-center gap-1 rounded-lg border border-[#ead7b2] bg-white px-2 py-1.5 text-[11px] font-semibold text-rose-600">
                <Trash2 className="h-3 w-3" aria-hidden />
                {labels.delete}
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
