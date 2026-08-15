/**
 * 가족 일정(Family Calendar) 섹션 컴포넌트
 */

'use client';

import React, { useState, useMemo, useCallback, memo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Calendar, ChevronLeft, ChevronRight, CalendarDays, Plus, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import type { FamilyEvent } from '../types';
import { useFamilyCalendar } from '../hooks/useFamilyCalendar';
import type { LangCode } from '@/lib/language-fonts';
import { intlLocaleForLang } from '@/lib/language-fonts';
import { useGroup } from '@/app/contexts/GroupContext';
import { resolveUiTheme } from '@/lib/ui-theme';

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
  realtimeSubscriptionId: string;
  eventAuthorNames: Record<string, string>;
  familyRoleByUserId: Record<string, 'mom' | 'dad' | 'son' | 'daughter' | 'grandpa' | 'grandma' | 'other' | null>;
  getFamilyRoleEmoji: (role: 'mom' | 'dad' | 'son' | 'daughter' | 'grandpa' | 'grandma' | 'other' | null) => string;
  getFamilyRoleLabel: (lang: any, role: 'mom' | 'dad' | 'son' | 'daughter' | 'grandpa' | 'grandma' | 'other' | null) => string;
  lang: any;
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
    event_edit_title?: string;
    event_update_btn?: string;
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
  realtimeSubscriptionId,
  eventAuthorNames,
  familyRoleByUserId,
  getFamilyRoleEmoji,
  getFamilyRoleLabel,
  lang,
  translations: t,
}: FamilyCalendarSectionProps) {
  const intlLocale = intlLocaleForLang(lang as LangCode);
  const formatMonthYear = (y: number, mZeroBased: number) =>
    new Date(y, mZeroBased, 1).toLocaleDateString(intlLocale, { year: 'numeric', month: 'long' });
  const formatLongDate = (d: Date) =>
    d.toLocaleDateString(intlLocale, { year: 'numeric', month: 'long', day: 'numeric' });

  const { currentGroup } = useGroup();
  const isKidsTheme = resolveUiTheme((currentGroup as { ui_theme?: unknown } | null)?.ui_theme) === 'kids_friendly';

  const getKidsEventEmoji = useCallback((titles: string[]): string => {
    const text = titles.join(' ').toLowerCase();
    if (/생일|birthday|cake|케이크/.test(text)) return '🎂';
    if (/여행|travel|trip|vacation|비행|flight/.test(text)) return '✈️';
    if (/학교|school|수업|class|학원/.test(text)) return '📚';
    if (/병원|doctor|dentist|치과|의원/.test(text)) return '🏥';
    if (/운동|gym|sport|축구|야구|수영/.test(text)) return '⚽';
    if (/파티|party|festival|축제/.test(text)) return '🎉';
    if (/결혼|wedding/.test(text)) return '💒';
    if (/가족|family/.test(text)) return '👨‍👩‍👧‍👦';
    if (/집|home|house|이사/.test(text)) return '🏠';
    if (/음악|music|concert|콘서트/.test(text)) return '🎵';
    return '⭐';
  }, []);

  const isKidsThemeRef = useRef(isKidsTheme);
  isKidsThemeRef.current = isKidsTheme;

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

  const [calendarMonth, setCalendarMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [showEventModal, setShowEventModal] = useState(false);
  const [editingEventId, setEditingEventId] = useState<string | null>(null);
  const [eventFormDate, setEventFormDate] = useState<Date | null>(null);
  const [eventForm, setEventForm] = useState<{ title: string; month: string; day: string; desc: string; repeat_type: 'none' | 'monthly' | 'yearly' }>({
    title: '',
    month: '',
    day: '',
    desc: '',
    repeat_type: 'none',
  });

  const { addEvent, updateEvent, deleteEvent } = useFamilyCalendar({
    currentGroupId,
    userId,
    getCurrentKey,
    CryptoService,
    onEventsChange,
    currentEvents: events,
    realtimeSubscriptionId,
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

    const cells: Array<
      { type: 'empty' } | { type: 'day'; date: Date; day: number; isCurrentMonth: true; isToday: boolean; eventCount: number }
    > = [];

    for (let i = 0; i < firstDay; i++) cells.push({ type: 'empty' });

    for (let d = 1; d <= daysInMonth; d++) {
      const date = new Date(y, m, d);
      const key = date.getFullYear() + '-' + String(date.getMonth() + 1).padStart(2, '0') + '-' + String(d).padStart(2, '0');
      cells.push({
        type: 'day',
        date,
        day: d,
        isCurrentMonth: true,
        isToday: key === todayKey,
        eventCount: eventCountByDate[key] || 0,
      });
    }

    return { cells, year: y, month: m };
  }, [calendarMonth, events, eventMatchesDate]);

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

  const openEventModal = () => {
    const d = selectedDate || new Date();
    setEditingEventId(null);
    setEventFormDate(d);
    const month = d.toLocaleDateString('en-US', { month: 'short' }).toUpperCase();
    const day = d.getDate().toString();
    setEventForm({ title: '', month, day, desc: '', repeat_type: 'none' });
    setShowEventModal(true);
  };

  const openEditEventModal = (event: FamilyEvent) => {
    if (event.created_by != null && String(event.created_by).trim() !== String(userId).trim()) {
      alert('작성자만 수정할 수 있습니다.');
      return;
    }
    const idStr = String(event.id);
    if (/^\d+$/.test(idStr)) {
      alert('아직 저장되지 않은 일정입니다.');
      return;
    }
    const d = event.event_date ? new Date(event.event_date + 'T12:00:00') : selectedDate || new Date();
    setEditingEventId(idStr);
    setEventFormDate(d);
    setEventForm({
      title: event.title || '',
      month: event.month || d.toLocaleDateString('en-US', { month: 'short' }).toUpperCase(),
      day: event.day || String(d.getDate()),
      desc: event.desc || '',
      repeat_type: event.repeat_type === 'monthly' || event.repeat_type === 'yearly' ? event.repeat_type : 'none',
    });
    setShowEventModal(true);
  };

  const closeEventModal = () => {
    setShowEventModal(false);
    setEditingEventId(null);
    setEventFormDate(null);
    setEventForm({ title: '', month: '', day: '', desc: '', repeat_type: 'none' });
  };

  const handleEventSubmit = () => {
    if (!eventForm.title.trim()) {
      alert(t.event_title_required);
      return;
    }

    const dayNum = parseInt(eventForm.day, 10);
    if (isNaN(dayNum) || dayNum < 1 || dayNum > 31) {
      alert(t.event_date_invalid);
      return;
    }

    const sanitizedTitle = sanitizeInput(eventForm.title, 100);
    const sanitizedMonth = sanitizeInput(eventForm.month, 10);
    const sanitizedDay = dayNum.toString();
    const sanitizedDesc = sanitizeInput(eventForm.desc, 200);

    if (!sanitizedTitle) {
      alert(t.event_title_invalid);
      return;
    }

    const eventDateStr = eventFormDate
      ? `${eventFormDate.getFullYear()}-${String(eventFormDate.getMonth() + 1).padStart(2, '0')}-${String(eventFormDate.getDate()).padStart(2, '0')}`
      : '';

    if (editingEventId) {
      const previousEvents = events;
      onEventsChange(
        events.map((e) =>
          String(e.id) === editingEventId
            ? {
                ...e,
                month: sanitizedMonth,
                day: sanitizedDay,
                title: sanitizedTitle,
                desc: sanitizedDesc,
                event_date: eventDateStr,
                repeat_type: eventForm.repeat_type || 'none',
              }
            : e,
        ),
      );

      updateEvent({
        id: editingEventId,
        month: sanitizedMonth,
        day: sanitizedDay,
        title: sanitizedTitle,
        desc: sanitizedDesc,
        event_date: eventDateStr,
        repeat_type: eventForm.repeat_type || 'none',
      }).catch((error) => {
        console.error('일정 수정 실패, 복구 중:', error);
        onEventsChange(previousEvents);
        alert(error instanceof Error ? error.message : t.event_save_failed);
      });

      closeEventModal();
      return;
    }

    const newEvent: FamilyEvent = {
      id: Date.now(),
      month: sanitizedMonth,
      day: sanitizedDay,
      title: sanitizedTitle,
      desc: sanitizedDesc,
      event_date: eventDateStr,
      repeat_type: eventForm.repeat_type || 'none',
    };

    // 낙관적 업데이트
    onEventsChange([newEvent, ...events]);

    // Kids 테마: 신규 일정 추가 성공 시 confetti (0.5초 지연)
    if (isKidsThemeRef.current) {
      setTimeout(fireConfetti, 500);
    }

    // Supabase 추가
    addEvent(newEvent)
      .catch((error) => {
        console.error('일정 저장 실패, 복구 중:', error);
        onEventsChange(events.filter((e) => e.id !== newEvent.id));
        alert(t.event_save_failed);
      });

    closeEventModal();
  };

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

  const weekDays = [t.calendar_sun, t.calendar_mon, t.calendar_tue, t.calendar_wed, t.calendar_thu, t.calendar_fri, t.calendar_sat];
  const hasSelection = selectedDate != null;

  return (
    <>
      {/* Event Modal — createPortal로 widget-chrome CSS containment 범위 밖에 렌더링 */}
      {showEventModal && createPortal(
        <div
          className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/50"
          onClick={closeEventModal}
        >
          <div
            className={`w-[90%] max-w-[480px] rounded-[28px] p-6 shadow-[0_20px_60px_rgba(0,0,0,0.3)]`}
            style={isKidsTheme ? {
              background: 'linear-gradient(160deg, #ede9fe 0%, #e0e7ff 40%, #fce7f3 80%, #fed7aa 100%)',
              border: '1.5px solid rgba(255,255,255,0.7)',
            } : { background: '#fff', borderRadius: '12px' }}
            onClick={(e) => e.stopPropagation()}
          >
            {isKidsTheme && (
              <p className="mb-0 mt-0 text-center text-xs font-bold uppercase tracking-widest text-violet-400">
                FAMILY CALENDAR
              </p>
            )}
            <h3
              className={`mt-1 text-center font-bold ${
                isKidsTheme
                  ? 'mb-1 text-3xl text-violet-700'
                  : 'mb-2 mt-0 text-xl font-semibold text-slate-800'
              }`}
            >
              {editingEventId ? (t.event_edit_title || '일정 수정') : t.event_add_title}
            </h3>
            {eventFormDate && (
              <p className={`mt-0 text-center ${isKidsTheme ? 'mb-5 text-sm font-semibold text-violet-500' : 'mb-5 text-sm text-slate-500'}`}>
                {formatLongDate(eventFormDate)}
              </p>
            )}

            <div className="mb-4">
              <label className={`mb-2 block text-sm font-bold ${isKidsTheme ? 'text-slate-700' : 'font-medium text-slate-700'}`}>
                {t.event_title_label}
              </label>
              <input
                type="text"
                value={eventForm.title}
                onChange={(e) => setEventForm({ ...eventForm, title: e.target.value })}
                placeholder={t.event_title_placeholder}
                className={`w-full box-border p-3 text-[15px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/60 ${
                  isKidsTheme
                    ? 'rounded-2xl border-none bg-white/80 shadow-sm'
                    : 'rounded-lg border border-slate-200'
                }`}
              />
            </div>

            <div className="mb-5">
              <label className={`mb-2 block text-sm font-bold ${isKidsTheme ? 'text-slate-700' : 'font-medium text-slate-700'}`}>
                {t.event_desc_label}
              </label>
              <textarea
                value={eventForm.desc}
                onChange={(e) => setEventForm({ ...eventForm, desc: e.target.value })}
                placeholder={t.event_desc_placeholder}
                rows={3}
                className={`w-full box-border resize-y p-3 text-[15px] font-inherit focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/60 ${
                  isKidsTheme
                    ? 'rounded-2xl border-none bg-white/80 shadow-sm'
                    : 'rounded-lg border border-slate-200'
                }`}
              />
            </div>

            <div className="mb-5">
              <label className={`mb-2 block text-sm font-bold ${isKidsTheme ? 'text-slate-700' : 'font-medium text-slate-700'}`}>
                {t.event_repeat_label}
              </label>
              <div className="flex flex-wrap gap-4">
                <label className="flex cursor-pointer items-center gap-1.5 text-sm">
                  <input
                    type="radio"
                    name="repeat_type"
                    checked={eventForm.repeat_type === 'none'}
                    onChange={() => setEventForm({ ...eventForm, repeat_type: 'none' })}
                  />
                  {t.event_repeat_none}
                </label>
                <label className="flex cursor-pointer items-center gap-1.5 text-sm">
                  <input
                    type="radio"
                    name="repeat_type"
                    checked={eventForm.repeat_type === 'monthly'}
                    onChange={() => setEventForm({ ...eventForm, repeat_type: 'monthly' })}
                  />
                  {t.event_repeat_monthly}
                </label>
                <label className="flex cursor-pointer items-center gap-1.5 text-sm">
                  <input
                    type="radio"
                    name="repeat_type"
                    checked={eventForm.repeat_type === 'yearly'}
                    onChange={() => setEventForm({ ...eventForm, repeat_type: 'yearly' })}
                  />
                  {t.event_repeat_yearly}
                </label>
              </div>
            </div>

            <div className={`flex gap-3 ${isKidsTheme ? 'justify-center' : 'justify-end'}`}>
              <button
                onClick={closeEventModal}
                className={`cursor-pointer font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400/60 ${
                  isKidsTheme
                    ? 'rounded-2xl border-none bg-white/80 px-7 py-3 text-[15px] text-slate-500 shadow-sm hover:bg-white'
                    : 'rounded-lg border border-slate-200 bg-white px-5 py-2.5 text-[15px] text-slate-500 hover:bg-slate-50'
                }`}
              >
                {t.cancel}
              </button>
              <button
                onClick={handleEventSubmit}
                className={`cursor-pointer font-bold text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/60 ${
                  isKidsTheme
                    ? 'rounded-2xl border-none px-7 py-3 text-[15px]'
                    : 'rounded-lg border-none px-5 py-2.5 text-[15px] font-medium'
                }`}
                style={isKidsTheme ? {
                  background: 'linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%)',
                  boxShadow: '0 4px 14px rgba(124,58,237,0.4)',
                } : { background: '#6366f1' }}
              >
                {editingEventId ? (t.event_update_btn || '저장') : t.event_submit_btn}
              </button>
            </div>
          </div>
        </div>
      , document.body)}

      {/* Calendar Section — 상세 패널은 프레임 밖(아래)으로 분리해 날짜 셀 CQ 스케일 유지 */}
      <div
        className={`calendar-widget-stack${
          hasSelection ? ' calendar-widget-stack--expanded' : ''
        }`}
      >
      <div className="calendar-widget-cq-frame">
      {/* cqmin 기반 스케일·그라디언트 텍스트는 Tailwind arbitrary 처리가 불가하여 inline style 사용 */}
      <section
        className={`content-section calendar-widget-section calendar-widget-section--frame${
          isKidsTheme ? '' : ' bg-gradient-to-br from-purple-50 via-slate-50 to-sky-50'
        }`}
        style={isKidsTheme ? {
          background: 'linear-gradient(180deg, rgba(237,233,254,0.92) 0%, rgba(221,214,254,0.85) 30%, rgba(252,231,243,0.75) 70%, rgba(254,215,170,0.5) 100%)',
        } : undefined}
      >
        {isKidsTheme ? (
          <div className="section-header calendar-section-header">
            <h3
              className="section-title m-0 flex items-center calendar-section-title"
              style={{ color: '#5b21b6', fontWeight: 800 }}
            >
              <span role="img" aria-label="calendar" style={{ fontSize: '1.05em' }}>📅</span>
              FAMILY CALENDAR
            </h3>
          </div>
        ) : (
          <div className="section-header calendar-section-header">
            <h3 className="section-title m-0 flex items-center calendar-section-title">
              <Calendar className="calendar-section-title-icon" />
              {t.section_title_calendar}
            </h3>
          </div>
        )}
        <div className="section-body calendar-section-body">
          <motion.div
            key={`${calendarGrid.year}-${calendarGrid.month}`}
            className="calendar-month-block"
            initial={{ opacity: 0.7 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.2 }}
          >
            {isKidsTheme ? (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  background: 'rgba(255,255,255,0.9)',
                  borderRadius: '999px',
                  padding: '1.4cqmin 1.8cqmin',
                  boxShadow: '0 2px 10px rgba(180,160,220,0.18)',
                }}
              >
                <button
                  type="button"
                  onClick={() => setCalendarMonth(new Date(calendarGrid.year, calendarGrid.month - 1, 1))}
                  aria-label={t.calendar_prev_month}
                  className="flex items-center justify-center rounded-full transition-colors hover:bg-violet-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/60"
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#7c3aed', fontSize: '5.5cqmin', fontWeight: 800, padding: '0 1.5cqmin', lineHeight: 1 }}
                >
                  ‹
                </button>
                <h4
                  style={{
                    flex: 1,
                    textAlign: 'center',
                    margin: 0,
                    fontSize: '5.5cqmin',
                    fontWeight: 800,
                    background: 'linear-gradient(90deg, #7c3aed 0%, #db2777 100%)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    backgroundClip: 'text',
                  }}
                >
                  {formatMonthYear(calendarGrid.year, calendarGrid.month).toUpperCase()}
                </h4>
                <button
                  type="button"
                  onClick={() => setCalendarMonth(new Date(calendarGrid.year, calendarGrid.month + 1, 1))}
                  aria-label={t.calendar_next_month}
                  className="flex items-center justify-center rounded-full transition-colors hover:bg-violet-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/60"
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#7c3aed', fontSize: '5.5cqmin', fontWeight: 800, padding: '0 1.5cqmin', lineHeight: 1 }}
                >
                  ›
                </button>
              </div>
            ) : (
              <div className="calendar-month-nav">
                <h4 className="calendar-month-title">
                  {formatMonthYear(calendarGrid.year, calendarGrid.month)}
                </h4>
                <div className="calendar-month-nav-btns">
                  <button
                    type="button"
                    onClick={() => setCalendarMonth(new Date(calendarGrid.year, calendarGrid.month - 1, 1))}
                    className="calendar-nav-btn transition-all duration-200 hover:border-violet-300 hover:bg-violet-50 hover:shadow-[0_4px_12px_rgba(124,58,237,0.2)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/60"
                  >
                    <ChevronLeft className="calendar-nav-btn-icon" />
                    {t.calendar_prev_month}
                  </button>
                  <button
                    type="button"
                    onClick={() => setCalendarMonth(new Date(calendarGrid.year, calendarGrid.month + 1, 1))}
                    className="calendar-nav-btn transition-all duration-200 hover:border-violet-300 hover:bg-violet-50 hover:shadow-[0_4px_12px_rgba(124,58,237,0.2)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/60"
                  >
                    {t.calendar_next_month}
                    <ChevronRight className="calendar-nav-btn-icon" />
                  </button>
                </div>
              </div>
            )}
            <div className="calendar-grid-wrap">
              <div className="calendar-grid">
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
                  >
                    {day}
                  </div>
                ))}
                {calendarGrid.cells.map((cell, i) => {
                  if (cell.type === 'empty') {
                    return <div key={`empty-${i}`} aria-hidden />;
                  }

                  const isSelected = selectedDate && selectedDate.getTime() === cell.date.getTime();
                  const dateKey = cell.date.getFullYear() + '-' + String(cell.date.getMonth() + 1).padStart(2, '0') + '-' + String(cell.day).padStart(2, '0');
                  const eventsOnDay = isKidsTheme && cell.eventCount > 0
                    ? (events || []).filter((e) => eventMatchesDate(e, dateKey)).map((e) => e.title)
                    : [];
                  const kidsEmoji = isKidsTheme && eventsOnDay.length > 0 ? getKidsEventEmoji(eventsOnDay) : null;

                  return (
                    <button
                      key={cell.day}
                      type="button"
                      onClick={() => setSelectedDate(cell.date)}
                      style={{
                        background: isSelected
                          ? 'linear-gradient(135deg, #7c3aed 0%, #5b21b6 100%)'
                          : cell.isToday
                            ? 'linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%)'
                            : cell.eventCount > 0
                              ? isKidsTheme
                                ? 'linear-gradient(135deg, #ede9fe 0%, #fce7f3 100%)'
                                : 'linear-gradient(135deg, #e0e7ff 0%, #ddd6fe 100%)'
                              : isKidsTheme
                                ? 'rgba(255,255,255,0.8)'
                                : '#fff',
                        color: isSelected || cell.isToday ? '#fff' : cell.eventCount > 0 ? '#7c3aed' : '#1e293b',
                        fontWeight: cell.isToday || isSelected || cell.eventCount > 0 ? '700' : '500',
                        boxShadow: isSelected
                          ? '0 4px 12px rgba(124, 58, 237, 0.4), inset 0 -2px 4px rgba(0,0,0,0.15)'
                          : cell.isToday
                            ? '0 4px 12px rgba(245, 158, 11, 0.4), inset 0 -2px 4px rgba(0,0,0,0.15)'
                            : cell.eventCount > 0
                              ? '0 2px 6px rgba(124, 58, 237, 0.2)'
                              : isKidsTheme
                                ? '0 2px 8px rgba(180,160,220,0.2)'
                                : '0 1px 2px rgba(0,0,0,0.05)',
                        borderRadius: isKidsTheme ? '14px' : undefined,
                      }}
                      className="calendar-day-cell transition-transform duration-150 hover:scale-105 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/60"
                    >
                      <span>{cell.day}</span>
                      {isKidsTheme && kidsEmoji ? (
                        <span style={{ fontSize: '3.2cqmin', lineHeight: 1 }} aria-hidden>
                          {kidsEmoji}
                        </span>
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
                    </button>
                  );
                })}
              </div>
            </div>
          </motion.div>

          {isKidsTheme ? (
            <button
              type="button"
              onClick={openEventModal}
              className="w-full transition-transform duration-200 hover:-translate-y-0.5 hover:shadow-[0_6px_20px_rgba(124,58,237,0.45)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/60"
              style={{
                padding: '2.8cqmin 3cqmin',
                borderRadius: '999px',
                background: 'linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%)',
                color: '#fff',
                fontWeight: 700,
                fontSize: '4.2cqmin',
                border: 'none',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '1.5cqmin',
                boxShadow: '0 4px 16px rgba(124,58,237,0.35)',
              }}
            >
              <Plus className="calendar-add-btn-icon" />
              {t.event_add_title}
            </button>
          ) : (
            <button
              type="button"
              onClick={openEventModal}
              className="calendar-add-btn transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_6px_20px_rgba(124,58,237,0.4)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/60"
            >
              <Plus className="calendar-add-btn-icon" />
              {t.event_add_title}
            </button>
          )}
        </div>
      </section>
      </div>

          <AnimatePresence mode="wait">
            {selectedDate && (
              <motion.div
                key={selectedDate.getTime()}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.25 }}
                className="calendar-detail-panel"
              >
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
                    {eventsOnSelectedDate.map((e, i) => (
                      <motion.div
                        key={e.id}
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.05, duration: 0.2 }}
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
                      </motion.div>
                    ))}
                  </div>
                ) : (
                  <div className="calendar-detail-empty">
                    <Calendar className="calendar-detail-empty-icon" />
                    <p className="calendar-detail-empty-text">{t.event_no_events}</p>
                    <p className="calendar-detail-empty-hint">{t.event_add_hint}</p>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
      </div>
    </>
  );
});
