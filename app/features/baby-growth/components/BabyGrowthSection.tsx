'use client';

/**
 * BabyGrowthSection — 우리아이 성장기록 위젯 메인 컴포넌트
 *
 * [재렌더 가드 준수 사항]
 * - React.memo 적용
 * - useGroup() / useLanguage() 직접 호출 금지 (props로 수신)
 * - 모달 state는 이 컴포넌트 트리 안에서만 보유
 * - setState 배열 비교: 시그니처 비교 후 동일 시 prev 반환
 */

import React, { memo, useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { getBabyGrowthTranslations } from '@/lib/translations/baby-growth';
import type { LangCode } from '@/lib/language-fonts';
import { getCountryOptions } from '@/lib/countries';
import {
  BABY_BLOOD_TYPES,
  type BabyBloodType,
  type BabyDailyLog,
  type BabyProfile,
  type BabyProfileDraft,
  type BabyRecentStatus,
  type LogType,
  type PrenatalLog,
  type PrenatalLogType,
} from '../types';
import { asFiniteNumber } from '../utils/birth-snapshot';
import { gestationalProgress, isPrenatal } from '../utils/prenatal';
import { BABY_PROFILE_MAX, useBabyGrowth } from '../hooks/useBabyGrowth';
import { useBabyLogs, calcRecentStatus } from '../hooks/useBabyLogs';
import { usePrenatalLogs } from '../hooks/usePrenatalLogs';
import { useBirthTransition } from '../hooks/useBirthTransition';
import { BabyProfileCard } from './BabyProfileCard';
import { QuickStatusCards } from './QuickStatusCards';
import { QuickLogModal } from './QuickLogModal';
import { PrenatalStatusCards } from './PrenatalStatusCards';
import { PrenatalQuickLogModal } from './PrenatalQuickLogModal';
import { BirthTransitionModal } from './BirthTransitionModal';
import { TodayPhotoSlider } from './TodayPhotoSlider';
import { BabyAlbumView } from './BabyAlbumView';
import { BabyWidgetBackdrop, BabyWidgetStickers } from './BabyWidgetBackdrop';
import { AiGuideBriefingBanner } from './AiGuideBriefingBanner';
import { getGuideBrief } from '../utils/parse-guide-brief';
import { findCurrentOpenSleep, scheduledBedBefore } from '../utils/sleep-schedule';
import { useBabyAiGuide } from '../hooks/useBabyAiGuide';
import {
  type AiGuideCacheMap,
  isAiGuideStale,
  readAiGuideCache,
  textsFromCache,
  writeAiGuideCache,
} from '../utils/ai-guide-cache';

const ACTIVE_BABY_LS_KEY = 'sfh_baby_active_id';

function readStoredActiveBabyId(groupId: string | null): string | null {
  if (!groupId || typeof window === 'undefined') return null;
  try {
    return localStorage.getItem(`${ACTIVE_BABY_LS_KEY}:${groupId}`);
  } catch {
    return null;
  }
}

function storeActiveBabyId(groupId: string | null, babyId: string) {
  if (!groupId || typeof window === 'undefined') return;
  try {
    localStorage.setItem(`${ACTIVE_BABY_LS_KEY}:${groupId}`, babyId);
  } catch {
    /* ignore */
  }
}

// lazy import — 대시보드 초기 로드 성능 보호
const BabyGrowthNavigator = React.lazy(
  () => import('./BabyGrowthNavigator').then((m) => ({ default: m.BabyGrowthNavigator }))
);

// ---------------------------------------------------------------------------
// 로그 시그니처 비교 (재렌더 최소화)
// ---------------------------------------------------------------------------
function logsSignature(logs: BabyDailyLog[]): string {
  if (logs.length === 0) return 'empty';
  const head = logs
    .slice(0, 10)
    .map((l) => `${l.id}:${l.logged_at}:${l.sleep_end_at ?? ''}:${l.notes ?? ''}`)
    .join('|');
  const tail = logs[logs.length - 1];
  return `${logs.length}|${head}|${tail?.id ?? ''}:${tail?.logged_at ?? ''}`;
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------
interface BabyGrowthSectionProps {
  currentGroupId: string | null;
  userId: string;
  lang: LangCode;
  /** 확대 모달이 열렸을 때 true (WidgetChrome이 전달) */
  isMagnified?: boolean;
}

// ---------------------------------------------------------------------------
// BabyGrowthSection
// ---------------------------------------------------------------------------
export const BabyGrowthSection = memo(function BabyGrowthSection({
  currentGroupId,
  userId,
  lang,
  isMagnified = false,
}: BabyGrowthSectionProps) {
  const t = useMemo(() => getBabyGrowthTranslations(lang), [lang]);

  // ---------------------------------------------------------------------------
  // State
  // ---------------------------------------------------------------------------
  const [profiles, setProfiles] = useState<BabyProfile[]>([]);
  const [slideIndex, setSlideIndex] = useState(0);
  const [logs, setLogs] = useState<BabyDailyLog[]>([]);
  const [logModalOpen, setLogModalOpen] = useState(false);
  const [logModalType, setLogModalType] = useState<LogType>('feeding');
  const [prenatalLogs, setPrenatalLogs] = useState<PrenatalLog[]>([]);
  const [prenatalModalOpen, setPrenatalModalOpen] = useState(false);
  const [prenatalModalType, setPrenatalModalType] = useState<PrenatalLogType>('diary');
  const [birthModalOpen, setBirthModalOpen] = useState(false);
  const [addProfileOpen, setAddProfileOpen] = useState(false);
  const [addAsPrenatal, setAddAsPrenatal] = useState(false);
  const [editProfileOpen, setEditProfileOpen] = useState(false);
  const [babyLimitNotice, setBabyLimitNotice] = useState(false);
  /** 아이별 AI guide 전문 + 생성시각 — localStorage (주 1회 자동 갱신) */
  const [aiGuideCache, setAiGuideCache] = useState<AiGuideCacheMap>(() =>
    readAiGuideCache(currentGroupId),
  );
  const aiTextByBabyId = useMemo(() => textsFromCache(aiGuideCache), [aiGuideCache]);
  const aiGuideCacheRef = useRef(aiGuideCache);
  aiGuideCacheRef.current = aiGuideCache;
  const weeklyAiAttemptRef = useRef<Record<string, true>>({});
  const [albumOpen, setAlbumOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);

  // 로그 시그니처 ref — 동일 내용 setState 방지
  const logsSigRef = useRef<string>('');
  const logsRef = useRef<BabyDailyLog[]>(logs);
  logsRef.current = logs;
  const swipeStartRef = useRef<{
    x: number;
    y: number;
    id: number;
    locked: 'h' | 'v' | null;
  } | null>(null);
  const suppressClickRef = useRef(false);
  const slideIndexRef = useRef(0);
  const slideCountRef = useRef(1);
  const verticalScrollRef = useRef<HTMLDivElement>(null);
  const [snapPageHeight, setSnapPageHeight] = useState(0);
  slideIndexRef.current = slideIndex;

  const canShowAddSlide = profiles.length < BABY_PROFILE_MAX;
  const slideCount = Math.max(1, profiles.length + (canShowAddSlide ? 1 : 0));
  slideCountRef.current = slideCount;
  /** 등록용 초기 페이지(빈 슬롯) */
  const onAddSlide = canShowAddSlide && slideIndex >= profiles.length;
  const profile = onAddSlide ? null : (profiles[slideIndex] ?? profiles[0] ?? null);
  const activeBabyId = profile?.id ?? null;
  const aiText = activeBabyId ? (aiTextByBabyId[activeBabyId] ?? null) : null;

  // ---------------------------------------------------------------------------
  // 콜백 (안정 참조 보장)
  // ---------------------------------------------------------------------------
  const handleProfilesChange = useCallback((next: BabyProfile[]) => {
    setProfiles((prev) => {
      const prevSig = prev.map((p) => `${p.id}:${p.updated_at}`).join('|');
      const nextSig = next.map((p) => `${p.id}:${p.updated_at}`).join('|');
      return prevSig === nextSig ? prev : next;
    });
  }, []);

  const handleLogsChange = useCallback((newLogs: BabyDailyLog[]) => {
    const sig = logsSignature(newLogs);
    if (sig === logsSigRef.current) return;
    logsSigRef.current = sig;
    setLogs(newLogs);
  }, []);

  // ---------------------------------------------------------------------------
  // 훅
  // ---------------------------------------------------------------------------
  const { addProfile, updateProfile, deleteProfile } = useBabyGrowth({
    currentGroupId,
    userId,
    onProfilesChange: handleProfilesChange,
  });

  const { fetchLogs: fetchPrenatalLogs, addLog: addPrenatalLog } = usePrenatalLogs({
    babyId: activeBabyId,
    currentGroupId,
    userId,
  });

  const { hasApiKey, generate: generateAiGuide } = useBabyAiGuide({ userId });

  const { completeBirth } = useBirthTransition({
    profile: profile ?? ({
      id: '',
      group_id: currentGroupId ?? '',
      created_by: null,
      name: '',
      birth_date: null,
      due_date: null,
      birth_time: null,
      birth_place: null,
      fetal_name: null,
      birth_weight_kg: null,
      birth_height_cm: null,
      birth_head_cm: null,
      gestational_weeks: null,
      blood_type: null,
      birth_source: null,
      birth_event_id: null,
      gender: null,
      country_code: 'KR',
      notes: null,
      usual_bedtime: null,
      usual_wake_time: null,
      created_at: '',
      updated_at: '',
    } as BabyProfile),
    currentGroupId,
    userId,
    onProfileUpdated: (next) => {
      setProfiles((prev) => prev.map((p) => (p.id === next.id ? next : p)));
    },
  });

  useEffect(() => {
    setSlideIndex((prev) => {
      if (profiles.length === 0) return 0;
      const stored = readStoredActiveBabyId(currentGroupId);
      const storedIdx = stored ? profiles.findIndex((p) => p.id === stored) : -1;
      if (prev < profiles.length) {
        if (profiles[prev]) return prev;
      }
      if (prev >= profiles.length && canShowAddSlide) {
        return profiles.length; // 등록 슬롯 유지
      }
      if (storedIdx >= 0) return storedIdx;
      return 0;
    });
  }, [profiles, currentGroupId, canShowAddSlide]);

  useEffect(() => {
    if (!currentGroupId || !activeBabyId) return;
    storeActiveBabyId(currentGroupId, activeBabyId);
  }, [currentGroupId, activeBabyId]);

  // 그룹 전환 시 해당 그룹 캐시 복원
  useEffect(() => {
    setAiGuideCache(readAiGuideCache(currentGroupId));
    weeklyAiAttemptRef.current = {};
  }, [currentGroupId]);

  // 맵 변경 시 localStorage 저장
  useEffect(() => {
    writeAiGuideCache(currentGroupId, aiGuideCache);
  }, [currentGroupId, aiGuideCache]);

  // 삭제된 아이 키만 정리 — profiles 가 잠깐 비는 동안은 지우지 않음
  useEffect(() => {
    if (profiles.length === 0) return;
    const ids = new Set(profiles.map((p) => p.id));
    setAiGuideCache((prev) => {
      let changed = false;
      const next: AiGuideCacheMap = {};
      for (const [id, entry] of Object.entries(prev)) {
        if (ids.has(id)) next[id] = entry;
        else changed = true;
      }
      return changed ? next : prev;
    });
  }, [profiles]);

  const handleAiTextChange = useCallback(
    (text: string | null) => {
      if (!activeBabyId) return;
      setAiGuideCache((prev) => {
        // 생성 중 빈 문자열로 지우는 호출은 무시 — 이전 배너 유지
        if (text === '') return prev;
        if (text == null) {
          if (!(activeBabyId in prev)) return prev;
          const next = { ...prev };
          delete next[activeBabyId];
          return next;
        }
        // 동일 문구여도 수동 생성 완료 시각은 갱신 (주간 자동 갱신 기준)
        const prevEntry = prev[activeBabyId];
        if (prevEntry?.text === text && prevEntry.fetchedAt > Date.now() - 5_000) {
          return prev;
        }
        return {
          ...prev,
          [activeBabyId]: { text, fetchedAt: Date.now() },
        };
      });
    },
    [activeBabyId],
  );

  useEffect(() => {
    // 로그는 아이별로 다시 로드 — AI 배너(aiTextByBabyId)는 여기서 지우지 않음
    logsSigRef.current = '';
    setLogs([]);
    setPrenatalLogs([]);
  }, [activeBabyId]);

  useEffect(() => {
    if (!profile || !isPrenatal(profile)) return;
    let cancelled = false;
    void fetchPrenatalLogs().then((rows) => {
      if (!cancelled) setPrenatalLogs(rows);
    });
    return () => { cancelled = true; };
  }, [profile, fetchPrenatalLogs]);

  // API 키 있으면 주 1회(만료 시 앱 오픈) guide 자동 갱신 → 홈 배너 반영
  useEffect(() => {
    if (!profile || !currentGroupId || !hasApiKey) return;
    const babyId = profile.id;
    const entry = aiGuideCacheRef.current[babyId];
    if (entry && !isAiGuideStale(entry.fetchedAt)) return;
    if (weeklyAiAttemptRef.current[babyId]) return;
    weeklyAiAttemptRef.current[babyId] = true;

    const prenatal = isPrenatal(profile);
    let cancelled = false;
    let started = false;
    const timer = window.setTimeout(() => {
      if (cancelled) return;
      started = true;
      void (async () => {
        const text = await generateAiGuide('guide', profile, logsRef.current, null, {
          stream: false,
          lifePhase: prenatal ? 'prenatal' : 'postnatal',
        });
        if (cancelled) return;
        if (!text) {
          delete weeklyAiAttemptRef.current[babyId];
          return;
        }
        setAiGuideCache((prev) => ({
          ...prev,
          [babyId]: { text, fetchedAt: Date.now() },
        }));
      })();
    }, prenatal ? 400 : 900);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      if (!started) delete weeklyAiAttemptRef.current[babyId];
    };
    // logs는 타이머 시점 클로저로만 사용 (의존성 추가 시 반복 호출 방지)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- weekly once per baby while stale
  }, [profile?.id, currentGroupId, hasApiKey, generateAiGuide]);

  // 세로 스냅 페이지 높이 = 스크롤포트 실측 (화면 비율 유지 + 스크롤 가능)
  useEffect(() => {
    if (isMagnified) return;
    const el = verticalScrollRef.current;
    if (!el) return;
    const update = () => {
      const next = Math.round(el.clientHeight);
      setSnapPageHeight((prev) => (Math.abs(prev - next) < 2 ? prev : next));
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [isMagnified, onAddSlide, profile]);

  const goToSlide = useCallback(
    (index: number) => {
      const max = slideCount - 1;
      setSlideIndex(Math.max(0, Math.min(max, index)));
      setBabyLimitNotice(false);
    },
    [slideCount],
  );

  const { addLog, updateLog } = useBabyLogs({
    babyId: profile?.id ?? null,
    currentGroupId,
    userId,
    onLogsChange: handleLogsChange,
    limit: 120,
  });

  const tryOpenAddBaby = useCallback(() => {
    if (profiles.length >= BABY_PROFILE_MAX) {
      setBabyLimitNotice(true);
      return;
    }
    setBabyLimitNotice(false);
    setAddProfileOpen(true);
  }, [profiles.length]);

  const onBabyPointerDown = useCallback((e: React.PointerEvent) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    // 실제 버튼/입력만 제외 (카드 role=button 위에서도 가로 스와이프 허용)
    const target = e.target as HTMLElement | null;
    if (target?.closest('button, a, input, textarea, select')) {
      swipeStartRef.current = null;
      return;
    }
    suppressClickRef.current = false;
    swipeStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      id: e.pointerId,
      locked: null,
    };
  }, []);

  const onBabyPointerMove = useCallback((e: React.PointerEvent) => {
    const start = swipeStartRef.current;
    if (!start || start.id !== e.pointerId) return;
    const dx = e.clientX - start.x;
    const dy = e.clientY - start.y;
    if (start.locked == null && (Math.abs(dx) > 10 || Math.abs(dy) > 10)) {
      start.locked = Math.abs(dx) > Math.abs(dy) * 1.15 ? 'h' : 'v';
      if (start.locked === 'h') {
        try {
          (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
        } catch {
          /* ignore */
        }
      }
    }
    if (start.locked === 'h') {
      // 가로 제스처 중에는 세로 스크롤이 끼어들지 않게
      e.preventDefault();
    }
  }, []);

  const onBabyPointerUp = useCallback(
    (e: React.PointerEvent) => {
      const start = swipeStartRef.current;
      if (!start || start.id !== e.pointerId) return;
      swipeStartRef.current = null;
      if (slideCountRef.current < 2) return;
      const dx = e.clientX - start.x;
      const dy = e.clientY - start.y;
      const horizontal =
        start.locked === 'h' || (start.locked == null && Math.abs(dx) > Math.abs(dy) * 1.15);
      if (!horizontal) return;
      if (Math.abs(dx) < 36 || Math.abs(dx) <= Math.abs(dy) * 1.1) return;
      suppressClickRef.current = true;
      const idx = slideIndexRef.current;
      if (dx < 0) goToSlide(idx + 1);
      else goToSlide(idx - 1);
    },
    [goToSlide],
  );

  const onBabyPointerCancel = useCallback((e: React.PointerEvent) => {
    if (swipeStartRef.current?.id === e.pointerId) swipeStartRef.current = null;
  }, []);

  const onBabyClickCapture = useCallback((e: React.MouseEvent) => {
    if (!suppressClickRef.current) return;
    suppressClickRef.current = false;
    e.preventDefault();
    e.stopPropagation();
  }, []);

  // ---------------------------------------------------------------------------
  // 파생 상태
  // ---------------------------------------------------------------------------
  const recentStatus: BabyRecentStatus = useMemo(() => calcRecentStatus(logs), [logs]);

  // ---------------------------------------------------------------------------
  // 이벤트 핸들러
  // ---------------------------------------------------------------------------
  const handleCardClick = useCallback((logType: LogType) => {
    setLogModalType(logType);
    setLogModalOpen(true);
  }, []);

  const handleLogSave = useCallback(
    async (draft: Parameters<typeof addLog>[0]) => {
      await addLog(draft);
    },
    [addLog]
  );

  const handleBed = useCallback(async () => {
    if (!profile || !currentGroupId) return;
    const open = findCurrentOpenSleep(logs, new Date(), profile.usual_wake_time);
    if (open) return;
    await addLog({
      baby_id: profile.id,
      group_id: currentGroupId,
      log_type: 'sleep',
      logged_at: new Date().toISOString(),
      sleep_start_recorded: true,
      sleep_end_recorded: false,
    });
  }, [profile, currentGroupId, logs, addLog]);

  const handleWake = useCallback(async () => {
    if (!profile || !currentGroupId) return;
    const now = new Date();
    const open = findCurrentOpenSleep(logs, now, profile.usual_wake_time);
    if (open) {
      await updateLog(open.id, { sleep_end_at: now.toISOString(), sleep_end_recorded: true });
      return;
    }
    const bed = profile.usual_bedtime ? scheduledBedBefore(now, profile.usual_bedtime) : null;
    await addLog({
      baby_id: profile.id,
      group_id: currentGroupId,
      log_type: 'sleep',
      logged_at: (bed ?? new Date(now.getTime() - 60 * 60_000)).toISOString(),
      sleep_end_at: now.toISOString(),
      sleep_start_recorded: false,
      sleep_end_recorded: true,
    });
  }, [profile, currentGroupId, logs, addLog, updateLog]);

  // ---------------------------------------------------------------------------
  // 렌더
  // ---------------------------------------------------------------------------

  const growthNavigator = profile ? (
    <React.Suspense fallback={<div className="flex-1 flex items-center justify-center text-xs text-gray-400">{t.loading}</div>}>
      <BabyGrowthNavigator
        profile={profile}
        logs={logs}
        currentGroupId={currentGroupId}
        userId={userId}
        t={t}
        onAddLog={addLog}
        aiText={aiText}
        onAiTextChange={handleAiTextChange}
      />
    </React.Suspense>
  ) : null;

  if (isMagnified && growthNavigator) {
    return growthNavigator;
  }

  const snapPageStyle =
    snapPageHeight > 0
      ? ({ height: snapPageHeight, minHeight: snapPageHeight } as const)
      : undefined;

  const guideBrief = aiText ? getGuideBrief(aiText) : '';

  // 대시보드 위젯 뷰 — 가로: 아이 / 등록 슬롯, 세로 스냅: 카드→사진
  return (
    <div
      className="relative h-full w-full overflow-hidden rounded-2xl bg-[#fff8f4] text-gray-800"
      style={{ touchAction: 'pan-y' }}
      onPointerDown={onBabyPointerDown}
      onPointerMove={onBabyPointerMove}
      onPointerUp={onBabyPointerUp}
      onPointerCancel={onBabyPointerCancel}
      onClickCapture={onBabyClickCapture}
    >
      <BabyWidgetBackdrop />
      <div
        ref={verticalScrollRef}
        className="relative h-full snap-y snap-mandatory overflow-y-auto overflow-x-hidden overscroll-y-contain"
        style={{ WebkitOverflowScrolling: 'touch', touchAction: 'pan-y' }}
      >
      {onAddSlide || !profile ? (
        <div
          className="relative z-20 flex h-full min-h-48 flex-col items-center justify-center gap-3 px-4 text-center"
          style={snapPageStyle}
        >
          <span className="text-4xl">🍼</span>
          <p className="text-sm text-gray-500">{t.no_baby_profile}</p>
          <div className="flex flex-wrap items-center justify-center gap-2">
            <button
              onClick={() => { setAddAsPrenatal(true); tryOpenAddBaby(); }}
              className="rounded-full bg-rose-100 px-5 py-2 text-sm font-semibold text-rose-600 transition-colors hover:bg-rose-200"
            >
              {t.prenatal_register}
            </button>
            <button
              onClick={() => { setAddAsPrenatal(false); tryOpenAddBaby(); }}
              className="rounded-full bg-pink-500 px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-pink-600"
            >
              {t.postnatal_register}
            </button>
          </div>
          {babyLimitNotice && (
            <p className="max-w-xs text-xs leading-relaxed text-rose-500">{t.baby_limit_reached}</p>
          )}
        </div>
      ) : (
        <>
          <section
            className="relative z-[1] flex h-full min-h-0 snap-start snap-always flex-col overflow-hidden px-2 pt-2 pb-2"
            style={snapPageStyle}
          >
            <BabyWidgetStickers />
            <div className="relative z-20 shrink-0">
              <BabyProfileCard
                profile={profile}
                t={t}
                onEditClick={() => setEditProfileOpen(true)}
                onReportClick={() => setDetailOpen(true)}
                onBirthClick={isPrenatal(profile) ? () => setBirthModalOpen(true) : undefined}
              />
              {guideBrief ? <AiGuideBriefingBanner text={guideBrief} /> : null}
            </div>
            <div className="relative z-[1] mt-1.5 min-h-0 flex-1">
              {isPrenatal(profile) ? (
                <PrenatalStatusCards
                  weeksPregnant={
                    profile.due_date
                      ? gestationalProgress(profile.due_date).weeksPregnant
                      : 0
                  }
                  logs={prenatalLogs}
                  t={t}
                  fillHeight
                  onCardClick={(lt) => {
                    setPrenatalModalType(lt);
                    setPrenatalModalOpen(true);
                  }}
                />
              ) : (
                <QuickStatusCards
                  status={recentStatus}
                  profile={profile}
                  logs={logs}
                  t={t}
                  fillHeight
                  onCardClick={handleCardClick}
                  onBed={() => { void handleBed(); }}
                  onWake={() => { void handleWake(); }}
                />
              )}
            </div>
          </section>
          <section
            className="relative z-[1] flex h-full min-h-0 snap-start snap-always flex-col gap-1.5 overflow-hidden px-2 pt-2 pb-3"
            style={snapPageStyle}
          >
            <div className="min-h-0 flex-1">
              <TodayPhotoSlider
                babyId={profile.id}
                currentGroupId={currentGroupId}
                birthDate={profile.birth_date}
                t={t}
                fillHeight
                onOpen={() => setAlbumOpen(true)}
              />
            </div>
          </section>
        </>
      )}
      </div>

      {/* 로그 입력 모달 */}
      {logModalOpen && profile && (
        <QuickLogModal
          isOpen={logModalOpen}
          defaultLogType={logModalType}
          babyId={profile.id}
          currentGroupId={currentGroupId ?? ''}
          t={t}
          onBed={handleBed}
          onWake={handleWake}
          onSave={handleLogSave}
          onClose={() => setLogModalOpen(false)}
        />
      )}

      {prenatalModalOpen && profile && isPrenatal(profile) && (
        <PrenatalQuickLogModal
          key={prenatalModalType}
          isOpen={prenatalModalOpen}
          defaultType={prenatalModalType}
          babyId={profile.id}
          currentGroupId={currentGroupId ?? ''}
          weeksPregnant={
            profile.due_date ? gestationalProgress(profile.due_date).weeksPregnant : 0
          }
          t={t}
          onSave={async (draft) => {
            const row = await addPrenatalLog(draft);
            if (row) setPrenatalLogs((prev) => [row, ...prev]);
          }}
          onClose={() => setPrenatalModalOpen(false)}
        />
      )}

      {birthModalOpen && profile && isPrenatal(profile) && (
        <BirthTransitionModal
          profile={profile}
          t={t}
          onSubmit={async (input) => {
            await completeBirth(input);
            setBirthModalOpen(false);
          }}
          onClose={() => setBirthModalOpen(false)}
        />
      )}

      {/* 아기 등록 모달 (간단 인라인) */}
      {addProfileOpen && (
        <AddBabyModal
          t={t}
          currentGroupId={currentGroupId ?? ''}
          lang={lang}
          prenatalMode={addAsPrenatal}
          onSave={async (draft) => {
            try {
              const created = await addProfile({ ...draft, group_id: currentGroupId ?? '' });
              setAddProfileOpen(false);
              setBabyLimitNotice(false);
              storeActiveBabyId(currentGroupId, created.id);
              // 추가 직전 길이 = 새 아이 인덱스 (profiles state는 다음 렌더에 반영)
              setSlideIndex(profiles.length);
            } catch (err) {
              if (err instanceof Error && err.message === 'BABY_PROFILE_LIMIT') {
                setAddProfileOpen(false);
                setBabyLimitNotice(true);
                return;
              }
              throw err;
            }
          }}
          onClose={() => setAddProfileOpen(false)}
        />
      )}

      {/* 프로필 수정 모달 */}
      {editProfileOpen && profile && (
        <AddBabyModal
          t={t}
          currentGroupId={currentGroupId ?? ''}
          lang={lang}
          initial={profile}
          onSave={async (draft) => {
            await updateProfile(profile.id, { ...draft, group_id: currentGroupId ?? '' });
            setEditProfileOpen(false);
          }}
          onDelete={async () => {
            await deleteProfile(profile.id);
            setEditProfileOpen(false);
          }}
          onClose={() => setEditProfileOpen(false)}
        />
      )}

      {detailOpen && profile && createPortal(
        <div className="fixed inset-0 z-[9999] bg-white dark:bg-gray-950 flex flex-col">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-800">
            <h2 className="text-sm font-bold">
              {isPrenatal(profile) ? t.prenatal_widget_title : t.widget_title}
            </h2>
            <button type="button" onClick={() => setDetailOpen(false)} className="text-sm text-gray-500">{t.close}</button>
          </div>
          <div className="flex-1 min-h-0 overflow-hidden">
            {growthNavigator}
          </div>
        </div>,
        document.body,
      )}

      {albumOpen && profile && createPortal(
        <div className="fixed inset-0 z-[9999] bg-white dark:bg-gray-950 flex flex-col">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-800">
            <h2 className="text-sm font-bold">
              {isPrenatal(profile) ? t.prenatal_album_title : t.album_title}
            </h2>
            <button type="button" onClick={() => setAlbumOpen(false)} className="text-sm text-gray-500">{t.close}</button>
          </div>
          <div className="flex-1 min-h-0 overflow-hidden">
            <BabyAlbumView
              babyId={profile.id}
              currentGroupId={currentGroupId}
              birthDate={profile.birth_date}
              t={t}
            />
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
});

// ---------------------------------------------------------------------------
// AddBabyModal — 아기 프로필 등록/수정 인라인 모달
// ---------------------------------------------------------------------------
interface AddBabyModalProps {
  t: ReturnType<typeof getBabyGrowthTranslations>;
  currentGroupId: string;
  lang: LangCode;
  initial?: BabyProfile;
  /** 신규 등록 시 임신 중 모드 */
  prenatalMode?: boolean;
  onSave: (draft: Omit<BabyProfileDraft, 'group_id'> & { group_id?: string }) => Promise<void>;
  onDelete?: () => Promise<void>;
  onClose: () => void;
}

function AddBabyModal({
  t, currentGroupId: _groupId, lang, initial, prenatalMode = false, onSave, onDelete, onClose,
}: AddBabyModalProps) {
  const editingPrenatal = initial ? isPrenatal(initial) : prenatalMode;
  const [name, setName] = useState(initial?.name ?? '');
  const [birthDate, setBirthDate] = useState(initial?.birth_date ?? '');
  const [dueDate, setDueDate] = useState(initial?.due_date ?? '');
  const [birthTime, setBirthTime] = useState(initial?.birth_time?.slice(0, 5) ?? '');
  const [birthPlace, setBirthPlace] = useState(initial?.birth_place ?? '');
  const [fetalName, setFetalName] = useState(
    initial?.fetal_name
      ?? (initial && !initial.birth_date ? (initial.name ?? '') : '')
      ?? '',
  )
  const [birthWeight, setBirthWeight] = useState(
    initial?.birth_weight_kg != null ? String(initial.birth_weight_kg) : '',
  );
  const [birthHeight, setBirthHeight] = useState(
    initial?.birth_height_cm != null ? String(initial.birth_height_cm) : '',
  );
  const [birthHead, setBirthHead] = useState(
    initial?.birth_head_cm != null ? String(initial.birth_head_cm) : '',
  );
  const [gestationalWeeks, setGestationalWeeks] = useState(
    initial?.gestational_weeks != null ? String(initial.gestational_weeks) : '',
  );
  const [bloodType, setBloodType] = useState<BabyBloodType | ''>(initial?.blood_type ?? '');
  const [gender, setGender] = useState<'male' | 'female' | 'other'>(initial?.gender ?? 'female');
  const [countryCode, setCountryCode] = useState(initial?.country_code ?? 'KR');
  const [usualBedtime, setUsualBedtime] = useState(initial?.usual_bedtime?.slice(0, 5) ?? '');
  const [usualWake, setUsualWake] = useState(initial?.usual_wake_time?.slice(0, 5) ?? '');
  const [countrySearch, setCountrySearch] = useState('');
  const [countryOpen, setCountryOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const countryDropdownRef = useRef<HTMLDivElement>(null);

  // 드롭다운 외부 클릭 시 닫기
  useEffect(() => {
    if (!countryOpen) return;
    const handler = (e: MouseEvent) => {
      if (countryDropdownRef.current && !countryDropdownRef.current.contains(e.target as Node)) {
        setCountryOpen(false);
        setCountrySearch('');
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [countryOpen]);

  const allCountries = useMemo(() => getCountryOptions(lang), [lang]);
  const filteredCountries = useMemo(() => {
    const q = countrySearch.trim().toLowerCase();
    if (!q) return allCountries;
    return allCountries.filter(
      ({ code, label }) =>
        code.toLowerCase().includes(q) || label.toLowerCase().includes(q)
    );
  }, [allCountries, countrySearch]);

  const selectedLabel = useMemo(
    () => allCountries.find((c) => c.code === countryCode)?.label ?? countryCode,
    [allCountries, countryCode]
  );

  const handleSave = async () => {
    const fetal = fetalName.trim();
    const displayName = editingPrenatal ? fetal : (name.trim() || fetal);
    if (editingPrenatal) {
      if (!fetal || !dueDate) return;
    } else if (!displayName || !birthDate) {
      return;
    }
    setSaving(true);
    try {
      await onSave({
        name: displayName,
        birth_date: editingPrenatal ? null : birthDate,
        due_date: editingPrenatal ? dueDate : (dueDate || null),
        birth_time: editingPrenatal ? null : (birthTime || null),
        birth_place: editingPrenatal ? null : (birthPlace.trim() || null),
        fetal_name: editingPrenatal ? fetal : (fetal || null),
        birth_weight_kg: editingPrenatal ? null : asFiniteNumber(birthWeight),
        birth_height_cm: editingPrenatal ? null : asFiniteNumber(birthHeight),
        birth_head_cm: editingPrenatal ? null : asFiniteNumber(birthHead),
        gestational_weeks: editingPrenatal ? null : asFiniteNumber(gestationalWeeks),
        blood_type: editingPrenatal ? null : (bloodType || null),
        birth_source: initial?.birth_source === 'birth_event' ? 'birth_event' : 'manual',
        gender,
        country_code: countryCode,
        usual_bedtime: editingPrenatal ? null : (usualBedtime || null),
        usual_wake_time: editingPrenatal ? null : (usualWake || null),
      });
    } catch (err) {
      console.error('[AddBabyModal] 저장 오류:', err);
    } finally {
      setSaving(false);
    }
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center bg-black/40"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="flex max-h-[90dvh] w-full flex-col rounded-t-2xl bg-white pb-safe shadow-2xl dark:bg-gray-900 sm:w-96 sm:rounded-2xl">
        <div className="flex items-center justify-between border-b border-gray-100 px-5 pb-2 pt-4 dark:border-gray-800">
          <h2 className="text-base font-bold">
            {initial ? t.edit_baby : editingPrenatal ? t.prenatal_register : t.postnatal_register}
          </h2>
          <button onClick={onClose} className="text-xl text-gray-400 hover:text-gray-600">×</button>
        </div>

        <div className="space-y-3 overflow-y-auto px-5 py-4">
          {editingPrenatal ? (
            <div className="space-y-1">
              <label className="block text-xs font-medium text-gray-500">{t.fetal_name}</label>
              <input
                type="text"
                value={fetalName}
                onChange={(e) => setFetalName(e.target.value)}
                placeholder={t.fetal_name_placeholder}
                className="w-full text-sm rounded-lg border border-gray-200 dark:border-gray-700 dark:bg-gray-800 px-3 py-2"
              />
            </div>
          ) : (
            <div className="space-y-1">
              <label className="block text-xs font-medium text-gray-500">{t.baby_name}</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full text-sm rounded-lg border border-gray-200 dark:border-gray-700 dark:bg-gray-800 px-3 py-2"
              />
            </div>
          )}

          {editingPrenatal ? (
            <div className="space-y-1">
              <label className="block text-xs font-medium text-gray-500">{t.due_date}</label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full text-sm rounded-lg border border-gray-200 dark:border-gray-700 dark:bg-gray-800 px-3 py-2"
              />
            </div>
          ) : (
            <div className="space-y-1">
              <label className="block text-xs font-medium text-gray-500">{t.birth_date}</label>
              <input
                type="date"
                value={birthDate}
                onChange={(e) => setBirthDate(e.target.value)}
                className="w-full text-sm rounded-lg border border-gray-200 dark:border-gray-700 dark:bg-gray-800 px-3 py-2"
              />
            </div>
          )}

          {!editingPrenatal && initial?.due_date ? (
            <div className="space-y-1">
              <label className="block text-xs font-medium text-gray-500">{t.due_date}</label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full text-sm rounded-lg border border-gray-200 dark:border-gray-700 dark:bg-gray-800 px-3 py-2"
              />
            </div>
          ) : null}

          {!editingPrenatal ? (
            <>
              <p className="pt-1 text-xs font-semibold text-gray-600 dark:text-gray-300">{t.birth_info}</p>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label className="block text-xs font-medium text-gray-500">{t.birth_time}</label>
                  <input
                    type="time"
                    value={birthTime}
                    onChange={(e) => setBirthTime(e.target.value)}
                    className="w-full text-sm rounded-lg border border-gray-200 dark:border-gray-700 dark:bg-gray-800 px-3 py-2"
                  />
                </div>
                <div className="space-y-1">
                  <label className="block text-xs font-medium text-gray-500">{t.blood_type}</label>
                  <select
                    value={bloodType}
                    onChange={(e) => setBloodType((e.target.value || '') as BabyBloodType | '')}
                    className="w-full text-sm rounded-lg border border-gray-200 dark:border-gray-700 dark:bg-gray-800 px-3 py-2"
                  >
                    <option value="">{t.blood_type_unset}</option>
                    {BABY_BLOOD_TYPES.map((bt) => (
                      <option key={bt} value={bt}>{bt}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-medium text-gray-500">{t.fetal_name}</label>
                <input
                  type="text"
                  value={fetalName}
                  onChange={(e) => setFetalName(e.target.value)}
                  placeholder={t.fetal_name_placeholder}
                  className="w-full text-sm rounded-lg border border-gray-200 dark:border-gray-700 dark:bg-gray-800 px-3 py-2"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-medium text-gray-500">{t.birth_place}</label>
                <input
                  type="text"
                  value={birthPlace}
                  onChange={(e) => setBirthPlace(e.target.value)}
                  placeholder={t.birth_place_placeholder}
                  className="w-full text-sm rounded-lg border border-gray-200 dark:border-gray-700 dark:bg-gray-800 px-3 py-2"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label className="block text-xs font-medium text-gray-500">{t.birth_weight_kg}</label>
                  <input
                    type="number"
                    inputMode="decimal"
                    step="0.01"
                    min="0"
                    value={birthWeight}
                    onChange={(e) => setBirthWeight(e.target.value)}
                    placeholder="ex) 3.2"
                    className="w-full text-sm rounded-lg border border-gray-200 dark:border-gray-700 dark:bg-gray-800 px-3 py-2"
                  />
                </div>
                <div className="space-y-1">
                  <label className="block text-xs font-medium text-gray-500">{t.birth_height_cm}</label>
                  <input
                    type="number"
                    inputMode="decimal"
                    step="0.1"
                    min="0"
                    value={birthHeight}
                    onChange={(e) => setBirthHeight(e.target.value)}
                    placeholder="ex) 49"
                    className="w-full text-sm rounded-lg border border-gray-200 dark:border-gray-700 dark:bg-gray-800 px-3 py-2"
                  />
                </div>
                <div className="space-y-1">
                  <label className="block text-xs font-medium text-gray-500">{t.birth_head_cm}</label>
                  <input
                    type="number"
                    inputMode="decimal"
                    step="0.1"
                    min="0"
                    value={birthHead}
                    onChange={(e) => setBirthHead(e.target.value)}
                    placeholder="ex) 34"
                    className="w-full text-sm rounded-lg border border-gray-200 dark:border-gray-700 dark:bg-gray-800 px-3 py-2"
                  />
                </div>
                <div className="space-y-1">
                  <label className="block text-xs font-medium text-gray-500">{t.gestational_weeks}</label>
                  <input
                    type="number"
                    inputMode="decimal"
                    step="0.1"
                    min="0"
                    max="45"
                    value={gestationalWeeks}
                    onChange={(e) => setGestationalWeeks(e.target.value)}
                    placeholder="ex) 38"
                    className="w-full text-sm rounded-lg border border-gray-200 dark:border-gray-700 dark:bg-gray-800 px-3 py-2"
                  />
                </div>
              </div>
            </>
          ) : null}

          <div className="space-y-1">
            <label className="block text-xs font-medium text-gray-500">{t.gender}</label>
            <div className="flex gap-2">
              {(['male', 'female', 'other'] as const).map((g) => (
                <button
                  key={g}
                  onClick={() => setGender(g)}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    gender === g
                      ? 'bg-pink-500 text-white'
                      : 'bg-gray-100 dark:bg-gray-800 text-gray-600'
                  }`}
                >
                  {t[`gender_${g}` as keyof typeof t] as string}
                </button>
              ))}
            </div>
          </div>

          {!editingPrenatal ? (
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <label className="block text-xs font-medium text-gray-500">{t.usual_bedtime}</label>
                <input
                  type="time"
                  value={usualBedtime}
                  onChange={(e) => setUsualBedtime(e.target.value)}
                  className="w-full text-sm rounded-lg border border-gray-200 dark:border-gray-700 dark:bg-gray-800 px-3 py-2"
                />
              </div>
              <div className="space-y-1">
                <label className="block text-xs font-medium text-gray-500">{t.usual_wake_time}</label>
                <input
                  type="time"
                  value={usualWake}
                  onChange={(e) => setUsualWake(e.target.value)}
                  className="w-full text-sm rounded-lg border border-gray-200 dark:border-gray-700 dark:bg-gray-800 px-3 py-2"
                />
              </div>
            </div>
          ) : null}

          <div className="space-y-1">
            <label className="block text-xs font-medium text-gray-500">{t.country_code}</label>
            <div className="relative" ref={countryDropdownRef}>
              {/* 선택 버튼 */}
              <button
                type="button"
                onClick={() => setCountryOpen((o) => !o)}
                className="w-full flex items-center justify-between text-sm rounded-lg border border-gray-200 dark:border-gray-700 dark:bg-gray-800 px-3 py-2 text-left"
              >
                <span>{countryCode} {selectedLabel}</span>
                <span className="text-gray-400 ml-2">{countryOpen ? '▲' : '▼'}</span>
              </button>

              {/* 드롭다운 패널 */}
              {countryOpen && (
                <div className="absolute z-10 mt-1 w-full bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg overflow-hidden">
                  {/* 검색 인풋 */}
                  <div className="px-3 py-2 border-b border-gray-100 dark:border-gray-800">
                    <input
                      autoFocus
                      type="text"
                      value={countrySearch}
                      onChange={(e) => setCountrySearch(e.target.value)}
                      placeholder={`🔍 ${t.country_search_placeholder}`}
                      className="w-full text-sm bg-gray-50 dark:bg-gray-800 rounded-lg px-3 py-1.5 outline-none border border-gray-200 dark:border-gray-700"
                    />
                  </div>
                  {/* 국가 목록 */}
                  <ul className="max-h-48 overflow-y-auto">
                    {filteredCountries.length === 0 ? (
                      <li className="px-4 py-3 text-xs text-gray-400 text-center">{t.country_search_empty}</li>
                    ) : (
                      filteredCountries.map(({ code, label }) => (
                        <li key={code}>
                          <button
                            type="button"
                            onClick={() => {
                              setCountryCode(code);
                              setCountryOpen(false);
                              setCountrySearch('');
                            }}
                            className={`w-full text-left px-4 py-2 text-sm hover:bg-pink-50 dark:hover:bg-pink-900/20 transition-colors ${
                              countryCode === code ? 'bg-pink-50 dark:bg-pink-900/20 font-semibold text-pink-600 dark:text-pink-400' : ''
                            }`}
                          >
                            {code} {label}
                          </button>
                        </li>
                      ))
                    )}
                  </ul>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="px-5 py-3 border-t border-gray-100 dark:border-gray-800 flex gap-2">
          {onDelete && (
            <button
              onClick={onDelete}
              className="flex-none px-4 py-2 rounded-xl bg-red-50 dark:bg-red-900/20 text-red-500 text-sm font-medium hover:bg-red-100 transition-colors"
            >
              {t.delete}
            </button>
          )}
          <button
            onClick={handleSave}
            disabled={
              saving ||
              (editingPrenatal
                ? !fetalName.trim() || !dueDate
                : !(name.trim() || fetalName.trim()) || !birthDate)
            }
            className="flex-1 bg-pink-500 hover:bg-pink-600 disabled:opacity-60 text-white font-semibold py-2 rounded-xl transition-colors text-sm"
          >
            {saving ? '...' : t.save}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
