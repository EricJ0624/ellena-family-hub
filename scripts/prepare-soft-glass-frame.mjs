/**
 * soft-glass-landscape.png — 흰 배경 export 전처리
 * - 가장자리 연결 흰색 → 투명 (바깥 배경)
 * - 가운데 흰 개구부 → 투명 (사진 영역)
 * - 반투명 글래스 가장자리 알파는 그대로 유지 (hard threshold 없음)
 * 실행: node scripts/prepare-soft-glass-frame.mjs
 */
import sharp from 'sharp';
import fs from 'fs';

const path = 'public/photo-frames/soft-glass-landscape.png';

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

function measureInset(openingMask, cropW, cropH, minX, minY, maxX, maxY) {
  let oMinX = cropW;
  let oMinY = cropH;
  let oMaxX = 0;
  let oMaxY = 0;
  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      if (!openingMask[y * w + x]) continue;
      if (x < oMinX) oMinX = x;
      if (x > oMaxX) oMaxX = x;
      if (y < oMinY) oMinY = y;
      if (y > oMaxY) oMaxY = y;
    }
  }
  if (oMaxX < oMinX || oMaxY < oMinY) return null;

  const cw = maxX - minX + 1;
  const ch = maxY - minY + 1;
  const innerH = oMaxY - oMinY + 1;

  let cornerR = 0;
  for (let r = 5; r < 120; r++) {
    let ok = true;
    for (let t = 0; t <= r; t++) {
      const u = Math.round(Math.sqrt(r * r - t * t));
      if (data[((oMinY + t) * w + (oMinX + r - u)) * c + 3] > 20) {
        ok = false;
        break;
      }
      if (data[((oMinY + r - u) * w + (oMinX + t)) * c + 3] > 20) {
        ok = false;
        break;
      }
    }
    if (ok) cornerR = r;
  }

  return {
    left: +(((oMinX - minX) / cw) * 100).toFixed(1),
    right: +(((maxX - oMaxX) / cw) * 100).toFixed(1),
    top: +(((oMinY - minY) / ch) * 100).toFixed(1),
    bottom: +(((minY + ch - oMaxY - 1) / ch) * 100).toFixed(1),
    cornerPct: +((cornerR / innerH) * 100).toFixed(2),
  };
}

const inset = measureInset(opening, minX, minY, maxX, maxY);

console.log(JSON.stringify({ crop: { minX, minY, cw, ch }, inset }, null, 2));
if (inset) {
  console.log(
    `SOFT_GLASS_FRAME_INSET_CLASS = 'left-[${inset.left}%] right-[${inset.right}%] top-[${inset.top}%] bottom-[${inset.bottom}%]';`,
  );
  console.log(`inner corner radius ~${inset.cornerPct}% of inner height`);
}

await sharp(data, { raw: { width: w, height: h, channels: c } })
  .extract({ left: minX, top: minY, width: cw, height: ch })
  .png()
  .toBuffer()
  .then((buf) => sharp(buf).png().toFile(`${path}.tmp`));

fs.renameSync(`${path}.tmp`, path);
console.log('saved', path);
console.log('Tip: node scripts/feather-frame-alpha.mjs', path, '1.2');
