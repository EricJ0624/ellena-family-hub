'use client';

/**
 * 위젯 미리보기 컴포넌트
 * 실제 위젯의 CSS 클래스·구조를 재사용해 외관을 충실히 재현.
 * 데이터/기능 없이 정적 마크업만 사용.
 */

import React from 'react';
import type { DashboardWidgetKey } from '@/lib/widgets/types';

// ── Tasks (칠판 스타일) ──────────────────────────────────────────
function TasksPreview() {
  const items = [
    { text: '가족 저녁 식사 준비', done: false, assignee: '👩' },
    { text: '마트 장보기', done: true, assignee: '👨' },
    { text: '아이 학교 준비물', done: false, assignee: '👧' },
    { text: '주말 청소', done: false, assignee: null },
  ];
  return (
    <div className="chalkboard-frame h-full">
      <section className="chalkboard-container h-full">
        <div className="chalkboard-top-bar">
          <h3 className="chalkboard-title">Family Tasks</h3>
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
  const days = ['일', '월', '화', '수', '목', '금', '토'];
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
          Family Calendar
        </h3>
      </div>
      <div className="section-body">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-base font-bold text-slate-800">2026년 5월</span>
          <div className="flex gap-1">
            <div className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs text-slate-500">◀ 이전</div>
            <div className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs text-slate-500">다음 ▶</div>
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
  const messages = [
    { user: '👩 엄마', time: '10:30', text: '오늘 저녁 뭐 먹을까?', mine: false },
    { user: '나', time: '10:32', text: '치킨 어때요? 😋', mine: true },
    { user: '👨 아빠', time: '10:35', text: '좋아! 오늘 내가 시킬게', mine: false },
    { user: '나', time: '10:36', text: '👍', mine: true },
  ];
  return (
    <section className="content-section h-full">
      <div className="section-header">
        <h3 className="section-title">Family Chat</h3>
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
        <div className="chat-input-wrapper gap-1.5">
          <div className="flex-1 rounded-full border border-slate-200 bg-white px-3 py-2 text-xs text-slate-400">
            메시지 입력...
          </div>
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-500 text-sm text-white">
            ↑
          </div>
        </div>
      </div>
    </section>
  );
}

// ── Location (지도 스타일) ──────────────────────────────────────
function LocationPreview() {
  const members = [
    { emoji: '👩', name: '엄마', location: '서울 강남구' },
    { emoji: '👨', name: '아빠', location: '서울 종로구' },
    { emoji: '👧', name: '딸', location: '학교' },
  ];
  return (
    <section className="content-section h-full">
      <div className="section-header">
        <h3 className="section-title flex items-center gap-2">
          <span>📍</span>
          Family Location
        </h3>
        <div className="rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-medium text-white">
          📍 어디있어?
        </div>
      </div>
      <div className="section-body">
        <div className="mb-3 flex min-h-[120px] flex-col items-center justify-center rounded-xl border border-slate-200 bg-slate-50 p-4">
          <div className="mb-2 grid grid-cols-3 gap-2 w-full">
            {[...Array(9)].map((_, i) => (
              <div key={i} className={`h-8 rounded ${i % 3 === 0 ? 'bg-green-100' : i % 3 === 1 ? 'bg-slate-100' : 'bg-blue-50'}`} />
            ))}
          </div>
          <span className="text-xs text-slate-400">🗺️ 지도 영역</span>
        </div>
        <div className="grid gap-1.5">
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
  return (
    <section className="content-section h-full">
      <div className="section-header">
        <h3 className="section-title">Family Album</h3>
        <div className="rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-bold text-white">
          📸 전체보기
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
  const trips = [
    { title: '제주도 가족 여행', dates: '2026.07.15 ~ 07.20' },
    { title: '경주 역사 탐방', dates: '2026.08.10 ~ 08.12' },
    { title: '강원도 캠핑', dates: '2026.09.05 ~ 09.07' },
  ];
  return (
    <section className="content-section h-full">
      <div className="section-header">
        <h3 className="section-title">Travel Planner</h3>
        <div className="rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-bold text-white">
          + 여행 추가
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
  const members = [
    { name: '엄마', wallet: '₩ 50,000', bank: '₩ 1,200,000' },
    { name: '아빠', wallet: '₩ 30,000', bank: '₩ 2,500,000' },
    { name: '딸', wallet: '₩ 15,000', bank: '₩ 350,000' },
  ];
  return (
    <section className="content-section h-full">
      <div className="section-header">
        <h3 className="section-title">Piggy Bank</h3>
        <div className="flex items-center gap-1.5 rounded-lg bg-red-500 px-2.5 py-1.5 text-xs font-semibold text-white">
          <span>🐷</span> 관리
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
                  <div className="text-[10px] text-amber-600">지갑</div>
                  <div className="text-xs font-bold text-amber-800">{m.wallet}</div>
                </div>
                <div className="rounded-lg bg-blue-50 px-2 py-1.5">
                  <div className="text-[10px] text-blue-600">은행</div>
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

// ── Games (결정 게임) ───────────────────────────────────────────
function GamesPreview() {
  const tabs = ['사다리', '가위바위보', '룰렛'];
  return (
    <section className="content-section h-full">
      <div className="section-header">
        <h3 className="section-title">결정 게임</h3>
      </div>
      <div className="section-body">
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
            {['민수', '영희', '철수', '지우'].map((name) => (
              <div key={name} className="text-center text-[9px] font-semibold text-slate-700">
                {name}
              </div>
            ))}
          </div>
          <div className="relative mx-auto h-20 w-full max-w-[140px]">
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
            {['당번', '설거지', '치킨', '커피'].map((label) => (
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

// ── 통합 레코드 ──────────────────────────────────────────────────
export const WIDGET_PREVIEW_MAP: Record<DashboardWidgetKey, () => React.ReactNode> = {
  tasks:    () => <TasksPreview />,
  calendar: () => <CalendarPreview />,
  chat:     () => <ChatPreview />,
  location: () => <LocationPreview />,
  album:    () => <AlbumPreview />,
  travel:   () => <TravelPreview />,
  piggy:    () => <PiggyPreview />,
  games:    () => <GamesPreview />,
};
