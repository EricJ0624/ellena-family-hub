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
import type { BabyProfile, BabyDailyLog, BabyRecentStatus, LogType } from '../types';
import { BABY_PROFILE_MAX, useBabyGrowth } from '../hooks/useBabyGrowth';
import { useBabyLogs, calcRecentStatus } from '../hooks/useBabyLogs';
import { BabyProfileCard } from './BabyProfileCard';
import { QuickStatusCards } from './QuickStatusCards';
import { QuickLogModal } from './QuickLogModal';
import { TodayPhotoSlider } from './TodayPhotoSlider';
import { BabyAlbumView } from './BabyAlbumView';
import { BabyWidgetBackdrop, BabyWidgetStickers } from './BabyWidgetBackdrop';
import { AiGuideBriefingBanner } from './AiGuideBriefingBanner';
import { getGuideBrief } from '../utils/parse-guide-brief';
import { findCurrentOpenSleep, scheduledBedBefore } from '../utils/sleep-schedule';

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
  const [addProfileOpen, setAddProfileOpen] = useState(false);
  const [editProfileOpen, setEditProfileOpen] = useState(false);
  const [babyLimitNotice, setBabyLimitNotice] = useState(false);
  const [aiText, setAiText] = useState<string | null>(null);
  const [albumOpen, setAlbumOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);

  // 로그 시그니처 ref — 동일 내용 setState 방지
  const logsSigRef = useRef<string>('');
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

  useEffect(() => {
    setAiText(null);
    logsSigRef.current = '';
    setLogs([]);
  }, [activeBabyId]);

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
        onAiTextChange={setAiText}
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
          <button
            onClick={tryOpenAddBaby}
            className="rounded-full bg-pink-500 px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-pink-600"
          >
            {t.add_baby}
          </button>
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
              />
              {guideBrief ? <AiGuideBriefingBanner text={guideBrief} /> : null}
            </div>
            <div className="relative z-[1] mt-1.5 min-h-0 flex-1">
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

      {/* 아기 등록 모달 (간단 인라인) */}
      {addProfileOpen && (
        <AddBabyModal
          t={t}
          currentGroupId={currentGroupId ?? ''}
          lang={lang}
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
            <h2 className="text-sm font-bold">{t.widget_title}</h2>
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
            <h2 className="text-sm font-bold">{t.album_title}</h2>
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
  onSave: (draft: { name: string; birth_date: string; gender?: 'male' | 'female' | 'other'; country_code?: string; usual_bedtime?: string | null; usual_wake_time?: string | null }) => Promise<void>;
  onDelete?: () => Promise<void>;
  onClose: () => void;
}

function AddBabyModal({ t, currentGroupId: _groupId, lang, initial, onSave, onDelete, onClose }: AddBabyModalProps) {
  const [name, setName] = useState(initial?.name ?? '');
  const [birthDate, setBirthDate] = useState(initial?.birth_date ?? '');
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
    if (!name.trim() || !birthDate) return;
    setSaving(true);
    try {
      await onSave({
        name: name.trim(),
        birth_date: birthDate,
        gender,
        country_code: countryCode,
        usual_bedtime: usualBedtime || null,
        usual_wake_time: usualWake || null,
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
      <div className="w-full sm:w-96 bg-white dark:bg-gray-900 rounded-t-2xl sm:rounded-2xl shadow-2xl pb-safe">
        <div className="flex items-center justify-between px-5 pt-4 pb-2 border-b border-gray-100 dark:border-gray-800">
          <h2 className="text-base font-bold">{initial ? t.edit_baby : t.add_baby}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">×</button>
        </div>

        <div className="px-5 py-4 space-y-3">
          <div className="space-y-1">
            <label className="block text-xs font-medium text-gray-500">{t.baby_name}</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full text-sm rounded-lg border border-gray-200 dark:border-gray-700 dark:bg-gray-800 px-3 py-2"
            />
          </div>

          <div className="space-y-1">
            <label className="block text-xs font-medium text-gray-500">{t.birth_date}</label>
            <input
              type="date"
              value={birthDate}
              onChange={(e) => setBirthDate(e.target.value)}
              className="w-full text-sm rounded-lg border border-gray-200 dark:border-gray-700 dark:bg-gray-800 px-3 py-2"
            />
          </div>

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
            disabled={saving || !name.trim() || !birthDate}
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
