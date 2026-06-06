/** canvas measureText로 가용 폭에 맞는 font-size(px) 계산 */

export function measureTextWidthPx(
  text: string,
  fontSizePx: number,
  fontFamily: string,
  fontWeight: string | number,
): number {
  if (typeof document === 'undefined' || !text) return 0;
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) return 0;
  ctx.font = `${fontWeight} ${fontSizePx}px ${fontFamily}`;
  return ctx.measureText(text).width;
}

export function fitFontSizeToWidth(
  text: string,
  maxWidthPx: number,
  minPx: number,
  maxPx: number,
  fontFamily: string,
  fontWeight: string | number,
): number {
  if (!text || maxWidthPx <= 0) return maxPx;
  if (measureTextWidthPx(text, minPx, fontFamily, fontWeight) <= maxWidthPx) {
    return minPx;
  }
  for (let size = maxPx; size >= minPx; size -= 1) {
    if (measureTextWidthPx(text, size, fontFamily, fontWeight) <= maxWidthPx) {
      return size;
    }
  }
  return minPx;
}

/** 관리자(⚙️ 버튼 있음) vs 일반 사용자 대시보드 타이틀 가용 폭 */
export const DASHBOARD_TITLE_MAX_WIDTH = {
  admin: 262,
  user: 350,
} as const;
