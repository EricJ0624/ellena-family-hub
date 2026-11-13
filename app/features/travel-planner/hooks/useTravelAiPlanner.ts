/**
 * useTravelAiPlanner — 여행 플래너 AI 계획 생성 훅
 *
 * 보안 원칙:
 * - API 키는 useBabyAiGuide와 동일한 localStorage 패턴 사용: sfh_ai_key_{userId}_{provider}
 * - 모든 LLM 호출은 /api/baby-growth/ai-proxy 를 통과 (범용 LLM 프록시)
 * - 키는 서버에 저장되지 않음
 */

import { useState, useCallback } from 'react';
import type { TravelTrip } from '@/lib/modules/travel-planner/types';

// ---------------------------------------------------------------------------
// 타입
// ---------------------------------------------------------------------------

export type AiProvider = 'openai' | 'anthropic';

/** AI가 생성한 기타 일정 항목 */
export interface AiItineraryItem {
  day_date: string;
  title: string;
  description?: string;
  start_time?: string;
  end_time?: string;
}

/** AI가 생성한 숙소 항목 */
export interface AiAccommodationItem {
  name: string;
  check_in_date: string;
  check_out_date: string;
  check_in_time?: string;
  check_out_time?: string;
  address?: string;
  memo?: string;
}

/** AI가 생성한 먹거리 항목 */
export interface AiDiningItem {
  name: string;
  day_date: string;
  time_at?: string;
  category?: string;
  memo?: string;
  address?: string;
}

/** AI가 생성한 교통 항목 */
export interface AiTransportItem {
  transport_type: 'air' | 'train' | 'car' | 'bike';
  day_date: string;
  departure?: string;
  arrival?: string;
  start_time?: string;
  end_time?: string;
  memo?: string;
}

/** AI가 생성한 전체 여행 계획 */
export interface AiTravelPlan {
  itineraries: AiItineraryItem[];
  accommodations: AiAccommodationItem[];
  dining: AiDiningItem[];
  transports: AiTransportItem[];
}

// ---------------------------------------------------------------------------
// 상수 / 유틸
// ---------------------------------------------------------------------------

const LS_KEY = (userId: string, provider: AiProvider) =>
  `sfh_ai_key_${userId}_${provider}`;

export function getStoredAiKey(userId: string): { key: string; provider: AiProvider } | null {
  if (typeof window === 'undefined' || !userId) return null;
  const openaiKey = localStorage.getItem(LS_KEY(userId, 'openai'));
  if (openaiKey) return { key: openaiKey, provider: 'openai' };
  const anthropicKey = localStorage.getItem(LS_KEY(userId, 'anthropic'));
  if (anthropicKey) return { key: anthropicKey, provider: 'anthropic' };
  return null;
}

// ---------------------------------------------------------------------------
// 프롬프트 빌더
// ---------------------------------------------------------------------------

function buildTravelPrompt(
  trip: TravelTrip,
  options: {
    theme: string;
    notes: string;
    participantCount: number;
    isKorean: boolean;
  },
): { systemPrompt: string; userPrompt: string } {
  const { theme, notes, participantCount, isKorean } = options;

  const schema = `{
  "itineraries": [{ "day_date": "YYYY-MM-DD", "title": "장소/일정명", "description": "설명(선택)", "start_time": "HH:MM(선택)", "end_time": "HH:MM(선택)" }],
  "accommodations": [{ "name": "숙소명", "check_in_date": "YYYY-MM-DD", "check_out_date": "YYYY-MM-DD", "check_in_time": "HH:MM(선택)", "address": "주소(선택)", "memo": "메모(선택)" }],
  "dining": [{ "name": "식당명", "day_date": "YYYY-MM-DD", "time_at": "HH:MM(선택)", "category": "한식/일식 등(선택)", "address": "주소(선택)" }],
  "transports": [{ "transport_type": "air|train|car|bike", "day_date": "YYYY-MM-DD", "departure": "출발지(선택)", "arrival": "도착지(선택)", "start_time": "HH:MM(선택)", "memo": "메모(선택)" }]
}`;

  const systemPrompt = isKorean
    ? `당신은 전문 가족 여행 플래너입니다. 주어진 여행 정보를 바탕으로 상세한 여행 계획을 JSON 형식으로만 반환하세요.
JSON 외의 텍스트(설명, 인사말 등)를 절대 포함하지 마세요. 반드시 아래 스키마를 따르세요:
${schema}
- 모든 날짜는 여행 기간(start_date ~ end_date) 내에 있어야 합니다.
- 선택(선택) 표시 필드는 생략 가능합니다.
- 반드시 유효한 JSON만 반환하세요.`
    : `You are a professional family travel planner. Return ONLY a JSON travel plan with no other text. Use this exact schema:
${schema}
- All dates must be within the trip duration (start_date ~ end_date).
- Fields marked (선택) are optional.
- Return ONLY valid JSON, no explanation text.`;

  const tripLines = [
    `여행 제목: ${trip.title}`,
    trip.destination ? `목적지: ${trip.destination}` : null,
    `여행 기간: ${trip.start_date} ~ ${trip.end_date}`,
    participantCount > 0 ? `참가 인원: ${participantCount}명` : null,
    theme ? `여행 테마: ${theme}` : null,
    notes ? `요청 사항: ${notes}` : null,
  ].filter(Boolean).join('\n');

  const userPrompt = isKorean
    ? `다음 여행 정보를 바탕으로 상세한 여행 계획을 JSON으로 작성해 주세요.\n\n${tripLines}\n\n주의: 반드시 JSON만 반환하세요.`
    : `Create a detailed travel plan in JSON for the following trip.\n\n${tripLines}\n\nIMPORTANT: Return ONLY valid JSON, no explanation text.`;

  return { systemPrompt, userPrompt };
}

// ---------------------------------------------------------------------------
// JSON 파서
// ---------------------------------------------------------------------------

function parseAiTravelPlan(text: string): AiTravelPlan | null {
  let jsonText = text.trim();

  // ```json ... ``` 펜스 제거
  const fenceMatch = jsonText.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) jsonText = fenceMatch[1].trim();

  // 순수 JSON 블록 추출 (앞뒤 텍스트가 있는 경우)
  const braceMatch = jsonText.match(/\{[\s\S]*\}/);
  if (braceMatch) jsonText = braceMatch[0];

  try {
    const parsed = JSON.parse(jsonText) as Partial<AiTravelPlan>;
    return {
      itineraries: Array.isArray(parsed.itineraries) ? parsed.itineraries : [],
      accommodations: Array.isArray(parsed.accommodations) ? parsed.accommodations : [],
      dining: Array.isArray(parsed.dining) ? parsed.dining : [],
      transports: Array.isArray(parsed.transports) ? parsed.transports : [],
    };
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// 훅
// ---------------------------------------------------------------------------

interface UseTravelAiPlannerProps {
  userId: string;
  /** hasApiKey 재계산 트리거 (isOpen 등이 바뀔 때마다 호출) */
  hasApiKeyRevision?: number;
}

export function useTravelAiPlanner({ userId, hasApiKeyRevision }: UseTravelAiPlannerProps) {
  // hasApiKeyRevision 이 바뀔 때마다 최신 localStorage 상태 반영
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const keyInfo = getStoredAiKey(userId);
  void hasApiKeyRevision; // 의존성 트리거용

  const [generating, setGenerating] = useState(false);
  const [plan, setPlan] = useState<AiTravelPlan | null>(null);
  const [error, setError] = useState<string | null>(null);

  const clearPlan = useCallback(() => {
    setPlan(null);
    setError(null);
  }, []);

  const generate = useCallback(
    async (
      trip: TravelTrip,
      options: {
        theme: string;
        notes: string;
        participantCount: number;
        isKorean: boolean;
      },
    ) => {
      // 호출 시점에 최신 키 재읽기 (저장 후 즉시 사용 가능하도록)
      const currentKeyInfo = getStoredAiKey(userId);
      if (!currentKeyInfo) {
        setError('API 키가 필요합니다. 계정 설정에서 API 키를 등록해 주세요.');
        return;
      }

      setGenerating(true);
      setError(null);
      setPlan(null);

      try {
        const { systemPrompt, userPrompt } = buildTravelPrompt(trip, options);

        const res = await fetch('/api/baby-growth/ai-proxy', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${currentKeyInfo.key}`,
          },
          body: JSON.stringify({
            provider: currentKeyInfo.provider,
            systemPrompt,
            userPrompt,
            stream: false,
            maxTokens: 2500,
          }),
        });

        if (!res.ok) {
          const errJson = await res.json().catch(() => ({})) as { error?: string };
          throw new Error(errJson?.error ?? `HTTP ${res.status}`);
        }

        const json = await res.json() as Record<string, unknown>;
        const text =
          (json.choices as Array<{ message: { content: string } }>)?.[0]?.message?.content?.trim() ??
          (json.content as Array<{ text: string }>)?.[0]?.text?.trim() ??
          '';

        const parsed = parseAiTravelPlan(text);
        if (parsed) {
          setPlan(parsed);
        } else {
          setError('AI 응답을 JSON으로 파싱하지 못했습니다. 다시 시도해 주세요.');
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'AI 응답을 받지 못했습니다.');
      } finally {
        setGenerating(false);
      }
    },
    [userId],
  );

  return {
    hasApiKey: Boolean(keyInfo),
    generating,
    plan,
    error,
    generate,
    clearPlan,
  };
}
