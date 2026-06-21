/**
 * parchment-frame-landscape.png — PNG 전처리
 * - 각 변에서 안쪽으로 평탄한 크림 여백만 제거 → 투명 (대시보드 배경 비침)
 * - 중앙 사진 개구부(이미 투명) bbox로 inset 측정
 * - 데클·장식 프레임은 유지, opaque bbox 크롭
 * 실행: node scripts/prepare-parchment-frame.mjs
 */
import sharp from 'sharp';
import fs from 'fs';

const path = 'public/photo-frames/parchment-frame-landscape.png';

const { data, info } = await sharp(path).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const w = info.width;
const h = info.height;
const c = info.channels;

const px = (x, y) => {
  const i = (y * w + x) * c;
  return [data[i], data[i + 1], data[i + 2], data[i + 3]];
};

const isBorder = (x, y) => x === 0 || y === 0 || x === w - 1 || y === h - 1;

const localGradient = (x, y) => {
  const p = px(x, y);
  if (isBorder(x, y)) return 0;
  const l = px(x - 1, y);
  const r = px(x + 1, y);
  const u = px(x, y - 1);
  const d = px(x, y + 1);
  return (
    Math.abs(p[0] - l[0]) +
    Math.abs(p[0] - r[0]) +
    Math.abs(p[0] - u[0]) +
    Math.abs(p[0] - d[0])
  );
};

/** 이미지 가장자리에서 연속되는 평탄 크림 여백 (장식·데클 직전까지) */
const isFlatMargin = (x, y) => {
  const p = px(x, y);
  if (p[3] < 128) return true;
  if (!(p[0] > 205 && p[1] > 195 && p[2] > 185 && p[0] - p[2] > 2)) return false;
  return localGradient(x, y) < 30;
};

function stripFlatMargins() {
  for (let x = 0; x < w; x++) {
    for (let y = 0; y < h; y++) {
      if (!isFlatMargin(x, y)) break;
      data[(y * w + x) * c + 3] = 0;
    }
    for (let y = h - 1; y >= 0; y--) {
      if (!isFlatMargin(x, y)) break;
      data[(y * w + x) * c + 3] = 0;
    }
  }
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (!isFlatMargin(x, y)) break;
      data[(y * w + x) * c + 3] = 0;
    }
    for (let x = w - 1; x >= 0; x--) {
      if (!isFlatMargin(x, y)) break;
      data[(y * w + x) * c + 3] = 0;
    }
  }
}

stripFlatMargins();

let minX = w;
let minY = h;
let maxX = 0;
let maxY = 0;
for (let y = 0; y < h; y++) {
  for (let x = 0; x < w; x++) {
    if (data[(y * w + x) * c + 3] > 10) {
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }
}

if (maxX < minX || maxY < minY) {
  throw new Error('No visible frame content after margin strip');
}

const cw = maxX - minX + 1;
const ch = maxY - minY + 1;

const dirs = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];

/** 중앙 투명 개구부 flood → inset bbox */
const opening = new Uint8Array(w * h);
const cx = Math.floor(w / 2);
const cy = Math.floor(h / 2);
const openQueue = [];

if (data[(cy * w + cx) * c + 3] < 128) {
  opening[cy * w + cx] = 1;
  openQueue.push([cx, cy]);
}

while (openQueue.length) {
  const [x, y] = openQueue.pop();
  for (const [dx, dy] of dirs) {
    const nx = x + dx;
    const ny = y + dy;
    if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
    const idx = ny * w + nx;
    if (opening[idx]) continue;
    if (data[idx * c + 3] >= 128) continue;
    opening[idx] = 1;
    openQueue.push([nx, ny]);
  }
}

let oMinX = w;
let oMinY = h;
let oMaxX = 0;
let oMaxY = 0;
for (let y = 0; y < h; y++) {
  for (let x = 0; x < w; x++) {
    if (!opening[y * w + x]) continue;
    if (x < oMinX) oMinX = x;
    if (x > oMaxX) oMaxX = x;
    if (y < oMinY) oMinY = y;
    if (y > oMaxY) oMaxY = y;
  }
}

const inset =
  oMaxX >= oMinX
    ? {
        left: +(((oMinX - minX) / cw) * 100).toFixed(1),
        right: +(((maxX - oMaxX) / cw) * 100).toFixed(1),
        top: +(((oMinY - minY) / ch) * 100).toFixed(1),
        bottom: +(((maxY - oMaxY) / ch) * 100).toFixed(1),
      }
    : null;

console.log(JSON.stringify({ crop: { minX, minY, cw, ch }, inset }, null, 2));
if (inset) {
  console.log(
    `PARCHMENT_FRAME_INSET_CLASS = 'left-[${inset.left}%] right-[${inset.right}%] top-[${inset.top}%] bottom-[${inset.bottom}%]';`,
  );
}

await sharp(data, { raw: { width: w, height: h, channels: c } })
  .extract({ left: minX, top: minY, width: cw, height: ch })
  .png()
  .toFile(`${path}.tmp`);

fs.renameSync(`${path}.tmp`, path);
console.log('saved', path);
