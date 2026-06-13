/**
 * polaroid-paper-landscape.png → 백플레이트 마스크
 * - 반투명 픽셀(20 <= alpha < 252)만 포함 — 불투명 종이·투명 코너 제외
 * - 그림자·테두리 아래에만 캔버스색을 깔아 보라 혼색 방지, 종이 밖 하얀 박스 방지
 * 실행: node scripts/prepare-polaroid-backplate-mask.mjs
 */
import sharp from 'sharp';

const src = 'public/photo-frames/polaroid-paper-landscape.png';
const out = 'public/photo-frames/polaroid-paper-landscape-backplate-mask.png';
const alphaMin = 20;
const alphaMax = 251;

const { data, info } = await sharp(src).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const { width: w, height: h, channels: c } = info;

const mask = Buffer.alloc(w * h * 4);
let onCount = 0;

for (let i = 0; i < w * h; i++) {
  const a = data[i * c + 3];
  const on = a >= alphaMin && a <= alphaMax ? 255 : 0;
  if (on) onCount++;
  mask[i * 4] = on;
  mask[i * 4 + 1] = on;
  mask[i * 4 + 2] = on;
  mask[i * 4 + 3] = on;
}

await sharp(mask, { raw: { width: w, height: h, channels: 4 } }).png().toFile(out);
console.log('wrote', out, `${w}x${h}`, { alphaMin, alphaMax, onCount });
