/**
 * renderer.js  v7
 * - 換頁跳幅加大（切換瞬間位移 ×4）
 * - 左中右不重複跳動修復
 * - 15秒上限：根據張數自動計算停留時間
 */

const JITTER_PX_STABLE = 3;    // 穩定時抖動
const JITTER_PX_SWITCH = 18;   // 切換瞬間跳幅（×6）
const JITTER_ROT_STABLE = 0.004;
const JITTER_ROT_SWITCH = 0.022;

export const INTERNAL_FPS = 24;
export const OUTPUT_W     = 540;
export const OUTPUT_H     = 675;

// 根據照片張數計算每張停留幀數，總時長 ≤ 15 秒
export function calcHoldFrames(photoCount) {
  const yoyoCount  = photoCount <= 1 ? 1 : 2 * photoCount - 2;
  const maxSeconds = 14.5;
  const secPerPhoto = Math.min(1.5, maxSeconds / yoyoCount);
  return Math.max(6, Math.round(secPerPhoto * INTERNAL_FPS));
}

export function getFPS() { return INTERNAL_FPS; }

// 左中右位置（相對畫面中心的偏移比例）
const POS_OFFSETS = [-0.16, 0, 0.16];

function buildPositionSeq(length) {
  const seq = [];
  let last = -1;
  for (let i = 0; i < length; i++) {
    const choices = [0, 1, 2].filter(p => p !== last);
    const pick    = choices[Math.floor(Math.random() * choices.length)];
    seq.push(pick);
    last = pick;
  }
  return seq;
}

export function buildSequence(items) {
  if (!items || items.length === 0) return [];
  const holdFrames = calcHoldFrames(items.length);

  if (items.length === 1) {
    return Array(holdFrames).fill({ item: items[0], photoIdx: 0, subFrame: 0, posIdx: 1, holdFrames });
  }

  const yoyo   = [...items, ...[...items].slice(1, -1).reverse()];
  const posSeq = buildPositionSeq(yoyo.length);

  const expanded = [];
  yoyo.forEach((item, photoIdx) => {
    for (let f = 0; f < holdFrames; f++) {
      expanded.push({ item, photoIdx, subFrame: f, posIdx: posSeq[photoIdx], holdFrames });
    }
  });
  return expanded;
}

export function compositeFrame(ctx, entry, bgFrames) {
  const { item, photoIdx, subFrame, posIdx, holdFrames } = entry;
  const W = OUTPUT_W;
  const H = OUTPUT_H;

  // 切換瞬間（前3幀）跳幅大，之後穩定微抖
  const isSwitching = subFrame < 3;
  const jPX  = isSwitching ? JITTER_PX_SWITCH  : JITTER_PX_STABLE;
  const jROT = isSwitching ? JITTER_ROT_SWITCH : JITTER_ROT_STABLE;

  const seed = photoIdx * 137.508;
  const dx   = Math.sin(seed * 2.13 + subFrame * 0.8) * jPX;
  const dy   = Math.cos(seed * 1.77 + subFrame * 0.6) * jPX * 0.5;
  const rot  = Math.sin(seed * 3.31 + subFrame * 0.4) * jROT;

  ctx.clearRect(0, 0, W, H);

  // ── Layer 0: 場景背景 ──
  if (bgFrames && bgFrames.length > 0) {
    const bgIdx = photoIdx % bgFrames.length;
    _drawCover(ctx, bgFrames[bgIdx], 0, 0, W, H);
  } else {
    const g = ctx.createLinearGradient(0, 0, W, H);
    g.addColorStop(0, '#1a1a2e');
    g.addColorStop(1, '#0f3460');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  }

  // ── Layer 1: 人物（78%寬，貼底，左中右跳位）──
  ctx.save();
  ctx.translate(dx, dy);

  const natW    = item.naturalWidth  || item.width;
  const natH    = item.naturalHeight || item.height;
  const personW = W * 0.78;
  const personH = personW * (natH / natW);
  const posOff  = POS_OFFSETS[posIdx ?? 1] * W;
  const personX = (W - personW) / 2 + posOff;
  const personY = H - personH;

  ctx.drawImage(item, personX, personY, personW, personH);
  ctx.restore();

  // ── Layer 2: 底部融合 ──
  const footGrad = ctx.createLinearGradient(0, H * 0.78, 0, H);
  footGrad.addColorStop(0, 'rgba(0,0,0,0)');
  footGrad.addColorStop(1, 'rgba(0,0,0,0.5)');
  ctx.fillStyle = footGrad;
  ctx.fillRect(0, 0, W, H);

  // ── Layer 3: 暈影 ──
  const vg = ctx.createRadialGradient(W/2, H/2, H*0.15, W/2, H/2, H*0.75);
  vg.addColorStop(0, 'rgba(0,0,0,0)');
  vg.addColorStop(1, 'rgba(0,0,0,0.45)');
  ctx.fillStyle = vg;
  ctx.fillRect(0, 0, W, H);
}

function _drawCover(ctx, img, x, y, w, h) {
  const natW = img.naturalWidth  || img.width;
  const natH = img.naturalHeight || img.height;
  const iR = natW / natH, cR = w / h;
  let sw, sh, sx, sy;
  if (iR > cR) { sh=h; sw=sh*iR; sy=y; sx=x-(sw-w)/2; }
  else         { sw=w; sh=sw/iR; sx=x; sy=y-(sh-h)/2; }
  ctx.drawImage(img, sx, sy, sw, sh);
}
