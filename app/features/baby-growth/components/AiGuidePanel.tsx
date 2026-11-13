'use client';

import React, { useState } from 'react';
import { useBabyAiGuide } from '../hooks/useBabyAiGuide';
import type { AiMode } from '../hooks/useBabyAiGuide';
import type { BabyProfile, BabyDailyLog, BabyGrowthRecord } from '../types';
import type { BabyGrowthTranslations } from '@/lib/translations/baby-growth';

interface AiGuidePanelProps {
  profile: BabyProfile;
  userId: string;
  recentLogs: BabyDailyLog[];
  latestGrowth: BabyGrowthRecord | null;
  t: BabyGrowthTranslations;
  externalText?: string | null;
  onTextChange?: (text: string) => void;
}

const MODES: { key: AiMode; emoji: string; labelKey: keyof BabyGrowthTranslations }[] = [
  { key: 'guide',    emoji: '🌟', labelKey: 'ai_guide_prompt' },
  { key: 'diary',    emoji: '📝', labelKey: 'ai_diary_prompt' },
  { key: 'schedule', emoji: '🗓️', labelKey: 'ai_schedule_prompt' },
  { key: 'qa',       emoji: '💬', labelKey: 'ai_qa_prompt' },
];

export function AiGuidePanel({
  profile,
  userId,
  recentLogs,
  latestGrowth,
  t,
  externalText,
  onTextChange,
}: AiGuidePanelProps) {
  const {
    hasApiKey,
    generate,
    generating,
    result,
    error,
    clearResult,
  } = useBabyAiGuide({ userId });

  const [qaQuestion, setQaQuestion] = useState('');
  const [activeMode, setActiveMode] = useState<AiMode>('guide');

  const displayText = externalText ?? result;

  const handleGenerate = async (mode: AiMode) => {
    setActiveMode(mode);
    clearResult();
    if (onTextChange) onTextChange('');
    await generate(mode, profile, recentLogs, latestGrowth, {
      qaQuestion: mode === 'qa' ? qaQuestion : undefined,
      stream: true,
    });
  };

  /** 닉네임 모달(계정 설정)을 열어 API 키를 등록하도록 안내 */
  const openAccountSettings = () => {
    window.dispatchEvent(new CustomEvent('sfh:open-nickname-modal'));
  };

  return (
    <div className="flex flex-col gap-4 p-4 overflow-y-auto">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-bold">{t.ai_title}</h2>
        {hasApiKey && (
          <button
            onClick={openAccountSettings}
            className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            ⚙️ 키 관리
          </button>
        )}
      </div>

      {/* API 키 미등록 — Fallback UX */}
      {!hasApiKey && (
        <div className="flex flex-col gap-3 p-4 rounded-xl bg-purple-50 dark:bg-purple-900/20 border border-purple-100 dark:border-purple-800 text-center">
          <div className="text-3xl">🤖</div>
          <p className="text-sm font-medium text-purple-700 dark:text-purple-300">
            AI 육아 가이드를 사용하려면 API 키가 필요합니다
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            OpenAI 또는 Anthropic API 키를 등록하면<br />
            맞춤 육아 가이드, 일기 초안, 일과 예측을 받을 수 있습니다.
          </p>
          <p className="text-[11px] text-gray-400">
            🔒 키는 이 기기의 localStorage에만 저장되며 서버로 전송되지 않습니다.
          </p>
          <button
            onClick={openAccountSettings}
            className="bg-purple-500 hover:bg-purple-600 text-white text-sm font-semibold px-5 py-2 rounded-xl transition-colors"
          >
            🔑 계정 설정에서 API 키 등록하기
          </button>
        </div>
      )}

      {/* 모드 버튼 (키 등록 시) */}
      {hasApiKey && (
        <>
          <div className="grid grid-cols-2 gap-2">
            {MODES.map(({ key, emoji, labelKey }) => (
              <button
                key={key}
                onClick={() => key !== 'qa' && handleGenerate(key)}
                disabled={generating}
                className={`flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-semibold transition-colors disabled:opacity-60 ${
                  activeMode === key && generating
                    ? 'ring-2 ring-purple-400'
                    : ''
                } ${
                  key === 'guide'    ? 'bg-purple-500 hover:bg-purple-600 text-white' :
                  key === 'diary'    ? 'bg-indigo-500 hover:bg-indigo-600 text-white' :
                  key === 'schedule' ? 'bg-blue-500 hover:bg-blue-600 text-white' :
                                       'bg-teal-500 hover:bg-teal-600 text-white'
                }`}
              >
                {emoji} {t[labelKey] as string}
              </button>
            ))}
          </div>

          {/* QA 입력 */}
          <div className="flex gap-2">
            <input
              type="text"
              value={qaQuestion}
              onChange={(e) => setQaQuestion(e.target.value)}
              placeholder={t.ai_qa_input}
              className="flex-1 text-sm rounded-lg border border-gray-200 dark:border-gray-700 dark:bg-gray-800 px-3 py-2"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && qaQuestion.trim()) {
                  handleGenerate('qa');
                }
              }}
            />
            <button
              onClick={() => qaQuestion.trim() && handleGenerate('qa')}
              disabled={generating || !qaQuestion.trim()}
              className="bg-teal-500 hover:bg-teal-600 disabled:opacity-60 text-white text-sm font-semibold px-4 rounded-xl transition-colors"
            >
              {generating && activeMode === 'qa' ? '...' : '질문'}
            </button>
          </div>
        </>
      )}

      {/* 에러 */}
      {error && (
        <div className="p-3 rounded-xl bg-red-50 dark:bg-red-900/20 text-red-600 text-xs">
          {t.ai_error}: {error}
        </div>
      )}

      {/* 결과 */}
      {displayText && (
        <div className="p-4 rounded-xl bg-purple-50 dark:bg-purple-900/20 border border-purple-100 dark:border-purple-800">
          <p className="text-sm text-gray-700 dark:text-gray-200 leading-relaxed whitespace-pre-wrap">
            {displayText}
          </p>
          <button
            onClick={() => { clearResult(); if (onTextChange) onTextChange(''); }}
            className="mt-2 text-xs text-gray-400 hover:text-gray-600"
          >
            {t.close}
          </button>
        </div>
      )}

    </div>
  );
}

