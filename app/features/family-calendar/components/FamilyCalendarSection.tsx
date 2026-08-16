/**
 * 가족 일정(Family Calendar) 섹션 컴포넌트
 */

'use client';

import React, { useState, useMemo, useCallback, memo, useRef, startTransition } from 'react';
import { Calendar, CalendarDays, Plus, X } from 'lucide-react';
import type { FamilyEvent } from '../types';
import { useFamilyCalendar } from '../hooks/useFamilyCalendar';
import { openCalendarEventModal } from '../calendar-event-modal-store';
import type { CalendarEventSubmitPayload } from './CalendarEventModal';
import type { LangCode } from '@/lib/language-fonts';
import { intlLocaleForLang } from '@/lib/language-fonts';
import type { UiTheme } from '@/lib/ui-theme';
import {
  isKidsCongratsFrame,
  kidsCongratsVariant,
  kidsStickerFromTitles,
  layoutKidsIdleDecos,
} from '../kids-decorations';

/** 레이아웃은 공통, 색·그라데이션만 테마별 — 모듈 상수로 매 렌더 할당을 막음 */
const CALENDAR_SKINS = {
  kids_friendly: {
    sectionBg: 'linear-gradient(180deg, rgba(237,233,254,0.92) 0%, rgba(221,214,254,0.85) 30%, rgba(252,231,243,0.75) 70%, rgba(254,215,170,0.5) 100%)',
    titleColor: '#5b21b6',
    navBg: 'rgba(255,255,255,0.9)',
    navBtn: '#7c3aed',
    navTitle: 'linear-gradient(90deg, #5b4b82 0%, #4a6d8c 28%, #4a7a6e 52%, #7a6a3d 76%, #7a5360 100%)',
    addBg: 'linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%)',
    cellIdle: 'rgba(255,255,255,0.8)',
    cellEvent: 'linear-gradient(135deg, #ede9fe 0%, #fce7f3 100%)',
    cellIdleShadow: '0 2px 8px rgba(180,160,220,0.2)',
    cellText: '#1e293b',
    cellEventText: '#7c3aed',
    selectedBg: 'linear-gradient(135deg, #7c3aed 0%, #5b21b6 100%)',
  },
  highend_glass: {
    sectionBg: 'transparent',
    titleColor: '#ffffff',
    navBg: 'rgba(255,255,255,0.16)',
    navBtn: '#a5f3fc',
    navTitle: 'linear-gradient(90deg, #67e8f9 0%, #f9a8d4 100%)',
    addBg: 'linear-gradient(135deg, #22d3ee 0%, #818cf8 100%)',
    cellIdle: 'rgba(255,255,255,0.14)',
    cellEvent: 'rgba(165,243,252,0.28)',
    cellIdleShadow: 'none',
    cellText: '#f1f5f9',
    cellEventText: '#a5f3fc',
    selectedBg: '#22d3ee',
  },
  default: {
    sectionBg: 'linear-gradient(180deg, #faf5ff 0%, #f8fafc 40%, #e0f2fe 100%)',
    titleColor: '#334155',
    navBg: 'rgba(255,255,255,0.92)',
    navBtn: '#6366f1',
    navTitle: 'linear-gradient(90deg, #6366f1 0%, #7c3aed 100%)',
    addBg: 'linear-gradient(135deg, #7c3aed 0%, #5b21b6 100%)',
    cellIdle: '#fff',
    cellEvent: 'linear-gradient(135deg, #e0e7ff 0%, #ddd6fe 100%)',
    cellIdleShadow: '0 1px 2px rgba(0,0,0,0.05)',
    cellText: '#1e293b',
    cellEventText: '#7c3aed',
    selectedBg: 'linear-gradient(135deg, #7c3aed 0%, #5b21b6 100%)',
  },
} as const;

function calendarSkin(theme: UiTheme) {
  return CALENDAR_SKINS[theme] ?? CALENDAR_SKINS.default;
}

type CalendarSkin = (typeof CALENDAR_SKINS)[keyof typeof CALENDAR_SKINS];
type CalendarGridCell =
  | { type: 'empty' }
  | { type: 'day'; date: Date; day: number; isToday: boolean; eventCount: number; kidsSticker: string | null };

/** Kids 평상시 장식. 연월이 바뀌면 자리만 섞고, 글자·숫자·버튼은 피한다. */
const KidsIdleDecorations = memo(function KidsIdleDecorations({
  year,
  month,
}: {
  year: number;
  month: number;
}) {
  const items = useMemo(() => layoutKidsIdleDecos(year, month), [year, month]);
  return (
    <div className="pointer-events-none absolute inset-0 z-[2] overflow-hidden bg-transparent" aria-hidden>
      {items.map((item, index) => (
        <img
          key={`${item.src}-${index}`}
          src={item.src}
          alt=""
          className={`absolute bg-transparent ${item.className}`}
        />
      ))}
    </div>
  );
});

const CalendarMonthGrid = memo(function CalendarMonthGrid({
  calendarGrid,
  selectedDate,
  isKidsTheme,
  uiTheme,
  skin,
  weekDays,
  sectionTitle,
  prevLabel,
  nextLabel,
  addLabel,
  monthTitle,
  onPrevMonth,
  onNextMonth,
  onSelectDate,
  onAdd,
}: {
  calendarGrid: { cells: CalendarGridCell[]; year: number; month: number };
  selectedDate: Date | null;
  isKidsTheme: boolean;
  uiTheme: UiTheme;
  skin: CalendarSkin;
  weekDays: string[];
  sectionTitle: string;
  prevLabel: string;
  nextLabel: string;
  addLabel: string;
  monthTitle: string;
  onPrevMonth: () => void;
  onNextMonth: () => void;
  onSelectDate: (date: Date) => void;
  onAdd: () => void;
}) {
  const [rocketTick, setRocketTick] = useState(0);
  const handleAddClick = () => {
    if (isKidsTheme) setRocketTick((tick) => tick + 1);
    onAdd();
  };

  return (
    <div className="calendar-widget-cq-frame">
      <section
        className={`content-section calendar-widget-section calendar-widget-section--frame${
          isKidsTheme ? ' relative' : ''
        }`}
        style={{
          ...(skin.sectionBg !== 'transparent' ? { background: skin.sectionBg } : null),
          paddingBottom: '2cqmin',
          paddingTop: '4.5cqmin',
        }}
      >
        {isKidsTheme ? <KidsIdleDecorations year={calendarGrid.year} month={calendarGrid.month} /> : null}
        <div className="section-header calendar-section-header" style={{ marginBottom: '2.5cqmin' }}>
          <h3
            className="section-title m-0 flex items-center calendar-section-title"
            style={{ color: skin.titleColor, fontWeight: 800 }}
          >
            {isKidsTheme ? (
              <span role="img" aria-label="calendar" style={{ fontSize: '1.05em' }}>📅</span>
            ) : (
              <Calendar className="calendar-section-title-icon" />
            )}
            {isKidsTheme ? 'FAMILY CALENDAR' : sectionTitle}
          </h3>
        </div>
        <div className="section-body calendar-section-body" style={{ gap: '2.2cqmin' }}>
          <div
            className="calendar-month-block min-h-0"
            style={{ gap: '2.2cqmin', flex: '1 1 0%', minHeight: 0 }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                background: skin.navBg,
                borderRadius: '999px',
                padding: '1.4cqmin 1.8cqmin',
                boxShadow: '0 2px 10px rgba(15,23,42,0.12)',
              }}
            >
              <button
                type="button"
                onClick={onPrevMonth}
                aria-label={prevLabel}
                className="flex items-center justify-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/60"
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: skin.navBtn, fontSize: '5.5cqmin', fontWeight: 800, padding: '0 1.5cqmin', lineHeight: 1 }}
              >
                ‹
              </button>
              <div className="relative flex min-w-0 flex-1 items-center justify-center">
                {isKidsTheme ? (
                  <span className="calendar-kids-month-glow pointer-events-none absolute -inset-y-[55%] inset-x-[2%] rounded-full" aria-hidden />
                ) : null}
                <h4
                  className="relative z-[1]"
                  style={{
                    flex: 1,
                    textAlign: 'center',
                    margin: 0,
                    fontSize: '5.5cqmin',
                    fontWeight: 800,
                    backgroundImage: skin.navTitle,
                    backgroundColor: 'transparent',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    backgroundClip: 'text',
                  }}
                >
                  {monthTitle}
                </h4>
              </div>
              <button
                type="button"
                onClick={onNextMonth}
                aria-label={nextLabel}
                className="flex items-center justify-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/60"
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: skin.navBtn, fontSize: '5.5cqmin', fontWeight: 800, padding: '0 1.5cqmin', lineHeight: 1 }}
              >
                ›
              </button>
            </div>
            <div className="calendar-grid-wrap">
              <div className="calendar-grid" style={{ gap: '1cqmin' }}>
                {weekDays.map((day, i) => (
                  <div
                    key={i}
                    className={`calendar-weekday ${
                      i === 0
                        ? 'calendar-weekday--sun'
                        : i === 6
                          ? 'calendar-weekday--sat'
                          : 'calendar-weekday--mid'
                    }`}
                    style={{ background: 'transparent' }}
                  >
                    {day}
                  </div>
                ))}
                {calendarGrid.cells.map((cell, i) => {
                  if (cell.type === 'empty') {
                    return <div key={`empty-${i}`} aria-hidden />;
                  }
                  const isSelected = selectedDate && selectedDate.getTime() === cell.date.getTime();
                  const congratsFrame = isKidsTheme && isKidsCongratsFrame(cell.kidsSticker);
                  const congratsVariant = congratsFrame && cell.kidsSticker
                    ? kidsCongratsVariant(cell.kidsSticker)
                    : null;
                  return (
                    <button
                      key={cell.day}
                      type="button"
                      onClick={() => onSelectDate(cell.date)}
                      data-congrats={congratsVariant ?? undefined}
                      style={{
                        background: congratsFrame
                          ? isSelected
                            ? 'rgba(124,58,237,0.16)'
                            : cell.isToday
                              ? 'rgba(251,191,36,0.2)'
                              : 'transparent'
                          : isSelected
                            ? skin.selectedBg
                            : cell.isToday
                              ? (uiTheme === 'highend_glass' ? 'rgba(251, 191, 36, 0.85)' : 'linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%)')
                              : cell.eventCount > 0
                                ? skin.cellEvent
                                : skin.cellIdle,
                        color: congratsFrame
                          ? isSelected
                            ? '#5b21b6'
                            : '#1e293b'
                          : isSelected || cell.isToday ? '#fff' : cell.eventCount > 0 ? skin.cellEventText : skin.cellText,
                        fontWeight: cell.isToday || isSelected || cell.eventCount > 0 ? '700' : '500',
                        boxShadow: congratsFrame
                          ? isSelected
                            ? '0 0 0 0.35cqmin #7c3aed'
                            : 'none'
                          : uiTheme === 'highend_glass'
                            ? 'none'
                            : isSelected
                              ? '0 4px 12px rgba(124, 58, 237, 0.4), inset 0 -2px 4px rgba(0,0,0,0.15)'
                              : cell.isToday
                                ? '0 4px 12px rgba(245, 158, 11, 0.4), inset 0 -2px 4px rgba(0,0,0,0.15)'
                                : cell.eventCount > 0
                                  ? '0 2px 6px rgba(124, 58, 237, 0.2)'
                                  : skin.cellIdleShadow,
                        borderRadius: '14px',
                      }}
                      className={`calendar-day-cell focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/60${
                        congratsFrame ? ' calendar-day-cell--congrats' : ''
                      }`}
                    >
                      {congratsFrame && cell.kidsSticker ? (
                        <>
                          <img
                            src={cell.kidsSticker}
                            alt=""
                            aria-hidden
                            className="calendar-day-cell-congrats-frame"
                          />
                          <span className="calendar-day-cell-congrats-num">{cell.day}</span>
                        </>
                      ) : (
                        <>
                          <span>{cell.day}</span>
                          {cell.kidsSticker ? (
                            <img
                              src={cell.kidsSticker}
                              alt=""
                              aria-hidden
                              className="mt-[0.2cqmin] h-[3.2cqmin] w-[3.2cqmin] bg-transparent object-contain"
                            />
                          ) : (
                            cell.eventCount > 0 && (
                              <span
                                className={`calendar-day-cell-count ${
                                  isSelected || cell.isToday ? 'text-white/90' : 'text-violet-600'
                                }`}
                              >
                                {cell.eventCount}개
                              </span>
                            )
                          )}
                        </>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
          <div className="relative w-full">
            {isKidsTheme && rocketTick > 0 ? (
              <img
                key={rocketTick}
                src="/family-calendar/emojis/rocket.png"
                alt=""
                aria-hidden
                className="calendar-kids-rocket pointer-events-none absolute left-1/2 z-[3] w-[16cqmin] bg-transparent"
              />
            ) : null}
            <button
              type="button"
              onClick={handleAddClick}
              className="calendar-kids-add-btn w-full rounded-full border-0 outline-none appearance-none transition-transform duration-200 hover:-translate-y-0.5 focus:outline-none focus-visible:outline-none"
              style={{
                padding: '2.8cqmin 3cqmin',
                borderRadius: '999px',
                background: skin.addBg,
                color: '#fff',
                fontWeight: 700,
                fontSize: '4.2cqmin',
                border: 'none',
                outline: 'none',
                boxShadow: 'none',
                WebkitAppearance: 'none',
                appearance: 'none',
                WebkitTapHighlightColor: 'transparent',
                overflow: 'hidden',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '1.5cqmin',
              }}
            >
              <Plus className="calendar-add-btn-icon" />
              {addLabel}
            </button>
          </div>
        </div>
      </section>
    </div>
  );
});

interface FamilyCalendarSectionProps {
  events: FamilyEvent[];
  onEventsChange: (events: FamilyEvent[]) => void;
  userId: string;
  currentGroupId: string | null;
  getCurrentKey: () => string;
  CryptoService: {
    encrypt: (data: any, key: string) => string;
    decrypt: (cipher: string, key: string) => any;
  };
  sanitizeInput: (input: string | null | undefined, maxLength?: number) => string;
  eventAuthorNames: Record<string, string>;
  familyRoleByUserId: Record<string, 'mom' | 'dad' | 'son' | 'daughter' | 'grandpa' | 'grandma' | 'other' | null>;
  getFamilyRoleEmoji: (role: 'mom' | 'dad' | 'son' | 'daughter' | 'grandpa' | 'grandma' | 'other' | null) => string;
  getFamilyRoleLabel: (lang: any, role: 'mom' | 'dad' | 'son' | 'daughter' | 'grandpa' | 'grandma' | 'other' | null) => string;
  lang: any;
  /** 대시보드에서 내려줌 — 내부 useGroup 금지(memo가 깨져 위젯 클릭 시 전체 재렌더됨) */
  uiTheme: UiTheme;
  translations: {
    section_title_calendar: string;
    calendar_prev_month: string;
    calendar_next_month: string;
    calendar_sun: string;
    calendar_mon: string;
    calendar_tue: string;
    calendar_wed: string;
    calendar_thu: string;
    calendar_fri: string;
    calendar_sat: string;
    calendar_day_events_title: string;
    event_add_title: string;
    event_edit_title: string;
    event_update_btn: string;
    event_start_date: string;
    event_end_date: string;
    event_end_unset: string;
    event_single_date: string;
    event_picker_start: string;
    event_picker_end: string;
    event_picker_year_month: string;
    event_title_label: string;
    event_title_placeholder: string;
    event_desc_label: string;
    event_desc_placeholder: string;
    event_repeat_label: string;
    event_repeat_none: string;
    event_repeat_monthly: string;
    event_repeat_yearly: string;
    event_submit_btn: string;
    event_title_required: string;
    event_date_invalid: string;
    event_title_invalid: string;
    event_author: string;
    event_no_events: string;
    event_add_hint: string;
    event_save_failed: string;
    delete_failed_retry: string;
    me: string;
    unknown: string;
    cancel: string;
    close: string;
    delete: string;
    delete_confirm: string;
    edit?: string;
  };
}

export const FamilyCalendarSection = memo(function FamilyCalendarSection({
  events,
  onEventsChange,
  userId,
  currentGroupId,
  getCurrentKey,
  CryptoService,
  sanitizeInput,
  eventAuthorNames,
  familyRoleByUserId,
  getFamilyRoleEmoji,
  getFamilyRoleLabel,
  lang,
  uiTheme,
  translations: t,
}: FamilyCalendarSectionProps) {
  const intlLocale = intlLocaleForLang(lang as LangCode);
  const formatMonthYear = useCallback(
    (y: number, mZeroBased: number) =>
      new Date(y, mZeroBased, 1).toLocaleDateString(intlLocale, { year: 'numeric', month: 'long' }),
    [intlLocale],
  );
  const formatLongDate = useCallback(
    (d: Date) => d.toLocaleDateString(intlLocale, { year: 'numeric', month: 'long', day: 'numeric' }),
    [intlLocale],
  );

  const isKidsTheme = uiTheme === 'kids_friendly';
  const skin = calendarSkin(uiTheme);

  const isKidsThemeRef = useRef(isKidsTheme);
  isKidsThemeRef.current = isKidsTheme;
  const translationsRef = useRef(t);
  translationsRef.current = t;
  const sanitizeInputRef = useRef(sanitizeInput);
  sanitizeInputRef.current = sanitizeInput;
  const submitEventRef = useRef<(payload: CalendarEventSubmitPayload) => void>(() => {});

  const fireConfetti = useCallback(() => {
    import('canvas-confetti').then(({ default: confetti }) => {
      confetti({
        particleCount: 80,
        spread: 70,
        origin: { x: 0.5, y: 0.6 },
        colors: ['#7c3aed', '#db2777', '#fbbf24', '#34d399', '#60a5fa'],
        ticks: 200,
      });
    });
  }, []);

  const fireUpdateConfetti = useCallback(() => {
    import('canvas-confetti').then(({ default: confetti }) => {
      const canvas = document.createElement('canvas');
      canvas.setAttribute('aria-hidden', 'true');
      canvas.style.cssText =
        'position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:10050';
      document.body.appendChild(canvas);
      const fire = confetti.create(canvas, { resize: true, useWorker: false });
      const colors = ['#7c3aed', '#db2777', '#fbbf24', '#34d399', '#60a5fa'];
      const sparkle = (x: number, y: number) => {
        fire({
          particleCount: 32,
          spread: 360,
          startVelocity: 22,
          origin: { x, y },
          colors,
          ticks: 140,
          gravity: 0.85,
          scalar: 1.15,
          shapes: ['star'],
        });
      };
      sparkle(0.28, 0.22);
      sparkle(0.72, 0.2);
      setTimeout(() => sparkle(0.5, 0.16), 180);
      setTimeout(() => {
        fire.reset();
        canvas.remove();
      }, 2500);
    });
  }, []);

  const [calendarMonth, setCalendarMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const selectedDateRef = useRef(selectedDate);
  selectedDateRef.current = selectedDate;

  const { addEvent, updateEvent, deleteEvent } = useFamilyCalendar({
    currentGroupId,
    userId,
    getCurrentKey,
    CryptoService,
    onEventsChange,
    currentEvents: events,
  });

  const eventMatchesDate = useCallback((e: FamilyEvent, dateKey: string): boolean => {
    if (e.repeat_type === 'monthly') {
      const dayMatch = dateKey.substring(8, 10);
      return e.day === dayMatch.replace(/^0/, '');
    } else if (e.repeat_type === 'yearly') {
      const monthDay = dateKey.substring(5, 10);
      const [mm, dd] = monthDay.split('-');
      const MONTH_NAMES = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];
      const monthName = MONTH_NAMES[parseInt(mm, 10) - 1] ?? '';
      return e.month === monthName && e.day === dd.replace(/^0/, '');
    } else {
      // 기간 이벤트: end_date > event_date 이면 범위 전체에 표시
      if (e.end_date && e.end_date > e.event_date) {
        return dateKey >= e.event_date && dateKey <= e.end_date;
      }
      return e.event_date === dateKey;
    }
  }, []);

  const calendarGrid = useMemo(() => {
    const y = calendarMonth.getFullYear();
    const m = calendarMonth.getMonth();
    const firstDay = new Date(y, m, 1).getDay();
    const daysInMonth = new Date(y, m + 1, 0).getDate();
    const today = new Date();
    const todayKey = today.getFullYear() + '-' + String(today.getMonth() + 1).padStart(2, '0') + '-' + String(today.getDate()).padStart(2, '0');
    const eventCountByDate: Record<string, number> = {};

    for (let d = 1; d <= daysInMonth; d++) {
      const key = y + '-' + String(m + 1).padStart(2, '0') + '-' + String(d).padStart(2, '0');
      eventCountByDate[key] = (events || []).filter((e) => eventMatchesDate(e, key)).length;
    }

    const cells: CalendarGridCell[] = [];

    for (let i = 0; i < firstDay; i++) cells.push({ type: 'empty' });

    for (let d = 1; d <= daysInMonth; d++) {
      const date = new Date(y, m, d);
      const key = date.getFullYear() + '-' + String(date.getMonth() + 1).padStart(2, '0') + '-' + String(d).padStart(2, '0');
      const eventCount = eventCountByDate[key] || 0;
      const titles = isKidsTheme && eventCount > 0
        ? (events || []).filter((e) => eventMatchesDate(e, key)).map((e) => e.title)
        : [];
      cells.push({
        type: 'day',
        date,
        day: d,
        isToday: key === todayKey,
        eventCount,
        kidsSticker: titles.length > 0 ? kidsStickerFromTitles(titles, key) : null,
      });
    }

    return { cells, year: y, month: m };
  }, [calendarMonth, events, eventMatchesDate, isKidsTheme]);

  const eventsOnSelectedDate = useMemo(() => {
    if (!selectedDate) return [];
    const key =
      selectedDate.getFullYear() +
      '-' +
      String(selectedDate.getMonth() + 1).padStart(2, '0') +
      '-' +
      String(selectedDate.getDate()).padStart(2, '0');
    return (events || []).filter((e) => eventMatchesDate(e, key));
  }, [selectedDate, events, eventMatchesDate]);

  const openEventModal = useCallback(() => {
    openCalendarEventModal({
      isKidsTheme: isKidsThemeRef.current,
      initialDate: selectedDateRef.current || new Date(),
      editingEvent: null,
      translations: translationsRef.current,
      sanitizeInput: (input, maxLength) => sanitizeInputRef.current(input, maxLength),
      onSubmit: (payload) => submitEventRef.current(payload),
    });
  }, []);

  const handlePrevMonth = useCallback(() => {
    setCalendarMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  }, []);

  const handleNextMonth = useCallback(() => {
    setCalendarMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
  }, []);

  const openEditEventModal = (event: FamilyEvent) => {
    if (event.created_by != null && String(event.created_by).trim() !== String(userId).trim()) {
      return;
    }
    const idStr = String(event.id);
    if (/^\d+$/.test(idStr)) {
      return;
    }
    const d = event.event_date ? new Date(event.event_date + 'T12:00:00') : selectedDate || new Date();
    openCalendarEventModal({
      isKidsTheme: isKidsThemeRef.current,
      initialDate: d,
      editingEvent: event,
      translations: translationsRef.current,
      sanitizeInput: (input, maxLength) => sanitizeInputRef.current(input, maxLength),
      onSubmit: (payload) => submitEventRef.current(payload),
    });
  };

  const handleEventSubmit = (payload: CalendarEventSubmitPayload) => {

    if (payload.editingEventId) {
      const previousEvents = events;
      const nextEvents = events.map((e) =>
        String(e.id) === payload.editingEventId
          ? {
              ...e,
              month: payload.month,
              day: payload.day,
              title: payload.title,
              desc: payload.desc,
              event_date: payload.event_date,
              end_date: payload.end_date,
              repeat_type: payload.repeat_type,
            }
          : e,
      );
      startTransition(() => {
        onEventsChange(nextEvents);
      });
      if (isKidsThemeRef.current) {
        requestAnimationFrame(() => {
          window.setTimeout(fireUpdateConfetti, 0);
        });
      }

      updateEvent({
        id: payload.editingEventId,
        month: payload.month,
        day: payload.day,
        title: payload.title,
        desc: payload.desc,
        event_date: payload.event_date,
        end_date: payload.end_date,
        repeat_type: payload.repeat_type,
      }).catch((error) => {
        console.error('일정 수정 실패, 복구 중:', error);
        onEventsChange(previousEvents);
      });
      return;
    }

    const newEvent: FamilyEvent = {
      id: Date.now(),
      month: payload.month,
      day: payload.day,
      title: payload.title,
      desc: payload.desc,
      event_date: payload.event_date,
      end_date: payload.end_date,
      repeat_type: payload.repeat_type,
    };

    startTransition(() => {
      onEventsChange([newEvent, ...events]);
    });

    if (isKidsThemeRef.current) {
      setTimeout(fireConfetti, 500);
    }

    addEvent(newEvent).catch((error) => {
      console.error('일정 저장 실패, 복구 중:', error);
      onEventsChange(events.filter((e) => e.id !== newEvent.id));
    });
  };
  submitEventRef.current = handleEventSubmit;

  const handleDeleteEvent = async (eventId: number | string) => {
    if (!confirm(t.delete_confirm)) return;

    const eventToDelete = events.find((e) => e.id === eventId);

    // 작성자만 삭제 가능
    if (eventToDelete && eventToDelete.created_by != null && String(eventToDelete.created_by).trim() !== String(userId).trim()) {
      alert('작성자만 삭제할 수 있습니다.');
      return;
    }

    // 낙관적 업데이트
    const previousEvents = events;
    onEventsChange(events.filter((e) => e.id !== eventId));

    try {
      await deleteEvent(eventId);
    } catch (error) {
      console.error('일정 삭제 실패, 복구 중:', error);
      if (eventToDelete) {
        onEventsChange([...previousEvents].sort((a, b) => {
          const monthOrder: { [key: string]: number } = {
            JAN: 1,
            FEB: 2,
            MAR: 3,
            APR: 4,
            MAY: 5,
            JUN: 6,
            JUL: 7,
            AUG: 8,
            SEP: 9,
            OCT: 10,
            NOV: 11,
            DEC: 12,
          };
          const monthDiff = (monthOrder[a.month] || 0) - (monthOrder[b.month] || 0);
          if (monthDiff !== 0) return monthDiff;
          return parseInt(a.day) - parseInt(b.day);
        }));
      }
      alert(t.delete_failed_retry);
    }
  };

  const weekDays = useMemo(
    () => [t.calendar_sun, t.calendar_mon, t.calendar_tue, t.calendar_wed, t.calendar_thu, t.calendar_fri, t.calendar_sat],
    [t],
  );
  const hasSelection = selectedDate != null;
  const monthTitle = formatMonthYear(calendarGrid.year, calendarGrid.month).toUpperCase();

  return (
      <div
        className={`calendar-widget-stack${
          hasSelection ? ' calendar-widget-stack--expanded' : ''
        }`}
      >
        {/* 상세 패널은 프레임 밖(아래)으로 분리해 날짜 셀 CQ 스케일 유지 */}
        <CalendarMonthGrid
          calendarGrid={calendarGrid}
          selectedDate={selectedDate}
          isKidsTheme={isKidsTheme}
          uiTheme={uiTheme}
          skin={skin}
          weekDays={weekDays}
          sectionTitle={t.section_title_calendar}
          prevLabel={t.calendar_prev_month}
          nextLabel={t.calendar_next_month}
          addLabel={t.event_add_title}
          monthTitle={monthTitle}
          onPrevMonth={handlePrevMonth}
          onNextMonth={handleNextMonth}
          onSelectDate={setSelectedDate}
          onAdd={openEventModal}
        />

            {selectedDate && (
              <div className="calendar-detail-panel">
                <div className="calendar-detail-header">
                  <h4 className="calendar-detail-title">
                    <CalendarDays className="calendar-detail-title-icon" />
                    {t.calendar_day_events_title.replace(/\{date\}/g, formatLongDate(selectedDate))}
                  </h4>
                  <button
                    type="button"
                    onClick={() => setSelectedDate(null)}
                    className="calendar-detail-close-btn transition-all duration-200 hover:border-slate-300 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400/60"
                  >
                    <X className="calendar-nav-btn-icon" />
                    {t.close}
                  </button>
                </div>
                {eventsOnSelectedDate.length > 0 ? (
                  <div className="calendar-detail-events">
                    {eventsOnSelectedDate.map((e) => (
                      <div
                        key={e.id}
                        className="calendar-event-card transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_8px_24px_rgba(124,58,237,0.12)]"
                      >
                        <div className="flex items-start justify-between" style={{ gap: '2.5cqmin' }}>
                          <div className="min-w-0 flex-1">
                            <h5 className="calendar-event-card-title">{e.title}</h5>
                            {(e.repeat_type === 'monthly' || e.repeat_type === 'yearly') && (
                              <p className="calendar-event-card-meta text-violet-600">
                                {e.repeat_type === 'monthly' ? t.event_repeat_monthly : t.event_repeat_yearly}
                              </p>
                            )}
                            {e.created_by != null && (
                              <p className="calendar-event-card-meta text-slate-500">
                                {t.event_author}:{' '}
                                {e.created_by === userId ? t.me : eventAuthorNames[e.created_by] ?? t.unknown}
                                {familyRoleByUserId[e.created_by]
                                  ? ` ${getFamilyRoleEmoji(familyRoleByUserId[e.created_by])} ${getFamilyRoleLabel(lang, familyRoleByUserId[e.created_by])}`
                                  : ''}
                              </p>
                            )}
                            {e.desc && (
                              <p className="calendar-event-card-desc">{e.desc}</p>
                            )}
                            {e.created_at && (
                              <p className="calendar-event-card-meta mb-0 text-slate-400" style={{ marginTop: '1.5cqmin' }}>
                                등록: {new Date(e.created_at).toLocaleString('ko-KR')}
                              </p>
                            )}
                          </div>
                          {e.created_by != null && String(e.created_by).trim() === String(userId).trim() && (
                            <div className="flex shrink-0 flex-col gap-1">
                              <button
                                type="button"
                                onClick={() => openEditEventModal(e)}
                                className="cursor-pointer rounded-md border-none bg-transparent text-violet-600 hover:bg-violet-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/60"
                                style={{ padding: '1.5cqmin' }}
                                aria-label={t.edit || '수정'}
                              >
                                <svg className="calendar-nav-btn-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                </svg>
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteEvent(e.id)}
                                className="cursor-pointer rounded-md border-none bg-transparent text-red-500 hover:bg-red-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400/60"
                                style={{ padding: '1.5cqmin' }}
                                aria-label={t.delete}
                              >
                                <svg className="calendar-nav-btn-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                                </svg>
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="calendar-detail-empty">
                    <Calendar className="calendar-detail-empty-icon" />
                    <p className="calendar-detail-empty-text">{t.event_no_events}</p>
                    <p className="calendar-detail-empty-hint">{t.event_add_hint}</p>
                  </div>
                )}
              </div>
            )}
      </div>
  );
});
