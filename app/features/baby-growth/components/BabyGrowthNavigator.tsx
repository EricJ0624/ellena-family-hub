'use client';

import React, { useState } from 'react';
import type { BabyProfile, BabyDailyLog, BabyDailyLogDraft, BabyGrowthRecord } from '../types';
import type { BabyGrowthTranslations } from '@/lib/translations/baby-growth';
import { MedicalReportView } from './MedicalReportView';
import { GrowthChartView } from './GrowthChartView';
import { BabyAlbumView } from './BabyAlbumView';
import { VaccinationSchedule } from './VaccinationSchedule';
import { AiGuidePanel } from './AiGuidePanel';
import { DailyLogStats } from './DailyLogStats';
import { CheckupView } from './CheckupView';
import { ReminderBanner } from './ReminderBanner';
import { useBabyGrowthRecords } from '../hooks/useBabyGrowthRecords';
import { useBabyReminders } from '../hooks/useBabyReminders';

type TabKey = 'home' | 'growth' | 'health' | 'album' | 'vaccine' | 'ai';

const TABS: { key: TabKey; emoji: string; label: string }[] = [
  { key: 'home',    emoji: '🏠', label: '홈' },
  { key: 'growth',  emoji: '📈', label: '성장' },
  { key: 'health',  emoji: '🏥', label: '건강' },
  { key: 'album',   emoji: '📷', label: '앨범' },
  { key: 'vaccine', emoji: '💉', label: '접종' },
  { key: 'ai',      emoji: '🤖', label: 'AI' },
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
  const [activeTab, setActiveTab] = useState<TabKey>('home');

  // 최신 성장 기록 (AI 패널용)
  const { fetchGrowthRecords } = useBabyGrowthRecords({
    babyId: profile.id,
    currentGroupId,
    userId,
  });
  const [latestGrowth, setLatestGrowth] = React.useState<BabyGrowthRecord | null>(null);
  React.useEffect(() => {
    void fetchGrowthRecords().then((recs) => setLatestGrowth(recs[recs.length - 1] ?? null));
  }, [fetchGrowthRecords]);

  // 검진 목록 — CheckupView가 로드/저장 시 갱신해 진료 리포트와 맞춤
  const [checkups, setCheckups] = React.useState<import('../types').BabyCheckup[]>([]);

  // 알림 배너
  const { reminders, fetchReminders, dismissReminder } = useBabyReminders({
    babyId: profile.id,
    currentGroupId,
  });
  React.useEffect(() => {
    void fetchReminders();
  }, [fetchReminders]);

  const handleReminderNavigate = (reminderType: string) => {
    const tab = REMINDER_TAB_MAP[reminderType];
    if (tab) setActiveTab(tab);
  };

  return (
    <div className="flex flex-col h-full">
      {/* 알림 배너 */}
      {reminders.length > 0 && (
        <div className="px-3 pt-3">
          <ReminderBanner
            reminders={reminders}
            t={t}
            onDismiss={dismissReminder}
            onNavigate={handleReminderNavigate}
          />
        </div>
      )}

      {/* 탭 헤더 */}
      <nav className="flex border-b border-gray-100 dark:border-gray-800 shrink-0 overflow-x-auto scrollbar-none">
        {TABS.map((tab) => (
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
            {tab.label}
          </button>
        ))}
      </nav>

      {/* 탭 컨텐츠 */}
      <div className="min-h-0 flex-1 overflow-hidden">
        {activeTab === 'home' && (
          <div className="h-full overflow-y-auto">
            <DailyLogStats logs={logs} t={t} />
          </div>
        )}

        {activeTab === 'growth' && (
          <GrowthChartView
            profile={profile}
            currentGroupId={currentGroupId}
            userId={userId}
            t={t}
          />
        )}

        {activeTab === 'health' && (
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

        {activeTab === 'vaccine' && (
          <VaccinationSchedule
            profile={profile}
            currentGroupId={currentGroupId}
            userId={userId}
            t={t}
          />
        )}

        {activeTab === 'ai' && (
          <AiGuidePanel
            profile={profile}
            userId={userId}
            recentLogs={logs}
            latestGrowth={latestGrowth}
            t={t}
            externalText={aiText}
            onTextChange={onAiTextChange}
          />
        )}
      </div>
    </div>
  );
}
