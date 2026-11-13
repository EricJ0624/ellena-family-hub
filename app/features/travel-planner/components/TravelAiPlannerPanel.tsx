'use client';

/**
 * TravelAiPlannerPanel — AI 여행 계획 생성 패널
 *
 * - 사용자가 여행 테마/요청사항을 입력하면 AI가 JSON 계획을 생성
 * - 미리보기 후 [저장] 버튼으로 각 API에 일정 저장
 * - API 키 미등록 시 닉네임 모달(계정 설정) 열기 안내
 * - 패널 내부에 AI 상태 격리 (대시보드 재렌더 가드 준수)
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import {
  useTravelAiPlanner,
  type AiTravelPlan,
  type AiItineraryItem,
  type AiAccommodationItem,
  type AiDiningItem,
  type AiTransportItem,
} from '../hooks/useTravelAiPlanner';
import type { TravelTrip } from '@/lib/modules/travel-planner/types';

// ---------------------------------------------------------------------------
// 상수
// ---------------------------------------------------------------------------

const THEME_OPTIONS = [
  { value: '', label: '선택 안 함' },
  { value: '가족여행', label: '👨‍👩‍👧‍👦 가족여행' },
  { value: '자연/힐링', label: '🌿 자연/힐링' },
  { value: '맛집 투어', label: '🍜 맛집 투어' },
  { value: '문화/역사', label: '🏛️ 문화/역사' },
  { value: '액티비티', label: '🏄 액티비티' },
  { value: '도시 관광', label: '🏙️ 도시 관광' },
  { value: '휴양/리조트', label: '🏖️ 휴양/리조트' },
];

const TRANSPORT_TYPE_LABEL: Record<string, string> = {
  air: '✈️ 항공',
  train: '🚆 기차',
  car: '🚗 자동차',
  bike: '🚲 자전거',
};

// ---------------------------------------------------------------------------
// 미리보기 렌더러 (순수 표시 컴포넌트)
// ---------------------------------------------------------------------------

function PlanPreview({ plan }: { plan: AiTravelPlan }) {
  const totalItems =
    plan.itineraries.length +
    plan.accommodations.length +
    plan.dining.length +
    plan.transports.length;

  if (totalItems === 0) {
    return (
      <p className="py-4 text-center text-sm text-slate-400">
        생성된 항목이 없습니다. 다시 시도해 주세요.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {/* 숙소 */}
      {plan.accommodations.length > 0 && (
        <div>
          <p className="mb-1.5 text-xs font-semibold text-slate-500">🏨 숙소 ({plan.accommodations.length})</p>
          <ul className="m-0 flex list-none flex-col gap-1 p-0">
            {plan.accommodations.map((item: AiAccommodationItem, idx: number) => (
              <li key={idx} className="rounded-md border border-blue-100 bg-blue-50 px-3 py-2 text-xs text-slate-700">
                <span className="font-semibold">{item.name}</span>
                <span className="ml-2 text-slate-500">{item.check_in_date} ~ {item.check_out_date}</span>
                {item.address && <span className="ml-2 text-slate-400">{item.address}</span>}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* 교통 */}
      {plan.transports.length > 0 && (
        <div>
          <p className="mb-1.5 text-xs font-semibold text-slate-500">🚗 교통 ({plan.transports.length})</p>
          <ul className="m-0 flex list-none flex-col gap-1 p-0">
            {plan.transports.map((item: AiTransportItem, idx: number) => (
              <li key={idx} className="rounded-md border border-amber-100 bg-amber-50 px-3 py-2 text-xs text-slate-700">
                <span className="font-semibold">{TRANSPORT_TYPE_LABEL[item.transport_type] ?? item.transport_type}</span>
                <span className="ml-2 text-slate-500">{item.day_date}</span>
                {item.departure && item.arrival && (
                  <span className="ml-2">{item.departure} → {item.arrival}</span>
                )}
                {item.start_time && <span className="ml-2 text-slate-400">{item.start_time}</span>}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* 먹거리 */}
      {plan.dining.length > 0 && (
        <div>
          <p className="mb-1.5 text-xs font-semibold text-slate-500">🍽️ 먹거리 ({plan.dining.length})</p>
          <ul className="m-0 flex list-none flex-col gap-1 p-0">
            {plan.dining.map((item: AiDiningItem, idx: number) => (
              <li key={idx} className="rounded-md border border-orange-100 bg-orange-50 px-3 py-2 text-xs text-slate-700">
                <span className="font-semibold">{item.name}</span>
                <span className="ml-2 text-slate-500">{item.day_date}</span>
                {item.time_at && <span className="ml-2 text-slate-400">{item.time_at}</span>}
                {item.category && <span className="ml-2 text-slate-400">({item.category})</span>}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* 일정 */}
      {plan.itineraries.length > 0 && (
        <div>
          <p className="mb-1.5 text-xs font-semibold text-slate-500">📍 일정 ({plan.itineraries.length})</p>
          <ul className="m-0 flex list-none flex-col gap-1 p-0">
            {plan.itineraries.map((item: AiItineraryItem, idx: number) => (
              <li key={idx} className="rounded-md border border-purple-100 bg-purple-50 px-3 py-2 text-xs text-slate-700">
                <span className="font-semibold">{item.title}</span>
                <span className="ml-2 text-slate-500">{item.day_date}</span>
                {item.start_time && <span className="ml-2 text-slate-400">{item.start_time}</span>}
                {item.description && (
                  <p className="mt-1 leading-snug text-slate-500">{item.description}</p>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// 메인 컴포넌트
// ---------------------------------------------------------------------------

interface TravelAiPlannerPanelProps {
  trip: TravelTrip;
  participantCount: number;
  lang: string;
  onSavePlan: (plan: AiTravelPlan) => Promise<void>;
  onOpenAccountSettings: () => void;
}

export function TravelAiPlannerPanel({
  trip,
  participantCount,
  lang,
  onSavePlan,
  onOpenAccountSettings,
}: TravelAiPlannerPanelProps) {
  const [userId, setUserId] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  // 패널 열릴 때마다 localStorage 재읽기 트리거 (hasApiKey staleness 방지)
  const [keyRevision, setKeyRevision] = useState(0);

  const [theme, setTheme] = useState('');
  const [notes, setNotes] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // setTimeout 메모리 누수 방지용 ref
  const successTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // userId 초기화 (세션에서 추출, 한 번만 실행)
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      const id = data.session?.user?.id ?? '';
      if (id) setUserId(id);
    });
  }, []);

  // unmount 시 타이머 정리
  useEffect(() => {
    return () => {
      if (successTimerRef.current) clearTimeout(successTimerRef.current);
    };
  }, []);

  const isKorean = lang === 'ko' || lang.startsWith('ko');

  const { hasApiKey, generating, plan, error, generate, clearPlan } = useTravelAiPlanner({
    userId,
    hasApiKeyRevision: keyRevision,
  });

  // 여행이 바뀌면 이전 계획 초기화
  useEffect(() => {
    clearPlan();
    setSaveError(null);
    setSaveSuccess(false);
  }, [trip.id, clearPlan]);

  // 패널 토글 — 열릴 때 localStorage 재읽기
  const handleToggle = useCallback(() => {
    setIsOpen((prev) => {
      const next = !prev;
      if (next) setKeyRevision((r) => r + 1);
      return next;
    });
  }, []);

  const handleGenerate = useCallback(async () => {
    clearPlan();
    setSaveError(null);
    setSaveSuccess(false);
    await generate(trip, { theme, notes, participantCount, isKorean });
  }, [generate, trip, theme, notes, participantCount, isKorean, clearPlan]);

  const handleSave = useCallback(async () => {
    if (!plan) return;
    setIsSaving(true);
    setSaveError(null);
    setSaveSuccess(false);
    try {
      await onSavePlan(plan);
      setSaveSuccess(true);
      clearPlan();
      setTheme('');
      setNotes('');
      // 성공 메시지 3초 후 초기화 (unmount 시 타이머 정리됨)
      if (successTimerRef.current) clearTimeout(successTimerRef.current);
      successTimerRef.current = setTimeout(() => setSaveSuccess(false), 3000);
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : '저장 중 오류가 발생했습니다.');
    } finally {
      setIsSaving(false);
    }
  }, [plan, onSavePlan, clearPlan]);

  const totalItems = plan
    ? plan.itineraries.length + plan.accommodations.length + plan.dining.length + plan.transports.length
    : 0;

  return (
    <div className="mt-4 overflow-hidden rounded-xl border border-indigo-200 bg-indigo-50/60 dark:bg-indigo-900/10">
      {/* 헤더 (토글 버튼) */}
      <button
        type="button"
        onClick={handleToggle}
        className="flex w-full cursor-pointer items-center justify-between px-4 py-3 text-left"
      >
        <span className="flex items-center gap-2 text-sm font-semibold text-indigo-700">
          <span className="text-base">🤖</span>
          AI로 여행 계획 짜기
        </span>
        <span className="text-xs text-indigo-400">{isOpen ? '▲' : '▼'}</span>
      </button>

      {isOpen && (
        <div className="flex flex-col gap-4 px-4 pb-4">
          {/* API 키 미등록 안내 (userId 로드 완료 후 키 없을 때만 표시) */}
          {userId && !hasApiKey && (
            <div className="rounded-lg border border-purple-200 bg-purple-50 p-3 text-center">
              <p className="mb-1 text-sm font-medium text-purple-700">🔑 AI API 키가 필요합니다</p>
              <p className="mb-3 text-xs text-slate-500">
                OpenAI 또는 Anthropic API 키를 등록하면<br />
                AI가 여행 일정을 자동으로 생성해 드립니다.
              </p>
              <button
                type="button"
                onClick={onOpenAccountSettings}
                className="rounded-lg bg-purple-500 px-4 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-purple-600"
              >
                계정 설정에서 API 키 등록하기
              </button>
            </div>
          )}

          {/* 입력 폼: 키가 있거나 userId 로드 전(로딩 중) */}
          {(hasApiKey || !userId) && (
            <>
              {/* 여행 정보 요약 */}
              <div className="rounded-lg border border-indigo-100 bg-white/80 px-3 py-2 text-xs text-slate-600">
                <span className="font-semibold">{trip.title}</span>
                {trip.destination && <span className="ml-2">📍 {trip.destination}</span>}
                <span className="ml-2">📅 {trip.start_date} ~ {trip.end_date}</span>
                {participantCount > 0 && <span className="ml-2">👥 {participantCount}명</span>}
              </div>

              {/* 테마 선택 */}
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-slate-600">
                  여행 테마
                </label>
                <select
                  value={theme}
                  onChange={(e) => setTheme(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700"
                >
                  {THEME_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>

              {/* 추가 요청사항 */}
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-slate-600">
                  추가 요청사항 <span className="font-normal text-slate-400">(선택)</span>
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="예: 아이가 좋아하는 체험 위주, 무리하지 않는 일정, 비건 식당 포함..."
                  rows={2}
                  maxLength={300}
                  className="w-full resize-none rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700"
                />
              </div>

              {/* 생성 버튼 */}
              <button
                type="button"
                onClick={() => void handleGenerate()}
                disabled={generating || !userId}
                className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-indigo-600 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {generating ? (
                  <><span className="animate-spin">⏳</span>AI가 계획을 생성 중...</>
                ) : (
                  <>✨ AI 여행 계획 생성</>
                )}
              </button>
            </>
          )}

          {/* 오류 메시지 */}
          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
              {error}
            </div>
          )}

          {/* 저장 오류 */}
          {saveError && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
              {saveError}
            </div>
          )}

          {/* 저장 성공 */}
          {saveSuccess && (
            <div className="rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-xs font-semibold text-green-700">
              ✅ 여행 계획이 저장되었습니다! 아래 일정 목록을 확인해 주세요.
            </div>
          )}

          {/* 미리보기 + 저장 버튼 */}
          {plan && !saveSuccess && (
            <div className="flex flex-col gap-3">
              <div>
                <p className="mb-2 text-xs font-semibold text-slate-500">
                  📋 AI 생성 계획 미리보기 ({totalItems}개 항목)
                </p>
                <div className="max-h-72 overflow-y-auto rounded-lg border border-slate-200 bg-white p-3">
                  <PlanPreview plan={plan} />
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => { clearPlan(); setSaveError(null); }}
                  className="flex-1 cursor-pointer rounded-xl border border-slate-300 bg-white py-2 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-50"
                >
                  다시 생성
                </button>
                <button
                  type="button"
                  onClick={() => void handleSave()}
                  disabled={isSaving || totalItems === 0}
                  className="flex-[2] flex cursor-pointer items-center justify-center gap-2 rounded-xl bg-emerald-600 py-2 text-sm font-semibold text-white transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isSaving ? (
                    <><span className="animate-spin">⏳</span>저장 중...</>
                  ) : (
                    <>💾 여행 계획에 저장 ({totalItems}개)</>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
