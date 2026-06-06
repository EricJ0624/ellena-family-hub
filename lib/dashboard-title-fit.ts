/** canvas measureText로 가용 폭에 맞는 font-size(px) 계산 */

export const DEFAULT_APP_TITLE_MAX_PX_PORTRAIT = 42;
export const DEFAULT_APP_TITLE_MIN_PX_PORTRAIT = 28;

export function measureTextWidthPx(
  text: string,
  fontSizePx: number,
  fontFamily: string,
  fontWeight: string | number,
  letterSpacingPx = 0,
): number {
  if (typeof document === 'undefined' || !text) return 0;

  if (letterSpacingPx !== 0) {
    const probe = document.createElement('span');
    probe.textContent = text;
    probe.style.cssText = [
      'position:absolute',
      'visibility:hidden',
      'white-space:nowrap',
      'pointer-events:none',
      `font-size:${fontSizePx}px`,
      `font-family:${fontFamily}`,
      `font-weight:${fontWeight}`,
      `letter-spacing:${letterSpacingPx}px`,
    ].join(';');
    document.body.appendChild(probe);
    const w = probe.offsetWidth;
    document.body.removeChild(probe);
    return w;
  }

  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) return 0;
  ctx.font = `${fontWeight} ${fontSizePx}px ${fontFamily}`;
  return ctx.measureText(text).width;
}

/** 커스텀 가족 이름 타이틀 — app_title clamp 최솟값(33~40px)과 별도 */
export const CUSTOM_TITLE_FONT_MIN_PX = 14;
export const CUSTOM_TITLE_FONT_MAX_PX = {
  admin: 31,
  user: 41,
} as const;

/** 긴 가족 이름은 상한을 더 낮춤 */
export function customTitleMaxFontSize(
  text: string,
  role: 'admin' | 'user',
  styleCap: number | null,
): number {
  const baseCap = Math.min(styleCap ?? CUSTOM_TITLE_FONT_MAX_PX[role], CUSTOM_TITLE_FONT_MAX_PX[role]);
  const len = text.trim().length;
  if (len > 20) return Math.min(baseCap, role === 'admin' ? 24 : 30);
  if (len > 14) return Math.min(baseCap, role === 'admin' ? 28 : 34);
  return baseCap;
}

export function fitFontSizeToWidth(
  text: string,
  maxWidthPx: number,
  minPx: number,
  maxPx: number,
  fontFamily: string,
  fontWeight: string | number,
  letterSpacingPx = 0,
): number {
  if (!text || maxWidthPx <= 0) return maxPx;
  for (let size = maxPx; size >= minPx; size -= 1) {
    if (
      measureTextWidthPx(text, size, fontFamily, fontWeight, letterSpacingPx) <= maxWidthPx
    ) {
      return size;
    }
  }
  return minPx;
}

/** AppTitleContent — main 1em, 괄호 0.65em, 부제 0.333em */
export function measureAppTitleWidthPx(
  title: string,
  baseFontSizePx: number,
  fontFamily: string,
  fontWeight: string | number,
  letterSpacingPx = 0,
): number {
  if (!title) return 0;
  const colon = title.indexOf(': ');
  if (colon < 0) {
    return measureTextWidthPx(title, baseFontSizePx, fontFamily, fontWeight, letterSpacingPx);
  }

  const mainStr = title.slice(0, colon + 2);
  const sub = title.slice(colon + 2);
  const parenMatch = mainStr.match(/^(.*?)(\s*\([^)]+\))(.*)$/);
  const mainWidth = parenMatch
    ? measureTextWidthPx(parenMatch[1], baseFontSizePx, fontFamily, fontWeight, letterSpacingPx)
      + measureTextWidthPx(
        parenMatch[2],
        baseFontSizePx * 0.65,
        fontFamily,
        fontWeight,
        letterSpacingPx,
      )
      + measureTextWidthPx(parenMatch[3], baseFontSizePx, fontFamily, fontWeight, letterSpacingPx)
    : measureTextWidthPx(mainStr, baseFontSizePx, fontFamily, fontWeight, letterSpacingPx);

  return (
    mainWidth
    + measureTextWidthPx(
      sub,
      baseFontSizePx * 0.333,
      fontFamily,
      fontWeight,
      letterSpacingPx,
    )
  );
}

export function fitAppTitleFontSizeToWidth(
  title: string,
  maxWidthPx: number,
  minPx: number,
  maxPx: number,
  fontFamily: string,
  fontWeight: string | number,
  letterSpacingPx = 0,
): number {
  if (!title || maxWidthPx <= 0) return maxPx;
  for (let size = maxPx; size >= minPx; size -= 1) {
    if (
      measureAppTitleWidthPx(title, size, fontFamily, fontWeight, letterSpacingPx) <= maxWidthPx
    ) {
      return size;
    }
  }
  return minPx;
}

/** h1 실제 scrollWidth 기준 — React 렌더 후 1회 보정용 */
export function shrinkFontSizeToElement(
  el: HTMLElement,
  maxPx: number,
  minPx: number,
): number {
  let size = maxPx;
  el.style.fontSize = `${size}px`;
  while (el.scrollWidth > el.clientWidth + 1 && size > minPx) {
    size -= 1;
    el.style.fontSize = `${size}px`;
  }
  return size;
}

/** 관리자(⚙️ 버튼 있음) vs 일반 사용자 대시보드 타이틀 가용 폭 (fallback) */
export const DASHBOARD_TITLE_MAX_WIDTH = {
  admin: 262,
  user: 350,
} as const;
