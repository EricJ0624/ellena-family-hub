/**
 * parchment-frame-landscape.png — PNG 전처리
 * - 가장자리 양피지(따뜻한 크림 톤)만 유지
 * - 체커보드·린넨·사진 구역 → 투명 (프레임 뒤 대시보드 배경 비침)
 * - 사진 개구부 inset 출력
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

/** 양피지·데클 테두리 (따뜻한 크림) */
const isParchment = (p) => p[0] - p[2] > 5 && p[0] > 205 && p[1] > 195;

const dirs = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];

const parchment = new Uint8Array(w * h);
const queue = [];

for (let x = 0; x < w; x++) {
  for (const y of [0, h - 1]) {
    const p = px(x, y);
    const idx = y * w + x;
    if (isParchment(p) && !parchment[idx]) {
      parchment[idx] = 1;
      queue.push([x, y]);
    }
  }
}
for (let y = 0; y < h; y++) {
  for (const x of [0, w - 1]) {
    const p = px(x, y);
    const idx = y * w + x;
    if (isParchment(p) && !parchment[idx]) {
      parchment[idx] = 1;
      queue.push([x, y]);
    }
  }
}

while (queue.length) {
  const [x, y] = queue.pop();
  for (const [dx, dy] of dirs) {
    const nx = x + dx;
    const ny = y + dy;
    if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
    const idx = ny * w + nx;
    if (parchment[idx]) continue;
    if (!isParchment(px(nx, ny))) continue;
    parchment[idx] = 1;
    queue.push([nx, ny]);
  }
}

for (let i = 0; i < w * h; i++) {
  if (!parchment[i]) {
    data[i * c + 3] = 0;
  }
}

/** 크롭 좌표계에서 내부 사진 홀 inset */
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

const cw = maxX - minX + 1;
const ch = maxY - minY + 1;

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
    `PARCHMENT_FRAME_INSET_CLASS = 'left-[${inset.left}%] right-[${inset.right}%] top-[${inset.top}%] bottom-[${inset.bottom}%]';`,
  );
}

await sharp(data, { raw: { width: w, height: h, channels: c } })
  .extract({ left: minX, top: minY, width: cw, height: ch })
  .png()
  .toFile(`${path}.tmp`);

fs.renameSync(`${path}.tmp`, path);
console.log('saved', path);
