/**
 * 가족 일정(Family Calendar) 섹션 컴포넌트
 */

'use client';

import React, { useState, useMemo, useCallback } from 'react';
import { Calendar, ChevronLeft, ChevronRight, CalendarDays, Plus, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import type { FamilyEvent } from '../types';
import { useFamilyCalendar } from '../hooks/useFamilyCalendar';
import type { LangCode } from '@/lib/language-fonts';
import { intlLocaleForLang } from '@/lib/language-fonts';

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
  };
}

export function FamilyCalendarSection({
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

  const [calendarMonth, setCalendarMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [showEventModal, setShowEventModal] = useState(false);
  const [eventFormDate, setEventFormDate] = useState<Date | null>(null);
  const [eventForm, setEventForm] = useState<{ title: string; month: string; day: string; desc: string; repeat_type: 'none' | 'monthly' | 'yearly' }>({
    title: '',
    month: '',
    day: '',
    desc: '',
    repeat_type: 'none',
  });

  const { addEvent, deleteEvent } = useFamilyCalendar({
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
      const monthName = new Date(2000, parseInt(mm, 10) - 1, 1).toLocaleDateString('en-US', { month: 'short' }).toUpperCase();
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
    setEventFormDate(d);
    const month = d.toLocaleDateString('en-US', { month: 'short' }).toUpperCase();
    const day = d.getDate().toString();
    setEventForm({ title: '', month, day, desc: '', repeat_type: 'none' });
    setShowEventModal(true);
  };

  const closeEventModal = () => {
    setShowEventModal(false);
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

  return (
    <>
      {/* Event Modal */}
      {showEventModal && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}
          onClick={closeEventModal}
        >
          <div
            style={{
              backgroundColor: 'white',
              borderRadius: '12px',
              padding: '24px',
              width: '90%',
              maxWidth: '500px',
              boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ marginTop: 0, marginBottom: '8px', fontSize: '20px', fontWeight: '600' }}>{t.event_add_title}</h3>
            {eventFormDate && (
              <p style={{ margin: '0 0 20px 0', fontSize: '14px', color: '#64748b' }}>
                {formatLongDate(eventFormDate)}
              </p>
            )}

            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: '500' }}>{t.event_title_label}</label>
              <input
                type="text"
                value={eventForm.title}
                onChange={(e) => setEventForm({ ...eventForm, title: e.target.value })}
                placeholder={t.event_title_placeholder}
                style={{
                  width: '100%',
                  padding: '12px',
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                  fontSize: '15px',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: '500' }}>{t.event_desc_label}</label>
              <textarea
                value={eventForm.desc}
                onChange={(e) => setEventForm({ ...eventForm, desc: e.target.value })}
                placeholder={t.event_desc_placeholder}
                rows={3}
                style={{
                  width: '100%',
                  padding: '12px',
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                  fontSize: '15px',
                  boxSizing: 'border-box',
                  resize: 'vertical',
                  fontFamily: 'inherit',
                }}
              />
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: '500' }}>{t.event_repeat_label}</label>
              <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '14px' }}>
                  <input
                    type="radio"
                    name="repeat_type"
                    checked={eventForm.repeat_type === 'none'}
                    onChange={() => setEventForm({ ...eventForm, repeat_type: 'none' })}
                  />
                  {t.event_repeat_none}
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '14px' }}>
                  <input
                    type="radio"
                    name="repeat_type"
                    checked={eventForm.repeat_type === 'monthly'}
                    onChange={() => setEventForm({ ...eventForm, repeat_type: 'monthly' })}
                  />
                  {t.event_repeat_monthly}
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '14px' }}>
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

            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button
                onClick={closeEventModal}
                style={{
                  padding: '10px 20px',
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                  backgroundColor: 'white',
                  color: '#64748b',
                  fontSize: '15px',
                  cursor: 'pointer',
                  fontWeight: '500',
                }}
              >
                {t.cancel}
              </button>
              <button
                onClick={handleEventSubmit}
                style={{
                  padding: '10px 20px',
                  border: 'none',
                  borderRadius: '8px',
                  backgroundColor: '#667eea',
                  color: 'white',
                  fontSize: '15px',
                  cursor: 'pointer',
                  fontWeight: '500',
                }}
              >
                {t.event_submit_btn}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Calendar Section */}
      <section
        className="content-section"
        style={{
          background: 'linear-gradient(135deg, #faf5ff 0%, #f8fafc 50%, #f0f9ff 100%)',
          borderRadius: '16px',
          padding: '14px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
        }}
      >
        <div className="section-header" style={{ marginBottom: '10px' }}>
          <h3 className="section-title" style={{ display: 'flex', alignItems: 'center', gap: '10px', margin: 0 }}>
            <Calendar style={{ width: '24px', height: '24px', color: '#7c3aed' }} />
            {t.section_title_calendar}
          </h3>
        </div>
        <div className="section-body">
          <motion.div
            key={`${calendarGrid.year}-${calendarGrid.month}`}
            initial={{ opacity: 0.7 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.2 }}
            style={{ marginBottom: '10px' }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '10px',
                flexWrap: 'wrap',
                gap: '8px',
              }}
            >
              <h4 style={{ margin: 0, fontSize: '18px', fontWeight: '700', color: '#1e293b' }}>
                {formatMonthYear(calendarGrid.year, calendarGrid.month)}
              </h4>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  type="button"
                  onClick={() => setCalendarMonth(new Date(calendarGrid.year, calendarGrid.month - 1, 1))}
                  style={{
                    padding: '8px 14px',
                    border: '1px solid #e2e8f0',
                    borderRadius: '10px',
                    background: '#fff',
                    cursor: 'pointer',
                    fontSize: '14px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                    transition: 'all 0.2s ease',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = '#f5f3ff';
                    e.currentTarget.style.boxShadow = '0 4px 12px rgba(124, 58, 237, 0.2)';
                    e.currentTarget.style.borderColor = '#c4b5fd';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = '#fff';
                    e.currentTarget.style.boxShadow = '0 1px 2px rgba(0,0,0,0.05)';
                    e.currentTarget.style.borderColor = '#e2e8f0';
                  }}
                >
                  <ChevronLeft style={{ width: '18px', height: '18px' }} />
                  {t.calendar_prev_month}
                </button>
                <button
                  type="button"
                  onClick={() => setCalendarMonth(new Date(calendarGrid.year, calendarGrid.month + 1, 1))}
                  style={{
                    padding: '8px 14px',
                    border: '1px solid #e2e8f0',
                    borderRadius: '10px',
                    background: '#fff',
                    cursor: 'pointer',
                    fontSize: '14px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                    transition: 'all 0.2s ease',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = '#f5f3ff';
                    e.currentTarget.style.boxShadow = '0 4px 12px rgba(124, 58, 237, 0.2)';
                    e.currentTarget.style.borderColor = '#c4b5fd';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = '#fff';
                    e.currentTarget.style.boxShadow = '0 1px 2px rgba(0,0,0,0.05)';
                    e.currentTarget.style.borderColor = '#e2e8f0';
                  }}
                >
                  {t.calendar_next_month}
                  <ChevronRight style={{ width: '18px', height: '18px' }} />
                </button>
              </div>
            </div>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(7, 1fr)',
                gridAutoRows: '42px',
                gap: '4px',
                textAlign: 'center',
                fontSize: '12px',
              }}
            >
              {weekDays.map((day, i) => (
                <div
                  key={i}
                  style={{
                    padding: '6px 2px',
                    minHeight: '34px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: '700',
                    color: i === 0 ? '#dc2626' : i === 6 ? '#2563eb' : '#64748b',
                    backgroundColor: i === 0 || i === 6 ? 'rgba(0,0,0,0.03)' : 'transparent',
                    borderRadius: '6px',
                    fontSize: '13px',
                  }}
                >
                  {day}
                </div>
              ))}
              {calendarGrid.cells.map((cell, i) => {
                if (cell.type === 'empty') {
                  return <div key={`empty-${i}`} />;
                }

                const isSelected = selectedDate && selectedDate.getTime() === cell.date.getTime();

                return (
                  <motion.button
                    key={cell.day}
                    type="button"
                    onClick={() => setSelectedDate(cell.date)}
                    initial={false}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    style={{
                      padding: '6px 2px',
                      minHeight: '34px',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      border: 'none',
                      borderRadius: '8px',
                      background: isSelected
                        ? 'linear-gradient(135deg, #7c3aed 0%, #5b21b6 100%)'
                        : cell.isToday
                          ? 'linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%)'
                          : cell.eventCount > 0
                            ? 'linear-gradient(135deg, #e0e7ff 0%, #ddd6fe 100%)'
                            : '#fff',
                      color: isSelected || cell.isToday ? '#fff' : cell.eventCount > 0 ? '#7c3aed' : '#1e293b',
                      fontWeight: cell.isToday || isSelected || cell.eventCount > 0 ? '700' : '500',
                      cursor: 'pointer',
                      boxShadow: isSelected
                        ? '0 4px 12px rgba(124, 58, 237, 0.4), inset 0 -2px 4px rgba(0,0,0,0.15)'
                        : cell.isToday
                          ? '0 4px 12px rgba(245, 158, 11, 0.4), inset 0 -2px 4px rgba(0,0,0,0.15)'
                          : cell.eventCount > 0
                            ? '0 2px 6px rgba(124, 58, 237, 0.2)'
                            : '0 1px 2px rgba(0,0,0,0.05)',
                      transition: 'all 0.15s ease',
                      position: 'relative',
                      fontSize: '14px',
                    }}
                  >
                    <span>{cell.day}</span>
                    {cell.eventCount > 0 && (
                      <span
                        style={{
                          fontSize: '9px',
                          fontWeight: '700',
                          marginTop: '1px',
                          color: isSelected || cell.isToday ? 'rgba(255,255,255,0.9)' : '#7c3aed',
                        }}
                      >
                        {cell.eventCount}개
                      </span>
                    )}
                  </motion.button>
                );
              })}
            </div>
          </motion.div>

          <AnimatePresence mode="wait">
            {selectedDate && (
              <motion.div
                key={selectedDate.getTime()}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.25 }}
                style={{
                  marginTop: '14px',
                  padding: '14px',
                  border: '1px solid #e2e8f0',
                  borderRadius: '12px',
                  backgroundColor: 'rgba(255,255,255,0.8)',
                  boxShadow: '0 4px 20px rgba(0,0,0,0.06)',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: '12px',
                    flexWrap: 'wrap',
                    gap: '8px',
                  }}
                >
                  <h4 style={{ margin: 0, fontSize: '15px', fontWeight: '700', color: '#1e293b', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <CalendarDays style={{ width: '20px', height: '20px', color: '#7c3aed' }} />
                    {t.calendar_day_events_title.replace(/\{date\}/g, formatLongDate(selectedDate))}
                  </h4>
                  <button
                    type="button"
                    onClick={() => setSelectedDate(null)}
                    style={{
                      padding: '8px 12px',
                      border: '1px solid #e2e8f0',
                      borderRadius: '10px',
                      background: '#fff',
                      cursor: 'pointer',
                      fontSize: '13px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      transition: 'all 0.2s ease',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = '#f1f5f9';
                      e.currentTarget.style.borderColor = '#cbd5e1';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = '#fff';
                      e.currentTarget.style.borderColor = '#e2e8f0';
                    }}
                  >
                    <X style={{ width: '16px', height: '16px' }} />
                    {t.close}
                  </button>
                </div>
                {eventsOnSelectedDate.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                    {eventsOnSelectedDate.map((e, i) => (
                      <motion.div
                        key={e.id}
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.05, duration: 0.2 }}
                        style={{
                          padding: '14px 14px 14px 18px',
                          background: '#fff',
                          border: '1px solid #e2e8f0',
                          borderRadius: '12px',
                          borderLeft: '4px solid #7c3aed',
                          boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
                          transition: 'all 0.2s ease',
                        }}
                        onMouseEnter={(el) => {
                          el.currentTarget.style.boxShadow = '0 8px 24px rgba(124, 58, 237, 0.12)';
                          el.currentTarget.style.transform = 'translateY(-2px)';
                        }}
                        onMouseLeave={(el) => {
                          el.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.04)';
                          el.currentTarget.style.transform = 'translateY(0)';
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '10px' }}>
                          <div style={{ flex: 1 }}>
                            <h5 style={{ margin: '0 0 8px 0', fontSize: '16px', fontWeight: '600', color: '#1e293b' }}>{e.title}</h5>
                            {(e.repeat_type === 'monthly' || e.repeat_type === 'yearly') && (
                              <p style={{ margin: '0 0 4px 0', fontSize: '12px', color: '#7c3aed' }}>
                                {e.repeat_type === 'monthly' ? t.event_repeat_monthly : t.event_repeat_yearly}
                              </p>
                            )}
                            {e.created_by != null && (
                              <p style={{ margin: '0 0 4px 0', fontSize: '12px', color: '#64748b' }}>
                                {t.event_author}:{' '}
                                {e.created_by === userId ? t.me : eventAuthorNames[e.created_by] ?? t.unknown}
                                {familyRoleByUserId[e.created_by]
                                  ? ` ${getFamilyRoleEmoji(familyRoleByUserId[e.created_by])} ${getFamilyRoleLabel(lang, familyRoleByUserId[e.created_by])}`
                                  : ''}
                              </p>
                            )}
                            {e.desc && (
                              <p style={{ margin: 0, fontSize: '14px', color: '#475569', whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>
                                {e.desc}
                              </p>
                            )}
                            {e.created_at && (
                              <p style={{ margin: '10px 0 0 0', fontSize: '12px', color: '#94a3b8' }}>
                                등록: {new Date(e.created_at).toLocaleString('ko-KR')}
                              </p>
                            )}
                          </div>
                          {e.created_by != null && String(e.created_by).trim() === String(userId).trim() && (
                            <button
                              type="button"
                              onClick={() => handleDeleteEvent(e.id)}
                              style={{
                                flexShrink: 0,
                                padding: '6px',
                                border: 'none',
                                background: 'transparent',
                                cursor: 'pointer',
                                color: '#ef4444',
                                borderRadius: '6px',
                              }}
                              aria-label={t.delete}
                              onMouseEnter={(el) => {
                                el.currentTarget.style.background = '#fef2f2';
                              }}
                              onMouseLeave={(el) => {
                                el.currentTarget.style.background = 'transparent';
                              }}
                            >
                              <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </button>
                          )}
                        </div>
                      </motion.div>
                    ))}
                  </div>
                ) : (
                  <div style={{ textAlign: 'center', padding: '24px 16px' }}>
                    <Calendar style={{ width: '48px', height: '48px', color: '#cbd5e1', margin: '0 auto 12px', display: 'block' }} />
                    <p style={{ margin: 0, fontSize: '14px', color: '#64748b' }}>{t.event_no_events}</p>
                    <p style={{ margin: '8px 0 0 0', fontSize: '13px', color: '#94a3b8' }}>{t.event_add_hint}</p>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          <button
            type="button"
            onClick={openEventModal}
            style={{
              marginTop: '14px',
              width: '100%',
              padding: '12px',
              border: 'none',
              borderRadius: '10px',
              background: 'linear-gradient(135deg, #7c3aed 0%, #5b21b6 100%)',
              color: 'white',
              fontSize: '15px',
              fontWeight: '600',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              boxShadow: '0 4px 12px rgba(124, 58, 237, 0.3)',
              transition: 'all 0.2s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.boxShadow = '0 6px 20px rgba(124, 58, 237, 0.4)';
              e.currentTarget.style.transform = 'translateY(-2px)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.boxShadow = '0 4px 12px rgba(124, 58, 237, 0.3)';
              e.currentTarget.style.transform = 'translateY(0)';
            }}
          >
            <Plus style={{ width: '20px', height: '20px' }} />
            {t.event_add_title}
          </button>
        </div>
      </section>
    </>
  );
}
