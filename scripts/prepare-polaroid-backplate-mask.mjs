/**
 * polaroid-paper-landscape.png 알fa → 백플레이트 하드 마스크
 * - alpha >= threshold 인 픽셀만 불투명(흰색) — 그림자·테두리 아래 캔버스색 유지
 * - 투명 코너(찢어진 가장자리)는 마스크 제외 — 사각 백플레이트가 액자 밖으로 보이지 않음
 * 실행: node scripts/prepare-polaroid-backplate-mask.mjs
 */
import sharp from 'sharp';

const src = 'public/photo-frames/polaroid-paper-landscape.png';
const out = 'public/photo-frames/polaroid-paper-landscape-backplate-mask.png';
const threshold = 20;

const { data, info } = await sharp(src).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const { width: w, height: h, channels: c } = info;

const mask = Buffer.alloc(w * h * 4);
for (let i = 0; i < w * h; i++) {
  const a = data[i * c + 3];
  const on = a >= threshold ? 255 : 0;
  mask[i * 4] = on;
  mask[i * 4 + 1] = on;
  mask[i * 4 + 2] = on;
  mask[i * 4 + 3] = on;
}

await sharp(mask, { raw: { width: w, height: h, channels: 4 } }).png().toFile(out);
console.log('wrote', out, `${w}x${h}`, `threshold=${threshold}`);
