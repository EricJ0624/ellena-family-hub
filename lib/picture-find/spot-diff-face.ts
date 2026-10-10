import type { NormalizedRegion } from './types';

export type FacePose = 'front' | 'profile';

export type FaceAnchorKind = 'glasses' | 'earring' | 'mole';

export type FaceAnchor = {
  kind: FaceAnchorKind;
  x: number;
  y: number;
};

export type HeadBox = {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
};

export type FaceLayout = {
  pose: FacePose;
  head: HeadBox;
  anchors: FaceAnchor[];
};

export type FaceGrid = {
  cols: number;
  rows: number;
  skin: Uint8Array;
  lum: Uint8Array;
};

type EyeBlob = { x: number; y: number; width: number };

function clampUnit(value: number): number {
  return Math.min(0.94, Math.max(0.06, value));
}

function pointInHead(head: HeadBox, x: number, y: number): boolean {
  const pad = 0.03;
  return x >= head.x0 - pad && x <= head.x1 + pad && y >= head.y0 - pad && y <= head.y1 + pad;
}

/**
 * 피부 격자에서 정면/옆모습을 가른다.
 * 눈이 둘로 나뉘거나, 눈 띠가 넓고 좌우 피부가 비슷하면 정면이다.
 * 눈이 확인되지 않으면 옆모습으로 두어 귀걸이·안경을 넣지 않는다.
 */
export function layoutFace(grid: FaceGrid): FaceLayout | null {
  const { cols, rows, skin, lum } = grid;
  const total = cols * rows;
  if (total === 0) return null;

  let skinCount = 0;
  let minX = cols;
  let minY = rows;
  let maxX = -1;
  let maxY = -1;
  for (let i = 0; i < total; i += 1) {
    if (!skin[i]) continue;
    skinCount += 1;
    const x = i % cols;
    const y = Math.floor(i / cols);
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
  }
  if (skinCount < total * 0.03 || maxX < minX) return null;

  const x0 = minX;
  const y0 = minY;
  const x1 = maxX;
  let y1 = maxY;
  const boxW = x1 - x0 + 1;
  const boxH = y1 - y0 + 1;
  if (boxH > boxW * 1.4) y1 = Math.min(rows - 1, Math.round(y0 + boxW * 1.25));

  const headW = x1 - x0 + 1;
  const headH = y1 - y0 + 1;
  if (headW < cols * 0.12 || headH < rows * 0.1) return null;

  let skinLum = 0;
  let skinLumCount = 0;
  let leftSkin = 0;
  let rightSkin = 0;
  const midX = (x0 + x1) / 2;
  for (let y = y0; y <= y1; y += 1) {
    for (let x = x0; x <= x1; x += 1) {
      const i = y * cols + x;
      if (!skin[i]) continue;
      skinLum += lum[i];
      skinLumCount += 1;
      if (x < midX) leftSkin += 1;
      else rightSkin += 1;
    }
  }
  if (skinLumCount === 0) return null;
  const skinMean = skinLum / skinLumCount;
  const darkLimit = Math.min(110, skinMean * 0.62);
  const balance = Math.min(leftSkin, rightSkin) / Math.max(leftSkin, rightSkin, 1);

  const eyeY0 = Math.round(y0 + headH * 0.28);
  const eyeY1 = Math.round(y0 + headH * 0.5);
  const colScore = new Float32Array(cols);
  const colY = new Float32Array(cols);
  for (let y = eyeY0; y <= eyeY1; y += 1) {
    for (let x = x0; x <= x1; x += 1) {
      const i = y * cols + x;
      if (lum[i] >= darkLimit) continue;
      colScore[x] += 1;
      colY[x] += y;
    }
  }

  const eyes = findEyeBlobs(colScore, colY, x0, x1, headW);
  const wideEyes = eyes.length === 1 && eyes[0].width > headW * 0.22 && balance >= 0.6;
  const pose: FacePose = eyes.length >= 2 || wideEyes ? 'front' : 'profile';

  const nx0 = x0 / cols;
  const ny0 = y0 / rows;
  const nx1 = x1 / cols;
  const ny1 = y1 / rows;
  const head: HeadBox = { x0: nx0, y0: ny0, x1: nx1, y1: ny1 };
  const w = nx1 - nx0;
  const h = ny1 - ny0;

  if (pose === 'profile') {
    const cheekX = leftSkin >= rightSkin ? nx0 + w * 0.38 : nx0 + w * 0.62;
    const anchors: FaceAnchor[] = [0, 1, 2, 3].map((step) => ({
      kind: 'mole',
      x: clampUnit(cheekX + (step % 2 === 0 ? -0.05 : 0.05) * w),
      y: clampUnit(ny0 + (0.5 + step * 0.09) * h),
    }));
    return { pose, head, anchors };
  }

  const eyeY = eyes.length >= 2
    ? ((eyes[0].y + eyes[1].y) / 2) / rows
    : ny0 + h * 0.38;
  const eyeX = eyes.length >= 2
    ? ((eyes[0].x + eyes[1].x) / 2) / cols
    : nx0 + w * 0.5;

  const anchors: FaceAnchor[] = [
    { kind: 'glasses', x: clampUnit(eyeX), y: clampUnit(eyeY) },
    { kind: 'mole', x: clampUnit(nx0 + w * 0.32), y: clampUnit(ny0 + h * 0.66) },
    { kind: 'mole', x: clampUnit(nx0 + w * 0.7), y: clampUnit(ny0 + h * 0.7) },
    { kind: 'mole', x: clampUnit(nx0 + w * 0.48), y: clampUnit(ny0 + h * 0.76) },
  ];
  const earY = clampUnit(ny0 + h * 0.58);
  if (earSideInFrame(grid, x0, y0, x1, y1, 'left')) {
    anchors.splice(1, 0, { kind: 'earring', x: clampUnit(nx0 + w * 0.08), y: earY });
  }
  if (earSideInFrame(grid, x0, y0, x1, y1, 'right')) {
    anchors.push({ kind: 'earring', x: clampUnit(nx1 - w * 0.08), y: earY });
  }
  return { pose, head, anchors };
}

/** 얼굴 옆이 사진 안에 남고, 그 옆에 배경이 있을 때만 귀가 보이는 쪽으로 본다. */
function earSideInFrame(
  grid: FaceGrid,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  side: 'left' | 'right',
): boolean {
  const { cols, rows, skin } = grid;
  const edgePad = Math.max(1, Math.round(cols * 0.04));
  if (side === 'left' && x0 <= edgePad) return false;
  if (side === 'right' && x1 >= cols - 1 - edgePad) return false;

  const earY0 = Math.max(0, Math.round(y0 + (y1 - y0) * 0.48));
  const earY1 = Math.min(rows - 1, Math.round(y0 + (y1 - y0) * 0.7));
  const margin = Math.max(2, Math.round(cols * 0.03));
  const edge = side === 'left' ? x0 : x1;
  const from = side === 'left' ? Math.max(0, edge - margin) : edge;
  const to = side === 'left' ? edge : Math.min(cols - 1, edge + margin);
  let background = 0;
  let samples = 0;
  for (let y = earY0; y <= earY1; y += 1) {
    for (let x = from; x <= to; x += 1) {
      samples += 1;
      if (!skin[y * cols + x]) background += 1;
    }
  }
  return samples > 0 && background / samples >= 0.35;
}

function findEyeBlobs(
  colScore: Float32Array,
  colY: Float32Array,
  x0: number,
  x1: number,
  headW: number,
): EyeBlob[] {
  let max = 0;
  for (let x = x0; x <= x1; x += 1) if (colScore[x] > max) max = colScore[x];
  if (max < 2) return [];
  const threshold = max * 0.45;
  const blobs: EyeBlob[] = [];
  let runStart = -1;
  let runWeight = 0;
  let runX = 0;
  let runY = 0;
  const closeRun = (endX: number) => {
    if (runStart < 0 || runWeight <= 0) return;
    blobs.push({ x: runX / runWeight, y: runY / runWeight, width: endX - runStart + 1 });
    runStart = -1;
    runWeight = 0;
    runX = 0;
    runY = 0;
  };
  for (let x = x0; x <= x1; x += 1) {
    if (colScore[x] >= threshold) {
      if (runStart < 0) runStart = x;
      runWeight += colScore[x];
      runX += x * colScore[x];
      runY += colY[x];
    } else if (runStart >= 0) {
      closeRun(x - 1);
    }
  }
  closeRun(x1);

  const minGap = headW * 0.1;
  const merged: EyeBlob[] = [];
  blobs.forEach((blob) => {
    const prev = merged[merged.length - 1];
    if (prev && blob.x - prev.x < minGap) {
      const weight = prev.width + blob.width;
      prev.x = (prev.x * prev.width + blob.x * blob.width) / weight;
      prev.y = (prev.y * prev.width + blob.y * blob.width) / weight;
      prev.width = weight;
      return;
    }
    merged.push({ ...blob });
  });
  return merged;
}

/**
 * 얼굴 상자 안의 차이만 옮긴다. 손처럼 상자 밖 피부는 그대로 둔다.
 * 정면은 안경과 점을 두고, 귀가 보이는 쪽에만 귀걸이를 더한다. 옆모습은 점만 둔다.
 * 앵커보다 많은 자리는 점이 되며, 마지막 앵커가 귀걸이여도 귀걸이를 복제하지 않는다.
 */
export function assignFaceDifferences(
  regions: NormalizedRegion[],
  layout: FaceLayout | null,
): { regions: NormalizedRegion[]; faceKinds: Array<FaceAnchorKind | null> } {
  const next = regions.map((region) => ({ ...region }));
  const faceKinds: Array<FaceAnchorKind | null> = regions.map(() => null);
  if (!layout) return { regions: next, faceKinds };

  const candidates = regions
    .map((region, index) => ({ region, index }))
    .filter(({ region }) => pointInHead(layout.head, region.x, region.y))
    .map(({ index }) => index);

  candidates.forEach((regionIndex, order) => {
    const overflow = order >= layout.anchors.length;
    const anchor = layout.anchors[Math.min(order, layout.anchors.length - 1)];
    const kind: FaceAnchorKind = overflow ? 'mole' : anchor.kind;
    let x = anchor.x;
    let y = anchor.y;
    if (overflow) {
      const moleAnchor = layout.anchors.find((item) => item.kind === 'mole') ?? anchor;
      const shift = (order - layout.anchors.length + 1) * 0.045;
      x = clampUnit(moleAnchor.x + (order % 2 === 0 ? shift : -shift));
      y = clampUnit(moleAnchor.y + shift * 0.4);
    }
    next[regionIndex] = {
      ...next[regionIndex],
      x,
      y,
      r: kind === 'glasses' ? Math.max(next[regionIndex].r, 0.07) : next[regionIndex].r,
    };
    faceKinds[regionIndex] = kind;
  });

  return { regions: next, faceKinds };
}
