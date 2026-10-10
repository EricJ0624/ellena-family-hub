/**
 * 얼굴 밖 차이에 붙일 작은 그림을 고르고 캔버스에 그린다.
 * 종류는 그 자리의 색·높이로 정하고, 돌은 하늘 후보에 넣지 않는다.
 * 안경·귀걸이·점은 얼굴 배치에서 직접 고른다.
 */

export type SpotSurface = 'sky' | 'water' | 'tree' | 'grass' | 'ground' | 'wood' | 'skin' | 'cloth' | 'object';

export type SpotSpriteKind =
  | 'cloud'
  | 'bird'
  | 'kite'
  | 'plane'
  | 'duck'
  | 'ripple'
  | 'fruit'
  | 'leaf'
  | 'flower'
  | 'butterfly'
  | 'mushroom'
  | 'rock'
  | 'pinecone'
  | 'mole'
  | 'earring'
  | 'glasses'
  | 'button'
  | 'ribbon'
  | 'stain'
  | 'fly'
  | 'pin';

export type RegionAppearance = {
  /** 0이 위, 1이 아래 */
  y: number;
  /** 0–360. 무채색이면 0 */
  hue: number;
  saturation: number;
  lightness: number;
  /** 원 안에서 살색으로 본 픽셀 비율 */
  skinRatio: number;
  /** 밝기 표준편차 (0–255). 단색 벽과 피부 질감을 구분한다 */
  lightnessStd: number;
};

type SceneSurface = Exclude<SpotSurface, 'skin'>;

const SPRITES: Record<SceneSurface, SpotSpriteKind[]> = {
  sky: ['cloud', 'bird', 'kite', 'plane'],
  water: ['duck', 'ripple'],
  tree: ['bird', 'fruit', 'leaf'],
  grass: ['flower', 'butterfly', 'mushroom'],
  ground: ['rock', 'pinecone'],
  wood: ['pinecone', 'leaf'],
  cloth: ['button', 'ribbon', 'stain'],
  object: ['fly', 'pin', 'leaf'],
};

export function classifySpotSurface(sample: RegionAppearance): SpotSurface {
  const { y, hue, saturation: s, lightness: l, skinRatio, lightnessStd } = sample;
  const green = hue >= 70 && hue <= 165 && s >= 0.18;
  const blue = hue >= 185 && hue <= 255 && s >= 0.15;
  const brown = hue >= 12 && hue <= 50 && s >= 0.12 && l <= 0.78;
  const gray = s < 0.14;
  const brightUpper = l >= 0.78 && s < 0.28 && y < 0.52;

  if (skinRatio >= 0.45 && lightnessStd >= 3 && s <= 0.58) return 'skin';
  if ((blue && y < 0.52) || brightUpper) return 'sky';
  if (blue && y >= 0.72 && l >= 0.4) return 'water';
  if (green && y < 0.46) return 'tree';
  if (green) return 'grass';
  if (y >= 0.6 && (gray || (brown && s < 0.38)) && l < 0.82) return 'ground';
  if (brown && s >= 0.38) return 'wood';
  if (s >= 0.08) return 'cloth';
  return 'object';
}

export function pickSpotSprite(surface: SceneSurface, index: number): SpotSpriteKind {
  const list = SPRITES[surface];
  return list[index % list.length];
}

export function paintSpotSprite(
  ctx: CanvasRenderingContext2D,
  kind: SpotSpriteKind,
  cx: number,
  cy: number,
  radius: number,
  index: number,
): void {
  ctx.save();
  ctx.translate(cx, cy);
  const tilt = ((index % 7) - 3) * 0.06;
  if (kind !== 'cloud' && kind !== 'ripple' && kind !== 'mole' && kind !== 'glasses') ctx.rotate(tilt);
  if (kind !== 'mole' && kind !== 'stain' && kind !== 'ripple') {
    ctx.shadowColor = 'rgba(15, 23, 42, 0.28)';
    ctx.shadowBlur = radius * 0.1;
    ctx.shadowOffsetY = radius * 0.05;
  }
  drawKind(ctx, kind, radius, index);
  ctx.restore();
}

function drawKind(ctx: CanvasRenderingContext2D, kind: SpotSpriteKind, s: number, index: number): void {
  switch (kind) {
    case 'cloud':
      drawCloud(ctx, s);
      break;
    case 'bird':
      drawBird(ctx, s);
      break;
    case 'kite':
      drawKite(ctx, s);
      break;
    case 'plane':
      drawPlane(ctx, s);
      break;
    case 'duck':
      drawDuck(ctx, s);
      break;
    case 'ripple':
      drawRipple(ctx, s);
      break;
    case 'fruit':
      drawFruit(ctx, s);
      break;
    case 'leaf':
      drawLeaf(ctx, s);
      break;
    case 'flower':
      drawFlower(ctx, s, index);
      break;
    case 'butterfly':
      drawButterfly(ctx, s, index);
      break;
    case 'mushroom':
      drawMushroom(ctx, s);
      break;
    case 'rock':
      drawRock(ctx, s);
      break;
    case 'pinecone':
      drawPinecone(ctx, s);
      break;
    case 'mole':
      drawMole(ctx, s);
      break;
    case 'earring':
      drawEarring(ctx, s);
      break;
    case 'glasses':
      drawGlasses(ctx, s);
      break;
    case 'button':
      drawButton(ctx, s, index);
      break;
    case 'ribbon':
      drawRibbon(ctx, s);
      break;
    case 'stain':
      drawStain(ctx, s);
      break;
    case 'fly':
      drawFly(ctx, s);
      break;
    case 'pin':
      drawPin(ctx, s);
      break;
  }
}

function fillEllipse(ctx: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number): void {
  ctx.beginPath();
  ctx.ellipse(x, y, Math.max(0.5, rx), Math.max(0.5, ry), 0, 0, Math.PI * 2);
  ctx.fill();
}

function drawCloud(ctx: CanvasRenderingContext2D, s: number): void {
  ctx.fillStyle = '#f8fafc';
  fillEllipse(ctx, 0, s * 0.06, s * 0.46, s * 0.24);
  fillEllipse(ctx, -s * 0.26, s * 0.1, s * 0.26, s * 0.18);
  fillEllipse(ctx, s * 0.24, s * 0.08, s * 0.28, s * 0.2);
  ctx.fillStyle = 'rgba(148, 163, 184, 0.45)';
  fillEllipse(ctx, s * 0.04, s * 0.18, s * 0.3, s * 0.08);
}

function drawBird(ctx: CanvasRenderingContext2D, s: number): void {
  ctx.fillStyle = '#1e293b';
  ctx.beginPath();
  ctx.moveTo(-s * 0.5, s * 0.08);
  ctx.quadraticCurveTo(-s * 0.2, -s * 0.42, s * 0.02, 0);
  ctx.quadraticCurveTo(s * 0.22, -s * 0.4, s * 0.52, s * 0.1);
  ctx.quadraticCurveTo(s * 0.12, -s * 0.02, -s * 0.5, s * 0.08);
  ctx.fill();
  ctx.fillStyle = '#f59e0b';
  ctx.beginPath();
  ctx.moveTo(s * 0.46, s * 0.02);
  ctx.lineTo(s * 0.66, s * 0.08);
  ctx.lineTo(s * 0.44, s * 0.14);
  ctx.fill();
}

function drawKite(ctx: CanvasRenderingContext2D, s: number): void {
  ctx.fillStyle = '#ef4444';
  ctx.beginPath();
  ctx.moveTo(0, -s * 0.46);
  ctx.lineTo(s * 0.32, 0);
  ctx.lineTo(0, s * 0.4);
  ctx.lineTo(-s * 0.32, 0);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#fee2e2';
  ctx.lineWidth = Math.max(1, s * 0.045);
  ctx.beginPath();
  ctx.moveTo(0, -s * 0.46);
  ctx.lineTo(0, s * 0.4);
  ctx.moveTo(-s * 0.32, 0);
  ctx.lineTo(s * 0.32, 0);
  ctx.stroke();
  ctx.strokeStyle = '#334155';
  ctx.lineWidth = Math.max(1, s * 0.03);
  ctx.beginPath();
  ctx.moveTo(0, s * 0.4);
  ctx.quadraticCurveTo(s * 0.18, s * 0.52, s * 0.05, s * 0.62);
  ctx.stroke();
}

function drawPlane(ctx: CanvasRenderingContext2D, s: number): void {
  ctx.fillStyle = '#e2e8f0';
  ctx.strokeStyle = '#334155';
  ctx.lineWidth = Math.max(1, s * 0.04);
  ctx.beginPath();
  ctx.ellipse(s * 0.04, 0, s * 0.48, s * 0.12, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(-s * 0.02, 0);
  ctx.lineTo(s * 0.16, -s * 0.02);
  ctx.lineTo(-s * 0.08, -s * 0.32);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(-s * 0.02, 0);
  ctx.lineTo(s * 0.12, s * 0.02);
  ctx.lineTo(-s * 0.06, s * 0.28);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(-s * 0.36, 0);
  ctx.lineTo(-s * 0.5, -s * 0.16);
  ctx.lineTo(-s * 0.28, -s * 0.02);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
}

function drawDuck(ctx: CanvasRenderingContext2D, s: number): void {
  ctx.fillStyle = '#facc15';
  fillEllipse(ctx, -s * 0.06, s * 0.08, s * 0.36, s * 0.22);
  fillEllipse(ctx, s * 0.28, -s * 0.08, s * 0.18, s * 0.16);
  ctx.fillStyle = '#f97316';
  ctx.beginPath();
  ctx.moveTo(s * 0.42, -s * 0.08);
  ctx.lineTo(s * 0.64, -s * 0.02);
  ctx.lineTo(s * 0.42, s * 0.02);
  ctx.fill();
  ctx.fillStyle = '#0f172a';
  fillEllipse(ctx, s * 0.32, -s * 0.12, s * 0.035, s * 0.035);
}

function drawRipple(ctx: CanvasRenderingContext2D, s: number): void {
  ctx.strokeStyle = 'rgba(14, 116, 144, 0.95)';
  ctx.lineWidth = Math.max(1.5, s * 0.07);
  ctx.lineCap = 'round';
  for (let i = 1; i <= 3; i += 1) {
    ctx.beginPath();
    ctx.ellipse(0, s * 0.05, s * 0.2 * i, s * 0.09 * i, 0, Math.PI * 0.12, Math.PI * 0.88);
    ctx.stroke();
  }
}

function drawFruit(ctx: CanvasRenderingContext2D, s: number): void {
  ctx.fillStyle = '#dc2626';
  fillEllipse(ctx, 0, s * 0.06, s * 0.32, s * 0.3);
  ctx.strokeStyle = '#166534';
  ctx.lineWidth = Math.max(1.5, s * 0.06);
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(0, -s * 0.2);
  ctx.lineTo(s * 0.02, -s * 0.4);
  ctx.stroke();
  ctx.fillStyle = '#16a34a';
  ctx.beginPath();
  ctx.ellipse(s * 0.14, -s * 0.28, s * 0.14, s * 0.07, -0.6, 0, Math.PI * 2);
  ctx.fill();
}

function drawLeaf(ctx: CanvasRenderingContext2D, s: number): void {
  ctx.fillStyle = '#15803d';
  ctx.beginPath();
  ctx.moveTo(0, s * 0.4);
  ctx.quadraticCurveTo(s * 0.55, s * 0.05, 0, -s * 0.48);
  ctx.quadraticCurveTo(-s * 0.55, s * 0.05, 0, s * 0.4);
  ctx.fill();
  ctx.strokeStyle = '#14532d';
  ctx.lineWidth = Math.max(1, s * 0.04);
  ctx.beginPath();
  ctx.moveTo(0, s * 0.32);
  ctx.lineTo(0, -s * 0.36);
  ctx.stroke();
}

function drawFlower(ctx: CanvasRenderingContext2D, s: number, index: number): void {
  const colors = ['#e11d48', '#db2777', '#ea580c', '#7c3aed', '#ca8a04'];
  ctx.fillStyle = colors[index % colors.length];
  for (let i = 0; i < 5; i += 1) {
    const angle = (Math.PI * 2 * i) / 5 - Math.PI / 2;
    fillEllipse(ctx, Math.cos(angle) * s * 0.28, Math.sin(angle) * s * 0.28, s * 0.2, s * 0.2);
  }
  ctx.fillStyle = '#fde047';
  fillEllipse(ctx, 0, 0, s * 0.14, s * 0.14);
}

function drawButterfly(ctx: CanvasRenderingContext2D, s: number, index: number): void {
  const colors = ['#7c3aed', '#ea580c', '#0284c7', '#db2777'];
  ctx.fillStyle = colors[index % colors.length];
  fillEllipse(ctx, -s * 0.24, -s * 0.08, s * 0.26, s * 0.18);
  fillEllipse(ctx, s * 0.24, -s * 0.08, s * 0.26, s * 0.18);
  fillEllipse(ctx, -s * 0.18, s * 0.16, s * 0.18, s * 0.14);
  fillEllipse(ctx, s * 0.18, s * 0.16, s * 0.18, s * 0.14);
  ctx.fillStyle = '#1e293b';
  fillEllipse(ctx, 0, 0, s * 0.05, s * 0.28);
}

function drawMushroom(ctx: CanvasRenderingContext2D, s: number): void {
  ctx.fillStyle = '#fef3c7';
  ctx.fillRect(-s * 0.1, 0, s * 0.2, s * 0.36);
  ctx.fillStyle = '#dc2626';
  ctx.beginPath();
  ctx.ellipse(0, 0, s * 0.4, s * 0.24, 0, Math.PI, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#fff';
  fillEllipse(ctx, -s * 0.14, -s * 0.08, s * 0.06, s * 0.05);
  fillEllipse(ctx, s * 0.12, -s * 0.12, s * 0.05, s * 0.04);
}

function drawRock(ctx: CanvasRenderingContext2D, s: number): void {
  ctx.fillStyle = '#64748b';
  ctx.beginPath();
  ctx.moveTo(-s * 0.42, s * 0.18);
  ctx.lineTo(-s * 0.28, -s * 0.2);
  ctx.lineTo(-s * 0.02, -s * 0.32);
  ctx.lineTo(s * 0.3, -s * 0.12);
  ctx.lineTo(s * 0.42, s * 0.2);
  ctx.lineTo(s * 0.08, s * 0.34);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.28)';
  ctx.beginPath();
  ctx.moveTo(-s * 0.2, -s * 0.08);
  ctx.lineTo(0, -s * 0.22);
  ctx.lineTo(s * 0.08, -s * 0.02);
  ctx.closePath();
  ctx.fill();
}

function drawPinecone(ctx: CanvasRenderingContext2D, s: number): void {
  ctx.fillStyle = '#92400e';
  fillEllipse(ctx, 0, s * 0.04, s * 0.26, s * 0.4);
  ctx.strokeStyle = '#78350f';
  ctx.lineWidth = Math.max(1, s * 0.035);
  for (let row = -2; row <= 2; row += 1) {
    ctx.beginPath();
    ctx.ellipse(0, row * s * 0.12, s * 0.2, s * 0.07, 0, 0, Math.PI);
    ctx.stroke();
  }
}

function drawMole(ctx: CanvasRenderingContext2D, s: number): void {
  ctx.fillStyle = 'rgba(92, 58, 38, 0.35)';
  fillEllipse(ctx, 0, s * 0.02, s * 0.28, s * 0.22);
  ctx.fillStyle = '#5c3a26';
  fillEllipse(ctx, 0, s * 0.02, s * 0.16, s * 0.12);
}

function drawEarring(ctx: CanvasRenderingContext2D, s: number): void {
  ctx.strokeStyle = '#d97706';
  ctx.lineWidth = Math.max(2, s * 0.09);
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.arc(0, s * 0.02, s * 0.28, 0.35, Math.PI * 2 - 0.15);
  ctx.stroke();
  ctx.fillStyle = '#fde68a';
  fillEllipse(ctx, 0, s * 0.36, s * 0.09, s * 0.12);
}

function drawGlasses(ctx: CanvasRenderingContext2D, s: number): void {
  ctx.lineWidth = Math.max(1.5, s * 0.07);
  ctx.strokeStyle = '#0f172a';
  ctx.lineCap = 'round';
  ctx.fillStyle = 'rgba(186, 230, 253, 0.35)';
  fillEllipse(ctx, -s * 0.36, 0, s * 0.3, s * 0.2);
  fillEllipse(ctx, s * 0.36, 0, s * 0.3, s * 0.2);
  ctx.beginPath();
  ctx.ellipse(-s * 0.36, 0, s * 0.3, s * 0.2, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.ellipse(s * 0.36, 0, s * 0.3, s * 0.2, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(-s * 0.06, 0);
  ctx.lineTo(s * 0.06, 0);
  ctx.moveTo(-s * 0.64, -s * 0.02);
  ctx.lineTo(-s * 0.9, -s * 0.1);
  ctx.moveTo(s * 0.64, -s * 0.02);
  ctx.lineTo(s * 0.9, -s * 0.1);
  ctx.stroke();
}

function drawButton(ctx: CanvasRenderingContext2D, s: number, index: number): void {
  const fills = ['#f8fafc', '#1e3a8a', '#9f1239', '#14532d'];
  ctx.fillStyle = fills[index % fills.length];
  ctx.strokeStyle = '#0f172a';
  ctx.lineWidth = Math.max(1, s * 0.04);
  ctx.beginPath();
  ctx.arc(0, 0, s * 0.36, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = index % fills.length === 0 ? '#334155' : '#f8fafc';
  for (let i = 0; i < 4; i += 1) {
    const angle = (Math.PI * 2 * i) / 4 + Math.PI / 4;
    fillEllipse(ctx, Math.cos(angle) * s * 0.14, Math.sin(angle) * s * 0.14, s * 0.045, s * 0.045);
  }
}

function drawRibbon(ctx: CanvasRenderingContext2D, s: number): void {
  ctx.fillStyle = '#f43f5e';
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.quadraticCurveTo(-s * 0.15, -s * 0.45, -s * 0.48, -s * 0.12);
  ctx.quadraticCurveTo(-s * 0.2, -s * 0.02, 0, 0);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.quadraticCurveTo(s * 0.15, -s * 0.45, s * 0.48, -s * 0.12);
  ctx.quadraticCurveTo(s * 0.2, -s * 0.02, 0, 0);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(-s * 0.08, s * 0.02);
  ctx.lineTo(-s * 0.22, s * 0.42);
  ctx.lineTo(0, s * 0.16);
  ctx.lineTo(s * 0.22, s * 0.42);
  ctx.lineTo(s * 0.08, s * 0.02);
  ctx.fill();
  ctx.fillStyle = '#be123c';
  fillEllipse(ctx, 0, 0, s * 0.08, s * 0.08);
}

function drawStain(ctx: CanvasRenderingContext2D, s: number): void {
  ctx.fillStyle = 'rgba(120, 53, 15, 0.72)';
  fillEllipse(ctx, 0, 0, s * 0.28, s * 0.2);
  fillEllipse(ctx, s * 0.16, s * 0.06, s * 0.16, s * 0.12);
  fillEllipse(ctx, -s * 0.14, s * 0.08, s * 0.14, s * 0.1);
}

function drawFly(ctx: CanvasRenderingContext2D, s: number): void {
  ctx.fillStyle = 'rgba(226, 232, 240, 0.9)';
  fillEllipse(ctx, -s * 0.16, -s * 0.02, s * 0.18, s * 0.1);
  fillEllipse(ctx, s * 0.16, -s * 0.02, s * 0.18, s * 0.1);
  ctx.fillStyle = '#0f172a';
  fillEllipse(ctx, 0, s * 0.04, s * 0.08, s * 0.16);
  fillEllipse(ctx, 0, -s * 0.16, s * 0.07, s * 0.07);
}

function drawPin(ctx: CanvasRenderingContext2D, s: number): void {
  ctx.strokeStyle = '#64748b';
  ctx.lineWidth = Math.max(1.5, s * 0.05);
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(0, -s * 0.05);
  ctx.lineTo(0, s * 0.48);
  ctx.stroke();
  ctx.fillStyle = '#ef4444';
  fillEllipse(ctx, 0, -s * 0.18, s * 0.2, s * 0.2);
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  fillEllipse(ctx, -s * 0.06, -s * 0.24, s * 0.06, s * 0.05);
}
