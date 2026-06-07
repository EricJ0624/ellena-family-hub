/**
 * polaroid-paper-landscape.png — 테두리·그림자 뒤 회색 캔버스만 제거
 * - 가장자리에서 연결된 회색 배경 flood-fill → 투명
 * - 프레임·그림자·사진 구역·베이크 텍스트는 변경하지 않음
 * - 불투명 bbox 크롭만 수행
 * 실행: node scripts/crop-polaroid-bg.mjs
 */
import sharp from 'sharp';
import fs from 'fs';

const path = 'public/photo-frames/polaroid-paper-landscape.png';

const { data, info } = await sharp(path).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const w = info.width;
const h = info.height;
const c = info.channels;

const px = (x, y) => {
  const i = (y * w + x) * c;
  return [data[i], data[i + 1], data[i + 2], data[i + 3]];
};

const colorDist = (a, b) => Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) + Math.abs(a[2] - b[2]);

const isCanvasGray = (p, ref) =>
  p[3] > 128 && colorDist(p, ref) < 40 && p[0] > 170 && p[0] < 250;

/** 가장자리 전체에서 연결된 회색 캔버스만 투명 처리 */
const ref = px(0, 0)[3] > 128 ? px(0, 0) : px(6, 0);
const bgMask = new Uint8Array(w * h);
const queue = [];

for (let x = 0; x < w; x++) {
  for (const y of [0, h - 1]) {
    const p = px(x, y);
    if (isCanvasGray(p, ref) && !bgMask[y * w + x]) {
      bgMask[y * w + x] = 1;
      queue.push([x, y]);
    }
  }
}
for (let y = 0; y < h; y++) {
  for (const x of [0, w - 1]) {
    const p = px(x, y);
    if (isCanvasGray(p, ref) && !bgMask[y * w + x]) {
      bgMask[y * w + x] = 1;
      queue.push([x, y]);
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
  const [x, y] = queue.pop();
  for (const [dx, dy] of dirs) {
    const nx = x + dx;
    const ny = y + dy;
    if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
    const idx = ny * w + nx;
    if (bgMask[idx]) continue;
    const p = px(nx, ny);
    if (!isCanvasGray(p, ref)) continue;
    bgMask[idx] = 1;
    queue.push([nx, ny]);
  }
}

for (let i = 0; i < w * h; i++) {
  if (bgMask[i]) data[i * 4 + 3] = 0;
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
  throw new Error('No visible content after background removal');
}

const cw = maxX - minX + 1;
const ch = maxY - minY + 1;

/** 크롭 좌표계에서 사진 구역(투명 홀) inset — 외곽과 연결되지 않은 내부 홀만 */
const exterior = new Uint8Array(cw * ch);
const extQueue = [];
for (let x = 0; x < cw; x++) {
  for (const y of [0, ch - 1]) {
    const gx = minX + x;
    const gy = minY + y;
    if (data[(gy * w + gx) * c + 3] < 128) {
      exterior[y * cw + x] = 1;
      extQueue.push([x, y]);
    }
  }
}
for (let y = 0; y < ch; y++) {
  for (const x of [0, cw - 1]) {
    const gx = minX + x;
    const gy = minY + y;
    if (data[(gy * w + gx) * c + 3] < 128 && !exterior[y * cw + x]) {
      exterior[y * cw + x] = 1;
      extQueue.push([x, y]);
    }
  }
}
while (extQueue.length) {
  const [x, y] = extQueue.pop();
  for (const [dx, dy] of dirs) {
    const nx = x + dx;
    const ny = y + dy;
    if (nx < 0 || ny < 0 || nx >= cw || ny >= ch) continue;
    const idx = ny * cw + nx;
    if (exterior[idx]) continue;
    const gx = minX + nx;
    const gy = minY + ny;
    if (data[(gy * w + gx) * c + 3] >= 128) continue;
    exterior[idx] = 1;
    extQueue.push([nx, ny]);
  }
}

let oMinX = cw;
let oMinY = ch;
let oMaxX = 0;
let oMaxY = 0;
for (let y = 0; y < ch; y++) {
  for (let x = 0; x < cw; x++) {
    const gx = minX + x;
    const gy = minY + y;
    if (data[(gy * w + gx) * c + 3] < 128 && !exterior[y * cw + x]) {
      if (x < oMinX) oMinX = x;
      if (x > oMaxX) oMaxX = x;
      if (y < oMinY) oMinY = y;
      if (y > oMaxY) oMaxY = y;
    }
  }
}

const inset =
  oMaxX >= oMinX
    ? {
        left: +((oMinX / cw) * 100).toFixed(1),
        right: +(((cw - oMaxX - 1) / cw) * 100).toFixed(1),
        top: +((oMinY / ch) * 100).toFixed(1),
        bottom: +(((ch - oMaxY - 1) / ch) * 100).toFixed(1),
      }
    : null;

console.log(JSON.stringify({ crop: { minX, minY, cw, ch }, inset }, null, 2));
if (inset) {
  console.log(
    `POLAROID_FRAME_INSET_CLASS = 'left-[${inset.left}%] right-[${inset.right}%] top-[${inset.top}%] bottom-[${inset.bottom}%]';`,
  );
  console.log(`viewBox: { width: ${cw}, height: ${ch} }`);
}

await sharp(data, { raw: { width: w, height: h, channels: c } })
  .extract({ left: minX, top: minY, width: cw, height: ch })
  .png()
  .toFile(`${path}.tmp`);

fs.renameSync(`${path}.tmp`, path);
console.log('saved', path);
