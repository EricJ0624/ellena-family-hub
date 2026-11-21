/**
 * /api/ai/proxy — 공용 LLM Pass-through Proxy
 *
 * 보안 원칙:
 * - Authorization: Supabase access_token (세션 인증)
 * - X-AI-Api-Key: 사용자 LLM 키 (메모리에서만 사용, 서버 DB 미저장)
 * - custom baseUrl: https만 허용, 사설·루프백·메타데이터 호스트 차단
 * - 로그에 키를 출력하지 않음
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuthUser } from '@/lib/api-guards';
import { AI_USER_PROVIDERS, type AiUserProvider } from '@/lib/ai-user-key';

const OPENAI_ENDPOINT = 'https://api.openai.com/v1/chat/completions';
const ANTHROPIC_ENDPOINT = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_VERSION = '2023-06-01';
const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

const DEFAULT_MODEL: Record<Exclude<AiUserProvider, 'custom'>, string> = {
  // gpt-4o-mini: deprecated, shutdown ~2027-01-14 — 당분간 유지
  openai: 'gpt-4o-mini',
  // claude-3-haiku-20240307 retired 2026-04-20
  anthropic: 'claude-haiku-4-5-20251001',
  // gemini-2.0-flash shut down 2026-06-01
  gemini: 'gemini-3.5-flash-lite',
};

const CUSTOM_DEFAULT_MODEL = 'gpt-4o-mini';

function isPrivateOrLocalHostname(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (
    host === 'localhost' ||
    host === '0.0.0.0' ||
    host === '::1' ||
    host === '::' ||
    host.endsWith('.localhost') ||
    host.endsWith('.local') ||
    host.endsWith('.internal')
  ) {
    return true;
  }
  // IPv4
  const ipv4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(host);
  if (ipv4) {
    const parts = ipv4.slice(1).map((n) => Number(n));
    if (parts.some((n) => n > 255)) return true;
    const [a, b] = parts;
    if (a === 10) return true;
    if (a === 127) return true;
    if (a === 0) return true;
    if (a === 169 && b === 254) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
    return false;
  }
  // IPv6 unique local / link-local
  if (host.startsWith('fc') || host.startsWith('fd') || host.startsWith('fe80')) return true;
  return false;
}

/** custom upstream: https only + block SSRF targets. Returns chat/completions URL. */
function resolveCustomChatCompletionsUrl(rawBase: string): URL {
  let parsed: URL;
  try {
    parsed = new URL(rawBase.trim());
  } catch {
    throw new Error('기타 Base URL 형식이 올바르지 않습니다.');
  }
  if (parsed.protocol !== 'https:') {
    throw new Error('기타 Base URL은 https만 허용됩니다.');
  }
  if (parsed.username || parsed.password) {
    throw new Error('Base URL에 사용자 정보를 포함할 수 없습니다.');
  }
  if (isPrivateOrLocalHostname(parsed.hostname)) {
    throw new Error('사설·로컬 주소는 허용되지 않습니다.');
  }

  const path = parsed.pathname.replace(/\/+$/, '');
  if (path.endsWith('/chat/completions')) {
    return parsed;
  }
  if (path.endsWith('/v1')) {
    parsed.pathname = `${path}/chat/completions`;
    return parsed;
  }
  if (!path || path === '/') {
    parsed.pathname = '/v1/chat/completions';
    return parsed;
  }
  parsed.pathname = `${path}/chat/completions`;
  return parsed;
}

function openaiStyleTextResponse(text: string) {
  return NextResponse.json({
    choices: [{ message: { role: 'assistant', content: text } }],
  });
}

function extractGeminiText(json: Record<string, unknown>, trim = true): string {
  const candidates = json.candidates as
    | Array<{ content?: { parts?: Array<{ text?: string }> } }>
    | undefined;
  const parts = candidates?.[0]?.content?.parts ?? [];
  const text = parts.map((p) => p.text ?? '').join('');
  return trim ? text.trim() : text;
}

async function geminiFetch(params: {
  apiKey: string;
  model: string;
  systemPrompt: string;
  userPrompt: string;
  maxTokens: number;
  stream: boolean;
  ping?: boolean;
}): Promise<Response> {
  const model = encodeURIComponent(params.model);
  const action = params.stream ? 'streamGenerateContent' : 'generateContent';
  const url = `${GEMINI_BASE}/${model}:${action}${params.stream ? '?alt=sse' : ''}`;

  const body: Record<string, unknown> = {
    contents: [{ role: 'user', parts: [{ text: params.userPrompt }] }],
    generationConfig: {
      maxOutputTokens: params.ping ? 1 : params.maxTokens,
      temperature: 0.7,
    },
  };
  if (params.systemPrompt) {
    body.system_instruction = { parts: [{ text: params.systemPrompt }] };
  }

  return fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': params.apiKey,
    },
    body: JSON.stringify(body),
  });
}

/** Gemini SSE → OpenAI-compatible SSE (data: {choices:[{delta:{content}}]}) */
function geminiSseToOpenAiSse(upstream: ReadableStream<Uint8Array>): ReadableStream<Uint8Array> {
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  let buffer = '';

  return new ReadableStream({
    async start(controller) {
      const reader = upstream.getReader();
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() ?? '';
          for (const line of lines) {
            if (!line.startsWith('data: ')) continue;
            const payload = line.slice(6).trim();
            if (!payload || payload === '[DONE]') continue;
            try {
              const parsed = JSON.parse(payload) as Record<string, unknown>;
              // 스트림 청크는 trim 하지 않음 (중간 공백 유실 방지)
              const text = extractGeminiText(parsed, false);
              if (!text) continue;
              controller.enqueue(
                encoder.encode(
                  `data: ${JSON.stringify({ choices: [{ delta: { content: text } }] })}\n\n`,
                ),
              );
            } catch {
              // skip malformed chunk
            }
          }
        }
        controller.enqueue(encoder.encode('data: [DONE]\n\n'));
        controller.close();
      } catch (err) {
        controller.error(err);
      } finally {
        reader.releaseLock();
      }
    },
  });
}

export async function POST(request: NextRequest) {
  const authResult = await requireAuthUser(request);
  if (authResult instanceof NextResponse) return authResult;

  const userApiKey = request.headers.get('x-ai-api-key')?.trim() ?? '';

  if (!userApiKey) {
    return NextResponse.json(
      { error: 'API 키가 없습니다. X-AI-Api-Key 헤더가 필요합니다.' },
      { status: 401 },
    );
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: '요청 본문이 올바른 JSON이 아닙니다.' }, { status: 400 });
  }

  const provider = (body.provider as AiUserProvider) ?? 'openai';
  if (!(AI_USER_PROVIDERS as readonly string[]).includes(provider)) {
    return NextResponse.json({ error: '지원하지 않는 provider입니다.' }, { status: 400 });
  }

  const isPing = body.ping === true;
  const customBaseUrl = typeof body.baseUrl === 'string' ? body.baseUrl.trim() : '';
  const customModel =
    typeof body.model === 'string' && body.model.trim()
      ? body.model.trim()
      : CUSTOM_DEFAULT_MODEL;

  if (provider === 'custom' && !customBaseUrl) {
    return NextResponse.json(
      { error: '기타(OpenAI 호환)는 Base URL이 필요합니다.' },
      { status: 400 },
    );
  }

  let customEndpoint: URL | null = null;
  if (provider === 'custom') {
    try {
      customEndpoint = resolveCustomChatCompletionsUrl(customBaseUrl);
    } catch (e) {
      return NextResponse.json(
        { error: e instanceof Error ? e.message : '잘못된 Base URL' },
        { status: 400 },
      );
    }
  }

  if (isPing) {
    try {
      if (provider === 'openai' || provider === 'custom') {
        const endpoint = provider === 'custom' ? customEndpoint!.toString() : OPENAI_ENDPOINT;
        const model = provider === 'custom' ? customModel : DEFAULT_MODEL.openai;
        const res = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${userApiKey}`,
          },
          body: JSON.stringify({
            model,
            messages: [{ role: 'user', content: 'ping' }],
            max_tokens: 1,
          }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          return NextResponse.json(
            { error: err?.error?.message ?? 'Invalid API key' },
            { status: res.status },
          );
        }
        return NextResponse.json({ ok: true });
      }

      if (provider === 'anthropic') {
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
          return NextResponse.json(
            { error: err?.error?.message ?? 'Invalid API key' },
            { status: res.status },
          );
        }
        return NextResponse.json({ ok: true });
      }

      // gemini
      const res = await geminiFetch({
        apiKey: userApiKey,
        model: (body.model as string) || DEFAULT_MODEL.gemini,
        systemPrompt: '',
        userPrompt: 'ping',
        maxTokens: 1,
        stream: false,
        ping: true,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        return NextResponse.json(
          { error: err?.error?.message ?? err?.message ?? 'Invalid API key' },
          { status: res.status },
        );
      }
      return NextResponse.json({ ok: true });
    } catch (e) {
      const msg = e instanceof Error ? e.message : '연결 실패';
      return NextResponse.json({ error: msg }, { status: 502 });
    }
  }

  const systemPrompt = (body.systemPrompt as string) ?? '';
  const userPrompt = (body.userPrompt as string) ?? '';
  const useStream = body.stream === true;
  const maxTokens = typeof body.maxTokens === 'number' ? body.maxTokens : 500;

  if (!userPrompt) {
    return NextResponse.json({ error: 'userPrompt는 필수입니다.' }, { status: 400 });
  }

  try {
    if (provider === 'openai' || provider === 'custom') {
      const model =
        provider === 'custom'
          ? customModel
          : (body.model as string) || DEFAULT_MODEL.openai;
      const endpoint = provider === 'custom' ? customEndpoint!.toString() : OPENAI_ENDPOINT;
      const messages: { role: string; content: string }[] = [];
      if (systemPrompt) messages.push({ role: 'system', content: systemPrompt });
      messages.push({ role: 'user', content: userPrompt });

      const upstream = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${userApiKey}`,
        },
        body: JSON.stringify({
          model,
          messages,
          max_tokens: maxTokens,
          temperature: 0.7,
          stream: useStream,
        }),
      });

      if (!upstream.ok) {
        const err = await upstream.json().catch(() => ({}));
        return NextResponse.json(
          {
            error:
              err?.error?.message ??
              `${provider === 'custom' ? 'Custom' : 'OpenAI'} HTTP ${upstream.status}`,
          },
          { status: upstream.status },
        );
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

    if (provider === 'anthropic') {
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
        return NextResponse.json(
          { error: err?.error?.message ?? `Anthropic HTTP ${upstream.status}` },
          { status: upstream.status },
        );
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

    // gemini
    const geminiModel = (body.model as string) || DEFAULT_MODEL.gemini;
    const upstream = await geminiFetch({
      apiKey: userApiKey,
      model: geminiModel,
      systemPrompt,
      userPrompt,
      maxTokens,
      stream: useStream,
    });

    if (!upstream.ok) {
      const err = await upstream.json().catch(() => ({}));
      return NextResponse.json(
        { error: err?.error?.message ?? err?.message ?? `Gemini HTTP ${upstream.status}` },
        { status: upstream.status },
      );
    }

    if (useStream && upstream.body) {
      return new NextResponse(geminiSseToOpenAiSse(upstream.body), {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          Connection: 'keep-alive',
        },
      });
    }

    const json = (await upstream.json()) as Record<string, unknown>;
    return openaiStyleTextResponse(extractGeminiText(json));
  } catch (e) {
    const msg = e instanceof Error ? e.message : '업스트림 연결 실패';
    console.error('[ai-proxy] 오류:', msg);
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
