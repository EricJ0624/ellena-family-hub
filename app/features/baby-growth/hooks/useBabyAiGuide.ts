/**
 * useBabyAiGuide — 사용자 로컬 AI API 키로 육아 가이드 / 일기 초안 생성
 *
 * 보안 원칙:
 * - API 키는 localStorage에만 저장 (우리 서버 DB에 저장 안 함)
 * - 모든 LLM 호출은 /api/ai/proxy 를 통과 (CORS 우회, 서버 메모리서만 키 사용)
 * - localStorage key: sfh_ai_key_{userId}_{provider}  (앱 전체 공통 키)
 */

import { useState, useCallback, useEffect } from 'react';
import type { BabyProfile, BabyDailyLog, BabyGrowthRecord } from '../types';
import { calcAgeInDays, calcAgeInMonths } from '../utils/age-calculator';

// ---------------------------------------------------------------------------
// 상수
// ---------------------------------------------------------------------------

export type AiProvider = 'openai' | 'anthropic';
export type AiMode = 'guide' | 'diary' | 'schedule' | 'qa';

// 앱 전체 공통 AI 키 (위젯 독립적)
const LS_KEY = (userId: string, provider: AiProvider) =>
  `sfh_ai_key_${userId}_${provider}`;

// 구버전 호환: sfh_baby_ai_key_{userId}_{provider} 및 단일 키 형식
const LS_LEGACY_KEY_PROVIDER = (userId: string, provider: AiProvider) =>
  `sfh_baby_ai_key_${userId}_${provider}`;
const LS_LEGACY_KEY = (userId: string) => `sfh_baby_ai_key_${userId}`;

/** 구버전 키가 있으면 새 공통 키로 1회 마이그레이션 */
function migrateLegacyKeys(userId: string): void {
  if (typeof window === 'undefined') return;
  for (const prov of ['openai', 'anthropic'] as AiProvider[]) {
    const newKey = LS_KEY(userId, prov);
    if (localStorage.getItem(newKey)) continue; // 이미 존재
    const legacy = localStorage.getItem(LS_LEGACY_KEY_PROVIDER(userId, prov));
    if (legacy) {
      localStorage.setItem(newKey, legacy);
      localStorage.removeItem(LS_LEGACY_KEY_PROVIDER(userId, prov));
    }
  }
  // 단일 키 형식(provider 없음) → openai로 마이그레이션
  const singleLegacy = localStorage.getItem(LS_LEGACY_KEY(userId));
  if (singleLegacy && !localStorage.getItem(LS_KEY(userId, 'openai'))) {
    localStorage.setItem(LS_KEY(userId, 'openai'), singleLegacy);
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
        if (l.feeding_type?.startsWith('breast')) {
          const leftMin = l.breast_left_min ?? 0;
          const rightMin = l.breast_right_min ?? 0;
          lines.push(`[${time}] 모유수유 좌${leftMin}분 우${rightMin}분`);
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
): { systemPrompt: string; userPrompt: string } {
  const ageMonths = calcAgeInMonths(baby.birth_date);
  const ageDays = calcAgeInDays(baby.birth_date);

  const contextLines: string[] = [
    `아기 이름: ${baby.name}`,
    `월령: ${ageMonths}개월 (D+${ageDays})`,
    `성별: ${baby.gender ?? '미입력'}`,
  ];

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
          '의학적 판단이 필요한 경우 반드시 의사 상담을 권고하세요.',
        userPrompt: `${baseContext}\n\n위 정보를 바탕으로 오늘의 육아 가이드를 한국어로 3~4문장으로 작성해 주세요.`,
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
  const [provider, setProvider] = useState<AiProvider>(() => {
    if (typeof window === 'undefined') return 'openai';
    migrateLegacyKeys(userId); // 구버전 키 1회 마이그레이션
    // 현재 등록된 키가 있는 provider 자동 선택
    if (localStorage.getItem(LS_KEY(userId, 'anthropic'))) return 'anthropic';
    return 'openai';
  });

  const [apiKey, setApiKeyState] = useState<string>(() => {
    if (typeof window === 'undefined') return '';
    return localStorage.getItem(LS_KEY(userId, provider)) ?? '';
  });

  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [pinging, setPinging] = useState(false);
  const [pingResult, setPingResult] = useState<'ok' | 'fail' | null>(null);

  const saveApiKey = useCallback(
    (key: string, prov?: AiProvider) => {
      const trimmed = key.trim();
      const targetProvider = prov ?? provider;
      localStorage.setItem(LS_KEY(userId, targetProvider), trimmed);
      if (targetProvider === provider) setApiKeyState(trimmed);
    },
    [userId, provider]
  );

  const clearApiKey = useCallback(
    (prov?: AiProvider) => {
      const targetProvider = prov ?? provider;
      localStorage.removeItem(LS_KEY(userId, targetProvider));
      if (targetProvider === provider) setApiKeyState('');
    },
    [userId, provider]
  );

  const switchProvider = useCallback(
    (prov: AiProvider) => {
      setProvider(prov);
      const key = localStorage.getItem(LS_KEY(userId, prov)) ?? '';
      setApiKeyState(key);
      setPingResult(null);
      setResult('');
      setError(null);
    },
    [userId]
  );

  /**
   * 외부(닉네임 모달 등)에서 AI 키를 저장·삭제하면
   * 'sfh:ai-key-updated' 이벤트를 발행한다.
   * 이 훅은 그 이벤트를 수신해 localStorage에서 최신 키를 다시 읽는다.
   */
  useEffect(() => {
    const handleKeyUpdated = () => {
      const latest = localStorage.getItem(LS_KEY(userId, provider)) ?? '';
      setApiKeyState(latest);
      // 키가 없어진 경우 반대 provider에 키가 있으면 자동 전환
      if (!latest) {
        const other: AiProvider = provider === 'openai' ? 'anthropic' : 'openai';
        const otherKey = localStorage.getItem(LS_KEY(userId, other)) ?? '';
        if (otherKey) {
          setProvider(other);
          setApiKeyState(otherKey);
        }
      }
    };
    window.addEventListener('sfh:ai-key-updated', handleKeyUpdated);
    return () => window.removeEventListener('sfh:ai-key-updated', handleKeyUpdated);
  }, [userId, provider]);

  /**
   * API 키 유효성 검증 (Ping Test)
   * 최소 토큰으로 호출하여 인증 오류 여부를 확인한다.
   */
  const pingTest = useCallback(
    async (key?: string): Promise<boolean> => {
      const testKey = (key ?? apiKey).trim();
      if (!testKey) return false;
      setPinging(true);
      setPingResult(null);
      try {
        const res = await fetch('/api/ai/proxy', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${testKey}`,
          },
          body: JSON.stringify({
            provider,
            ping: true,
          }),
        });
        const ok = res.ok;
        setPingResult(ok ? 'ok' : 'fail');
        return ok;
      } catch {
        setPingResult('fail');
        return false;
      } finally {
        setPinging(false);
      }
    },
    [apiKey, provider]
  );

  /**
   * LLM 텍스트 생성 — 스트리밍(SSE) 지원
   */
  const generate = useCallback(
    async (
      mode: AiMode,
      baby: BabyProfile,
      recentLogs: BabyDailyLog[],
      latestGrowth: BabyGrowthRecord | null,
      options?: { qaQuestion?: string; stream?: boolean }
    ): Promise<void> => {
      if (!apiKey) {
        setError('API 키가 필요합니다. 설정에서 키를 등록해 주세요.');
        return;
      }
      setGenerating(true);
      setError(null);
      setResult('');

      try {
        const { systemPrompt, userPrompt } = buildPromptPayload(
          baby,
          recentLogs,
          latestGrowth,
          mode,
          options?.qaQuestion
        );

        const useStream = options?.stream ?? true;

        const res = await fetch('/api/ai/proxy', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            provider,
            systemPrompt,
            userPrompt,
            stream: useStream,
          }),
        });

        if (!res.ok) {
          const errJson = await res.json().catch(() => ({}));
          throw new Error(errJson?.error ?? `HTTP ${res.status}`);
        }

        if (useStream && res.body) {
          // 스트리밍 처리
          const reader = res.body.getReader();
          const decoder = new TextDecoder();
          let accumulated = '';
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            const chunk = decoder.decode(value, { stream: true });
            // SSE 라인 파싱 (data: {...})
            const lines = chunk.split('\n');
            for (const line of lines) {
              if (!line.startsWith('data: ')) continue;
              const payload = line.slice(6).trim();
              if (payload === '[DONE]') continue;
              try {
                const parsed = JSON.parse(payload);
                // OpenAI format
                const delta = parsed.choices?.[0]?.delta?.content ?? '';
                // Anthropic format
                const anthropicDelta = parsed.delta?.text ?? '';
                accumulated += delta || anthropicDelta;
                setResult(accumulated);
              } catch {
                // JSON 파싱 실패 시 무시
              }
            }
          }
        } else {
          // 일반 JSON 응답
          const json = await res.json();
          const text =
            json.choices?.[0]?.message?.content?.trim() ??
            json.content?.[0]?.text?.trim() ??
            '';
          setResult(text);
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'AI 응답을 받지 못했습니다.';
        console.error('[useBabyAiGuide] AI 오류:', err);
        setError(msg);
      } finally {
        setGenerating(false);
      }
    },
    [apiKey, provider]
  );

  return {
    provider,
    apiKey,
    hasApiKey: Boolean(apiKey),
    saveApiKey,
    clearApiKey,
    switchProvider,
    pingTest,
    pinging,
    pingResult,
    generate,
    generating,
    result,
    error,
    clearResult: () => {
      setResult('');
      setError(null);
      setPingResult(null);
    },
  };
}
