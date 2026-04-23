export const INTERNAL_FPS = 24;
export const OUTPUT_W = 540;
export const OUTPUT_H = 675;

const POS_OFFSETS = [-0.16, 0, 0.16];
const JITTER_PX_STABLE = 3;
const JITTER_PX_SWITCH = 18;
const JITTER_ROT_STABLE = 0.004;
const JITTER_ROT_SWITCH = 0.022;

function buildPositionSeq(length) {
  const seq = [];
  let last = -1;
  for (let i = 0; i < length; i++) {
    const choices = [0, 1, 2].filter(p => p !== last);
    const pick = choices[Math.floor(Math.random() * choices.length)];
    seq.push(pick);
    last = pick;
  }
  return seq;
}

export function buildSequence(items) {
  if (!items || items.length === 0) return [];
  if (items.length === 1) {
    return Array(24).fill({ item: items[0], photoIdx: 0, subFrame: 0, posIdx: 1, holdFrames: 24 });
  }
  const yoyo = [...items, ...[...items].slice(1, -1).reverse()];
  const posSeq = buildPositionSeq(yoyo.length);
  const expanded = [];
  yoyo.forEach((item, photoIdx) => {
    for (let f = 0; f < 24; f++) {
      expanded.push({ item, photoIdx, subFrame: f, posIdx: posSeq[photoIdx], holdFrames: 24 });
    }
  });
  return expanded;
}

export function compositeFrame(ctx, entry, bgFrames) {
  const { item, photoIdx, subFrame, posIdx } = entry;
  const W = OUTPUT_W;
  const H = OUTPUT_H;
  
  const isSwitching = subFrame < 3;
  const jPX = isSwitching ? JITTER_PX_SWITCH : JITTER_PX_STABLE;
  const jROT = isSwitching ? JITTER_ROT_SWITCH : JITTER_ROT_STABLE;
  const seed = photoIdx * 137.508;
  const dx = Math.sin(seed * 2.13 + subFrame * 0.8) * jPX;
  const dy = Math.cos(seed * 1.77 + subFrame * 0.6) * jPX * 0.5;
  const rot = Math.sin(seed * 3.31 + subFrame * 0.4) * jROT;

  ctx.clearRect(0, 0, W, H);

  if (bgFrames && bgFrames.length > 0) {
    _drawCover(ctx, bgFrames[photoIdx % bgFrames.length], 0, 0, W, H);
  } else {
    const g = ctx.createLinearGradient(0, 0, W, H);
    g.addColorStop(0, '#1a1a2e');
    g.addColorStop(1, '#0f3460');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  }

  const natW = item.naturalWidth || item.width;
  const natH = item.naturalHeight || item.height;
  const personW = W * 0.78;
  const personH = personW * (natH / natW);
  const posOff = POS_OFFSETS[posIdx ?? 1] * W;
  const drawX = (W - personW) / 2 + posOff;
  const drawY = H - personH;

  ctx.save();
  ctx.translate(dx, dy);

  const shadowY = drawY + personH - 12;
  const shadowX = drawX + personW / 2;
  const radGrad = ctx.createRadialGradient(shadowX, shadowY, personW * 0.1, shadowX, shadowY, personW * 0.4);
  radGrad.addColorStop(0, 'rgba(0,0,0,0.65)');
  radGrad.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = radGrad;
  ctx.beginPath();
  ctx.ellipse(shadowX, shadowY, personW * 0.35, personH * 0.08, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.translate(drawX + personW / 2, drawY + personH / 2);
  ctx.rotate(rot);
  
  ctx.shadowColor = 'rgba(0,0,0,0.35)';
  ctx.shadowBlur = 10;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 5;
  
  ctx.filter = 'contrast(1.05) saturate(1.1) brightness(0.95)';
  ctx.drawImage(item, -personW / 2, -personH / 2, personW, personH);
  ctx.restore();

  if (bgFrames && bgFrames.length > 0) {
    ctx.save();
    ctx.globalCompositeOperation = 'overlay';
    ctx.fillStyle = 'rgba(255, 160, 60, 0.06)';
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
  }

  const fg = ctx.createLinearGradient(0, H * 0.78, 0, H);
  fg.addColorStop(0, 'rgba(0,0,0,0)');
  fg.addColorStop(1, 'rgba(0,0,0,0.5)');
  ctx.fillStyle = fg;
  ctx.fillRect(0, 0, W, H);

  const vg = ctx.createRadialGradient(W / 2, H / 2, H * 0.15, W / 2, H / 2, H * 0.75);
  vg.addColorStop(0, 'rgba(0,0,0,0)');
  vg.addColorStop(1, 'rgba(0,0,0,0.45)');
  ctx.fillStyle = vg;
  ctx.fillRect(0, 0, W, H);
}

function _drawCover(ctx, img, x, y, w, h) {
  const natW = img.naturalWidth || img.width;
  const natH = img.naturalHeight || img.height;
  const iR = natW / natH;
  const cR = w / h;
  let sw, sh, sx, sy;
  if (iR > cR) {
    sh = natH;
    sw = sh * cR;
    sy = 0;
    sx = (natW - sw) / 2;
  } else {
    sw = natW;
    sh = sw / cR;
    sx = 0;
    sy = (natH - sh) / 2;
  }
  ctx.drawImage(img, sx, sy, sw, sh, x, y, w, h);
}
