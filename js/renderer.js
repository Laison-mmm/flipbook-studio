export const INTERNAL_FPS = 24;
export const OUTPUT_W = 540;
export const OUTPUT_H = 675;

const POS_OFFSETS = [-0.16, 0, 0.16];
const JITTER_PX_STABLE = 3;
const JITTER_PX_SWITCH = 18;
const JITTER_ROT_STABLE = 0.004;
const JITTER_ROT_SWITCH = 0.022;

function buildPositionSeq(length) {
  const seq = []; let last = -1;
  for (let i = 0; i < length; i++) {
    const choices = [0, 1, 2].filter(p => p !== last);
    const pick = choices[Math.floor(Math.random() * choices.length)];
    seq.push(pick); last = pick;
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
  const W = OUTPUT_W; const H = OUTPUT_H;
  
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
    ctx.fillStyle = '#1a1a1a'; ctx.fillRect(0, 0, W, H);
  }

  const natW = item.naturalWidth || item.width;
  const natH = item.naturalHeight || item.height;
  const personW = W * 0.82;
  const personH = personW * (natH / natW);
  const posOff = POS_OFFSETS[posIdx ?? 1] * W;
  const drawX = (W - personW) / 2 + posOff;
  const drawY = H - personH;

  ctx.save();
  ctx.translate(dx, dy);

  const shadowY = drawY + personH - 15;
  const shadowX = drawX + personW / 2;
  const radGrad = ctx.createRadialGradient(shadowX, shadowY, 0, shadowX, shadowY, personW * 0.45);
  radGrad.addColorStop(0, 'rgba(0,0,0,0.5)');
  radGrad.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = radGrad;
  ctx.beginPath();
  ctx.ellipse(shadowX, shadowY, personW * 0.4, personH * 0.05, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.translate(drawX + personW / 2, drawY + personH / 2);
  ctx.rotate(rot);
  
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.2)'; ctx.shadowBlur = 12;
  ctx.filter = bgFrames.length ? 'contrast(1.06) brightness(0.98) saturate(1.05) sepia(0.04)' : 'none';
  ctx.drawImage(item, -personW / 2, -personH / 2, personW, personH);
  ctx.restore();
  
  ctx.globalCompositeOperation = 'destination-in';
  ctx.filter = 'blur(1px)';
  ctx.drawImage(item, -personW / 2, -personH / 2, personW, personH);
  ctx.globalCompositeOperation = 'source-over';
  ctx.restore();

  const vg = ctx.createRadialGradient(W / 2, H / 2, H * 0.25, W / 2, H / 2, H * 0.8);
  vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.3)');
  ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);
}

function _drawCover(ctx, img, x, y, w, h) {
  if (!img) return;
  const natW = img.naturalWidth || img.width;
  const natH = img.naturalHeight || img.height;
  const iR = natW / natH; const cR = w / h;
  let sw, sh, sx, sy;
  if (iR > cR) { sh = natH; sw = sh * cR; sy = 0; sx = (natW - sw) / 2; }
  else { sw = natW; sh = sw / cR; sx = 0; sy = (natH - sh) / 2; }
  ctx.drawImage(img, sx, sy, sw, sh, x, y, w, h);
}
