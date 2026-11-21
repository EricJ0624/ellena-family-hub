'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useBabyAiGuide, type AiMode } from '../hooks/useBabyAiGuide';
import type { BabyProfile, BabyDailyLog, BabyGrowthRecord } from '../types';
import type { BabyGrowthTranslations } from '@/lib/translations/baby-growth';
import { parseGuideResponse } from '../utils/parse-guide-brief';

interface AiGuidePanelProps {
  profile: BabyProfile;
  userId: string;
  recentLogs: BabyDailyLog[];
  latestGrowth: BabyGrowthRecord | null;
  t: BabyGrowthTranslations;
  /** 홈 1줄 브리핑용 — guide 결과만 부모에 반영 */
  externalText?: string | null;
  onTextChange?: (text: string | null) => void;
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
    seedResult,
  } = useBabyAiGuide({ userId });

  const [qaQuestion, setQaQuestion] = useState('');
  const [activeMode, setActiveMode] = useState<AiMode>('guide');
  const didSeedRef = useRef(false);

  // 탭 재진입 시 저장된 guide 전문을 패널에 1회 복원
  useEffect(() => {
    if (didSeedRef.current) return;
    didSeedRef.current = true;
    if (externalText && externalText.length > 0) {
      seedResult(externalText);
      setActiveMode('guide');
    }
  }, [externalText, seedResult]);

  // guide 완료 후에만 부모(홈 배너)에 반영 — 스트리밍 중 fallback 깜빡임 방지
  useEffect(() => {
    if (!onTextChange || activeMode !== 'guide' || generating) return;
    if (result) onTextChange(result);
  }, [result, generating, onTextChange, activeMode]);

  const handleGenerate = async (mode: AiMode) => {
    setActiveMode(mode);
    clearResult();
    if (mode === 'guide' && onTextChange) onTextChange(null);
    await generate(mode, profile, recentLogs, latestGrowth, {
      qaQuestion: mode === 'qa' ? qaQuestion : undefined,
      stream: true,
    });
  };

  const handleDelete = () => {
    const clearingGuide = activeMode === 'guide';
    clearResult();
    if (clearingGuide && onTextChange) onTextChange(null);
  };

  const openAccountSettings = () => {
    window.dispatchEvent(new CustomEvent('sfh:open-nickname-modal'));
  };

  // guide: 패널에는 본문만 (요약 줄은 홈 배너용). 다른 모드는 전문.
  const panelText =
    activeMode === 'guide' && result
      ? parseGuideResponse(result).body || result
      : result;

  return (
    <div className="flex h-full min-h-0 flex-col gap-4 overflow-hidden p-4">
      <div className="flex shrink-0 items-center justify-between">
        <h2 className="text-base font-bold">{t.ai_title}</h2>
        {hasApiKey && (
          <button
            type="button"
            onClick={openAccountSettings}
            className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800"
          >
            ⚙️ 키 관리
          </button>
        )}
      </div>

      {!hasApiKey && (
        <div className="flex shrink-0 flex-col gap-3 rounded-xl border border-purple-100 bg-purple-50 p-4 text-center dark:border-purple-800 dark:bg-purple-900/20">
          <div className="text-3xl">🤖</div>
          <p className="text-sm font-medium text-purple-700 dark:text-purple-300">
            AI 육아 가이드를 사용하려면 API 키가 필요합니다
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            GPT·Claude·Gemini 또는 OpenAI 호환(기타) 키를 등록하면<br />
            맞춤 육아 가이드, 일기 초안, 일과 예측을 받을 수 있습니다.
          </p>
          <p className="text-[11px] text-gray-400">
            🔒 키는 이 기기의 localStorage에만 저장되며 서버로 전송되지 않습니다.
          </p>
          <button
            type="button"
            onClick={openAccountSettings}
            className="rounded-xl bg-purple-500 px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-purple-600"
          >
            🔑 계정 설정에서 API 키 등록하기
          </button>
        </div>
      )}

      {hasApiKey && (
        <div className="flex shrink-0 flex-col gap-4">
          <div className="grid grid-cols-2 gap-2">
            {MODES.map(({ key, emoji, labelKey }) => (
              <button
                key={key}
                type="button"
                onClick={() => key !== 'qa' && void handleGenerate(key)}
                disabled={generating}
                className={`flex items-center justify-center gap-1.5 rounded-xl py-2.5 text-sm font-semibold transition-colors disabled:opacity-60 ${
                  activeMode === key && generating ? 'ring-2 ring-purple-400' : ''
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

          <div className="flex gap-2">
            <input
              type="text"
              value={qaQuestion}
              onChange={(e) => setQaQuestion(e.target.value)}
              placeholder={t.ai_qa_input}
              className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && qaQuestion.trim()) {
                  void handleGenerate('qa');
                }
              }}
            />
            <button
              type="button"
              onClick={() => qaQuestion.trim() && void handleGenerate('qa')}
              disabled={generating || !qaQuestion.trim()}
              className="rounded-xl bg-teal-500 px-4 text-sm font-semibold text-white transition-colors hover:bg-teal-600 disabled:opacity-60"
            >
              {generating && activeMode === 'qa' ? '...' : '질문'}
            </button>
          </div>
        </div>
      )}

      {error && (
        <div className="shrink-0 rounded-xl bg-red-50 p-3 text-xs text-red-600 dark:bg-red-900/20">
          {t.ai_error}: {error}
        </div>
      )}

      {panelText ? (
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-purple-100 bg-purple-50 dark:border-purple-800 dark:bg-purple-900/20">
          <div className="min-h-0 flex-1 overflow-y-auto p-4">
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-gray-700 dark:text-gray-200">
              {panelText}
            </p>
          </div>
          <div className="shrink-0 border-t border-purple-100 px-4 py-2 dark:border-purple-800">
            <button
              type="button"
              onClick={handleDelete}
              className="text-xs text-gray-400 transition-colors hover:text-rose-500"
            >
              {t.delete}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
