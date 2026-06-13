/**
 * polaroid-paper-landscape.png — 오른쪽 바깥 연한 드롭섀도 제거
 * (다크 배경에서 하얗게 번져 보이는 영역; 종이·진한 테두리·찢어진 가장자리는 유지)
 * 실행: node scripts/trim-polaroid-right-shadow.mjs
 */
import sharp from 'sharp';
import fs from 'fs';

const path = 'public/photo-frames/polaroid-paper-landscape.png';

const { data, info } = await sharp(path).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const { width: w, height: h, channels: c } = info;

const px = (x, y) => {
  const i = (y * w + x) * c;
  return [data[i], data[i + 1], data[i + 2], data[i + 3]];
};

const yBandTop = Math.floor(h * 0.06);
const yBandBottom = Math.floor(h * 0.82);

/** 종이 오른쪽 가장자리 (캡션 구역 제외) */
let paperRight = 0;
for (let x = w - 1; x >= 0; x--) {
  let cream = 0;
  let n = 0;
  for (let y = yBandTop; y < yBandBottom; y++) {
    const [r, g, b, a] = px(x, y);
    if (a > 200) {
      n++;
      if (r > 220 && g > 215 && b > 200) cream++;
    }
  }
  if (n > 0 && cream / n > 0.85) {
    paperRight = x;
    break;
  }
}

const trimFromX = paperRight + Math.round(w * 0.012);
const lumThreshold = 182;
let trimmed = 0;

for (let y = 0; y < h; y++) {
  for (let x = trimFromX; x < w; x++) {
    const i = (y * w + x) * c;
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const a = data[i + 3];
    if (a === 0) continue;
    const lum = (r + g + b) / 3;
    if (lum > lumThreshold) {
      data[i + 3] = 0;
      trimmed++;
    }
  }
}

await sharp(data, { raw: { width: w, height: h, channels: c } })
  .png()
  .toFile(`${path}.tmp`);
fs.renameSync(`${path}.tmp`, path);

console.log(
  JSON.stringify(
    {
      paperRight,
      paperRightPct: +((paperRight / w) * 100).toFixed(2),
      trimFromX,
      trimFromPct: +((trimFromX / w) * 100).toFixed(2),
      trimmedPixels: trimmed,
    },
    null,
    2,
  ),
);
