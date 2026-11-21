/**
 * useBabyAiGuide — 사용자 로컬 AI API 키로 육아 가이드 / 일기 초안 생성
 *
 * 보안 원칙:
 * - API 키는 localStorage에만 저장 (우리 서버 DB에 저장 안 함)
 * - 모든 LLM 호출은 /api/ai/proxy 를 통과 (CORS 우회, 서버 메모리서만 키 사용)
 * - localStorage key: sfh_ai_key_{userId}_{provider}  (앱 전체 공통 키)
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { fetchAiProxy } from '@/lib/ai-proxy-client';
import {
  aiUserKeyStorageKey,
  getStoredAiKey,
  storedAiKeyToProxyBody,
  writeStoredAiKey,
  type AiUserProvider,
} from '@/lib/ai-user-key';
import type { BabyProfile, BabyDailyLog, BabyGrowthRecord } from '../types';
import { calcAgeInDays, calcAgeInMonths } from '../utils/age-calculator';
import {
  displayBabyName,
  gestationalProgress,
  isPrenatal,
} from '../utils/prenatal';

// ---------------------------------------------------------------------------
// 상수
// ---------------------------------------------------------------------------

export type AiMode = 'guide' | 'diary' | 'schedule' | 'qa';

// 구버전 호환: sfh_baby_ai_key_{userId}_{provider} 및 단일 키 형식
const LS_LEGACY_KEY_PROVIDER = (userId: string, provider: AiUserProvider) =>
  `sfh_baby_ai_key_${userId}_${provider}`;
const LS_LEGACY_KEY = (userId: string) => `sfh_baby_ai_key_${userId}`;

/** 구버전 키가 있으면 새 공통 키로 1회 마이그레이션 */
function migrateLegacyKeys(userId: string): void {
  if (typeof window === 'undefined') return;
  for (const prov of ['openai', 'anthropic'] as AiUserProvider[]) {
    const newKey = aiUserKeyStorageKey(userId, prov);
    if (localStorage.getItem(newKey)) continue;
    const legacy = localStorage.getItem(LS_LEGACY_KEY_PROVIDER(userId, prov));
    if (legacy) {
      writeStoredAiKey(userId, prov, legacy);
      localStorage.removeItem(LS_LEGACY_KEY_PROVIDER(userId, prov));
    }
  }
  const singleLegacy = localStorage.getItem(LS_LEGACY_KEY(userId));
  if (singleLegacy && !localStorage.getItem(aiUserKeyStorageKey(userId, 'openai'))) {
    writeStoredAiKey(userId, 'openai', singleLegacy);
  }
  localStorage.removeItem(LS_LEGACY_KEY(userId));
}

// ---------------------------------------------------------------------------
// 프롬프트 빌더
// ---------------------------------------------------------------------------

function serializeLogs(logs: BabyDailyLog[], hours: number): string {
  const cutoff = new Date(Date.now() - hours * 3_600_000);
  const recent = logs.filter((l) => new Date(l.logged_at) >= cutoff);

  const lines: string[] = [];
  for (const l of recent) {
    const time = new Date(l.logged_at).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
    switch (l.log_type) {
      case 'feeding':
        if (l.feeding_type === 'breast_left' || l.feeding_type === 'breast_right') {
          const leftMin = l.breast_left_min ?? 0;
          const rightMin = l.breast_right_min ?? 0;
          lines.push(`[${time}] 모유수유 좌${leftMin}분 우${rightMin}분`);
        } else if (l.feeding_type === 'mixed') {
          lines.push(`[${time}] 모유 젖병 ${l.feeding_amount_ml ?? '-'}ml`);
        } else if (l.feeding_type === 'bottle') {
          lines.push(`[${time}] 분유 ${l.feeding_amount_ml ?? '-'}ml`);
        } else if (l.feeding_type === 'solid') {
          lines.push(`[${time}] 이유식 ${l.feeding_amount_ml ?? '-'}g${l.solid_ingredients ? ' (재료: ' + l.solid_ingredients + ')' : ''}${l.allergy_reaction ? ' ⚠️ 알레르기: ' + l.allergy_reaction : ''}`);
        } else {
          lines.push(`[${time}] 수유 ${l.feeding_amount_ml ?? '-'}ml`);
        }
        break;
      case 'sleep': {
        const endAt = l.sleep_end_at ? new Date(l.sleep_end_at) : null;
        const durationMin = endAt
          ? Math.round((endAt.getTime() - new Date(l.logged_at).getTime()) / 60000)
          : null;
        lines.push(`[${time}] 수면${durationMin != null ? ' ' + durationMin + '분' : ''}`);
        break;
      }
      case 'diaper':
        lines.push(`[${time}] 배변 ${l.diaper_type ?? '-'}${l.diaper_color ? ' 색상: ' + l.diaper_color : ''}${l.diaper_consistency ? ' 상태: ' + l.diaper_consistency : ''}`);
        break;
      case 'temperature':
        lines.push(`[${time}] 체온 ${l.temperature_celsius ?? '-'}°C`);
        break;
      case 'medication':
        lines.push(`[${time}] 투약 ${l.medication_name ?? '-'} ${l.medication_dose_mg ?? '-'}mg`);
        break;
      case 'activity':
        if (l.activity_type === 'pumping') {
          lines.push(`[${time}] 유축 ${l.pump_amount_ml ?? '-'}ml`);
        } else {
          lines.push(`[${time}] 활동 ${l.activity_type ?? '-'}${l.activity_duration_min ? ' ' + l.activity_duration_min + '분' : ''}`);
        }
        break;
    }
  }
  return lines.join('\n') || '(해당 기간 기록 없음)';
}

function buildPromptPayload(
  baby: BabyProfile,
  logs: BabyDailyLog[],
  latestGrowth: BabyGrowthRecord | null,
  mode: AiMode,
  qaQuestion?: string,
  lifePhase: 'prenatal' | 'postnatal' = 'postnatal',
): { systemPrompt: string; userPrompt: string } {
  const prenatal = lifePhase === 'prenatal' || isPrenatal(baby);
  const shownName = displayBabyName(baby);

  if (prenatal) {
    const progress = baby.due_date ? gestationalProgress(baby.due_date) : null;
    const contextLines: string[] = [
      `태명/이름: ${shownName}`,
      baby.fetal_name ? `태명: ${baby.fetal_name}` : '',
      baby.due_date ? `출산예정일: ${baby.due_date}` : '',
      progress
        ? `추정 임신 주수: ${progress.weeksPregnant}주 (출산까지 ${progress.ddayLabel}, 예정일 기준 추정)`
        : '',
      `성별: ${baby.gender ?? '미입력'}`,
    ].filter(Boolean);
    const baseContext = contextLines.join('\n');
    switch (mode) {
      case 'guide':
        return {
          systemPrompt:
            '당신은 산부인과·산전 케어를 돕는 전문 가이드입니다. ' +
            '임신 주수(예정일 기준 추정)에 맞는 주의사항과 산모·태아 케어를 간결히 안내하세요. ' +
            '의학적 진단은 하지 말고 필요 시 병원 상담을 권고하세요. ' +
            '응답 마지막 줄에는 반드시 `요약: …` 형식의 20자 이내 한 줄 요약을 붙이세요.',
          userPrompt:
            `${baseContext}\n\n오늘의 산전 가이드를 한국어로 3~4문장 본문으로 작성한 뒤, 마지막 줄에만 \`요약: (20자 이내)\` 을 추가해 주세요.`,
        };
      case 'diary':
        return {
          systemPrompt: '당신은 따뜻한 임신 일기 작가입니다. 산모의 시각으로 오늘을 기록해 주세요.',
          userPrompt: `${baseContext}\n\n오늘의 임신 일기 초안을 한국어로 150~200자로 작성해 주세요.`,
        };
      case 'schedule':
        return {
          systemPrompt: '당신은 산전 일정 도우미입니다. 주수에 맞는 검진·휴식·영양 일과를 제안하세요.',
          userPrompt: `${baseContext}\n\n내일 산전 일과 제안을 한국어로 작성해 주세요.`,
        };
      case 'qa':
        return {
          systemPrompt:
            '당신은 친절한 산전 케어 AI입니다. 의학적 진단은 하지 않고 필요 시 산부인과 상담을 권고하세요.',
          userPrompt: `${baseContext}\n\n질문: ${qaQuestion ?? '임신 중 궁금한 점이 있습니다.'}`,
        };
    }
  }

  const birthDate = baby.birth_date!;
  const ageMonths = calcAgeInMonths(birthDate);
  const ageDays = calcAgeInDays(birthDate);

  const contextLines: string[] = [
    `아기 이름: ${shownName}`,
    baby.fetal_name ? `태명: ${baby.fetal_name}` : '',
    `월령: ${ageMonths}개월 (D+${ageDays})`,
    baby.gestational_weeks != null ? `출생 시 재태주수: ${baby.gestational_weeks}주` : '',
    baby.birth_weight_kg != null ? `출생 체중: ${baby.birth_weight_kg}kg` : '',
    `성별: ${baby.gender ?? '미입력'}`,
  ].filter(Boolean);

  if (latestGrowth) {
    if (latestGrowth.weight_kg) contextLines.push(`최근 체중: ${latestGrowth.weight_kg}kg`);
    if (latestGrowth.height_cm) contextLines.push(`최근 키: ${latestGrowth.height_cm}cm`);
    if (latestGrowth.head_cm) contextLines.push(`최근 머리둘레: ${latestGrowth.head_cm}cm`);
  }

  const logs48h = serializeLogs(logs, 48);
  const logs24h = serializeLogs(logs, 24);

  const baseContext = `${contextLines.join('\n')}\n\n[최근 48시간 기록]\n${logs48h}`;

  switch (mode) {
    case 'guide':
      return {
        systemPrompt:
          '당신은 소아과 전문의와 협력하는 전문 육아 가이드입니다. ' +
          '아래 아기 정보를 바탕으로 오늘 하루 주의할 사항과 발달에 맞는 활동을 간결하게 안내해 주세요. ' +
          '의학적 판단이 필요한 경우 반드시 의사 상담을 권고하세요. ' +
          '응답 마지막 줄에는 반드시 홈 배너용 한 줄 요약을 `요약: …` 형식으로 붙이세요. ' +
          '요약은 키워드·짧은 문장으로 20자 이내, 본문과 중복되지 않게 쓰세요.',
        userPrompt:
          `${baseContext}\n\n위 정보를 바탕으로 오늘의 육아 가이드를 한국어로 3~4문장 본문으로 작성한 뒤, ` +
          `마지막 줄에만 \`요약: (20자 이내 한 줄)\` 을 추가해 주세요.`,
      };
    case 'diary':
      return {
        systemPrompt:
          '당신은 따뜻하고 감성적인 육아 일기 작가입니다. ' +
          '아래 아기 성장 데이터를 바탕으로 부모의 시각에서 오늘 하루 아기와의 소중한 순간을 담은 일기 초안을 작성해 주세요.',
        userPrompt: `${baseContext}\n\n위 정보를 바탕으로 오늘의 육아 일기 초안을 한국어로 150~200자로 작성해 주세요.`,
      };
    case 'schedule': {
      const feedingLogs = logs.filter((l) => l.log_type === 'feeding');
      const sleepLogs = logs.filter((l) => l.log_type === 'sleep');
      const scheduleContext =
        `${contextLines.join('\n')}\n\n[최근 24시간 기록]\n${logs24h}` +
        `\n\n수유 패턴: 최근 ${feedingLogs.length}회` +
        `\n수면 패턴: 최근 ${sleepLogs.length}회`;
      return {
        systemPrompt:
          '당신은 아기 일과 패턴 분석 전문가입니다. ' +
          '아래 최근 24시간 수유·수면 데이터를 바탕으로 다음 24시간의 예상 일과를 시간대별로 간결하게 예측해 주세요.',
        userPrompt: `${scheduleContext}\n\n위 패턴을 바탕으로 내일 예상 수유·수면 일과를 한국어로 작성해 주세요. (형식: HH:MM - 활동 예시)`,
      };
    }
    case 'qa':
      return {
        systemPrompt:
          '당신은 친절한 육아 전문 AI 어시스턴트입니다. ' +
          '아기 정보와 최근 기록을 참고하여 부모의 질문에 정확하고 도움이 되는 답변을 한국어로 제공해 주세요. ' +
          '의학적 진단은 하지 않고, 필요 시 소아과 상담을 권고하세요.',
        userPrompt: `${baseContext}\n\n질문: ${qaQuestion ?? '아기의 현재 상태에 대해 궁금한 점이 있습니다.'}`,
      };
  }
}

// ---------------------------------------------------------------------------
// 훅
// ---------------------------------------------------------------------------

interface UseBabyAiGuideProps {
  userId: string;
}

export function useBabyAiGuide({ userId }: UseBabyAiGuideProps) {
  const [hasApiKey, setHasApiKey] = useState(() => {
    if (typeof window === 'undefined') return false;
    migrateLegacyKeys(userId);
    return Boolean(getStoredAiKey(userId));
  });
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const sync = () => setHasApiKey(Boolean(getStoredAiKey(userId)));
    window.addEventListener('sfh:ai-key-updated', sync);
    return () => window.removeEventListener('sfh:ai-key-updated', sync);
  }, [userId]);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
      abortRef.current = null;
    };
  }, []);

  const clearResult = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setResult('');
    setError(null);
    setGenerating(false);
  }, []);

  /** 탭 재진입 시 홈 브리핑(guide)을 패널에 다시 보여 줄 때 사용 */
  const seedResult = useCallback((text: string) => {
    setResult(text);
    setError(null);
  }, []);

  const generate = useCallback(
    async (
      mode: AiMode,
      baby: BabyProfile,
      recentLogs: BabyDailyLog[],
      latestGrowth: BabyGrowthRecord | null,
      options?: { qaQuestion?: string; stream?: boolean; lifePhase?: 'prenatal' | 'postnatal' }
    ): Promise<string | null> => {
      const stored = getStoredAiKey(userId);
      if (!stored) {
        setError('API 키가 필요합니다. 설정에서 키를 등록해 주세요.');
        return null;
      }

      abortRef.current?.abort();
      const ac = new AbortController();
      abortRef.current = ac;

      setGenerating(true);
      setError(null);
      setResult('');

      try {
        const { systemPrompt, userPrompt } = buildPromptPayload(
          baby,
          recentLogs,
          latestGrowth,
          mode,
          options?.qaQuestion,
          options?.lifePhase ?? (isPrenatal(baby) ? 'prenatal' : 'postnatal'),
        );

        const useStream = options?.stream ?? true;

        const res = await fetchAiProxy({
          apiKey: stored.key,
          body: storedAiKeyToProxyBody(stored, {
            systemPrompt,
            userPrompt,
            stream: useStream,
          }),
          signal: ac.signal,
        });

        if (ac.signal.aborted) return null;

        if (!res.ok) {
          const errJson = await res.json().catch(() => ({}));
          throw new Error(errJson?.error ?? `HTTP ${res.status}`);
        }

        if (useStream && res.body) {
          const reader = res.body.getReader();
          const decoder = new TextDecoder();
          let accumulated = '';
          while (true) {
            if (ac.signal.aborted) {
              try {
                await reader.cancel();
              } catch {
                /* ignore */
              }
              return null;
            }
            const { done, value } = await reader.read();
            if (done) break;
            const chunk = decoder.decode(value, { stream: true });
            const lines = chunk.split('\n');
            for (const line of lines) {
              if (!line.startsWith('data: ')) continue;
              const payload = line.slice(6).trim();
              if (payload === '[DONE]') continue;
              try {
                const parsed = JSON.parse(payload);
                const delta = parsed.choices?.[0]?.delta?.content ?? '';
                const anthropicDelta = parsed.delta?.text ?? '';
                accumulated += delta || anthropicDelta;
                if (!ac.signal.aborted) setResult(accumulated);
              } catch {
                // JSON 파싱 실패 시 무시
              }
            }
          }
          return accumulated.trim() || null;
        }

        const json = await res.json();
        if (ac.signal.aborted) return null;
        const text =
          json.choices?.[0]?.message?.content?.trim() ??
          json.content?.[0]?.text?.trim() ??
          '';
        setResult(text);
        return text || null;
      } catch (err: unknown) {
        if (ac.signal.aborted || (err instanceof DOMException && err.name === 'AbortError')) {
          return null;
        }
        const msg = err instanceof Error ? err.message : 'AI 응답을 받지 못했습니다.';
        console.error('[useBabyAiGuide] AI 오류:', err);
        setError(msg);
        return null;
      } finally {
        if (abortRef.current === ac) abortRef.current = null;
        if (!ac.signal.aborted) setGenerating(false);
      }
    },
    [userId]
  );

  return {
    hasApiKey,
    generate,
    generating,
    result,
    error,
    clearResult,
    seedResult,
  };
}
