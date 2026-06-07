/**
 * 프레임 PNG — 테두리·그림자 뒤 배경 제거 (회색 캔버스 또는 코너 색상 flood)
 * 사용: node scripts/crop-frame-bg.mjs [path]
 * 기본: public/photo-frames/vintage-frame-landscape.png
 */
import sharp from 'sharp';
import fs from 'fs';

const path = process.argv[2] ?? 'public/photo-frames/vintage-frame-landscape.png';

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

/** 가장자리 전체에서 색상 유사 flood (실내·테이블 등 복합 배경) */
function floodBorderBackground(tolerance) {
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
      if (colorDist(p, ref) < tolerance) {
        bgMask[idx] = 1;
        queue.push([nx, ny, ref]);
      }
    }
  }
  return bgMask;
}

/** 코너·가장자리에서 색상 유사 flood (legacy) */
function floodCornerBackground(tolerance) {
  const bgMask = new Uint8Array(w * h);
  const queue = [];
  const seeds = [
    [0, 0],
    [w - 1, 0],
    [0, h - 1],
    [w - 1, h - 1],
  ];
  for (const [sx, sy] of seeds) {
    const ref = px(sx, sy);
    if (ref[3] < 128) continue;
    const idx = sy * w + sx;
    if (!bgMask[idx]) {
      bgMask[idx] = 1;
      queue.push([sx, sy, ref]);
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
      if (colorDist(p, ref) < tolerance) {
        bgMask[idx] = 1;
        queue.push([nx, ny, ref]);
      }
    }
  }
  return bgMask;
}

/** 가장자리 회색 캔버스 flood (polaroid 등) */
function floodEdgeGrayCanvas() {
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
  return bgMask;
}

let bgMask = floodEdgeGrayCanvas();
let bgCount = 0;
for (let i = 0; i < w * h; i++) if (bgMask[i]) bgCount++;

if (bgCount < w * h * 0.05) {
  bgMask = floodBorderBackground(52);
  bgCount = 0;
  for (let i = 0; i < w * h; i++) if (bgMask[i]) bgCount++;
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
  throw new Error('No visible content after background removal');
}

const cw = maxX - minX + 1;
const ch = maxY - minY + 1;

let oMinX = cw;
let oMinY = ch;
let oMaxX = 0;
let oMaxY = 0;
for (let y = 0; y < ch; y++) {
  for (let x = 0; x < cw; x++) {
    const gx = minX + x;
    const gy = minY + y;
    if (data[(gy * w + gx) * c + 3] < 128) {
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

console.log(JSON.stringify({ path, crop: { minX, minY, cw, ch }, inset, bgPixels: bgCount }, null, 2));
if (inset) {
  console.log(
    `INSET = 'left-[${inset.left}%] right-[${inset.right}%] top-[${inset.top}%] bottom-[${inset.bottom}%]';`,
  );
  console.log(`viewBox: { width: ${cw}, height: ${ch} }`);
}

await sharp(data, { raw: { width: w, height: h, channels: c } })
  .extract({ left: minX, top: minY, width: cw, height: ch })
  .png()
  .toFile(`${path}.tmp`);

fs.renameSync(`${path}.tmp`, path);
console.log('saved', path);
