/**
 * polaroid-paper-landscape.png 전처리 (바로크·모던과 동일 패턴)
 * 1) 회색 캔버스 배경 flood-fill → 투명
 * 2) 검정 개구부(불투명) → 투명 (원본에 알파가 없을 때)
 * 3) 불투명 bbox 크롭 (여백만 제거)
 * 실행: node scripts/prepare-polaroid-frame.mjs
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

const ref = px(0, 0);
const bgMask = new Uint8Array(w * h);
const queue = [];
for (const [sx, sy] of [[0, 0], [w - 1, 0], [0, h - 1], [w - 1, h - 1]]) {
  const p = px(sx, sy);
  if (p[3] > 128 && colorDist(p, ref) < 32) {
    bgMask[sy * w + sx] = 1;
    queue.push([sx, sy]);
  }
}

const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
while (queue.length) {
  const [x, y] = queue.pop();
  for (const [dx, dy] of dirs) {
    const nx = x + dx;
    const ny = y + dy;
    if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
    const idx = ny * w + nx;
    if (bgMask[idx]) continue;
    const p = px(nx, ny);
    if (p[3] < 128) continue;
    if (colorDist(p, ref) < 32) {
      bgMask[idx] = 1;
      queue.push([nx, ny]);
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
    if (data[((y * w + x) * c) + 3] > 10) {
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }
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
    if (data[((gy * w + gx) * c) + 3] < 128) {
      if (x < oMinX) oMinX = x;
      if (x > oMaxX) oMaxX = x;
      if (y < oMinY) oMinY = y;
      if (y > oMaxY) oMaxY = y;
    }
  }
}

const inset = {
  left: +((oMinX / cw) * 100).toFixed(2),
  right: +(((cw - oMaxX - 1) / cw) * 100).toFixed(2),
  top: +((oMinY / ch) * 100).toFixed(2),
  bottom: +(((ch - oMaxY - 1) / ch) * 100).toFixed(2),
};

console.log(JSON.stringify({ crop: { minX, minY, cw, ch }, inset }, null, 2));
console.log(`POLAROID_FRAME_INSET_CLASS = 'left-[${inset.left}%] right-[${inset.right}%] top-[${inset.top}%] bottom-[${inset.bottom}%]';`);
console.log(`viewBox: { width: ${cw}, height: ${ch} }`);

await sharp(data, { raw: { width: w, height: h, channels: c } })
  .extract({ left: minX, top: minY, width: cw, height: ch })
  .png()
  .toFile(`${path}.tmp`);

fs.renameSync(`${path}.tmp`, path);
console.log('saved', path);
