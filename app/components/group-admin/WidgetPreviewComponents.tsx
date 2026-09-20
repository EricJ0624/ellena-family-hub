'use client';

/**
 * 위젯 미리보기 (쇼룸 · 그룹관리 레이아웃 에디터 공용)
 * Family Friendly 비주얼만 사용. 테마 분기 없음.
 * surface=showroom 이면 호스트에 이미 제목/설명이 있으므로 본문 위주·빈 영역 최소화.
 */

import { Camera, MapPin, Mic, Navigation, Paperclip, Plus, Send } from 'lucide-react';
import React, { createContext, useContext, useMemo } from 'react';
import { KidsChatDecorations } from '@/app/features/family-chat/components/FamilyChatSection';
import { AlbumPageDoodles } from '@/app/features/family-album/components/FamilyAlbumSection';
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

type PreviewSurface = 'default' | 'showroom';

const WidgetPreviewSurfaceContext = createContext<PreviewSurface>('default');

export function WidgetPreviewSurfaceProvider({
  surface,
  children,
}: {
  surface: PreviewSurface;
  children: React.ReactNode;
}) {
  return (
    <WidgetPreviewSurfaceContext.Provider value={surface}>
      {children}
    </WidgetPreviewSurfaceContext.Provider>
  );
}

function usePreviewSurface() {
  return useContext(WidgetPreviewSurfaceContext);
}

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

// ── Tasks ───────────────────────────────────────────────────────
function TasksPreview() {
  const { lang, dt, wp } = useWidgetPreviewCopy();
  const surface = usePreviewSurface();
  const titleInBg = lang === 'ko' && surface !== 'showroom';
  const items = [
    { text: wp('preview_task_1'), done: false, assignee: '👩' },
    { text: wp('preview_task_2'), done: true, assignee: '👨' },
    { text: wp('preview_task_3'), done: false, assignee: '👧' },
    { text: wp('preview_task_4'), done: false, assignee: null },
  ];

  return (
    <div className="chalkboard-frame flex w-full flex-col">
      <section className="chalkboard-container flex min-h-[13rem] flex-col">
        <div className="chalkboard-top-bar">
          <h3
            className={
              titleInBg ? 'chalkboard-title chalkboard-title--sr-only' : 'chalkboard-title'
            }
          >
            {dt('todo_section_title')}
          </h3>
        </div>
        <div className="section-body">
          <div className="todo-list">
            {items.map((item, i) => (
              <div key={i} className="todo-item">
                <div className="todo-content">
                  <div className={`todo-checkbox${item.done ? ' todo-checkbox-checked' : ''}`}>
                    {item.done ? (
                      <svg className="todo-checkmark" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    ) : null}
                  </div>
                  <div className="todo-text-wrapper">
                    <span className={`todo-text${item.done ? ' todo-text-done' : ''}`}>{item.text}</span>
                    {item.assignee ? <span className="todo-assignee">{item.assignee}</span> : null}
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

// ── Calendar (실위젯과 같이 일정 칸에 PNG 스티커) ───────────────
function CalendarPreview() {
  const { dt, dateLocale } = useWidgetPreviewCopy();
  const surface = usePreviewSurface();
  const days = [
    dt('calendar_weekday_0'),
    dt('calendar_weekday_1'),
    dt('calendar_weekday_2'),
    dt('calendar_weekday_3'),
    dt('calendar_weekday_4'),
    dt('calendar_weekday_5'),
    dt('calendar_weekday_6'),
  ];
  const monthLabel = new Date(2026, 4, 1).toLocaleDateString(dateLocale, {
    year: 'numeric',
    month: 'long',
  });
  /** day → kids 캘린더와 동일한 PNG 스티커 (유니코드 이모지 아님) */
  const stickers: Record<number, string> = {
    8: '/family-calendar/emojis/family.png',
    15: '/family-calendar/emojis/congrats-1.png',
    22: '/family-calendar/emojis/book.png',
    26: '/family-calendar/emojis/star.png',
  };
  const cells = [
    '', '', '', '', 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22,
    23, 24, 25, 26, 27, 28, 29, 30, 31,
  ] as (number | '')[];

  return (
    <section className="content-section h-full min-h-[14rem] bg-gradient-to-br from-purple-50 via-white to-sky-50">
      {surface !== 'showroom' ? (
        <div className="section-header mb-2">
          <h3 className="section-title m-0 flex items-center gap-2">
            <span aria-hidden>📅</span>
            {dt('section_title_calendar')}
          </h3>
        </div>
      ) : null}
      <div className="section-body">
        <div className="mb-2 flex items-center justify-between gap-2">
          <span className="text-sm font-bold text-slate-800 sm:text-base">{monthLabel}</span>
          <div className="flex shrink-0 gap-1">
            <span className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-[10px] text-slate-500">
              ◀ {dt('calendar_prev_month')}
            </span>
            <span className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-[10px] text-slate-500">
              {dt('calendar_next_month')} ▶
            </span>
          </div>
        </div>
        <div className="grid grid-cols-7 gap-0.5 text-center text-xs">
          {days.map((d, i) => (
            <div
              key={d}
              className={`py-1 text-[11px] font-bold ${
                i === 0 ? 'text-red-500' : i === 6 ? 'text-blue-500' : 'text-slate-500'
              }`}
            >
              {d}
            </div>
          ))}
          {cells.map((cell, i) => {
            const sticker = typeof cell === 'number' ? stickers[cell] : undefined;
            const isCongrats = cell === 15;
            return (
              <div
                key={i}
                className={`relative flex h-9 flex-col items-center justify-center rounded-md text-[12px] font-medium ${
                  cell === 26
                    ? 'bg-violet-600 font-bold text-white'
                    : isCongrats
                      ? 'bg-amber-100 font-bold text-amber-900'
                      : cell === 8 || cell === 22
                        ? 'bg-violet-100 font-bold text-violet-700'
                        : cell !== ''
                          ? 'text-slate-700'
                          : ''
                }`}
              >
                {cell !== '' ? (
                  <>
                    <span className="leading-none">{cell}</span>
                    {sticker ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={sticker}
                        alt=""
                        aria-hidden
                        className={`mt-0.5 object-contain ${
                          isCongrats ? 'h-4 w-4' : 'h-3 w-3'
                        }`}
                      />
                    ) : null}
                  </>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

// ── Chat ────────────────────────────────────────────────────────
function ChatPreview() {
  const { dt, ct, familyRole, wp } = useWidgetPreviewCopy();
  const surface = usePreviewSurface();
  const messages = [
    { user: `👩 ${familyRole('mom')}`, time: '10:30', text: wp('preview_chat_1'), mine: false },
    { user: ct('me'), time: '10:32', text: wp('preview_chat_2'), mine: true },
    { user: `👨 ${familyRole('dad')}`, time: '10:35', text: wp('preview_chat_3'), mine: false },
  ];

  return (
    <section className="content-section chat-widget-section chat-widget-section--kids h-full min-h-[14rem]">
      <KidsChatDecorations />
      {surface !== 'showroom' ? (
        <div className="section-header chat-section-header relative z-[3]">
          <h3 className="sr-only">{dt('section_title_chat')}</h3>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/family-chat/title.png" alt="" className="chat-kids-title" />
        </div>
      ) : null}
      <div className="section-body chat-section-body relative z-[3]">
        <div className="chat-messages">
          {messages.map((m, i) => (
            <div key={i} className="message-item">
              <div className="message-header">
                <span className={`message-user${m.mine ? ' chat-kids-me' : ''}`}>{m.user}</span>
                <span className="message-time">{m.time}</span>
              </div>
              <div className="message-bubble">
                <p className="message-text">{m.text}</p>
              </div>
            </div>
          ))}
        </div>
        <div className="chat-input-wrapper" style={{ gap: '1.5cqmin' }}>
          <div className="chat-kids-composer">
            <span className="chat-kids-mic" aria-hidden>
              <Mic className="chat-kids-mic-icon" />
            </span>
            <input
              type="text"
              readOnly
              tabIndex={-1}
              className="chat-input min-w-0 flex-1"
              placeholder={dt('chat_placeholder')}
              aria-hidden
            />
            <span className="chat-kids-add" aria-hidden>
              <Plus className="chat-kids-add-plus" />
              <span className="chat-kids-add-label">{dt('todo_register_btn')}</span>
            </span>
            <div className="chat-attach-wrap">
              <button type="button" tabIndex={-1} className="chat-attach-btn" aria-hidden>
                <Camera className="chat-attach-icon" aria-hidden />
                <Paperclip className="chat-attach-icon" aria-hidden />
              </button>
            </div>
          </div>
          <div className="chat-kids-send-cluster">
            <button type="button" tabIndex={-1} className="btn-send" aria-hidden>
              {dt('chat_send')}
              <Send className="chat-kids-send-icon" aria-hidden />
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

// ── Location (실위젯 location-action-btn 구조) ───────────────────
function LocationPreview() {
  const { dt, familyRole, wp } = useWidgetPreviewCopy();
  const surface = usePreviewSurface();
  const city = wp('preview_location_city');
  const members = [
    { emoji: '👩', name: familyRole('mom'), location: city },
    { emoji: '👨', name: familyRole('dad'), location: city },
    { emoji: '👧', name: familyRole('daughter'), location: wp('preview_location_school') },
  ];

  return (
    <section className="content-section location-widget-section h-full min-h-[14rem]">
      <div className="section-header shrink-0">
        {surface !== 'showroom' ? (
          <h3 className="section-title">{dt('section_title_location')}</h3>
        ) : null}
        <div className="location-header-actions">
          <div className="location-header-actions-twin">
            <span className="location-action-btn bg-emerald-500 text-white">
              <span>📍</span>
              <span>{dt('location_where_btn')}</span>
            </span>
            <span className="location-action-btn bg-blue-500 text-white">
              <span>🚶</span>
              <span>{dt('location_come_btn')}</span>
            </span>
          </div>
          <span className="location-action-btn location-action-btn--im-here bg-amber-500 text-white">
            <span>📌</span>
            <span>{dt('location_im_here_btn')}</span>
          </span>
        </div>
      </div>
      <div className="section-body location-section-body flex min-h-0 flex-col gap-2">
        <div className="grid gap-1.5">
          {members.map((m) => (
            <div
              key={m.name}
              className="flex items-center gap-2 rounded-xl border border-slate-100 bg-white/90 px-3 py-2 shadow-sm"
            >
              <span className="text-base">{m.emoji}</span>
              <div className="min-w-0 flex-1">
                <div className="text-xs font-semibold text-slate-800">{m.name}</div>
                <div className="text-[11px] text-slate-500">{m.location}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ── Album (실위젯 스크랩북 — 쇼룸용 명시 높이) ───────────────────
function AlbumPreview() {
  const { dt } = useWidgetPreviewCopy();
  const left = ['🏖️', '🎂', '⛰️', '🎈', '🌸', '⛺', '🎄', '🏡', '🚗'];
  const right = ['🌅', '🎿', '🌊', '🎇', '🍂', '🦁', '🎸', '🍕', '✈️'];

  return (
    <section className="content-section album-widget-section min-h-[16rem]">
      <div className="album-book-stage min-h-[12rem]">
        <div className="album-book-cover">
          <div className="album-book-fit">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              className="album-book-art"
              src="/family-album/spread-frame.png?v=2"
              alt=""
              draggable={false}
            />
            <h3 className="album-book-title">{dt('section_title_memories')}</h3>
            <div className="album-book-spread">
              <div className="album-book-page album-book-page--left">
                <div className="album-book-grid">
                  {left.map((emoji) => (
                    <div key={emoji} className="album-tile flex items-center justify-center text-sm">
                      {emoji}
                    </div>
                  ))}
                </div>
              </div>
              <div className="album-book-page album-book-page--right">
                <div className="album-book-grid">
                  {right.map((emoji) => (
                    <div key={emoji} className="album-tile flex items-center justify-center text-sm">
                      {emoji}
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <AlbumPageDoodles />
          </div>
        </div>
      </div>
      <div className="album-book-footer">
        <span className="album-book-pager">1 / 1</span>
        <div className="album-widget-view-all inline-flex items-center justify-center font-bold text-white">
          📸 {dt('album_view_all')}
        </div>
      </div>
    </section>
  );
}

// ── Travel ──────────────────────────────────────────────────────
function TravelPreview() {
  const { tt, wp } = useWidgetPreviewCopy();
  const surface = usePreviewSurface();
  const trips = [
    { title: wp('preview_trip_1_title'), dates: wp('preview_trip_1_dates') },
    { title: wp('preview_trip_2_title'), dates: wp('preview_trip_2_dates') },
    { title: wp('preview_trip_3_title'), dates: wp('preview_trip_3_dates') },
  ];

  return (
    <section className="content-section travel-kids-widget min-h-[13rem]">
      <div className="travel-kids-widget-stage">
        <div className="travel-kids-widget-head">
          {surface !== 'showroom' ? (
            <h3 className="travel-kids-widget-title">{tt('title')}</h3>
          ) : null}
          <div className="travel-kids-widget-actions">
            <div className="travel-kids-widget-import">{tt('import_open_button')}</div>
            <div className="travel-kids-widget-add">
              <Plus className="travel-kids-widget-add-icon" aria-hidden />
              {tt('add_trip')}
            </div>
          </div>
          <div className="travel-kids-widget-bottom">
            <ul className="travel-kids-widget-trips">
              {trips.map((trip) => (
                <li key={trip.title} className="travel-kids-widget-trip-item">
                  <div className="travel-kids-widget-trip">
                    <div className="travel-kids-widget-trip-title">{trip.title}</div>
                    <div className="travel-kids-widget-trip-dates">{trip.dates}</div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}

// ── Piggy (실위젯 piggy-widget-* 카드) ──────────────────────────
function PiggyPreview() {
  const { dt, wp, familyRole } = useWidgetPreviewCopy();
  const surface = usePreviewSurface();
  const members = [
    { name: familyRole('mom'), wallet: '₩ 50,000', bank: '₩ 1,200,000' },
    { name: familyRole('dad'), wallet: '₩ 30,000', bank: '₩ 2,500,000' },
    { name: familyRole('daughter'), wallet: '₩ 15,000', bank: '₩ 350,000' },
  ];

  return (
    <section className="content-section h-full min-h-[13rem]">
      {surface !== 'showroom' ? (
        <div className="section-header">
          <h3 className="section-title">{dt('piggy_section_admin_title')}</h3>
          <span className="inline-flex items-center gap-1 rounded-lg bg-red-500 px-2.5 py-1.5 text-xs font-semibold text-white">
            🐷 {wp('preview_manage_btn')}
          </span>
        </div>
      ) : (
        <div className="mb-2 flex items-center justify-end">
          <span className="inline-flex items-center gap-1 rounded-lg bg-red-500 px-2.5 py-1 text-[11px] font-semibold text-white">
            🐷 {wp('preview_manage_btn')}
          </span>
        </div>
      )}
      <div className="section-body">
        <div className="grid gap-2">
          {members.map((m) => (
            <div
              key={m.name}
              className="piggy-widget-card rounded-xl border border-slate-200 bg-white p-2.5"
            >
              <div className="mb-2 text-sm font-bold text-[#1f2937]">{m.name}</div>
              <div className="grid grid-cols-2 gap-1.5">
                <div className="piggy-widget-metric--wallet rounded-lg border border-solid border-[#fecaca] bg-[#fef2f2] px-2 py-1.5">
                  <div className="mb-0.5 text-[10px] text-[#b91c1c]">{wp('preview_wallet')}</div>
                  <div className="text-xs font-bold text-[#b91c1c]">{m.wallet}</div>
                </div>
                <div className="piggy-widget-metric--bank rounded-lg border border-solid border-[#fed7aa] bg-[#fff7ed] px-2 py-1.5">
                  <div className="mb-0.5 text-[10px] text-[#9a3412]">{wp('preview_bank')}</div>
                  <div className="text-xs font-bold text-[#9a3412]">{m.bank}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ── Games ───────────────────────────────────────────────────────
function GamesPreview() {
  const { gt, wp } = useWidgetPreviewCopy();
  const surface = usePreviewSurface();
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
    <section className="content-section games-widget-section min-h-[12rem]">
      {surface !== 'showroom' ? (
        <div className="section-header">
          <h3 className="section-title">{gt('section_title')}</h3>
        </div>
      ) : null}
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
        <div className="rounded-xl border border-slate-100 bg-white p-3 shadow-sm">
          <div className="mb-2 grid grid-cols-4 gap-1">
            {names.map((name) => (
              <div key={name} className="text-center text-[9px] font-semibold text-slate-700">
                {name}
              </div>
            ))}
          </div>
          <svg viewBox="0 0 100 56" className="mx-auto h-14 w-full max-w-[160px]">
            {[20, 40, 60, 80].map((x) => (
              <line key={x} x1={x} y1={6} x2={x} y2={50} stroke="#94a3b8" strokeWidth={1} />
            ))}
            <line x1={20} y1={20} x2={40} y2={20} stroke="#6366f1" strokeWidth={2} />
            <line x1={40} y1={34} x2={60} y2={34} stroke="#94a3b8" strokeWidth={1.5} />
            <line x1={60} y1={42} x2={80} y2={42} stroke="#6366f1" strokeWidth={2} />
          </svg>
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

// ── Travel diary (저장된 여행 목록 — 실위젯 trip list) ───────────
function TravelDiaryPreview() {
  const { tdy, wp } = useWidgetPreviewCopy();
  const surface = usePreviewSurface();
  const trips = [
    { title: wp('preview_trip_1_title'), dates: wp('preview_trip_1_dates') },
    { title: wp('preview_trip_2_title'), dates: wp('preview_trip_2_dates') },
    { title: wp('preview_diary_sample_title'), dates: wp('preview_diary_sample_dates') },
  ];

  return (
    <section className="content-section travel-diary-widget relative isolate min-h-[13rem] overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-cover bg-center opacity-90"
        style={{ backgroundImage: "url('/travel-diary/widget-bg.png?v=8')" }}
      />
      <div className="relative z-[1] flex h-full min-h-[13rem] flex-col p-3">
        {surface !== 'showroom' ? (
          <h3 className="m-0 mb-2 inline-flex items-center gap-1.5 text-sm font-bold text-slate-900">
            <span aria-hidden>📔</span>
            {tdy('section_title')}
          </h3>
        ) : null}
        <ul className="travel-kids-widget-trips m-0 flex flex-1 list-none flex-col gap-2 p-0">
          {trips.map((trip) => (
            <li key={trip.title} className="travel-kids-widget-trip-item">
              <div className="travel-kids-widget-trip rounded-xl bg-white/92 px-3 py-2 shadow-sm backdrop-blur-sm">
                <div className="travel-kids-widget-trip-title text-sm font-semibold text-slate-900">
                  {trip.title}
                </div>
                <div className="travel-kids-widget-trip-dates text-[11px] text-slate-500">
                  {trip.dates}
                </div>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

// ── Quick travel record (kids 원형 버튼 + 지도 BG 복원) ──────────
function TravelQuickRecordPreview() {
  const { tt } = useWidgetPreviewCopy();
  const surface = usePreviewSurface();
  const circleBtn =
    'travel-quick-record-circle inline-flex aspect-square w-[min(43cqmin,5.5rem)] max-h-[5.5rem] min-w-[4.5rem] shrink-0 flex-col items-center justify-center gap-1 border-0 px-2 text-center font-bold text-white';
  const iconCls = 'travel-quick-record-circle-icon h-5 w-5 shrink-0';
  const labelCls =
    'travel-quick-record-circle-label max-w-[95%] px-0.5 text-[10px] leading-snug [overflow-wrap:anywhere] [word-break:keep-all]';

  return (
    <section className="content-section travel-quick-record-widget travel-quick-record-widget--kids min-h-[11rem]">
      <div className="travel-quick-record-stage">
        {surface !== 'showroom' ? (
          <h3 className="travel-kids-widget-title">{tt('quick_record_title')}</h3>
        ) : null}
        <div className="travel-quick-record-body">
          <div className="travel-quick-record-circle-row flex w-full min-w-0 items-center justify-center gap-3 py-1">
            <div className={`${circleBtn} travel-quick-record-circle--checkin`}>
              <MapPin className={iconCls} aria-hidden />
              <span className={labelCls}>{tt('quick_record_checkin')}</span>
            </div>
            <div className={`${circleBtn} travel-quick-record-circle--route`}>
              <Navigation className={iconCls} aria-hidden />
              <span className={labelCls}>{tt('quick_record_route')}</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export const WIDGET_PREVIEW_MAP: Record<DashboardWidgetKey, () => React.ReactNode> = {
  tasks: () => <TasksPreview />,
  calendar: () => <CalendarPreview />,
  chat: () => <ChatPreview />,
  location: () => <LocationPreview />,
  album: () => <AlbumPreview />,
  travel: () => <TravelPreview />,
  piggy: () => <PiggyPreview />,
  games: () => <GamesPreview />,
  travel_diary: () => <TravelDiaryPreview />,
  travel_quick_record: () => <TravelQuickRecordPreview />,
};
