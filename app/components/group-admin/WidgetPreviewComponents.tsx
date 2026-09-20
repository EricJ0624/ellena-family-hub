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
import { getWidgetPreviewTranslation } from '@/lib/translations/widgetPreview';
import { getFamilyRoleLabel } from '@/lib/translations/memberManagement';
import { getCommonTranslation } from '@/lib/translations/common';
import { intlLocaleForLang } from '@/lib/language-fonts';

/** 쇼룸 앨범/다이어리용 로컬 가짜 사진 (외부 네트워크 불필요) */
function fakePhotoSrc(seed: number, w = 120, h = 120) {
  const hue = (seed * 47) % 360;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
    <stop stop-color="hsl(${hue},72%,68%)"/><stop offset="1" stop-color="hsl(${(hue + 48) % 360},58%,42%)"/>
  </linearGradient></defs>
  <rect width="${w}" height="${h}" fill="url(#g)"/>
  <circle cx="${Math.round(w * 0.32)}" cy="${Math.round(h * 0.34)}" r="${Math.round(w * 0.12)}" fill="rgba(255,255,255,0.35)"/>
  <rect x="${Math.round(w * 0.18)}" y="${Math.round(h * 0.62)}" width="${Math.round(w * 0.64)}" height="${Math.round(h * 0.18)}" rx="6" fill="rgba(255,255,255,0.22)"/>
</svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

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
      dateLocale,
      dt: (key: Parameters<typeof getDashboardTranslation>[1]) => getDashboardTranslation(lang, key),
      tt: (key: Parameters<typeof getTravelTranslation>[1]) => getTravelTranslation(lang, key),
      gt: (key: Parameters<typeof getGamesTranslation>[1]) => getGamesTranslation(lang, key),
      tdy: (key: Parameters<typeof getTravelDiaryTranslation>[1]) => getTravelDiaryTranslation(lang, key),
      wp: (key: Parameters<typeof getWidgetPreviewTranslation>[1]) => getWidgetPreviewTranslation(lang, key),
      ct: (key: Parameters<typeof getCommonTranslation>[1]) => getCommonTranslation(lang, key),
      familyRole: (role: 'mom' | 'dad' | 'daughter') => getFamilyRoleLabel(lang, role),
    }),
    [lang, dateLocale],
  );
}

// ── Tasks ───────────────────────────────────────────────────────
function TasksPreview() {
  const { dt, wp } = useWidgetPreviewCopy();
  /** chalkboard-bg.png 에 타이틀이 포함됨 — 실위젯과 동일하게 HTML은 sr-only */
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
          <h3 className="chalkboard-title chalkboard-title--sr-only">{dt('todo_section_title')}</h3>
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

// ── Calendar (kids 실위젯 그라데이션·장식·스티커) ───────────────
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
  const idleDecos = [
    { src: '/family-calendar/emojis/rainbow.png', className: 'left-1 top-2 h-7 w-7 -rotate-12' },
    { src: '/family-calendar/emojis/star.png', className: 'right-2 top-3 h-5 w-5 rotate-12' },
    { src: '/family-calendar/emojis/planet.png', className: 'bottom-2 left-2 h-6 w-6' },
    { src: '/family-calendar/emojis/shooting-star.png', className: 'bottom-3 right-3 h-7 w-7 rotate-[-8deg]' },
  ];
  const kidsBg =
    'linear-gradient(180deg, rgba(237,233,254,0.92) 0%, rgba(221,214,254,0.85) 30%, rgba(252,231,243,0.75) 70%, rgba(254,215,170,0.5) 100%)';

  return (
    <section
      className="content-section calendar-widget-section calendar-widget-section--frame relative h-full min-h-[14rem] overflow-hidden"
      style={{ background: kidsBg }}
    >
      <div className="pointer-events-none absolute inset-0 z-[1] overflow-hidden" aria-hidden>
        {idleDecos.map((d) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img key={d.src + d.className} src={d.src} alt="" className={`absolute object-contain ${d.className}`} />
        ))}
      </div>
      {surface !== 'showroom' ? (
        <div className="section-header relative z-[2] mb-2">
          <h3 className="section-title m-0 flex items-center gap-2 font-extrabold text-violet-800">
            <span aria-hidden>📅</span>
            FAMILY CALENDAR
          </h3>
        </div>
      ) : null}
      <div className="section-body relative z-[2]">
        <div
          className="mb-2 flex items-center justify-between gap-2 rounded-full px-2 py-1 shadow-sm"
          style={{ background: 'rgba(255,255,255,0.9)' }}
        >
          <span
            className="text-sm font-bold sm:text-base"
            style={{
              backgroundImage:
                'linear-gradient(90deg, #5b4b82 0%, #4a6d8c 28%, #4a7a6e 52%, #7a6a3d 76%, #7a5360 100%)',
              WebkitBackgroundClip: 'text',
              backgroundClip: 'text',
              color: 'transparent',
            }}
          >
            {monthLabel}
          </span>
          <div className="flex shrink-0 gap-1">
            <span className="rounded-full bg-violet-600 px-2 py-0.5 text-[10px] font-semibold text-white">
              ◀ {dt('calendar_prev_month')}
            </span>
            <span className="rounded-full bg-violet-600 px-2 py-0.5 text-[10px] font-semibold text-white">
              {dt('calendar_next_month')} ▶
            </span>
          </div>
        </div>
        <div className="grid grid-cols-7 gap-0.5 text-center text-xs">
          {days.map((d, i) => (
            <div
              key={d}
              className={`py-1 text-[11px] font-bold ${
                i === 0 ? 'text-red-500' : i === 6 ? 'text-blue-500' : 'text-violet-700/70'
              }`}
            >
              {d}
            </div>
          ))}
          {cells.map((cell, i) => {
            const sticker = typeof cell === 'number' ? stickers[cell] : undefined;
            const isCongrats = cell === 15;
            const hasEvent = cell === 8 || cell === 22 || isCongrats;
            return (
              <div
                key={i}
                className={`relative flex h-9 flex-col items-center justify-center rounded-md text-[12px] font-medium shadow-sm ${
                  cell === 26
                    ? 'bg-gradient-to-br from-violet-600 to-violet-800 font-bold text-white'
                    : hasEvent
                      ? 'bg-gradient-to-br from-violet-100 to-pink-100 font-bold text-violet-700'
                      : cell !== ''
                        ? 'bg-white/80 text-slate-700'
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
                        className={`mt-0.5 object-contain ${isCongrats ? 'h-4 w-4' : 'h-3 w-3'}`}
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

// ── Location (실위젯: action 버튼 + map-slot 플레이스홀더) ───────
function LocationPreview() {
  const { dt, familyRole } = useWidgetPreviewCopy();
  const surface = usePreviewSurface();
  const pins = [
    { emoji: '👩', name: familyRole('mom') },
    { emoji: '👨', name: familyRole('dad') },
    { emoji: '👧', name: familyRole('daughter') },
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
        <div className="location-map-slot min-h-[7rem] flex-1">
          <div
            className="location-map-surface relative flex h-full min-h-[7rem] w-full flex-col items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-cover bg-center text-slate-600"
            style={{
              backgroundImage:
                "linear-gradient(rgba(248,250,252,0.55),rgba(248,250,252,0.55)),url('/family-location/widget-bg.webp')",
            }}
          >
            <div className="absolute inset-0 flex items-end justify-around px-4 pb-4">
              {pins.map((m, i) => (
                <div
                  key={m.name}
                  className="flex flex-col items-center"
                  style={{ transform: `translateY(${i === 1 ? -10 : 0}px)` }}
                >
                  <span className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-white bg-white text-base shadow-md">
                    {m.emoji}
                  </span>
                </div>
              ))}
            </div>
            <p className="relative z-[1] rounded-lg bg-white/85 px-2 py-1 text-[10px] font-semibold text-slate-600 shadow-sm">
              {dt('location_ui_map_title')}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

// ── Album (스크랩북 + 샘플 사진 타일) ────────────────────────────
function AlbumPreview() {
  const { dt } = useWidgetPreviewCopy();
  const left = [1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => fakePhotoSrc(n + 10));
  const right = [1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => fakePhotoSrc(n + 30));

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
                  {left.map((src) => (
                    <div key={src} className="album-tile overflow-hidden">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={src} alt="" className="h-full w-full object-cover" draggable={false} />
                    </div>
                  ))}
                </div>
              </div>
              <div className="album-book-page album-book-page--right">
                <div className="album-book-grid">
                  {right.map((src) => (
                    <div key={src} className="album-tile overflow-hidden">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={src} alt="" className="h-full w-full object-cover" draggable={false} />
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

// ── Travel (일정 결과물 축소판 — 메인 목록이 아님) ───────────────
function TravelPreview() {
  const { wp } = useWidgetPreviewCopy();
  const items = [
    { icon: '🏨', text: wp('preview_plan_stay') },
    { icon: '📍', text: wp('preview_plan_spot') },
    { icon: '🍜', text: wp('preview_plan_meal') },
  ];

  return (
    <section className="content-section travel-kids-widget min-h-[13rem]">
      <div className="travel-kids-widget-stage">
        <div className="flex h-full min-h-[13rem] flex-col justify-center gap-2 p-3">
          <div className="rounded-2xl border border-white/50 bg-white/90 p-3 shadow-md backdrop-blur-sm">
            <div className="text-[11px] font-bold uppercase tracking-wide text-violet-600">
              {wp('preview_plan_day')}
            </div>
            <div className="mt-1 text-sm font-bold text-slate-900">{wp('preview_trip_1_title')}</div>
            <div className="text-[11px] text-slate-500">{wp('preview_trip_1_dates')}</div>
            <ul className="mt-2.5 m-0 flex list-none flex-col gap-1.5 p-0">
              {items.map((item) => (
                <li
                  key={item.text}
                  className="flex items-start gap-2 rounded-xl bg-violet-50/90 px-2.5 py-1.5 text-[11px] font-medium text-slate-700"
                >
                  <span aria-hidden>{item.icon}</span>
                  <span className="min-w-0 flex-1 leading-snug">{item.text}</span>
                </li>
              ))}
            </ul>
            <div className="mt-2.5 flex items-center justify-between rounded-xl bg-amber-50 px-2.5 py-1.5">
              <span className="text-[11px] font-semibold text-amber-800">{wp('preview_plan_budget')}</span>
              <span className="text-xs font-bold text-amber-900">{wp('preview_plan_budget_amount')}</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ── Piggy (kids BG 일러스트 + metric 카드) ───────────────────────
function PiggyPreview() {
  const { dt, wp, familyRole } = useWidgetPreviewCopy();
  const surface = usePreviewSurface();
  const members = [
    { name: familyRole('mom'), wallet: '₩ 50,000', bank: '₩ 1,200,000' },
    { name: familyRole('dad'), wallet: '₩ 30,000', bank: '₩ 2,500,000' },
    { name: familyRole('daughter'), wallet: '₩ 15,000', bank: '₩ 350,000' },
  ];

  return (
    <section
      className="content-section relative h-full min-h-[13rem] overflow-hidden"
      data-piggy-filled="true"
      style={{
        backgroundColor: '#bae6fd',
        backgroundImage: 'linear-gradient(160deg, #bae6fd 0%, #f9a8d4 58%, #ffedd5 100%)',
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/piggy/kids-widget-bg.webp?v=5"
        alt=""
        aria-hidden
        className="pointer-events-none absolute inset-y-1 right-0 z-0 h-[calc(100%-0.5rem)] w-auto max-w-[55%] object-contain object-right opacity-95"
      />
      {surface !== 'showroom' ? (
        <div className="section-header relative z-[3]">
          <h3 className="section-title">{dt('piggy_section_admin_title')}</h3>
          <span className="inline-flex items-center gap-1 rounded-lg bg-red-500 px-2.5 py-1.5 text-xs font-semibold text-white">
            🐷 {wp('preview_manage_btn')}
          </span>
        </div>
      ) : (
        <div className="relative z-[3] mb-2 flex items-center justify-end">
          <span className="inline-flex items-center gap-1 rounded-lg bg-red-500 px-2.5 py-1 text-[11px] font-semibold text-white">
            🐷 {wp('preview_manage_btn')}
          </span>
        </div>
      )}
      <div className="section-body relative z-[3]">
        <div className="grid max-w-[72%] gap-2">
          {members.map((m) => (
            <div
              key={m.name}
              className="piggy-widget-card rounded-xl border border-slate-200/80 bg-white/95 p-2 shadow-sm backdrop-blur-[2px]"
            >
              <div className="mb-1.5 text-xs font-bold text-[#1f2937]">{m.name}</div>
              <div className="grid grid-cols-2 gap-1.5">
                <div className="piggy-widget-metric--wallet rounded-lg border border-solid border-[#fecaca] bg-[#fef2f2] px-2 py-1">
                  <div className="text-[9px] text-[#b91c1c]">{wp('preview_wallet')}</div>
                  <div className="text-[11px] font-bold text-[#b91c1c]">{m.wallet}</div>
                </div>
                <div className="piggy-widget-metric--bank rounded-lg border border-solid border-[#fed7aa] bg-[#fff7ed] px-2 py-1">
                  <div className="text-[9px] text-[#9a3412]">{wp('preview_bank')}</div>
                  <div className="text-[11px] font-bold text-[#9a3412]">{m.bank}</div>
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

// ── Travel diary (첨부4: 경로/일기 결과 카드) ────────────────────
function TravelDiaryPreview() {
  const { tdy, ct, wp } = useWidgetPreviewCopy();
  const photos = [1, 2, 3, 4, 5, 6].map((n) => fakePhotoSrc(n + 50, 140, 140));

  return (
    <section className="relative isolate min-h-[13rem] overflow-hidden rounded-2xl bg-slate-700/90 p-2.5">
      <div className="flex h-full min-h-[13rem] flex-col gap-2 text-slate-100">
        <div>
          <div className="text-xs font-bold text-sky-100">{wp('preview_diary_route_when')}</div>
          <div className="text-[10px] text-sky-200/80">{wp('preview_diary_sample_dates')}</div>
        </div>
        <div className="rounded-xl bg-white p-1.5 shadow-md">
          <div className="grid grid-cols-3 gap-1">
            {photos.map((src) => (
              <div key={src} className="aspect-square overflow-hidden rounded-md border border-slate-800/80">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={src} alt="" className="h-full w-full object-cover" draggable={false} />
              </div>
            ))}
          </div>
        </div>
        <div className="flex items-start justify-between gap-2 px-0.5">
          <div className="min-w-0">
            <div className="text-xs font-semibold text-sky-100">{wp('preview_diary_route_title')}</div>
            <div className="mt-1 flex items-center gap-1 text-sm" aria-hidden>
              <span>😊</span>
              <span>❤️</span>
              <span>☀️</span>
            </div>
            <div className="mt-0.5 text-[11px] text-amber-300" aria-hidden>
              ★★★★★
            </div>
          </div>
          <div
            className="h-14 w-20 shrink-0 overflow-hidden rounded-md border border-slate-500 bg-cover bg-center"
            style={{ backgroundImage: "url('/family-location/widget-bg.webp')" }}
            aria-hidden
          />
        </div>
        <div className="mt-auto flex items-center gap-2">
          <span className="inline-flex flex-1 items-center justify-center gap-1 rounded-lg bg-white px-2 py-1.5 text-[10px] font-semibold text-slate-700">
            ✎ {tdy('edit')}
          </span>
          <span className="inline-flex flex-1 items-center justify-center gap-1 rounded-lg bg-white px-2 py-1.5 text-[10px] font-semibold text-slate-700">
            🗑 {ct('delete')}
          </span>
          <span className="shrink-0 text-[10px] font-semibold text-sky-100">
            {wp('preview_diary_total_cost')}
          </span>
        </div>
      </div>
    </section>
  );
}

// ── Quick travel record (세로 압축 — 실위젯 H≈4) ────────────────
function TravelQuickRecordPreview() {
  const { tt } = useWidgetPreviewCopy();
  const surface = usePreviewSurface();
  const circleBtn =
    'travel-quick-record-circle inline-flex aspect-square w-[min(38cqmin,4.25rem)] max-h-[4.25rem] min-w-[3.5rem] shrink-0 flex-col items-center justify-center gap-0.5 border-0 px-1.5 text-center font-bold text-white';
  const iconCls = 'travel-quick-record-circle-icon h-4 w-4 shrink-0';
  const labelCls =
    'travel-quick-record-circle-label max-w-[95%] px-0.5 text-[9px] leading-snug [overflow-wrap:anywhere] [word-break:keep-all]';

  return (
    <section className="content-section travel-quick-record-widget travel-quick-record-widget--kids !min-h-0 min-h-[7.5rem]">
      <div className="travel-quick-record-stage !gap-1">
        {surface !== 'showroom' ? (
          <h3 className="travel-kids-widget-title !mb-0 text-sm">{tt('quick_record_title')}</h3>
        ) : null}
        <div className="travel-quick-record-body !justify-center !py-1">
          <div className="travel-quick-record-circle-row flex w-full min-w-0 items-center justify-center gap-2.5 py-0">
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
