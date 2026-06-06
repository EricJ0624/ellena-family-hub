/**
 * baroque-gold-landscape.png 후처리:
 * - 가장자리와 연결된 흰 배경 → 투명 (액자 곡선 밖 직사각형 모서리 제거)
 * - 안쪽 사진 구역 흰색 → 투명 (사진 레이어가 덮음)
 *
 * Usage: node scripts/process-baroque-frame-png.mjs
 */
import sharp from 'sharp';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const target = path.join(__dirname, '../public/photo-frames/baroque-gold-landscape.png');

const { data, info } = await sharp(target).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const { width, height, channels } = info;
const out = Buffer.from(data);

const isWhite = (x, y) => {
  const i = (y * width + x) * channels;
  return data[i] > 242 && data[i + 1] > 242 && data[i + 2] > 242;
};

const visited = new Uint8Array(width * height);
const queue = [];

for (let x = 0; x < width; x++) {
  if (isWhite(x, 0)) queue.push([x, 0]);
  if (isWhite(x, height - 1)) queue.push([x, height - 1]);
}
for (let y = 0; y < height; y++) {
  if (isWhite(0, y)) queue.push([0, y]);
  if (isWhite(width - 1, y)) queue.push([width - 1, y]);
}

let head = 0;
while (head < queue.length) {
  const [x, y] = queue[head++];
  const pi = y * width + x;
  if (visited[pi]) continue;
  visited[pi] = 1;
  out[pi * channels + 3] = 0;
  for (const [dx, dy] of [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ]) {
    const nx = x + dx;
    const ny = y + dy;
    if (nx >= 0 && nx < width && ny >= 0 && ny < height && isWhite(nx, ny) && !visited[ny * width + nx]) {
      queue.push([nx, ny]);
    }
  }
}

for (let y = 0; y < height; y++) {
  for (let x = 0; x < width; x++) {
    const pi = y * width + x;
    if (visited[pi] || !isWhite(x, y)) continue;
    out[pi * channels + 3] = 0;
  }
}

await sharp(out, { raw: { width, height, channels: 4 } }).png().toFile(target);
console.log(`Processed ${target}`);
