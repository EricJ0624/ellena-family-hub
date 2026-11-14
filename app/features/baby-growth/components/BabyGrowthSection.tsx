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
import { useBabyGrowth } from '../hooks/useBabyGrowth';
import { useBabyLogs, calcRecentStatus } from '../hooks/useBabyLogs';
import { BabyProfileCard } from './BabyProfileCard';
import { QuickStatusCards } from './QuickStatusCards';
import { QuickLogModal } from './QuickLogModal';
import { TodayPhotoSlider } from './TodayPhotoSlider';
import { BabyAlbumView } from './BabyAlbumView';
import { BabyWidgetBackdrop, BabyWidgetStickers } from './BabyWidgetBackdrop';
import { findCurrentOpenSleep, scheduledBedBefore } from '../utils/sleep-schedule';

// lazy import — 대시보드 초기 로드 성능 보호
const BabyGrowthNavigator = React.lazy(
  () => import('./BabyGrowthNavigator').then((m) => ({ default: m.BabyGrowthNavigator }))
);

// ---------------------------------------------------------------------------
// 로그 시그니처 비교 (재렌더 최소화)
// ---------------------------------------------------------------------------
function logsSignature(logs: BabyDailyLog[]): string {
  if (logs.length === 0) return 'empty';
  return logs
    .slice(0, 10)
    .map((l) => `${l.id}:${l.logged_at}:${l.sleep_end_at ?? ''}:${l.notes ?? ''}`)
    .join('|');
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
  const [profile, setProfile] = useState<BabyProfile | null>(null);
  const [logs, setLogs] = useState<BabyDailyLog[]>([]);
  const [logModalOpen, setLogModalOpen] = useState(false);
  const [logModalType, setLogModalType] = useState<LogType>('feeding');
  const [addProfileOpen, setAddProfileOpen] = useState(false);
  const [editProfileOpen, setEditProfileOpen] = useState(false);
  const [aiText, setAiText] = useState<string | null>(null);
  const [albumOpen, setAlbumOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);

  // 로그 시그니처 ref — 동일 내용 setState 방지
  const logsSigRef = useRef<string>('');

  // ---------------------------------------------------------------------------
  // 콜백 (안정 참조 보장)
  // ---------------------------------------------------------------------------
  const handleProfileChange = useCallback((p: BabyProfile | null) => {
    setProfile(p);
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
    onProfileChange: handleProfileChange,
  });

  const { addLog, updateLog } = useBabyLogs({
    babyId: profile?.id ?? null,
    currentGroupId,
    userId,
    onLogsChange: handleLogsChange,
  });

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

  // 대시보드 위젯 뷰
  return (
    <div className="relative h-full w-full overflow-hidden rounded-2xl bg-[#fff8f4] text-gray-800">
      <div className="relative h-full overflow-y-auto overflow-x-hidden px-2 pt-2 pb-3">
      <BabyWidgetBackdrop />
      <BabyWidgetStickers />
      <div className="relative space-y-2">
      {/* 프로필 없을 때 */}
      {!profile ? (
        <div className="relative z-20 flex min-h-48 flex-col items-center justify-center gap-3 px-4 text-center">
          <span className="text-4xl">🍼</span>
          <p className="text-sm text-gray-500">{t.no_baby_profile}</p>
          <button
            onClick={() => setAddProfileOpen(true)}
            className="rounded-full bg-pink-500 px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-pink-600"
          >
            {t.add_baby}
          </button>
        </div>
      ) : (
        <>
          <BabyProfileCard
            profile={profile}
            t={t}
            onEditClick={() => setEditProfileOpen(true)}
            onReportClick={() => setDetailOpen(true)}
          />
          {/* AI 브리핑 배너 */}
          {aiText && (
            <div className="relative z-20 line-clamp-2 rounded-xl bg-blue-50 px-3 py-2 text-xs leading-relaxed text-blue-700 dark:bg-blue-900/20 dark:text-blue-300">
              🤖 {aiText}
            </div>
          )}

          {/* 퀵 상태 카드 */}
          <QuickStatusCards
            status={recentStatus}
            profile={profile}
            logs={logs}
            t={t}
            onCardClick={handleCardClick}
            onBed={() => { void handleBed(); }}
            onWake={() => { void handleWake(); }}
          />

          {/* 오늘의 포토 슬라이드 */}
          <TodayPhotoSlider
            babyId={profile.id}
            currentGroupId={currentGroupId}
            birthDate={profile.birth_date}
            t={t}
            onOpen={() => setAlbumOpen(true)}
          />
        </>
      )}
      </div>
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
            await addProfile({ ...draft, group_id: currentGroupId ?? '' });
            setAddProfileOpen(false);
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
              userId={userId}
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
                      placeholder="🔍 국가 검색..."
                      className="w-full text-sm bg-gray-50 dark:bg-gray-800 rounded-lg px-3 py-1.5 outline-none border border-gray-200 dark:border-gray-700"
                    />
                  </div>
                  {/* 국가 목록 */}
                  <ul className="max-h-48 overflow-y-auto">
                    {filteredCountries.length === 0 ? (
                      <li className="px-4 py-3 text-xs text-gray-400 text-center">검색 결과 없음</li>
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
