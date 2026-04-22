/**
 * renderer.js  v2
 * 支援去背後的人像（透明 canvas）合成到場景背景
 *
 * 圖層順序：
 *   Layer 0 — 場景背景（慢速獨立循環）
 *   Layer 1 — 拍立得白框 + 陰影
 *   Layer 2 — 去背人像（含透明，自然融入背景）
 *   Layer 3 — 紙張紋理
 *   Layer 4 — 暈影
 */

// ── 固定物理參數 ──
const JITTER_PX  = 6;
const JITTER_ROT = 0.008;
const BORDER_PX  = 28;
const BORDER_BOT = 68;
const BG_SPEED   = 0.35;  // 背景比前景慢

export const OUTPUT_W = 540;
export const OUTPUT_H = 675;
export const FPS      = 8;   // 翻頁速度，8fps 較自然

/**
 * buildSequence(items)
 * items: HTMLImageElement[] 或 HTMLCanvasElement[]（去背後）
 * Yo-yo ping-pong 展開
 */
export function buildSequence(items) {
  if (items.length <= 1) return [...items];
  return [...items, ...[...items].slice(1, -1).reverse()];
}

/**
 * compositeFrame(ctx, userItem, bgFrames, frameIdx, totalFrames)
 * userItem: HTMLImageElement 或 HTMLCanvasElement（去背後，含透明）
 */
export function compositeFrame(ctx, userItem, bgFrames, frameIdx, totalFrames) {
  const W = OUTPUT_W;
  const H = OUTPUT_H;

  // ── 物理擾動（固定種子，每幀穩定）──
  const seed = frameIdx * 137.508 + 0.5;
  const dx   = Math.sin(seed * 2.13) * JITTER_PX;
  const dy   = Math.cos(seed * 1.77) * JITTER_PX * 0.55;
  const rot  = Math.sin(seed * 3.31) * JITTER_ROT;

  ctx.clearRect(0, 0, W, H);

  // ── Layer 0: 背景場景 ──
  if (bgFrames && bgFrames.length > 0) {
    const bgIdx = Math.floor((frameIdx * BG_SPEED) % bgFrames.length);
    _drawCover(ctx, bgFrames[bgIdx], 0, 0, W, H);
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.fillRect(0, 0, W, H);
  } else {
    const g = ctx.createLinearGradient(0, 0, W, H);
    g.addColorStop(0, '#1a1a2e');
    g.addColorStop(1, '#0f3460');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  }

  // ── Layer 1: 拍立得白框（含抖動）──
  const cardX = W * 0.06 + dx;
  const cardY = H * 0.05 + dy;
  const cardW = W * 0.88;
  const cardH = H * 0.86;

  ctx.save();
  ctx.translate(cardX + cardW / 2, cardY + cardH / 2);
  ctx.rotate(rot);

  // 陰影
  ctx.shadowColor   = 'rgba(0,0,0,0.65)';
  ctx.shadowBlur    = 36;
  ctx.shadowOffsetX = 5;
  ctx.shadowOffsetY = 12;

  // 白框本體
  ctx.fillStyle = '#f8f8f3';
  _roundRect(ctx, -cardW / 2, -cardH / 2, cardW, cardH, 3);
  ctx.fill();

  ctx.shadowColor = 'transparent';
  ctx.shadowBlur  = 0;

  // ── Layer 2: 人像區域 ──
  const photoX = -cardW / 2 + BORDER_PX;
  const photoY = -cardH / 2 + BORDER_PX;
  const photoW = cardW - BORDER_PX * 2;
  const photoH = cardH - BORDER_PX * 2 - BORDER_BOT;

  const isSegmented = userItem instanceof HTMLCanvasElement;

  if (isSegmented) {
    // 去背模式：人像透明 canvas，直接疊上去
    // 先在照片區域畫一個淺色底（讓白框內有背景感）
    ctx.save();
    ctx.beginPath();
    ctx.rect(photoX, photoY, photoW, photoH);
    ctx.clip();

    // 背景延伸到照片區（讓人像融入場景）
    if (bgFrames && bgFrames.length > 0) {
      const bgIdx = Math.floor((frameIdx * BG_SPEED) % bgFrames.length);
      // 把背景圖縮放畫進照片框（比卡片外的背景稍微不同縮放）
      _drawCover(ctx, bgFrames[bgIdx], photoX, photoY, photoW, photoH);
      ctx.fillStyle = 'rgba(0,0,0,0.15)';
      ctx.fillRect(photoX, photoY, photoW, photoH);
    }

    // 人像 cover-fit 畫進框內
    _drawCover(ctx, userItem, photoX, photoY, photoW, photoH);
    ctx.restore();

  } else {
    // 未去背模式（fallback）：原圖 cover-fit
    ctx.save();
    ctx.beginPath();
    ctx.rect(photoX, photoY, photoW, photoH);
    ctx.clip();
    _drawCover(ctx, userItem, photoX, photoY, photoW, photoH);
    ctx.restore();
  }

  // 底部拍立得分隔線
  ctx.fillStyle = 'rgba(0,0,0,0.05)';
  ctx.fillRect(-cardW / 2 + BORDER_PX, photoY + photoH, photoW, 1.5);

  ctx.restore(); // 結束 translate+rotate

  // ── Layer 3: 紙張紋理 ──
  _drawTexture(ctx, W, H);

  // ── Layer 4: 暈影 ──
  const vg = ctx.createRadialGradient(W / 2, H / 2, H * 0.2, W / 2, H / 2, H * 0.72);
  vg.addColorStop(0, 'rgba(0,0,0,0)');
  vg.addColorStop(1, 'rgba(0,0,0,0.52)');
  ctx.fillStyle = vg;
  ctx.fillRect(0, 0, W, H);
}

// ── Helpers ──

function _drawCover(ctx, img, x, y, w, h) {
  const natW = img.naturalWidth  || img.width;
  const natH = img.naturalHeight || img.height;
  const iR = natW / natH;
  const cR = w / h;
  let sw, sh, sx, sy;
  if (iR > cR) {
    sh = h; sw = sh * iR; sy = y; sx = x - (sw - w) / 2;
  } else {
    sw = w; sh = sw / iR; sx = x; sy = y - (sh - h) / 2;
  }
  ctx.drawImage(img, sx, sy, sw, sh);
}

function _roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

let _textureCache = null;
function _drawTexture(ctx, W, H) {
  if (!_textureCache) {
    const off = document.createElement('canvas');
    off.width = W; off.height = H;
    const oc = off.getContext('2d');
    for (let y = 0; y < H; y += 2) {
      for (let x = 0; x < W; x += 2) {
        if (Math.random() > 0.55) {
          oc.fillStyle = Math.random() > 0.5
            ? 'rgba(255,255,255,0.025)'
            : 'rgba(0,0,0,0.02)';
          oc.fillRect(x, y, 1, 1);
        }
      }
    }
    _textureCache = off;
  }
  ctx.globalAlpha = 0.55;
  ctx.drawImage(_textureCache, 0, 0);
  ctx.globalAlpha = 1;
}
