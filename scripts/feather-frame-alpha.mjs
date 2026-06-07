/**
 * PNG 프레임 알파 채널만 소폭 블러 — 곡선 외곽 계단(aliasing) 완화
 * 실행: node scripts/feather-frame-alpha.mjs [path] [sigma]
 */
import sharp from 'sharp';
import fs from 'fs';

const path = process.argv[2] ?? 'public/photo-frames/soft-glass-landscape.png';
const sigma = Number(process.argv[3] ?? 1);

if (!fs.existsSync(path)) {
  throw new Error(`File not found: ${path}`);
}

const { data, info } = await sharp(path).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const { width: w, height: h, channels: c } = info;

const alpha = Buffer.alloc(w * h);
for (let i = 0; i < w * h; i++) {
  alpha[i] = data[i * c + 3];
}

const blurredAlpha = await sharp(alpha, { raw: { width: w, height: h, channels: 1 } })
  .blur(sigma)
  .raw()
  .toBuffer();

const out = Buffer.from(data);
for (let i = 0; i < w * h; i++) {
  out[i * c + 3] = blurredAlpha[i];
}

await sharp(out, { raw: { width: w, height: h, channels: c } }).png().toFile(`${path}.tmp`);
fs.renameSync(`${path}.tmp`, path);
console.log('feathered alpha', path, `sigma=${sigma}`, `${w}x${h}`);
