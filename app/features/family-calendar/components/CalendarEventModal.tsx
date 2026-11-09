'use client';

import { memo, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { TopLayerDialog } from '@/app/components/TopLayerDialog';
import type { FamilyEvent } from '../types';
import { KIDS_ADD_DECOS } from '../kids-add-decorations';
import { CALENDAR_STICKER_EMOJIS, CALENDAR_STICKER_GROUPS, normalizeCalendarStickerEmoji } from '../calendar-sticker-emoji';
import {
  CALENDAR_REMIND_OFFSET_DAYS,
  normalizeRemindOffsets,
  type CalendarRemindOffsetDays,
} from '../remind-offsets';

const CALENDAR_QUICK_EMOJIS = CALENDAR_STICKER_EMOJIS.slice(0, 7);
const CALENDAR_QUICK_SET = new Set<string>(CALENDAR_QUICK_EMOJIS);

const KidsAddDecorations = memo(function KidsAddDecorations() {
  return (
    <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden" aria-hidden>
      {KIDS_ADD_DECOS.map((item) => (
        <img
          key={item.src}
          src={item.src}
          alt=""
          className={`absolute bg-transparent object-contain ${item.className}`}
        />
      ))}
    </div>
  );
});

function shiftDateStr(dateStr: string, days: number): string {
  const d = new Date(dateStr + 'T12:00:00');
  if (isNaN(d.getTime())) return dateStr;
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function toDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export type CalendarEventSubmitPayload = {
  editingEventId: string | null;
  title: string;
  month: string;
  day: string;
  desc: string;
  event_date: string;
  end_date?: string;
  repeat_type: 'none' | 'monthly' | 'yearly';
  sticker_emoji: string | null;
  remind_offsets: number[];
};

export type CalendarEventModalTranslations = {
  section_title_calendar: string;
  event_add_title: string;
  event_edit_title: string;
  event_title_label: string;
  event_title_placeholder: string;
  event_desc_label: string;
  event_desc_placeholder: string;
  event_emoji_label: string;
  event_emoji_health: string;
  event_emoji_kids: string;
  event_emoji_together: string;
  event_emoji_celebrate: string;
  event_repeat_label: string;
  event_repeat_none: string;
  event_repeat_monthly: string;
  event_repeat_yearly: string;
  event_remind_label: string;
  event_remind_1d: string;
  event_remind_3d: string;
  event_remind_1w: string;
  event_remind_2w: string;
  event_remind_1m: string;
  event_submit_btn: string;
  event_update_btn: string;
  event_start_date: string;
  event_end_date: string;
  event_end_unset: string;
  event_single_date: string;
  event_picker_start: string;
  event_picker_end: string;
  event_picker_year_month: string;
  event_title_required: string;
  event_date_invalid: string;
  event_title_invalid: string;
  calendar_sun: string;
  calendar_mon: string;
  calendar_tue: string;
  calendar_wed: string;
  calendar_thu: string;
  calendar_fri: string;
  calendar_sat: string;
  cancel: string;
};

type CalendarEventModalProps = {
  open: boolean;
  isKidsTheme: boolean;
  initialDate: Date;
  editingEvent: FamilyEvent | null;
  translations: CalendarEventModalTranslations;
  sanitizeInput: (input: string | null | undefined, maxLength?: number) => string;
  onClose: () => void;
  onSubmit: (payload: CalendarEventSubmitPayload) => void;
  /** 채팅 메시지에서 열 때 제목 미리 채우기 */
  prefillTitle?: string;
};

/**
 * 오버레이(TopLayerDialog)는 열림/닫힘만 다시 그린다.
 * 제목·날짜 입력 state는 안쪽 폼에만 둔다. 키 입력마다 포탈 셸이 다시 그려지면
 * Windows Chrome이 뒤 대시보드(cqmin)까지 다시 합성하며 멈춘다.
 */
export const CalendarEventModal = memo(function CalendarEventModal({
  open,
  onClose,
  ...formProps
}: CalendarEventModalProps) {
  if (!open) return null;
  return (
    <TopLayerDialog open onClose={onClose}>
      <CalendarEventForm {...formProps} onClose={onClose} />
    </TopLayerDialog>
  );
});

function CalendarEventForm({
  isKidsTheme,
  initialDate,
  editingEvent,
  prefillTitle,
  translations: t,
  sanitizeInput,
  onClose,
  onSubmit,
}: Omit<CalendarEventModalProps, 'open'>) {
  const startDate = editingEvent?.event_date
    ? new Date(editingEvent.event_date + 'T12:00:00')
    : initialDate;
  const [eventFormDate, setEventFormDate] = useState<Date>(startDate);
  const [datePickerOpen, setDatePickerOpen] = useState<'start' | 'end' | null>(null);
  const [pickerView, setPickerView] = useState({ year: startDate.getFullYear(), month: startDate.getMonth() });
  const [formError, setFormError] = useState<string | null>(null);
  const [stickerEmoji, setStickerEmoji] = useState<string | null>(
    normalizeCalendarStickerEmoji(editingEvent?.sticker_emoji),
  );
  const [remindOffsets, setRemindOffsets] = useState<CalendarRemindOffsetDays[]>(() =>
    normalizeRemindOffsets(editingEvent?.remind_offsets),
  );
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [emojiPanelPos, setEmojiPanelPos] = useState<{ top: number; left: number; maxHeight: number } | null>(null);
  const emojiAnchorRef = useRef<HTMLButtonElement>(null);
  const emojiPanelRef = useRef<HTMLDivElement>(null);
  const [eventForm, setEventForm] = useState({
    title: editingEvent?.title || prefillTitle || '',
    month: editingEvent?.month || startDate.toLocaleDateString('en-US', { month: 'short' }).toUpperCase(),
    day: editingEvent?.day || String(startDate.getDate()),
    desc: editingEvent?.desc || '',
    repeat_type:
      editingEvent?.repeat_type === 'monthly' || editingEvent?.repeat_type === 'yearly'
        ? editingEvent.repeat_type
        : ('none' as const),
    endDateStr: editingEvent?.end_date || toDateStr(startDate),
  });

  const handleSubmit = () => {
    if (!eventForm.title.trim()) {
      setFormError(t.event_title_required);
      return;
    }
    const dayNum = parseInt(eventForm.day, 10);
    if (isNaN(dayNum) || dayNum < 1 || dayNum > 31) {
      setFormError(t.event_date_invalid);
      return;
    }
    const title = sanitizeInput(eventForm.title, 100);
    const month = sanitizeInput(eventForm.month, 10);
    const desc = sanitizeInput(eventForm.desc, 200);
    if (!title) {
      setFormError(t.event_title_invalid);
      return;
    }
    const event_date = toDateStr(eventFormDate);
    const end_date =
      eventForm.endDateStr && eventForm.endDateStr > event_date ? eventForm.endDateStr : undefined;
    onSubmit({
      editingEventId: editingEvent ? String(editingEvent.id) : null,
      title,
      month,
      day: String(dayNum),
      desc,
      event_date,
      end_date,
      repeat_type: eventForm.repeat_type,
      sticker_emoji: stickerEmoji,
      remind_offsets: normalizeRemindOffsets(remindOffsets),
    });
  };

  const toggleRemindOffset = (days: CalendarRemindOffsetDays) => {
    setRemindOffsets((prev) =>
      normalizeRemindOffsets(prev.includes(days) ? prev.filter((d) => d !== days) : [...prev, days]),
    );
  };

  const remindLabels: Record<CalendarRemindOffsetDays, string> = {
    1: t.event_remind_1d,
    3: t.event_remind_3d,
    7: t.event_remind_1w,
    14: t.event_remind_2w,
    30: t.event_remind_1m,
  };

  useEffect(() => {
    if (!emojiOpen) return;
    const onPointer = (event: PointerEvent) => {
      const target = event.target as Node;
      if (emojiAnchorRef.current?.contains(target) || emojiPanelRef.current?.contains(target)) return;
      setEmojiOpen(false);
    };
    const close = () => setEmojiOpen(false);
    const onScroll = (event: Event) => {
      const target = event.target;
      if (target instanceof Node && emojiPanelRef.current?.contains(target)) return;
      close();
    };
    document.addEventListener('pointerdown', onPointer);
    window.addEventListener('resize', close);
    window.addEventListener('scroll', onScroll, true);
    return () => {
      document.removeEventListener('pointerdown', onPointer);
      window.removeEventListener('resize', close);
      window.removeEventListener('scroll', onScroll, true);
    };
  }, [emojiOpen]);

  const toggleEmojiPanel = () => {
    if (emojiOpen) {
      setEmojiOpen(false);
      return;
    }
    const rect = emojiAnchorRef.current?.getBoundingClientRect();
    if (!rect) return;
    const width = 240;
    const margin = 8;
    const left = Math.max(margin, Math.min(rect.left, window.innerWidth - width - margin));
    const spaceBelow = Math.max(0, window.innerHeight - rect.bottom - margin);
    const spaceAbove = Math.max(0, rect.top - margin);
    const maxHeight = Math.min(360, Math.max(96, Math.floor(Math.max(spaceBelow, spaceAbove))));
    let top = spaceBelow >= spaceAbove ? rect.bottom + 4 : rect.top - maxHeight - 4;
    top = Math.max(margin, Math.min(top, window.innerHeight - maxHeight - margin));
    setEmojiPanelPos({ top, left, maxHeight });
    setEmojiOpen(true);
  };

  const startStr = toDateStr(eventFormDate);
  const isRange = !!(eventForm.endDateStr && eventForm.endDateStr > startStr);

  const shiftStart = (days: number) => {
    const nd = new Date(eventFormDate);
    nd.setDate(nd.getDate() + days);
    const ndStr = toDateStr(nd);
    setEventFormDate(nd);
    setEventForm((prev) => ({
      ...prev,
      month: nd.toLocaleDateString('en-US', { month: 'short' }).toUpperCase(),
      day: String(nd.getDate()),
      endDateStr: prev.endDateStr && prev.endDateStr >= ndStr ? prev.endDateStr : ndStr,
    }));
  };

  const shiftEnd = (days: number) => {
    const next = shiftDateStr(eventForm.endDateStr || startStr, days);
    if (next >= startStr) setEventForm((prev) => ({ ...prev, endDateStr: next }));
  };

  const openPicker = (which: 'start' | 'end') => {
    const refStr = which === 'start' ? startStr : eventForm.endDateStr || startStr;
    if (refStr) {
      const d = new Date(refStr + 'T12:00:00');
      setPickerView({ year: d.getFullYear(), month: d.getMonth() });
    }
    setDatePickerOpen((prev) => (prev === which ? null : which));
  };

  const fieldCls = `flex items-center gap-0.5 ${isKidsTheme ? 'rounded-2xl bg-white px-2 py-1.5 shadow-sm' : 'rounded-lg border border-slate-200 px-2 py-1.5'}`;
  const btnCls = `flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-sm font-bold transition-colors focus-visible:outline-none ${isKidsTheme ? 'text-violet-600 hover:bg-violet-100' : 'text-slate-500 hover:bg-slate-100 border border-slate-200'}`;
  const labelCls = `mb-1 text-xs font-bold ${isKidsTheme ? 'text-violet-600' : 'text-slate-500'}`;
  const { year: pY, month: pM } = pickerView;
  const firstDow = new Date(pY, pM, 1).getDay();
  const daysInMo = new Date(pY, pM + 1, 0).getDate();
  const todayStr = toDateStr(new Date());
  const navBtnCls = `flex h-5 w-5 items-center justify-center rounded-full text-sm font-bold transition-colors ${isKidsTheme ? 'text-violet-600 hover:bg-violet-100' : 'text-slate-500 hover:bg-slate-100'}`;

  return (
      <div
        className={`relative w-[min(92vw,480px)] rounded-[28px] shadow-[0_20px_60px_rgba(0,0,0,0.3)] ${
          isKidsTheme ? 'overflow-hidden px-11 pb-16 pt-16' : 'p-6'
        }`}
        style={
          isKidsTheme
            ? {
                background: 'linear-gradient(160deg, #ede9fe 0%, #e0e7ff 40%, #fce7f3 80%, #fed7aa 100%)',
                border: '1.5px solid rgba(255,255,255,0.7)',
              }
            : { background: '#fff', borderRadius: '12px' }
        }
      >
        {isKidsTheme ? <KidsAddDecorations /> : null}
        <div className={isKidsTheme ? 'relative z-10' : undefined}>
        {isKidsTheme && (
          <p className="mb-0 mt-0 text-center text-xs font-bold uppercase tracking-widest text-violet-400">
            {t.section_title_calendar}
          </p>
        )}
        <h3
          className={`mt-1 text-center font-bold ${
            isKidsTheme ? 'mb-3 text-3xl text-violet-700' : 'mb-3 mt-0 text-xl font-semibold text-slate-800'
          }`}
        >
          {editingEvent ? t.event_edit_title : t.event_add_title}
        </h3>

        <div className="relative mb-4">
          <div className="flex gap-3">
            <div className="min-w-0 flex-1">
              <p className={labelCls}>{t.event_start_date}</p>
              <div className={fieldCls}>
                <button type="button" onClick={() => shiftStart(-1)} className={btnCls}>
                  −
                </button>
                <button
                  type="button"
                  onClick={() => openPicker('start')}
                  className={`flex-1 truncate text-center text-[13px] font-semibold tabular-nums transition-colors hover:text-violet-500 focus-visible:outline-none ${
                    datePickerOpen === 'start' ? 'text-violet-500' : isKidsTheme ? 'text-violet-700' : 'text-slate-700'
                  }`}
                >
                  {startStr}
                </button>
                <button type="button" onClick={() => shiftStart(1)} className={btnCls}>
                  +
                </button>
              </div>
            </div>
            <div className="min-w-0 flex-1">
              <p className={labelCls}>
                {t.event_end_date}
                {!isRange && <span className="ml-1 font-normal text-slate-400">{t.event_end_unset}</span>}
              </p>
              <div className={fieldCls}>
                <button type="button" onClick={() => shiftEnd(-1)} className={btnCls}>
                  −
                </button>
                <button
                  type="button"
                  onClick={() => openPicker('end')}
                  className={`flex-1 truncate text-center text-[13px] font-semibold tabular-nums transition-colors hover:text-violet-500 focus-visible:outline-none ${
                    datePickerOpen === 'end'
                      ? 'text-violet-500'
                      : isRange
                        ? isKidsTheme
                          ? 'text-violet-700'
                          : 'text-slate-700'
                        : 'text-slate-400'
                  }`}
                >
                  {eventForm.endDateStr || startStr}
                </button>
                <button type="button" onClick={() => shiftEnd(1)} className={btnCls}>
                  +
                </button>
              </div>
              {isRange && (
                <button
                  type="button"
                  onClick={() => setEventForm((prev) => ({ ...prev, endDateStr: '' }))}
                  className="mt-0.5 text-[11px] text-slate-400 transition-colors hover:text-red-400"
                >
                  {t.event_single_date}
                </button>
              )}
            </div>
          </div>

          {datePickerOpen ? (
            <div
              className={`absolute left-1/2 top-full z-20 mt-1 w-[236px] -translate-x-1/2 rounded-xl p-2 shadow-2xl ${
                isKidsTheme
                  ? 'border border-violet-100 bg-gradient-to-br from-violet-50 to-fuchsia-50'
                  : 'border border-slate-200 bg-white'
              }`}
            >
              <div className="mb-1 flex items-center justify-between px-0.5">
                <button
                  type="button"
                  className={navBtnCls}
                  onClick={() => {
                    const d = new Date(pY, pM - 1);
                    setPickerView({ year: d.getFullYear(), month: d.getMonth() });
                  }}
                >
                  ‹
                </button>
                <span className={`text-xs font-bold ${isKidsTheme ? 'text-violet-700' : 'text-slate-700'}`}>
                  {t.event_picker_year_month.replace('{year}', String(pY)).replace('{month}', String(pM + 1))}
                  <span className={`ml-1.5 text-[10px] font-normal ${isKidsTheme ? 'text-violet-400' : 'text-slate-400'}`}>
                    {datePickerOpen === 'start' ? t.event_picker_start : t.event_picker_end}
                  </span>
                </span>
                <button
                  type="button"
                  className={navBtnCls}
                  onClick={() => {
                    const d = new Date(pY, pM + 1);
                    setPickerView({ year: d.getFullYear(), month: d.getMonth() });
                  }}
                >
                  ›
                </button>
              </div>
              <div className="grid grid-cols-7">
                {[t.calendar_sun, t.calendar_mon, t.calendar_tue, t.calendar_wed, t.calendar_thu, t.calendar_fri, t.calendar_sat].map((w) => (
                  <div
                    key={w}
                    className={`text-center text-[10px] font-semibold ${isKidsTheme ? 'text-violet-400' : 'text-slate-400'}`}
                  >
                    {w}
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-7">
                {Array.from({ length: firstDow }, (_, i) => (
                  <div key={`b${i}`} />
                ))}
                {Array.from({ length: daysInMo }, (_, i) => {
                  const d = i + 1;
                  const ds = `${pY}-${String(pM + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
                  const isSel =
                    (datePickerOpen === 'start' && ds === startStr) ||
                    (datePickerOpen === 'end' && ds === (eventForm.endDateStr || startStr));
                  const inRange = isRange && ds > startStr && ds < eventForm.endDateStr;
                  const isToday = ds === todayStr;
                  const isPast = datePickerOpen === 'end' && ds < startStr;
                  return (
                    <button
                      key={d}
                      type="button"
                      disabled={isPast}
                      onClick={() => {
                        if (datePickerOpen === 'start') {
                          const nd = new Date(ds + 'T12:00:00');
                          setEventFormDate(nd);
                          setEventForm((prev) => ({
                            ...prev,
                            month: nd.toLocaleDateString('en-US', { month: 'short' }).toUpperCase(),
                            day: String(nd.getDate()),
                            endDateStr: prev.endDateStr && prev.endDateStr >= ds ? prev.endDateStr : ds,
                          }));
                        } else {
                          setEventForm((prev) => ({ ...prev, endDateStr: ds }));
                        }
                        setDatePickerOpen(null);
                      }}
                      className={`mx-auto flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-semibold transition-colors focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-25 ${
                        isSel
                          ? 'bg-violet-600 text-white shadow-sm'
                          : inRange
                            ? isKidsTheme
                              ? 'bg-violet-100 text-violet-700'
                              : 'bg-violet-50 text-violet-600'
                            : isToday
                              ? 'ring-1 ring-violet-400 text-violet-700'
                              : isKidsTheme
                                ? 'text-slate-700 hover:bg-violet-100'
                                : 'text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      {d}
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}
        </div>

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
              isKidsTheme ? 'rounded-2xl border-none bg-white shadow-sm' : 'rounded-lg border border-slate-200'
            }`}
          />
        </div>

        <div className="mb-4">
          <p className={`mb-2 text-sm font-bold ${isKidsTheme ? 'text-slate-700' : 'font-medium text-slate-700'}`}>
            {t.event_emoji_label}
          </p>
          <div className="flex flex-wrap items-center gap-1">
            {CALENDAR_QUICK_EMOJIS.map((emoji) => (
              <button
                key={emoji}
                type="button"
                onClick={() => setStickerEmoji((prev) => (prev === emoji ? null : emoji))}
                className={[
                  'shrink-0 cursor-pointer rounded-full border px-1.5 py-0.5 text-sm',
                  stickerEmoji === emoji
                    ? 'border-violet-400 bg-violet-100'
                    : isKidsTheme
                      ? 'border-white bg-white shadow-sm'
                      : 'border-slate-200 bg-white',
                ].join(' ')}
              >
                {emoji}
              </button>
            ))}
            {stickerEmoji && !CALENDAR_QUICK_SET.has(stickerEmoji) ? (
              <button
                type="button"
                onClick={() => setStickerEmoji(null)}
                className="shrink-0 cursor-pointer rounded-full border border-violet-400 bg-violet-100 px-1.5 py-0.5 text-sm"
              >
                {stickerEmoji}
              </button>
            ) : null}
            <button
              ref={emojiAnchorRef}
              type="button"
              aria-label={t.event_emoji_label}
              aria-expanded={emojiOpen}
              onClick={toggleEmojiPanel}
              className={`shrink-0 cursor-pointer rounded-full border px-1.5 py-0.5 text-sm ${
                isKidsTheme
                  ? 'border-white bg-white text-slate-600 shadow-sm'
                  : 'border-slate-200 bg-white text-slate-600'
              }`}
            >
              +
            </button>
          </div>
          {/* 모달 overflow에 잘리지 않도록 버튼 좌표로 띄운다 */}
          {emojiOpen && emojiPanelPos && typeof document !== 'undefined'
            ? createPortal(
            <div
              ref={emojiPanelRef}
              style={{ top: emojiPanelPos.top, left: emojiPanelPos.left, maxHeight: emojiPanelPos.maxHeight }}
              className="fixed z-[10060] w-60 touch-pan-y overflow-x-hidden overflow-y-auto overscroll-y-contain rounded-xl border border-slate-200 bg-white p-2 shadow-lg"
            >
              {CALENDAR_STICKER_GROUPS.map((group) => {
                const emojis = group.emojis.filter((emoji) => !CALENDAR_QUICK_SET.has(emoji));
                if (emojis.length === 0) return null;
                return (
                <div
                  key={group.id}
                  className="mt-1.5 border-t border-slate-100 pt-1.5 first:mt-0 first:border-t-0 first:pt-0"
                >
                  <p className="mb-1 text-[11px] font-medium text-slate-500">
                    {group.id === 'health'
                      ? t.event_emoji_health
                      : group.id === 'kids'
                        ? t.event_emoji_kids
                        : group.id === 'together'
                          ? t.event_emoji_together
                          : t.event_emoji_celebrate}
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {emojis.map((emoji) => (
                      <button
                        key={emoji}
                        type="button"
                        onClick={() => {
                          setStickerEmoji((prev) => (prev === emoji ? null : emoji));
                          setEmojiOpen(false);
                        }}
                        className={[
                          'cursor-pointer rounded-full border px-2 py-0.5 text-sm',
                          stickerEmoji === emoji
                            ? 'border-violet-400 bg-violet-100'
                            : 'border-slate-200 bg-white',
                        ].join(' ')}
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                </div>
                );
              })}
            </div>,
            document.body,
          ) : null}
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
              isKidsTheme ? 'rounded-2xl border-none bg-white shadow-sm' : 'rounded-lg border border-slate-200'
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

        <div className="mb-5">
          <label className={`mb-2 block text-sm font-bold ${isKidsTheme ? 'text-slate-700' : 'font-medium text-slate-700'}`}>
            {t.event_remind_label}
          </label>
          <div className="flex flex-wrap gap-3">
            {CALENDAR_REMIND_OFFSET_DAYS.map((days) => (
              <label key={days} className="flex cursor-pointer items-center gap-1.5 text-sm">
                <input
                  type="checkbox"
                  checked={remindOffsets.includes(days)}
                  onChange={() => toggleRemindOffset(days)}
                />
                {remindLabels[days]}
              </label>
            ))}
          </div>
        </div>

        {formError ? <p className="mb-3 text-center text-sm font-medium text-red-600">{formError}</p> : null}

        <div className={`flex gap-3 ${isKidsTheme ? 'justify-center' : 'justify-end'}`}>
          <button
            type="button"
            onClick={onClose}
            className={`cursor-pointer font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400/60 ${
              isKidsTheme
                ? 'rounded-2xl border-none bg-white px-7 py-3 text-[15px] text-slate-500 shadow-sm hover:bg-white'
                : 'rounded-lg border border-slate-200 bg-white px-5 py-2.5 text-[15px] text-slate-500 hover:bg-slate-50'
            }`}
          >
            {t.cancel}
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            className={`cursor-pointer font-bold text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/60 ${
              isKidsTheme
                ? 'rounded-2xl border-none px-7 py-3 text-[15px]'
                : 'rounded-lg border-none px-5 py-2.5 text-[15px] font-medium'
            }`}
            style={
              isKidsTheme
                ? {
                    background: 'linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%)',
                    boxShadow: '0 4px 14px rgba(124,58,237,0.4)',
                  }
                : { background: '#6366f1' }
            }
          >
            {editingEvent ? t.event_update_btn : t.event_submit_btn}
          </button>
        </div>
        </div>
      </div>
  );
}
