'use client';

import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Calendar, Plus, X } from 'lucide-react';
import { kidsStickerFromTitles } from '@/app/features/family-calendar/kids-decorations';
import { getCommonTranslation } from '@/lib/translations/common';
import { getDashboardTranslation } from '@/lib/translations/dashboard';
import { getFamilyRoleEmoji, getFamilyRoleLabel } from '@/lib/translations/memberManagement';
import { getWidgetShowroomTranslation } from '@/lib/translations/widgetShowroom';
import { intlLocaleForLang, type LangCode } from '@/lib/language-fonts';

const RING = 'ring-2 ring-violet-500 ring-offset-2';
const DEMO_YEAR = 2026;
const DEMO_MONTH = 11;
const DEMO_DAY = 25;
/** 2026-12-01은 화요일 */
const LEADING_BLANKS = 2;
const DECEMBER_BG = '/family-calendar/backgrounds/calendar-dec-bg.png?v=2';
const DECEMBER_WASH =
  'linear-gradient(180deg, rgba(226,238,250,0.97) 0%, rgba(196,220,242,0.94) 38%, rgba(176,208,236,0.9) 70%, rgba(214,230,246,0.96) 100%)';

const FORM_DECOS = [
  { src: '/family-calendar/add-emojis/cloud.png', className: 'left-1/2 top-1 h-8 w-8 -translate-x-1/2' },
  { src: '/family-calendar/add-emojis/book.png', className: 'left-2 top-2 h-8 w-8 -rotate-12' },
  { src: '/family-calendar/add-emojis/rainbow.png', className: 'left-0 top-12 h-8 w-8' },
  { src: '/family-calendar/add-emojis/puppy.png', className: 'right-1 top-10 h-8 w-8' },
  { src: '/family-calendar/add-emojis/rainbow-house.png', className: 'right-1 top-1 h-8 w-8' },
  { src: '/family-calendar/add-emojis/moon.png', className: 'left-[28%] top-14 h-6 w-6' },
  { src: '/family-calendar/add-emojis/sun.png', className: 'right-[30%] top-14 h-6 w-6' },
  { src: '/family-calendar/add-emojis/ghost.png', className: 'bottom-16 left-1 h-7 w-7' },
  { src: '/family-calendar/add-emojis/robot.png', className: 'bottom-2 left-2 h-7 w-7' },
  { src: '/family-calendar/add-emojis/milk.png', className: 'bottom-3 right-[28%] h-6 w-6' },
  { src: '/family-calendar/add-emojis/ghost-2.png', className: 'bottom-2 right-1 h-7 w-7' },
];

function TypedField({
  text,
  placeholder,
  multiline = false,
}: {
  text: string;
  placeholder: string;
  multiline?: boolean;
}) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    const id = window.setInterval(() => {
      setCount((n) => (n >= text.length ? n : n + 1));
    }, 90);
    return () => window.clearInterval(id);
  }, [text]);

  const value = text.slice(0, count);
  const className = `w-full rounded-2xl bg-white px-3 py-2 text-sm text-slate-800 shadow-sm outline-none ${
    multiline ? 'h-16 resize-none' : ''
  }`;

  if (multiline) {
    return <textarea readOnly tabIndex={-1} className={className} value={value} placeholder={placeholder} />;
  }

  return <input readOnly tabIndex={-1} className={className} value={value} placeholder={placeholder} />;
}

function ConfettiBurst() {
  const bits = useMemo(
    () =>
      Array.from({ length: 26 }, (_, i) => ({
        id: i,
        left: `${(i * 19) % 100}%`,
        delay: (i % 6) * 0.04,
        color: ['#7c3aed', '#db2777', '#fbbf24', '#34d399', '#60a5fa'][i % 5],
        rotate: (i * 37) % 160,
      })),
    [],
  );

  return (
    <div className="pointer-events-none absolute inset-0 z-20 overflow-hidden" aria-hidden>
      {bits.map((bit) => (
        <motion.span
          key={bit.id}
          className="absolute top-0 h-2.5 w-1.5 rounded-sm"
          style={{ left: bit.left, backgroundColor: bit.color }}
          initial={{ y: -10, opacity: 1, rotate: 0 }}
          animate={{ y: 280, opacity: 0, rotate: bit.rotate }}
          transition={{ duration: 1.35, delay: bit.delay, ease: 'easeIn' }}
        />
      ))}
    </div>
  );
}

/**
 * 달력 쇼룸 미리보기. 일정 저장·수정·삭제는 하지 않고, 영상 순서만 보여 준다.
 * 12월 25일 → 빈 목록 → 제목 → 설명 → 매년 반복 → 스티커.
 */
export function CalendarShowroomDemo({ lang, step }: { lang: LangCode; step: number }) {
  const dt = (key: Parameters<typeof getDashboardTranslation>[1]) => getDashboardTranslation(lang, key);
  const title = getWidgetShowroomTranslation(lang, 'demo_calendar_event');
  const note = getWidgetShowroomTranslation(lang, 'demo_calendar_desc');
  const locale = intlLocaleForLang(lang);
  const scene = step >= 2 && step <= 4 ? 'form' : 'board';
  const selected = step >= 1;
  const showEvent = step >= 5;
  const yearly = step >= 4;
  const sticker = kidsStickerFromTitles([title], `${DEMO_YEAR}-12-${DEMO_DAY}`);
  const registeredAt = new Date(2026, 9, 21, 11, 42, 58).toLocaleString(locale);
  const weekDays = [
    dt('calendar_weekday_0'),
    dt('calendar_weekday_1'),
    dt('calendar_weekday_2'),
    dt('calendar_weekday_3'),
    dt('calendar_weekday_4'),
    dt('calendar_weekday_5'),
    dt('calendar_weekday_6'),
  ];
  const monthLabel = new Date(DEMO_YEAR, DEMO_MONTH, 1).toLocaleDateString(locale, {
    year: 'numeric',
    month: 'long',
  });
  const longDate = new Date(DEMO_YEAR, DEMO_MONTH, DEMO_DAY).toLocaleDateString(locale, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
  const dateStr = `${DEMO_YEAR}-12-${String(DEMO_DAY).padStart(2, '0')}`;
  const cells = [
    ...Array.from({ length: LEADING_BLANKS }, () => 0),
    ...Array.from({ length: 31 }, (_, i) => i + 1),
  ];

  return (
    <div className="relative mx-auto w-full max-w-[20rem]">
      <AnimatePresence mode="wait">
        {scene === 'form' ? (
          <motion.div
            key="form"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.25 }}
            className="relative overflow-hidden rounded-[1.75rem] border border-white/70 px-4 pb-4 pt-8 shadow-lg"
            style={{
              background: 'linear-gradient(160deg, #ede9fe 0%, #e0e7ff 40%, #fce7f3 80%, #fed7aa 100%)',
            }}
          >
            <div className="pointer-events-none absolute inset-0" aria-hidden>
              {FORM_DECOS.map((item) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={item.src + item.className} src={item.src} alt="" className={`absolute object-contain ${item.className}`} />
              ))}
            </div>
            <div className="relative z-[1]">
              <p className="m-0 text-center text-[10px] font-bold uppercase tracking-widest text-violet-400">
                {dt('section_title_calendar')}
              </p>
              <h3 className="mb-3 mt-1 text-center text-2xl font-bold text-violet-700">{dt('event_add_title')}</h3>
              <div className="mb-3 grid grid-cols-2 gap-2">
                <div>
                  <p className="mb-1 text-[11px] font-bold text-violet-600">{dt('event_start_date')}</p>
                  <div className="flex items-center rounded-2xl bg-white px-1 py-1.5 text-xs font-semibold text-violet-700 shadow-sm">
                    <span className="px-1">−</span>
                    <span className="min-w-0 flex-1 truncate text-center">{dateStr}</span>
                    <span className="px-1">+</span>
                  </div>
                </div>
                <div>
                  <p className="mb-1 text-[11px] font-bold text-violet-600">
                    {dt('event_end_date')}
                    <span className="ml-1 font-normal text-slate-400">{dt('event_end_unset')}</span>
                  </p>
                  <div className="flex items-center rounded-2xl bg-white px-1 py-1.5 text-xs font-semibold text-slate-400 shadow-sm">
                    <span className="px-1">−</span>
                    <span className="min-w-0 flex-1 truncate text-center">{dateStr}</span>
                    <span className="px-1">+</span>
                  </div>
                </div>
              </div>
              <label className="mb-1 block text-xs font-bold text-slate-700">{dt('event_title_label')}</label>
              <div className={step === 2 ? `mb-3 rounded-2xl ${RING}` : 'mb-3'}>
                {step === 2 ? (
                  <TypedField text={title} placeholder={dt('event_title_placeholder')} />
                ) : (
                  <input
                    readOnly
                    tabIndex={-1}
                    className="w-full rounded-2xl bg-white px-3 py-2 text-sm text-slate-800 shadow-sm outline-none"
                    value={step > 2 ? title : ''}
                    placeholder={dt('event_title_placeholder')}
                  />
                )}
              </div>
              <label className="mb-1 block text-xs font-bold text-slate-700">{dt('event_desc_label')}</label>
              <div className={step === 3 ? `mb-3 rounded-2xl ${RING}` : 'mb-3'}>
                {step === 3 ? (
                  <TypedField text={note} placeholder={dt('event_desc_placeholder')} multiline />
                ) : (
                  <textarea
                    readOnly
                    tabIndex={-1}
                    className="h-16 w-full resize-none rounded-2xl bg-white px-3 py-2 text-sm text-slate-800 shadow-sm outline-none"
                    value={step > 3 ? note : ''}
                    placeholder={dt('event_desc_placeholder')}
                  />
                )}
              </div>
              <p className="mb-1 text-xs font-bold text-slate-700">{dt('event_repeat_label')}</p>
              <div className="mb-3 flex flex-wrap gap-2 text-[11px] text-slate-700">
                {(
                  [
                    ['none', dt('event_repeat_none')],
                    ['monthly', dt('event_repeat_monthly')],
                    ['yearly', dt('event_repeat_yearly')],
                  ] as const
                ).map(([value, label]) => {
                  const checked = (yearly ? 'yearly' : 'none') === value;
                  return (
                    <span
                      key={value}
                      className={`inline-flex items-center gap-1 rounded-full ${
                        step === 4 && value === 'yearly' ? RING : ''
                      }`}
                    >
                      <span
                        className={`h-3 w-3 rounded-full border ${
                          checked ? 'border-violet-600 bg-violet-600 shadow-[inset_0_0_0_2px_white]' : 'border-slate-300 bg-white'
                        }`}
                      />
                      {label}
                    </span>
                  );
                })}
              </div>
              <div className="flex justify-center gap-2">
                <span className="rounded-2xl bg-white px-5 py-2 text-sm font-medium text-slate-500 shadow-sm">
                  {getCommonTranslation(lang, 'cancel')}
                </span>
                <span
                  className={`rounded-2xl bg-gradient-to-br from-violet-600 to-violet-700 px-5 py-2 text-sm font-bold text-white shadow-md ${
                    step === 4 ? RING : ''
                  }`}
                >
                  {dt('event_submit_btn')}
                </span>
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
            className="relative"
          >
            <div
              className="relative overflow-hidden rounded-[1.75rem] px-4 pb-3 pt-3 shadow-lg"
              style={{
                backgroundColor: 'transparent',
                backgroundImage: `url('${DECEMBER_BG}'), ${DECEMBER_WASH}`,
                backgroundRepeat: 'no-repeat',
                backgroundPosition: 'center',
                backgroundSize: '100% 100%',
              }}
            >
              {showEvent ? <ConfettiBurst /> : null}
              <div className="relative z-[1]">
                <div className="mb-2 flex items-center gap-1.5 px-1">
                  <span className="text-base" aria-hidden>
                    📅
                  </span>
                  <h3 className="m-0 text-base font-extrabold tracking-wide text-violet-800">{dt('section_title_calendar')}</h3>
                </div>
                <div className="mx-auto mb-2 flex w-[70%] items-center justify-between px-1 py-1">
                  <span className="px-1 text-sm font-extrabold text-violet-700">‹</span>
                  <span className="bg-gradient-to-r from-violet-800 via-sky-800 to-amber-700 bg-clip-text text-sm font-extrabold text-transparent">
                    {monthLabel}
                  </span>
                  <span className="px-1 text-sm font-extrabold text-violet-700">›</span>
                </div>
                <div className="grid grid-cols-7 gap-1 text-center">
                  {weekDays.map((day, index) => (
                    <span
                      key={day}
                      className={`py-0.5 text-[10px] font-bold ${
                        index === 0 ? 'text-red-500' : index === 6 ? 'text-blue-500' : 'text-violet-700/70'
                      }`}
                    >
                      {day}
                    </span>
                  ))}
                  {cells.map((day, index) => {
                    if (day === 0) return <span key={`blank-${index}`} className="h-8" />;
                    const isSelected = selected && day === DEMO_DAY && !showEvent;
                    const withSticker = showEvent && day === DEMO_DAY;
                    return (
                      <span
                        key={day}
                        className={`flex h-8 items-center justify-center rounded-2xl text-[12px] font-semibold ${
                          withSticker
                            ? 'relative bg-transparent'
                            : isSelected
                              ? 'bg-violet-600 font-bold text-white shadow-md'
                              : 'bg-white/85 text-slate-700 shadow-sm'
                        } ${step === 0 && day === DEMO_DAY ? RING : ''}`}
                      >
                        {withSticker ? (
                          <>
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={sticker} alt="" className="absolute inset-0 h-full w-full object-contain" />
                            <span className="relative z-[1] text-[11px] font-bold text-slate-800">{day}</span>
                          </>
                        ) : (
                          day
                        )}
                      </span>
                    );
                  })}
                </div>
                <div
                  className={`relative z-[1] mt-2 flex items-center justify-center gap-1 rounded-full bg-violet-600 py-2.5 text-sm font-bold text-white shadow-md ${
                    step === 1 ? RING : ''
                  }`}
                >
                  <Plus className="h-4 w-4" aria-hidden />
                  {dt('event_add_title')}
                </div>
              </div>
            </div>

            {selected ? (
              <div className="mt-2 rounded-2xl bg-slate-200/90 p-3">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <h4 className="m-0 flex min-w-0 items-center gap-1 text-sm font-bold text-slate-800">
                    <Calendar className="h-4 w-4 shrink-0 text-violet-600" aria-hidden />
                    <span className="truncate">
                      {dt('calendar_day_events_title').replace(/\{date\}/g, longDate)}
                    </span>
                  </h4>
                  <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 shadow-sm">
                    <X className="h-3.5 w-3.5" aria-hidden />
                    {getCommonTranslation(lang, 'close')}
                  </span>
                </div>
                {showEvent ? (
                  <div className="rounded-xl border-l-4 border-violet-600 bg-white px-3 py-2 shadow-sm">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="m-0 text-sm font-bold text-slate-900">{title}</p>
                        <p className="m-0 mt-1 text-xs font-medium text-violet-600">{dt('event_repeat_yearly')}</p>
                        <p className="m-0 mt-0.5 text-xs text-slate-500">
                          {dt('event_author')}: {getCommonTranslation(lang, 'me')} {getFamilyRoleEmoji('dad')}{' '}
                          {getFamilyRoleLabel(lang, 'dad')}
                        </p>
                        <p className="m-0 mt-0.5 text-xs text-slate-600">{note}</p>
                        <p className="m-0 mt-1 text-[10px] text-slate-400">등록: {registeredAt}</p>
                      </div>
                      <div className="flex shrink-0 flex-col items-center gap-1 text-xs">
                        <span className="text-violet-600" aria-hidden>
                          ✎
                        </span>
                        <span className="font-bold text-red-500" aria-hidden>
                          ×
                        </span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="py-5 text-center">
                    <p className="m-0 text-xs text-slate-500">{dt('event_no_events')}</p>
                    <p className="m-0 mt-1 text-[11px] text-slate-400">{dt('event_add_hint')}</p>
                  </div>
                )}
              </div>
            ) : null}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
