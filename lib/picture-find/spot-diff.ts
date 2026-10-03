import { supabase } from '@/lib/supabase';
import type { NormalizedRegion } from './types';

/**
 * 각 diff 영역에 적용할 색조 변환 팔레트.
 * Canvas 'hue' 합성 모드 사용 → 원본 밝기/채도를 유지하면서 색조만 바꿔
 * 자연스러운 틀린그림 효과를 만든다.
 */
const HUE_COLORS = [
  'hsl(210, 100%, 50%)',  // 파랑
  'hsl(0,   100%, 50%)',  // 빨강
  'hsl(120, 100%, 35%)',  // 초록
  'hsl(270, 100%, 55%)',  // 보라
  'hsl(50,  100%, 50%)',  // 노랑
  'hsl(330, 100%, 50%)',  // 핑크
  'hsl(180, 100%, 35%)',  // 청록
  'hsl(30,  100%, 50%)',  // 주황
];

/**
 * 채도 판별 기준값 (0~1). 이 값 미만이면 저채도로 판정해 difference blend를 사용한다.
 * 0.12 = 대략 흑백에 가까운 중립 영역 (예: 흰 벽, 회색 도로, 흑백 사진)
 */
const SATURATION_THRESHOLD = 0.12;

/**
 * 원형 영역 내 픽셀들의 평균 HSL 채도(0~1)를 반환한다.
 * getImageData로 해당 박스를 읽고, 원 안에 있는 픽셀만 계산한다.
 */
function sampleRegionAvgSaturation(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  radius: number,
): number {
  const x0 = Math.max(0, Math.round(cx - radius));
  const y0 = Math.max(0, Math.round(cy - radius));
  const bw = Math.min(ctx.canvas.width - x0, Math.round(radius * 2));
  const bh = Math.min(ctx.canvas.height - y0, Math.round(radius * 2));
  if (bw <= 0 || bh <= 0) return 0;

  const data = ctx.getImageData(x0, y0, bw, bh).data;
  const boxCx = cx - x0;
  const boxCy = cy - y0;
  const r2 = radius * radius;

  let totalSat = 0;
  let count = 0;

  for (let py = 0; py < bh; py++) {
    for (let px = 0; px < bw; px++) {
      const dx = px - boxCx;
      const dy = py - boxCy;
      if (dx * dx + dy * dy > r2) continue;          // 원 밖 픽셀 제외

      const i = (py * bw + px) * 4;
      const r = data[i] / 255;
      const g = data[i + 1] / 255;
      const b = data[i + 2] / 255;

      const max = Math.max(r, g, b);
      const min = Math.min(r, g, b);
      if (max === min) { count++; continue; }        // 완전 중립 → 채도 0

      const l = (max + min) / 2;
      const sat = l < 0.5
        ? (max - min) / (max + min)
        : (max - min) / (2 - max - min);

      totalSat += sat;
      count++;
    }
  }

  return count > 0 ? totalSat / count : 0;
}

/**
 * 하나의 원본 이미지에서 diff 영역만 색조를 바꾼 오른쪽 비교 이미지를 생성한다.
 *
 * Canvas 'hue' blend 모드: 원본 픽셀의 밝기(L)·채도(S)는 유지하고 색조(H)만 교체 →
 * 색칠된 원이 아닌, 해당 부분 색깔이 실제로 달라 보이는 자연스러운 차이가 만들어진다.
 *
 * SVG 파일 대응: naturalWidth/naturalHeight가 0인 경우(viewBox만 있는 SVG)
 * 800×600 폴백을 사용해 canvas가 0×0이 되는 문제를 방지한다.
 */
export async function generateSpotDiffVariantDataUrl(
  imageUrl: string,
  regions: NormalizedRegion[],
): Promise<string> {
  const img = await loadImageForCanvas(imageUrl);
  const canvas = document.createElement('canvas');

  // SVG 등 naturalWidth=0 인 경우 viewBox 대신 안전한 fallback 사용
  const W = img.naturalWidth || img.width || 800;
  const H = img.naturalHeight || img.height || 600;
  canvas.width = W;
  canvas.height = H;

  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas unsupported');

  // 1) 원본 이미지를 먼저 그린다 (이후 hue blend의 대상 레이어가 됨)
  ctx.drawImage(img, 0, 0, W, H);

  // 2) 각 diff 영역에 색조 변환 적용
  //    - 채도가 충분한 영역: 'hue' blend → 색조만 바꿔 자연스러운 색깔 차이
  //    - 저채도(흑백·회색) 영역: 'difference' blend → 명도 반전으로 눈에 띄는 차이
  regions.forEach((region, index) => {
    const cx = region.x * W;
    const cy = region.y * H;
    const radius = region.r * Math.min(W, H);

    // 원형 영역의 평균 채도를 계산해 blend 방식 결정
    const avgSat = sampleRegionAvgSaturation(ctx, cx, cy, radius);
    const useDifference = avgSat < SATURATION_THRESHOLD;

    ctx.save();

    // 원형 영역으로 클리핑
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.clip();

    if (useDifference) {
      // 저채도 영역: difference + white → 전체 채널 반전 (어둠↔밝음)
      // 흑백 사진이나 회색 벽 등 색 없는 부분에서도 명확한 차이를 만든다
      ctx.globalCompositeOperation = 'difference';
      ctx.globalAlpha = 1.0;
      ctx.fillStyle = '#ffffff';
    } else {
      // 고채도 영역: hue blend → 원본 밝기·채도 유지, 색조만 교체
      ctx.globalCompositeOperation = 'hue';
      ctx.globalAlpha = 1.0;
      ctx.fillStyle = HUE_COLORS[index % HUE_COLORS.length];
    }

    ctx.fillRect(cx - radius, cy - radius, radius * 2, radius * 2);
    ctx.restore();
  });

  return canvas.toDataURL('image/jpeg', 0.92);
}

async function resolveCanvasSourceUrl(src: string): Promise<string> {
  if (!src.startsWith('http://') && !src.startsWith('https://')) {
    return src;
  }

  const {
    data: { session },
  } = await supabase.auth.getSession();
  const token = session?.access_token;
  if (!token) throw new Error('IMAGE_LOAD_FAILED');

  const res = await fetch(
    `/api/v1/picture-find/image-proxy?url=${encodeURIComponent(src)}`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  if (!res.ok) throw new Error('IMAGE_LOAD_FAILED');
  const blob = await res.blob();
  return URL.createObjectURL(blob);
}

function loadImageForCanvas(src: string): Promise<HTMLImageElement> {
  return (async () => {
    const url = await resolveCanvasSourceUrl(src);
    return new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      const cleanup = () => {
        // blob: URL은 사용 후 해제해 메모리 누수 방지
        if (url.startsWith('blob:')) URL.revokeObjectURL(url);
      };
      img.onload = () => { cleanup(); resolve(img); };
      img.onerror = () => { cleanup(); reject(new Error('IMAGE_LOAD_FAILED')); };
      img.src = url;
    });
  })();
}

export async function resolveSpotDiffPair(
  sceneImageUrl: string,
  variantImageUrl: string | null,
  diffMode: 'auto' | 'manual',
  regions: NormalizedRegion[],
): Promise<{ leftUrl: string; rightUrl: string }> {
  if (diffMode === 'manual' && variantImageUrl) {
    return { leftUrl: sceneImageUrl, rightUrl: variantImageUrl };
  }
  const rightUrl = await generateSpotDiffVariantDataUrl(sceneImageUrl, regions);
  return { leftUrl: sceneImageUrl, rightUrl };
}
