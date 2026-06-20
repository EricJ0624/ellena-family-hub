'use client';

/**
 * 위젯 미리보기 컴포넌트
 * 실제 위젯의 CSS 클래스·구조를 재사용해 외관을 충실히 재현.
 * 데이터/기능 없이 정적 마크업만 사용.
 */

import { Camera, Paperclip } from 'lucide-react';
import React, { useMemo } from 'react';
import type { DashboardWidgetKey } from '@/lib/widgets/types';
import { useLanguage } from '@/app/contexts/LanguageContext';
import { getDashboardTranslation } from '@/lib/translations/dashboard';
import { getTravelTranslation } from '@/lib/translations/travel';
import { getGamesTranslation } from '@/lib/translations/games';
import { getTravelDiaryTranslation } from '@/lib/translations/travel-diary';
import { getPiggyTranslation } from '@/lib/translations/piggy';
import { getGroupAdminTranslation } from '@/lib/translations/groupAdmin';
import { getWidgetPreviewTranslation } from '@/lib/translations/widgetPreview';
import { getFamilyRoleLabel } from '@/lib/translations/memberManagement';
import { getCommonTranslation } from '@/lib/translations/common';
import { intlLocaleForLang } from '@/lib/language-fonts';

function useWidgetPreviewCopy() {
  const { lang } = useLanguage();
  const dateLocale = intlLocaleForLang(lang);

  return useMemo(
    () => ({
      lang,
      dateLocale,
      dt: (key: Parameters<typeof getDashboardTranslation>[1]) => getDashboardTranslation(lang, key),
      tt: (key: Parameters<typeof getTravelTranslation>[1]) => getTravelTranslation(lang, key),
      gt: (key: Parameters<typeof getGamesTranslation>[1]) => getGamesTranslation(lang, key),
      tdy: (key: Parameters<typeof getTravelDiaryTranslation>[1]) => getTravelDiaryTranslation(lang, key),
      pt: (key: Parameters<typeof getPiggyTranslation>[1]) => getPiggyTranslation(lang, key),
      gat: (key: Parameters<typeof getGroupAdminTranslation>[1]) => getGroupAdminTranslation(lang, key),
      wp: (key: Parameters<typeof getWidgetPreviewTranslation>[1]) => getWidgetPreviewTranslation(lang, key),
      ct: (key: Parameters<typeof getCommonTranslation>[1]) => getCommonTranslation(lang, key),
      familyRole: (role: 'mom' | 'dad' | 'daughter') => getFamilyRoleLabel(lang, role),
    }),
    [lang, dateLocale],
  );
}

// ── Tasks (칠판 스타일) ──────────────────────────────────────────
function TasksPreview() {
  const { dt, wp } = useWidgetPreviewCopy();
  const items = [
    { text: wp('preview_task_1'), done: false, assignee: '👩' },
    { text: wp('preview_task_2'), done: true, assignee: '👨' },
    { text: wp('preview_task_3'), done: false, assignee: '👧' },
    { text: wp('preview_task_4'), done: false, assignee: null },
  ];
  return (
    <div className="chalkboard-frame flex w-full flex-col">
      <section className="chalkboard-container flex flex-col">
        <div className="chalkboard-top-bar">
          <h3 className="chalkboard-title">{dt('todo_section_title')}</h3>
        </div>
        <div className="section-body">
          <div className="todo-list">
            {items.map((item, i) => (
              <div key={i} className="todo-item">
                <div className="todo-content">
                  <div className={`todo-checkbox${item.done ? ' todo-checkbox-checked' : ''}`}>
                    {item.done && (
                      <svg className="todo-checkmark" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </div>
                  <div className="todo-text-wrapper">
                    <span className={`todo-text${item.done ? ' todo-text-done' : ''}`}>{item.text}</span>
                    {item.assignee && <span className="todo-assignee">{item.assignee}</span>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}

// ── Calendar (보라색 그라디언트) ────────────────────────────────
function CalendarPreview() {
  const { dt, dateLocale } = useWidgetPreviewCopy();
  const days = [
    dt('calendar_weekday_0'),
    dt('calendar_weekday_1'),
    dt('calendar_weekday_2'),
    dt('calendar_weekday_3'),
    dt('calendar_weekday_4'),
    dt('calendar_weekday_5'),
    dt('calendar_weekday_6'),
  ];
  const monthLabel = new Date(2026, 4, 1).toLocaleDateString(dateLocale, { year: 'numeric', month: 'long' });
  const cells = [
    '', '', '', '', 1, 2, 3,
    4, 5, 6, 7, 8, 9, 10,
    11, 12, 13, 14, 15, 16, 17,
    18, 19, 20, 21, 22, 23, 24,
    25, 26, 27, 28, 29, 30, 31,
  ] as (number | '')[];

  return (
    <section className="content-section bg-gradient-to-br from-purple-50 via-slate-50 to-sky-50 h-full">
      <div className="section-header mb-2.5">
        <h3 className="section-title m-0 flex items-center gap-2">
          <span className="text-violet-600">📅</span>
          {dt('section_title_calendar')}
        </h3>
      </div>
      <div className="section-body">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-base font-bold text-slate-800">{monthLabel}</span>
          <div className="flex gap-1">
            <div className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs text-slate-500">
              ◀ {dt('calendar_prev_month')}
            </div>
            <div className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs text-slate-500">
              {dt('calendar_next_month')} ▶
            </div>
          </div>
        </div>
        <div className="grid grid-cols-7 gap-0.5 text-center text-xs">
          {days.map((d, i) => (
            <div
              key={i}
              className={`py-1 text-[11px] font-bold ${
                i === 0 ? 'text-red-500' : i === 6 ? 'text-blue-500' : 'text-slate-500'
              }`}
            >
              {d}
            </div>
          ))}
          {cells.map((cell, i) => (
            <div
              key={i}
              className={`flex h-7 items-center justify-center rounded-md text-[12px] font-medium ${
                cell === 26
                  ? 'bg-violet-600 font-bold text-white'
                  : cell === 15
                    ? 'bg-amber-400 font-bold text-white'
                    : cell === 8 || cell === 22
                      ? 'bg-violet-100 font-bold text-violet-700'
                      : cell !== ''
                        ? 'text-slate-700'
                        : ''
              }`}
            >
              {cell}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ── Chat (메시지 스타일) ────────────────────────────────────────
function ChatPreview() {
  const { dt, ct, familyRole, wp } = useWidgetPreviewCopy();
  const messages = [
    { user: `👩 ${familyRole('mom')}`, time: '10:30', text: wp('preview_chat_1'), mine: false },
    { user: ct('me'), time: '10:32', text: wp('preview_chat_2'), mine: true },
    { user: `👨 ${familyRole('dad')}`, time: '10:35', text: wp('preview_chat_3'), mine: false },
    { user: ct('me'), time: '10:36', text: '👍', mine: true },
  ];
  return (
    <section className="content-section h-full">
      <div className="section-header">
        <h3 className="section-title">{dt('section_title_chat')}</h3>
      </div>
      <div className="section-body">
        <div className="chat-messages">
          {messages.map((m, i) => (
            <div key={i} className="message-item">
              <div className="message-header">
                <span className="message-user">{m.user}</span>
                <span className="message-time">{m.time}</span>
              </div>
              <div className="message-bubble">
                <p className="message-text">{m.text}</p>
              </div>
            </div>
          ))}
        </div>
        <div className="chat-input-wrapper" style={{ gap: '1.5cqmin' }}>
          <input
            type="text"
            readOnly
            tabIndex={-1}
            className="chat-input min-w-0 flex-1"
            placeholder={dt('chat_placeholder')}
            aria-hidden
          />
          <div className="chat-attach-wrap">
            <button type="button" tabIndex={-1} className="chat-attach-btn" aria-hidden>
              <Camera className="chat-attach-icon" aria-hidden />
              <Paperclip className="chat-attach-icon" aria-hidden />
            </button>
          </div>
          <button type="button" tabIndex={-1} className="btn-send" aria-hidden>
            {dt('chat_send')}
          </button>
        </div>
      </div>
    </section>
  );
}

// ── Location (지도 스타일) ──────────────────────────────────────
function LocationPreview() {
  const { dt, gat, familyRole, wp } = useWidgetPreviewCopy();
  const members = [
    { emoji: '👩', name: familyRole('mom'), location: 'Seoul' },
    { emoji: '👨', name: familyRole('dad'), location: 'Seoul' },
    { emoji: '👧', name: familyRole('daughter'), location: wp('preview_location_school') },
  ];
  return (
    <section className="content-section location-widget-section h-full min-h-0">
      <div className="section-header shrink-0">
        <h3 className="section-title flex items-center gap-2">
          <span>📍</span>
          {dt('section_title_location')}
        </h3>
        <div className="rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-medium text-white">
          📍 {dt('location_where_btn')}
        </div>
      </div>
      <div className="section-body location-section-body min-h-0">
        <div className="location-map-slot mb-3 flex min-h-0 flex-1 flex-col">
        <div className="location-map-surface flex min-h-0 flex-1 flex-col items-center justify-center rounded-xl border border-slate-200 bg-slate-50 p-4">
          <div className="mb-2 grid grid-cols-3 gap-2 w-full">
            {[...Array(9)].map((_, i) => (
              <div key={i} className={`h-8 rounded ${i % 3 === 0 ? 'bg-green-100' : i % 3 === 1 ? 'bg-slate-100' : 'bg-blue-50'}`} />
            ))}
          </div>
          <span className="text-xs text-slate-400">🗺️ {gat('widgets_preview_map_area')}</span>
        </div>
        </div>
        <div className="location-requests-panel grid shrink-0 gap-1.5 overflow-hidden">
          {members.map((m, i) => (
            <div key={i} className="glass-panel-soft flex items-center gap-2 rounded-lg px-3 py-2">
              <span className="text-base">{m.emoji}</span>
              <div className="min-w-0 flex-1">
                <div className="text-xs font-semibold text-slate-700">{m.name}</div>
                <div className="truncate text-[11px] text-slate-500">{m.location}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ── Album (사진첩 스타일) ──────────────────────────────────────
const PHOTO_COLORS = [
  'bg-rose-200', 'bg-sky-200', 'bg-amber-200',
  'bg-emerald-200', 'bg-violet-200', 'bg-orange-200',
];
function AlbumPreview() {
  const { dt } = useWidgetPreviewCopy();
  return (
    <section className="content-section h-full">
      <div className="section-header">
        <h3 className="section-title">{dt('section_title_memories')}</h3>
        <div className="rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-bold text-white">
          📸 {dt('album_view_all')}
        </div>
      </div>
      <div className="section-body">
        <div className="grid grid-cols-[repeat(auto-fill,minmax(80px,1fr))] gap-1.5 p-0.5">
          {PHOTO_COLORS.map((color, i) => (
            <div
              key={i}
              className={`aspect-square rounded-lg ${color} flex items-center justify-center text-xl`}
            >
              {['🏖️', '🎂', '🌸', '⛺', '🎡', '🌅'][i]}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ── Travel (여행 플래너 스타일) ─────────────────────────────────
function TravelPreview() {
  const { tt, wp } = useWidgetPreviewCopy();
  const trips = [
    { title: wp('preview_trip_1_title'), dates: wp('preview_trip_1_dates') },
    { title: wp('preview_trip_2_title'), dates: wp('preview_trip_2_dates') },
    { title: wp('preview_trip_3_title'), dates: wp('preview_trip_3_dates') },
  ];
  return (
    <section className="content-section h-full">
      <div className="section-header">
        <h3 className="section-title">{tt('title')}</h3>
        <div className="rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-bold text-white">
          + {tt('add_trip')}
        </div>
      </div>
      <div className="section-body">
        <ul className="m-0 list-none p-0 grid gap-1.5">
          {trips.map((trip, i) => (
            <li
              key={i}
              className="glass-panel-soft glass-panel-interactive rounded-lg px-3 py-2.5"
            >
              <div className="text-[13px] font-semibold text-slate-800">{trip.title}</div>
              <div className="mt-0.5 text-xs text-slate-500">{trip.dates}</div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

// ── Piggy Bank (저금통 스타일) ──────────────────────────────────
function PiggyPreview() {
  const { pt, wp, familyRole } = useWidgetPreviewCopy();
  const members = [
    { name: familyRole('mom'), wallet: '₩ 50,000', bank: '₩ 1,200,000' },
    { name: familyRole('dad'), wallet: '₩ 30,000', bank: '₩ 2,500,000' },
    { name: familyRole('daughter'), wallet: '₩ 15,000', bank: '₩ 350,000' },
  ];
  return (
    <section className="content-section h-full">
      <div className="section-header">
        <h3 className="section-title">{pt('piggy_label')}</h3>
        <div className="flex items-center gap-1.5 rounded-lg bg-red-500 px-2.5 py-1.5 text-xs font-semibold text-white">
          <span>🐷</span> {wp('preview_manage_btn')}
        </div>
      </div>
      <div className="section-body">
        <div className="grid gap-2">
          {members.map((m, i) => (
            <div
              key={i}
              className="glass-panel-soft glass-panel-interactive rounded-xl p-3"
            >
              <div className="mb-1.5 text-sm font-bold text-slate-800">{m.name}</div>
              <div className="grid grid-cols-2 gap-1.5">
                <div className="rounded-lg bg-amber-50 px-2 py-1.5">
                  <div className="text-[10px] text-amber-600">{wp('preview_wallet')}</div>
                  <div className="text-xs font-bold text-amber-800">{m.wallet}</div>
                </div>
                <div className="rounded-lg bg-blue-50 px-2 py-1.5">
                  <div className="text-[10px] text-blue-600">{wp('preview_bank')}</div>
                  <div className="text-xs font-bold text-blue-800">{m.bank}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ── Games (Family Games) ───────────────────────────────────────────
function GamesPreview() {
  const { gt, wp } = useWidgetPreviewCopy();
  const tabs = [gt('tab_ladder'), gt('tab_rps'), gt('tab_roulette')];
  const names = [
    wp('preview_game_name_1'),
    wp('preview_game_name_2'),
    wp('preview_game_name_3'),
    wp('preview_game_name_4'),
  ];
  const destinations = [
    wp('preview_game_dest_1'),
    wp('preview_game_dest_2'),
    wp('preview_game_dest_3'),
    wp('preview_game_dest_4'),
  ];
  return (
    <section className="content-section games-widget-section">
      <div className="section-header">
        <h3 className="section-title">{gt('section_title')}</h3>
      </div>
      <div className="section-body games-section-body">
        <div className="mb-2 flex flex-wrap gap-1 rounded-lg bg-slate-900/5 p-1">
          {tabs.map((tab, i) => (
            <span
              key={tab}
              className={`rounded-md px-2 py-1 text-[10px] font-semibold ${
                i === 0 ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-600'
              }`}
            >
              {tab}
            </span>
          ))}
        </div>
        <div className="glass-panel-soft rounded-xl p-3">
          <div className="mb-2 grid grid-cols-4 gap-1">
            {names.map((name) => (
              <div key={name} className="text-center text-[9px] font-semibold text-slate-700">
                {name}
              </div>
            ))}
          </div>
          <div className="relative mx-auto games-ladder-preview w-full max-w-[140px]">
            <svg viewBox="0 0 100 60" className="h-full w-full">
              {[20, 40, 60, 80].map((x) => (
                <line key={`v-${x}`} x1={x} y1={8} x2={x} y2={52} stroke="#94a3b8" strokeWidth={1} />
              ))}
              <line x1={20} y1={22} x2={40} y2={22} stroke="#6366f1" strokeWidth={2} />
              <line x1={40} y1={36} x2={60} y2={36} stroke="#94a3b8" strokeWidth={1.5} />
              <line x1={60} y1={44} x2={80} y2={44} stroke="#6366f1" strokeWidth={2} />
            </svg>
          </div>
          <div className="mt-2 grid grid-cols-4 gap-1">
            {destinations.map((label) => (
              <div key={label} className="text-center text-[9px] font-medium text-slate-600">
                {label}
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

// ── Travel diary ───────────────────────────────────────────────────
function TravelDiaryPreview() {
  const { tdy, wp } = useWidgetPreviewCopy();
  return (
    <section className="content-section">
      <div className="section-header">
        <h3 className="section-title">{tdy('section_title')}</h3>
      </div>
      <div className="section-body">
        <div className="glass-panel-soft rounded-xl p-3">
          <div className="text-sm font-bold text-slate-800">{wp('preview_diary_sample_title')}</div>
          <div className="mt-0.5 text-xs text-slate-500">{wp('preview_diary_sample_dates')}</div>
          <p className="mt-2 text-xs text-slate-600">{wp('preview_diary_sample_desc')}</p>
        </div>
      </div>
    </section>
  );
}

// ── 통합 레코드 ──────────────────────────────────────────────────
export const WIDGET_PREVIEW_MAP: Record<DashboardWidgetKey, () => React.ReactNode> = {
  tasks:    () => <TasksPreview />,
  calendar: () => <CalendarPreview />,
  chat:     () => <ChatPreview />,
  location: () => <LocationPreview />,
  album:    () => <AlbumPreview />,
  travel:   () => <TravelPreview />,
  piggy:    () => <PiggyPreview />,
  games:        () => <GamesPreview />,
  travel_diary: () => <TravelDiaryPreview />,
};
