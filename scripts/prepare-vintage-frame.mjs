/**
 * vintage-frame-landscape.png — 프레임·그림자 유지, 바깥 배경만 제거
 * - 가장자리 색상 flood (tolerance 48, 보수적)
 * - 불투명 검정 개구부만 투명 (이미 투명이면 스킵)
 * - 프레임 bbox 크롭
 * 실행: node scripts/prepare-vintage-frame.mjs
 */
import sharp from 'sharp';
import fs from 'fs';

const path = 'public/photo-frames/vintage-frame-landscape.png';
const TOLERANCE = 38;

const { data, info } = await sharp(path).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const w = info.width;
const h = info.height;
const c = info.channels;

const px = (x, y) => {
  const i = (y * w + x) * c;
  return [data[i], data[i + 1], data[i + 2], data[i + 3]];
};

const colorDist = (a, b) => Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) + Math.abs(a[2] - b[2]);

const bgMask = new Uint8Array(w * h);
const queue = [];

for (let x = 0; x < w; x++) {
  for (const y of [0, h - 1]) {
    const p = px(x, y);
    if (p[3] > 128 && !bgMask[y * w + x]) {
      bgMask[y * w + x] = 1;
      queue.push([x, y, p]);
    }
  }
}
for (let y = 0; y < h; y++) {
  for (const x of [0, w - 1]) {
    const p = px(x, y);
    if (p[3] > 128 && !bgMask[y * w + x]) {
      bgMask[y * w + x] = 1;
      queue.push([x, y, p]);
    }
  }
}

const dirs = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];
while (queue.length) {
  const [x, y, ref] = queue.pop();
  for (const [dx, dy] of dirs) {
    const nx = x + dx;
    const ny = y + dy;
    if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
    const idx = ny * w + nx;
    if (bgMask[idx]) continue;
    const p = px(nx, ny);
    if (p[3] < 128) continue;
    if (colorDist(p, ref) < TOLERANCE) {
      bgMask[idx] = 1;
      queue.push([nx, ny, ref]);
    }
  }
}

for (let i = 0; i < w * h; i++) {
  if (bgMask[i]) data[i * 4 + 3] = 0;
  const o = i * 4;
  if (data[o + 3] > 128 && data[o] < 20 && data[o + 1] < 20 && data[o + 2] < 20) {
    data[o + 3] = 0;
  }
}

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
  throw new Error('No visible frame content after background removal');
}

const cw = maxX - minX + 1;
const ch = maxY - minY + 1;

/** 사진 구역 inset — 개구부 중앙 행 inner wood 경계 */
function measureInset() {
  const xm = minX + Math.floor(cw / 2);
  let top = -1;
  let bottom = -1;
  for (let y = minY; y <= maxY; y++) {
    if (data[(y * w + xm) * c + 3] < 128) {
      if (top < 0) top = y;
      bottom = y;
    }
  }
  if (top < 0) return null;

  const ym = Math.floor((top + bottom) / 2);
  let x = minX;
  while (x <= maxX && data[(ym * w + x) * c + 3] < 128) x++;
  while (x <= maxX && data[(ym * w + x) * c + 3] > 128) x++;
  const innerL = x;
  while (x <= maxX && data[(ym * w + x) * c + 3] < 128) x++;
  const innerR = x - 1;
  if (innerR <= innerL) return null;

  return {
    left: +(((innerL - minX) / cw) * 100).toFixed(1),
    right: +(((maxX - innerR) / cw) * 100).toFixed(1),
    top: +(((top - minY) / ch) * 100).toFixed(1),
    bottom: +(((minY + ch - bottom - 1) / ch) * 100).toFixed(1),
  };
}

const inset = measureInset();

console.log(JSON.stringify({ crop: { minX, minY, cw, ch }, inset, tolerance: TOLERANCE }, null, 2));
if (inset) {
  console.log(
    `VINTAGE_FRAME_INSET_CLASS = 'left-[${inset.left}%] right-[${inset.right}%] top-[${inset.top}%] bottom-[${inset.bottom}%]';`,
  );
}

await sharp(data, { raw: { width: w, height: h, channels: c } })
  .extract({ left: minX, top: minY, width: cw, height: ch })
  .png()
  .toFile(`${path}.tmp`);

fs.renameSync(`${path}.tmp`, path);
console.log('saved', path);
