/**
 * guide 응답에서 홈 배너용 한 줄 요약과 본문을 분리한다.
 * 형식: 본문 … + 마지막 줄 `요약: …` (전각 콜론 ： 도 허용)
 */

const BRIEF_PREFIX_RE = /^\s*요약\s*[:：]\s*(.*)$/u;

const FALLBACK_MAX = 40;

function fallbackBrief(text: string): string {
  const cleaned = text.replace(/\s+/g, ' ').trim();
  if (!cleaned) return '';
  const sentence = cleaned.match(/^(.+?[.。!！?？])(?:\s|$)/);
  const first = (sentence?.[1] || cleaned.split(/\n/)[0] || cleaned).trim();
  if (first.length <= FALLBACK_MAX) return first;
  return `${first.slice(0, FALLBACK_MAX)}…`;
}

export function parseGuideResponse(text: string): { body: string; brief: string } {
  const raw = text.replace(/\s+$/u, '');
  if (!raw.trim()) return { body: '', brief: '' };

  const lines = raw.split('\n');
  let briefLineIdx = -1;
  let brief = '';

  for (let i = lines.length - 1; i >= 0; i -= 1) {
    if (!lines[i].trim()) continue;
    const m = lines[i].match(BRIEF_PREFIX_RE);
    if (m) {
      briefLineIdx = i;
      brief = (m[1] || '').trim();
    }
    break;
  }

  if (briefLineIdx >= 0) {
    const body = lines.slice(0, briefLineIdx).join('\n').trim();
    return {
      body: body || raw.trim(),
      brief: brief || fallbackBrief(body || raw),
    };
  }

  const full = raw.trim();
  return { body: full, brief: fallbackBrief(full) };
}

/** 홈 배너용 — 요약 줄이 있으면 그것만, 없으면 짧은 fallback */
export function getGuideBrief(text: string): string {
  return parseGuideResponse(text).brief;
}
