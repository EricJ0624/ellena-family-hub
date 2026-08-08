/**
 * parchment-frame-landscape.png — PNG 전처리
 * - 중앙 사진 개구부(체커보드·중성 회색/흰색) → 투명
 * - 양피지 프레임·캡션 블록·외곽 소프트 섀도 유지
 * - 개구부 bbox는 투명화 전에 측정 (데클 갭으로 외곽과 연결되어도 inset 유지)
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

/** 체커보드/중성 플레이스홀더 (채도 거의 없음). 따뜻한 양피지·장식은 제외 */
const isCheckerPlaceholder = (p) => {
  if (p[3] < 128) return false;
  const max = Math.max(p[0], p[1], p[2]);
  const min = Math.min(p[0], p[1], p[2]);
  return max - min < 12;
};

const dirs = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];

const opening = new Uint8Array(w * h);
const cx = Math.floor(w / 2);
const cy = Math.floor(h / 2);
const openQueue = [];

if (!isCheckerPlaceholder(px(cx, cy))) {
  throw new Error(
    `Center pixel is not a checkerboard placeholder (got ${px(cx, cy).join(',')}).`,
  );
}

opening[cy * w + cx] = 1;
openQueue.push([cx, cy]);

while (openQueue.length) {
  const [x, y] = openQueue.pop();
  for (const [dx, dy] of dirs) {
    const nx = x + dx;
    const ny = y + dy;
    if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
    const idx = ny * w + nx;
    if (opening[idx]) continue;
    if (!isCheckerPlaceholder(px(nx, ny))) continue;
    opening[idx] = 1;
    openQueue.push([nx, ny]);
  }
}

let oMinX = w;
let oMinY = h;
let oMaxX = 0;
let oMaxY = 0;
let openingCount = 0;
for (let y = 0; y < h; y++) {
  for (let x = 0; x < w; x++) {
    if (!opening[y * w + x]) continue;
    openingCount++;
    if (x < oMinX) oMinX = x;
    if (x > oMaxX) oMaxX = x;
    if (y < oMinY) oMinY = y;
    if (y > oMaxY) oMaxY = y;
  }
}

if (openingCount < 10000) {
  throw new Error(`Opening flood too small (${openingCount} px). Check checker detection.`);
}

for (let i = 0; i < w * h; i++) {
  if (opening[i]) data[i * c + 3] = 0;
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
  throw new Error('No visible frame content after opening removal');
}

const cw = maxX - minX + 1;
const ch = maxY - minY + 1;

const inset = {
  left: +(((oMinX - minX) / cw) * 100).toFixed(1),
  right: +(((maxX - oMaxX) / cw) * 100).toFixed(1),
  top: +(((oMinY - minY) / ch) * 100).toFixed(1),
  bottom: +(((maxY - oMaxY) / ch) * 100).toFixed(1),
};

console.log(
  JSON.stringify(
    {
      openingPixels: openingCount,
      openingBBox: { oMinX, oMinY, oMaxX, oMaxY },
      crop: { minX, minY, cw, ch },
      inset,
    },
    null,
    2,
  ),
);
console.log(
  `PARCHMENT_FRAME_INSET_CLASS = 'left-[${inset.left}%] right-[${inset.right}%] top-[${inset.top}%] bottom-[${inset.bottom}%]';`,
);

await sharp(data, { raw: { width: w, height: h, channels: c } })
  .extract({ left: minX, top: minY, width: cw, height: ch })
  .png()
  .toFile(`${path}.tmp`);

fs.renameSync(`${path}.tmp`, path);
console.log('saved', path);
