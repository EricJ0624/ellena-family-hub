/**
 * useTravelAiPlanner — 여행 일정 AI 생성 (일정 가져오기 위저드용)
 *
 * 보안 원칙:
 * - API 키는 localStorage: sfh_ai_key_{userId}_{provider}
 * - LLM 호출은 /api/ai/proxy 통과
 * - 키는 서버에 저장되지 않음
 */

import { useState, useCallback } from 'react';
import type { ParsedImportItem } from '@/lib/modules/travel-planner/itinerary-import-types';

// ---------------------------------------------------------------------------
// 타입
// ---------------------------------------------------------------------------

export type AiProvider = 'openai' | 'anthropic';

export interface TravelAiDraft {
  title: string;
  destination: string;
  start_date: string;
  end_date: string;
}

export interface AiItineraryItem {
  day_date: string;
  title: string;
  description?: string;
  start_time?: string;
  end_time?: string;
}

export interface AiAccommodationItem {
  name: string;
  check_in_date: string;
  check_out_date: string;
  check_in_time?: string;
  check_out_time?: string;
  address?: string;
  memo?: string;
}

export interface AiDiningItem {
  name: string;
  day_date: string;
  time_at?: string;
  category?: string;
  memo?: string;
  address?: string;
}

export interface AiTransportItem {
  transport_type: 'air' | 'train' | 'car' | 'bike';
  day_date: string;
  departure?: string;
  arrival?: string;
  start_time?: string;
  end_time?: string;
  memo?: string;
}

export interface AiTravelPlan {
  itineraries: AiItineraryItem[];
  accommodations: AiAccommodationItem[];
  dining: AiDiningItem[];
  transports: AiTransportItem[];
}

// ---------------------------------------------------------------------------
// localStorage
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

/** AI JSON → 가져오기 위저드 ParsedImportItem[] */
export function aiTravelPlanToImportItems(plan: AiTravelPlan): ParsedImportItem[] {
  const items: ParsedImportItem[] = [];
  let n = 0;
  const id = () => `ai-${Date.now()}-${n++}`;

  for (const a of plan.accommodations) {
    if (!a.name?.trim() || !a.check_in_date) continue;
    items.push({
      id: id(),
      kind: 'accommodation',
      title: a.name.trim(),
      check_in_date: a.check_in_date,
      check_out_date: a.check_out_date || a.check_in_date,
      day_date: a.check_in_date,
      address: a.address ?? null,
      description: a.memo ?? null,
    });
  }

  for (const t of plan.transports) {
    if (!t.day_date) continue;
    const title =
      t.departure && t.arrival
        ? `${t.departure} → ${t.arrival}`
        : t.memo?.trim() || t.transport_type;
    items.push({
      id: id(),
      kind: 'transport',
      title,
      day_date: t.day_date,
      start_time: t.start_time ?? null,
      end_time: t.end_time ?? null,
      transport_type: t.transport_type,
      departure: t.departure ?? null,
      arrival: t.arrival ?? null,
      description: t.memo ?? null,
    });
  }

  for (const d of plan.dining) {
    if (!d.name?.trim() || !d.day_date) continue;
    items.push({
      id: id(),
      kind: 'dining',
      title: d.name.trim(),
      day_date: d.day_date,
      start_time: d.time_at ?? null,
      address: d.address ?? null,
      description: d.memo ?? d.category ?? null,
    });
  }

  for (const i of plan.itineraries) {
    if (!i.title?.trim() || !i.day_date) continue;
    items.push({
      id: id(),
      kind: 'other',
      title: i.title.trim(),
      day_date: i.day_date,
      start_time: i.start_time ?? null,
      end_time: i.end_time ?? null,
      description: i.description ?? null,
    });
  }

  return items;
}

// ---------------------------------------------------------------------------
// 프롬프트
// ---------------------------------------------------------------------------

function buildTravelPrompt(
  draft: TravelAiDraft,
  options: { theme: string; notes: string; isKorean: boolean },
): { systemPrompt: string; userPrompt: string } {
  const { theme, notes, isKorean } = options;

  const schema = `{
  "itineraries": [{ "day_date": "YYYY-MM-DD", "title": "장소/일정명", "description": "설명(선택)", "start_time": "HH:MM(선택)", "end_time": "HH:MM(선택)" }],
  "accommodations": [{ "name": "숙소명", "check_in_date": "YYYY-MM-DD", "check_out_date": "YYYY-MM-DD", "address": "주소(선택)", "memo": "메모(선택)" }],
  "dining": [{ "name": "식당명", "day_date": "YYYY-MM-DD", "time_at": "HH:MM(선택)", "category": "한식/일식 등(선택)", "address": "주소(선택)" }],
  "transports": [{ "transport_type": "air|train|car|bike", "day_date": "YYYY-MM-DD", "departure": "출발지(선택)", "arrival": "도착지(선택)", "start_time": "HH:MM(선택)", "memo": "메모(선택)" }]
}`;

  const systemPrompt = isKorean
    ? `당신은 전문 가족 여행 플래너입니다. 주어진 여행 정보를 바탕으로 상세한 여행 계획을 JSON 형식으로만 반환하세요.
JSON 외의 텍스트를 절대 포함하지 마세요. 스키마:
${schema}
- 모든 날짜는 여행 기간 내에 있어야 합니다.
- 반드시 유효한 JSON만 반환하세요.`
    : `You are a professional family travel planner. Return ONLY JSON. Schema:
${schema}
- All dates within trip duration.
- Return ONLY valid JSON.`;

  const tripLines = [
    draft.title ? `여행 제목: ${draft.title}` : null,
    draft.destination ? `목적지: ${draft.destination}` : null,
    `여행 기간: ${draft.start_date} ~ ${draft.end_date}`,
    theme ? `여행 테마: ${theme}` : null,
    notes ? `요청 사항: ${notes}` : null,
  ].filter(Boolean).join('\n');

  const userPrompt = isKorean
    ? `다음 여행 정보를 바탕으로 상세한 여행 계획을 JSON으로 작성해 주세요.\n\n${tripLines}\n\n주의: 반드시 JSON만 반환하세요.`
    : `Create a detailed travel plan in JSON.\n\n${tripLines}\n\nIMPORTANT: Return ONLY valid JSON.`;

  return { systemPrompt, userPrompt };
}

function parseAiTravelPlan(text: string): AiTravelPlan | null {
  let jsonText = text.trim();
  const fenceMatch = jsonText.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) jsonText = fenceMatch[1].trim();
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
  hasApiKeyRevision?: number;
}

export function useTravelAiPlanner({ userId, hasApiKeyRevision }: UseTravelAiPlannerProps) {
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const keyInfo = getStoredAiKey(userId);
  void hasApiKeyRevision;

  const [generating, setGenerating] = useState(false);
  const [plan, setPlan] = useState<AiTravelPlan | null>(null);
  const [error, setError] = useState<string | null>(null);

  const clearPlan = useCallback(() => {
    setPlan(null);
    setError(null);
  }, []);

  const generate = useCallback(
    async (
      draft: TravelAiDraft,
      options: { theme: string; notes: string; isKorean: boolean },
    ): Promise<AiTravelPlan | null> => {
      const currentKeyInfo = getStoredAiKey(userId);
      if (!currentKeyInfo) {
        setError('API 키가 필요합니다. 계정 설정에서 API 키를 등록해 주세요.');
        return null;
      }
      if (!draft.start_date || !draft.end_date) {
        setError('여행 시작일·종료일을 입력해 주세요.');
        return null;
      }
      if (!draft.destination.trim()) {
        setError('목적지를 입력해 주세요.');
        return null;
      }

      setGenerating(true);
      setError(null);
      setPlan(null);

      try {
        const { systemPrompt, userPrompt } = buildTravelPrompt(draft, options);

        const res = await fetch('/api/ai/proxy', {
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
          return parsed;
        }
        setError('AI 응답을 JSON으로 파싱하지 못했습니다. 다시 시도해 주세요.');
        return null;
      } catch (err) {
        setError(err instanceof Error ? err.message : 'AI 응답을 받지 못했습니다.');
        return null;
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
