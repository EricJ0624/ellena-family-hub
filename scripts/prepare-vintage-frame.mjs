/**
 * vintage-frame-landscape.png — 흰 배경 export 전처리
 * - 가장자리 연결 흰색 → 투명 (바깥 배경)
 * - 가운데 흰 개구부 → 투명 (프레임 wood에 둘러싸인 영역)
 * - 프레임·장식은 유지, opaque bbox 크롭
 * 실행: node scripts/prepare-vintage-frame.mjs
 */
import sharp from 'sharp';
import fs from 'fs';

const path = 'public/photo-frames/vintage-frame-landscape.png';

const { data, info } = await sharp(path).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const w = info.width;
const h = info.height;
const c = info.channels;

const px = (x, y) => {
  const i = (y * w + x) * c;
  return [data[i], data[i + 1], data[i + 2], data[i + 3]];
};

/** export 흰 배경·개구부 (순수 흰에 가까운 픽셀) */
const isWhite = (p) => p[3] > 128 && p[0] > 232 && p[1] > 232 && p[2] > 232;

const dirs = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];

function floodWhite(seeds) {
  const mask = new Uint8Array(w * h);
  const queue = [];
  for (const [sx, sy] of seeds) {
    const p = px(sx, sy);
    const idx = sy * w + sx;
    if (!isWhite(p) || mask[idx]) continue;
    mask[idx] = 1;
    queue.push([sx, sy]);
  }
  while (queue.length) {
    const [x, y] = queue.pop();
    for (const [dx, dy] of dirs) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
      const idx = ny * w + nx;
      if (mask[idx]) continue;
      if (!isWhite(px(nx, ny))) continue;
      mask[idx] = 1;
      queue.push([nx, ny]);
    }
  }
  return mask;
}

/** 1) 바깥 흰 배경 */
const exteriorSeeds = [];
for (let x = 0; x < w; x++) {
  exteriorSeeds.push([x, 0], [x, h - 1]);
}
for (let y = 0; y < h; y++) {
  exteriorSeeds.push([0, y], [w - 1, y]);
}
const exterior = floodWhite(exteriorSeeds);

/** 2) 안쪽 흰 개구부 — 중앙 시드 */
const opening = floodWhite([[Math.floor(w / 2), Math.floor(h / 2)]]);

for (let i = 0; i < w * h; i++) {
  if (exterior[i] || (opening[i] && !exterior[i])) {
    data[i * 4 + 3] = 0;
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
  throw new Error('No visible frame content after white removal');
}

const cw = maxX - minX + 1;
const ch = maxY - minY + 1;

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

console.log(JSON.stringify({ crop: { minX, minY, cw, ch }, inset }, null, 2));
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
