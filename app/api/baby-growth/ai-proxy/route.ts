/**
 * /api/baby-growth/ai-proxy — LLM Pass-through Proxy
 *
 * 보안 원칙:
 * - 사용자의 API 키는 Authorization 헤더로 전달받아 메모리에서만 사용
 * - 서버 DB에 저장하지 않음
 * - 로그에 키를 출력하지 않음
 * - 요청자 인증(Supabase 세션)은 필수
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuthUser } from '@/lib/api-guards';

type AiProvider = 'openai' | 'anthropic';

const OPENAI_ENDPOINT = 'https://api.openai.com/v1/chat/completions';
const ANTHROPIC_ENDPOINT = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_VERSION = '2023-06-01';

const DEFAULT_MODEL: Record<AiProvider, string> = {
  openai: 'gpt-4o-mini',
  anthropic: 'claude-3-haiku-20240307',
};

export async function POST(request: NextRequest) {
  // 1. 인증 확인 — Supabase 세션
  const authResult = await requireAuthUser(request);
  if (authResult instanceof NextResponse) return authResult;

  // 2. 사용자 API 키 추출 (Authorization: Bearer <key>)
  const authHeader = request.headers.get('Authorization') ?? '';
  const userApiKey = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';

  if (!userApiKey) {
    return NextResponse.json({ error: 'API 키가 없습니다. Authorization 헤더에 Bearer 키를 포함해 주세요.' }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: '요청 본문이 올바른 JSON이 아닙니다.' }, { status: 400 });
  }

  const provider = (body.provider as AiProvider) ?? 'openai';
  const isPing = body.ping === true;

  // ---------------------------------------------------------------------------
  // Ping Test — 최소 토큰으로 API 키 유효성 검증
  // ---------------------------------------------------------------------------
  if (isPing) {
    try {
      if (provider === 'openai') {
        const res = await fetch(OPENAI_ENDPOINT, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${userApiKey}`,
          },
          body: JSON.stringify({
            model: DEFAULT_MODEL.openai,
            messages: [{ role: 'user', content: 'ping' }],
            max_tokens: 1,
          }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          return NextResponse.json({ error: err?.error?.message ?? 'Invalid API key' }, { status: res.status });
        }
        return NextResponse.json({ ok: true });
      } else {
        // Anthropic ping
        const res = await fetch(ANTHROPIC_ENDPOINT, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': userApiKey,
            'anthropic-version': ANTHROPIC_VERSION,
          },
          body: JSON.stringify({
            model: DEFAULT_MODEL.anthropic,
            max_tokens: 1,
            messages: [{ role: 'user', content: 'ping' }],
          }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          return NextResponse.json({ error: err?.error?.message ?? 'Invalid API key' }, { status: res.status });
        }
        return NextResponse.json({ ok: true });
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : '연결 실패';
      return NextResponse.json({ error: msg }, { status: 502 });
    }
  }

  // ---------------------------------------------------------------------------
  // 실제 생성 요청
  // ---------------------------------------------------------------------------
  const systemPrompt = (body.systemPrompt as string) ?? '';
  const userPrompt = (body.userPrompt as string) ?? '';
  const useStream = body.stream === true;
  const maxTokens = typeof body.maxTokens === 'number' ? body.maxTokens : 500;

  if (!userPrompt) {
    return NextResponse.json({ error: 'userPrompt는 필수입니다.' }, { status: 400 });
  }

  try {
    if (provider === 'openai') {
      const model = (body.model as string) || DEFAULT_MODEL.openai;
      const messages: { role: string; content: string }[] = [];
      if (systemPrompt) messages.push({ role: 'system', content: systemPrompt });
      messages.push({ role: 'user', content: userPrompt });

      const upstream = await fetch(OPENAI_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${userApiKey}`,
        },
        body: JSON.stringify({ model, messages, max_tokens: maxTokens, temperature: 0.7, stream: useStream }),
      });

      if (!upstream.ok) {
        const err = await upstream.json().catch(() => ({}));
        return NextResponse.json({ error: err?.error?.message ?? `OpenAI HTTP ${upstream.status}` }, { status: upstream.status });
      }

      if (useStream && upstream.body) {
        return new NextResponse(upstream.body, {
          headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            Connection: 'keep-alive',
          },
        });
      }

      const json = await upstream.json();
      return NextResponse.json(json);

    } else {
      // Anthropic
      const model = (body.model as string) || DEFAULT_MODEL.anthropic;
      const anthropicBody: Record<string, unknown> = {
        model,
        max_tokens: maxTokens,
        messages: [{ role: 'user', content: userPrompt }],
        stream: useStream,
      };
      if (systemPrompt) anthropicBody.system = systemPrompt;

      const upstream = await fetch(ANTHROPIC_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': userApiKey,
          'anthropic-version': ANTHROPIC_VERSION,
        },
        body: JSON.stringify(anthropicBody),
      });

      if (!upstream.ok) {
        const err = await upstream.json().catch(() => ({}));
        return NextResponse.json({ error: err?.error?.message ?? `Anthropic HTTP ${upstream.status}` }, { status: upstream.status });
      }

      if (useStream && upstream.body) {
        return new NextResponse(upstream.body, {
          headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            Connection: 'keep-alive',
          },
        });
      }

      const json = await upstream.json();
      return NextResponse.json(json);
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : '업스트림 연결 실패';
    console.error('[ai-proxy] 오류:', msg);
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
