'use client';

import React, { useState } from 'react';
import type {
  BabyProfile,
  BabyDailyLog,
  BabyDailyLogDraft,
  BabyGrowthRecord,
  PrenatalLog,
  PrenatalLogType,
} from '../types';
import type { BabyGrowthTranslations } from '@/lib/translations/baby-growth';
import { MedicalReportView } from './MedicalReportView';
import { GrowthChartView } from './GrowthChartView';
import { BabyAlbumView } from './BabyAlbumView';
import { VaccinationSchedule } from './VaccinationSchedule';
import { AiGuidePanel } from './AiGuidePanel';
import { DailyLogStats } from './DailyLogStats';
import { CheckupView } from './CheckupView';
import { ReminderBanner } from './ReminderBanner';
import { PrenatalTimelineView } from './PrenatalTimelineView';
import { PrenatalStatusCards } from './PrenatalStatusCards';
import { PrenatalQuickLogModal } from './PrenatalQuickLogModal';
import { useBabyGrowthRecords } from '../hooks/useBabyGrowthRecords';
import { useBabyReminders } from '../hooks/useBabyReminders';
import { usePrenatalLogs } from '../hooks/usePrenatalLogs';
import { displayBabyName, gestationalProgress, isPrenatal } from '../utils/prenatal';

type TabKey = 'home' | 'growth' | 'health' | 'album' | 'vaccine' | 'ai' | 'timeline';

const POSTNATAL_TABS: { key: TabKey; emoji: string; labelKey: keyof BabyGrowthTranslations | null; labelFallback: string }[] = [
  { key: 'home',    emoji: '🏠', labelKey: null, labelFallback: '홈' },
  { key: 'growth',  emoji: '📈', labelKey: null, labelFallback: '성장' },
  { key: 'health',  emoji: '🏥', labelKey: null, labelFallback: '건강' },
  { key: 'album',   emoji: '📷', labelKey: null, labelFallback: '앨범' },
  { key: 'vaccine', emoji: '💉', labelKey: 'nav_vaccine', labelFallback: '예방접종' },
  { key: 'timeline', emoji: '📔', labelKey: 'nav_prenatal_timeline', labelFallback: '임신기록' },
  { key: 'ai',      emoji: '🤖', labelKey: null, labelFallback: 'AI' },
];

const PRENATAL_TABS: typeof POSTNATAL_TABS = [
  { key: 'home', emoji: '🏠', labelKey: null, labelFallback: '홈' },
  { key: 'timeline', emoji: '📔', labelKey: 'nav_prenatal_timeline', labelFallback: '임신기록' },
  { key: 'album', emoji: '📷', labelKey: 'prenatal_album_title', labelFallback: '태아사진' },
  { key: 'ai', emoji: '🤖', labelKey: null, labelFallback: 'AI' },
];

const REMINDER_TAB_MAP: Record<string, TabKey> = {
  growth_record: 'growth',
  checkup: 'health',
  vaccination: 'vaccine',
};

interface BabyGrowthNavigatorProps {
  profile: BabyProfile;
  logs: BabyDailyLog[];
  currentGroupId: string | null;
  userId: string;
  t: BabyGrowthTranslations;
  onAddLog?: (draft: BabyDailyLogDraft) => Promise<unknown>;
  aiText: string | null;
  onAiTextChange: (text: string | null) => void;
}

export function BabyGrowthNavigator({
  profile,
  logs,
  currentGroupId,
  userId,
  t,
  onAddLog,
  aiText,
  onAiTextChange,
}: BabyGrowthNavigatorProps) {
  const prenatal = isPrenatal(profile);
  const tabs = prenatal ? PRENATAL_TABS : POSTNATAL_TABS;
  const [activeTab, setActiveTab] = useState<TabKey>('home');

  React.useEffect(() => {
    const allowed = prenatal ? PRENATAL_TABS : POSTNATAL_TABS;
    if (!allowed.some((tab) => tab.key === activeTab)) setActiveTab('home');
  }, [activeTab, prenatal]);

  const { fetchGrowthRecords } = useBabyGrowthRecords({
    babyId: profile.id,
    currentGroupId,
    userId,
  });
  const [latestGrowth, setLatestGrowth] = React.useState<BabyGrowthRecord | null>(null);
  React.useEffect(() => {
    if (prenatal) {
      setLatestGrowth(null);
      return;
    }
    void fetchGrowthRecords().then((recs) => setLatestGrowth(recs[recs.length - 1] ?? null));
  }, [fetchGrowthRecords, prenatal]);

  const [checkups, setCheckups] = React.useState<import('../types').BabyCheckup[]>([]);

  const { reminders, fetchReminders, dismissReminder } = useBabyReminders({
    babyId: profile.id,
    currentGroupId,
  });
  React.useEffect(() => {
    if (prenatal) return;
    void fetchReminders();
  }, [fetchReminders, prenatal]);

  const handleReminderNavigate = (reminderType: string) => {
    const tab = REMINDER_TAB_MAP[reminderType];
    if (tab) setActiveTab(tab);
  };

  const { fetchLogs: fetchPrenatalLogs, addLog: addPrenatalLog } = usePrenatalLogs({
    babyId: profile.id,
    currentGroupId,
    userId,
  });
  const [prenatalLogs, setPrenatalLogs] = useState<PrenatalLog[]>([]);
  const [prenatalModalOpen, setPrenatalModalOpen] = useState(false);
  const [prenatalModalType, setPrenatalModalType] = useState<PrenatalLogType>('diary');

  React.useEffect(() => {
    if (!prenatal) {
      setPrenatalLogs([]);
      return;
    }
    let cancelled = false;
    void fetchPrenatalLogs(80).then((rows) => {
      if (!cancelled) setPrenatalLogs(rows);
    });
    return () => { cancelled = true; };
  }, [fetchPrenatalLogs, prenatal]);

  const prenatalProgress = profile.due_date ? gestationalProgress(profile.due_date) : null;
  const weeksPregnant = prenatalProgress?.weeksPregnant ?? 0;

  return (
    <div className="flex flex-col h-full">
      {!prenatal && reminders.length > 0 && (
        <div className="px-3 pt-3">
          <ReminderBanner
            reminders={reminders}
            t={t}
            onDismiss={dismissReminder}
            onNavigate={handleReminderNavigate}
          />
        </div>
      )}

      <nav className="flex border-b border-gray-100 dark:border-gray-800 shrink-0 overflow-x-auto scrollbar-none">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex-1 min-w-[52px] flex flex-col items-center py-2 gap-0.5 text-[10px] font-medium transition-colors ${
              activeTab === tab.key
                ? 'text-pink-500 border-b-2 border-pink-500'
                : 'text-gray-400 hover:text-gray-600'
            }`}
          >
            <span className="text-base">{tab.emoji}</span>
            {tab.labelKey ? (t[tab.labelKey] as string) : tab.labelFallback}
          </button>
        ))}
      </nav>

      <div className="min-h-0 flex-1 overflow-hidden">
        {activeTab === 'home' && (
          <div className="h-full overflow-y-auto">
            {prenatal ? (
              <div className="flex h-full min-h-0 flex-col gap-3 p-3">
                <div className="rounded-2xl border border-pink-100 bg-pink-50/60 px-3 py-2.5 dark:border-pink-900/40 dark:bg-pink-950/20">
                  <p className="text-sm font-bold text-gray-800 dark:text-gray-100">
                    {displayBabyName(profile)}
                    {prenatalProgress
                      ? ` · ${t.prenatal_weeks.replace('{n}', String(prenatalProgress.weeksPregnant))}`
                      : ''}
                  </p>
                  {profile.due_date ? (
                    <p className="mt-0.5 text-xs text-gray-500">
                      {t.due_date}: {profile.due_date}
                      {prenatalProgress
                        ? ` · ${t.prenatal_until_due.replace('{dday}', prenatalProgress.ddayLabel)}`
                        : ''}
                    </p>
                  ) : (
                    <p className="mt-0.5 text-xs text-gray-400">{t.due_date_missing}</p>
                  )}
                </div>
                <div className="min-h-[16rem] flex-1">
                  <PrenatalStatusCards
                    weeksPregnant={weeksPregnant}
                    logs={prenatalLogs}
                    t={t}
                    fillHeight
                    onCardClick={(lt) => {
                      setPrenatalModalType(lt);
                      setPrenatalModalOpen(true);
                    }}
                  />
                </div>
              </div>
            ) : (
              <DailyLogStats logs={logs} t={t} />
            )}
          </div>
        )}

        {activeTab === 'timeline' && (
          <PrenatalTimelineView
            babyId={profile.id}
            currentGroupId={currentGroupId}
            userId={userId}
            t={t}
          />
        )}

        {activeTab === 'growth' && !prenatal && (
          <div className="h-full min-h-0">
            <GrowthChartView
              profile={profile}
              currentGroupId={currentGroupId}
              userId={userId}
              t={t}
            />
          </div>
        )}

        {activeTab === 'health' && !prenatal && (
          <div className="h-full overflow-y-auto">
            <CheckupView
              babyId={profile.id}
              currentGroupId={currentGroupId}
              userId={userId}
              t={t}
              onCheckupsChange={setCheckups}
            />
            <MedicalReportView
              logs={logs}
              t={t}
              checkups={checkups}
              babyId={profile.id}
              groupId={currentGroupId ?? ''}
              onAddLog={onAddLog}
            />
          </div>
        )}

        {activeTab === 'album' && (
          <BabyAlbumView
            babyId={profile.id}
            currentGroupId={currentGroupId}
            birthDate={profile.birth_date}
            t={t}
          />
        )}

        {activeTab === 'vaccine' && !prenatal && profile.birth_date && (
          <VaccinationSchedule
            profile={profile}
            currentGroupId={currentGroupId}
            userId={userId}
            t={t}
          />
        )}

        {activeTab === 'ai' && (
          <div className="h-full min-h-0">
            <AiGuidePanel
              key={profile.id}
              profile={profile}
              userId={userId}
              recentLogs={logs}
              latestGrowth={latestGrowth}
              t={t}
              externalText={aiText}
              onTextChange={onAiTextChange}
              lifePhase={prenatal ? 'prenatal' : 'postnatal'}
            />
          </div>
        )}
      </div>

      {prenatalModalOpen && prenatal && (
        <PrenatalQuickLogModal
          key={prenatalModalType}
          isOpen={prenatalModalOpen}
          defaultType={prenatalModalType}
          babyId={profile.id}
          currentGroupId={currentGroupId ?? ''}
          weeksPregnant={weeksPregnant}
          t={t}
          onSave={async (draft) => {
            const row = await addPrenatalLog(draft);
            if (row) setPrenatalLogs((prev) => [row, ...prev]);
          }}
          onClose={() => setPrenatalModalOpen(false)}
        />
      )}
    </div>
  );
}
