/**
 * renderer.js — stable rollback
 * 換頁跳幅大、左中右不重複、15秒限制
 */

const JITTER_PX_STABLE = 3;
const JITTER_PX_SWITCH = 18;
const JITTER_ROT_STABLE = 0.004;
const JITTER_ROT_SWITCH = 0.022;

export const INTERNAL_FPS = 24;
export const HOLD_FRAMES  = 24;
export const FPS          = INTERNAL_FPS;
export const OUTPUT_W     = 540;
export const OUTPUT_H     = 675;

const POS_OFFSETS = [-0.16, 0, 0.16];

function buildPositionSeq(length) {
  const seq = []; let last = -1;
  for (let i = 0; i < length; i++) {
    const choices = [0, 1, 2].filter(p => p !== last);
    const pick    = choices[Math.floor(Math.random() * choices.length)];
    seq.push(pick); last = pick;
  }
  return seq;
}

export function buildSequence(items) {
  if (!items || items.length === 0) return [];
  if (items.length === 1) {
    return Array(HOLD_FRAMES).fill({ item: items[0], photoIdx: 0, subFrame: 0, posIdx: 1, holdFrames: HOLD_FRAMES });
  }
  const yoyo   = [...items, ...[...items].slice(1, -1).reverse()];
  const posSeq = buildPositionSeq(yoyo.length);
  const expanded = [];
  yoyo.forEach((item, photoIdx) => {
    for (let f = 0; f < HOLD_FRAMES; f++) {
      expanded.push({ item, photoIdx, subFrame: f, posIdx: posSeq[photoIdx], holdFrames: HOLD_FRAMES });
    }
  });
  return expanded;
}

export function compositeFrame(ctx, entry, bgFrames) {
  const { item, photoIdx, subFrame, posIdx } = entry;
  const W = OUTPUT_W, H = OUTPUT_H;

  const isSwitching = subFrame < 3;
  const jPX  = isSwitching ? JITTER_PX_SWITCH  : JITTER_PX_STABLE;
  const jROT = isSwitching ? JITTER_ROT_SWITCH : JITTER_ROT_STABLE;
  const seed = photoIdx * 137.508;
  const dx   = Math.sin(seed * 2.13 + subFrame * 0.8) * jPX;
  const dy   = Math.cos(seed * 1.77 + subFrame * 0.6) * jPX * 0.5;
  const rot  = Math.sin(seed * 3.31 + subFrame * 0.4) * jROT;

  ctx.clearRect(0, 0, W, H);

  // 場景背景
  if (bgFrames && bgFrames.length > 0) {
    _drawCover(ctx, bgFrames[photoIdx % bgFrames.length], 0, 0, W, H);
  } else {
    const g = ctx.createLinearGradient(0, 0, W, H);
    g.addColorStop(0, '#1a1a2e'); g.addColorStop(1, '#0f3460');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  }

  // 人物（78%，貼底，左中右）
  ctx.save();
  ctx.translate(dx, dy);
  const natW = item.naturalWidth || item.width;
  const natH = item.naturalHeight || item.height;
  const personW = W * 0.78;
  const personH = personW * (natH / natW);
  const posOff  = POS_OFFSETS[posIdx ?? 1] * W;
  ctx.drawImage(item, (W - personW) / 2 + posOff, H - personH, personW, personH);
  ctx.restore();

  // 底部融合
  const fg = ctx.createLinearGradient(0, H * 0.78, 0, H);
  fg.addColorStop(0, 'rgba(0,0,0,0)'); fg.addColorStop(1, 'rgba(0,0,0,0.5)');
  ctx.fillStyle = fg; ctx.fillRect(0, 0, W, H);

  // 暈影
  const vg = ctx.createRadialGradient(W/2, H/2, H*0.15, W/2, H/2, H*0.75);
  vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.45)');
  ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);
}

function _drawCover(ctx, img, x, y, w, h) {
  const natW = img.naturalWidth || img.width;
  const natH = img.naturalHeight || img.height;
  const iR = natW/natH, cR = w/h;
  let sw, sh, sx, sy;
  if (iR > cR) { sh=h; sw=sh*iR; sy=y; sx=x-(sw-w)/2; }
  else         { sw=w; sh=sw/iR; sx=x; sy=y-(sh-h)/2; }
  ctx.drawImage(img, sx, sy, sw, sh);
}
