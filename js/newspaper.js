const CITY_TITLE_MAP = {
  '釜山': 'BUSAN DAILY / 부산 일보',
  '首爾': 'SEOUL MORNING / 서울 신문',
  '京都': 'KYOTO TIMES / 京都新聞',
  '大阪': 'OSAKA POST / 大阪日日',
  '東京': 'TOKYO EXPRESS / 東京新聞',
  '台北': 'TAIPEI TRIBUNE / 台北時報',
  '高雄': 'KAOHSIUNG NEWS / 高雄晨報',
  '香港': 'HONG KONG POST / 香港早報'
};

const PAPER_BG = '#f0e8d0';
const INK_COLOR = '#1a1a1a';
const CANVAS_W = 1080;
const CANVAS_H = 1350;

export const NEWS_NAMES = [
  'THE DAILY FLIP', 'BUSAN DAILY', 'SEOUL MORNING', 'KYOTO TIMES', 'OSAKA POST',
  'TOKYO EXPRESS', 'TAIPEI TRIBUNE', 'KAOHSIUNG NEWS', 'HONG KONG POST'
];

export function drawNewspaper(ctx, { items, mode, city, name, width, height, isPreview = false }) {
  const scale = width / CANVAS_W;
  ctx.save();
  ctx.scale(scale, scale);
  
  ctx.fillStyle = PAPER_BG;
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

  _drawNoise(ctx, CANVAS_W, CANVAS_H);

  ctx.fillStyle = INK_COLOR;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  
  ctx.font = 'bold 155px "Bebas Neue", sans-serif';
  ctx.fillText(name || 'THE DAILY FLIP', CANVAS_W / 2, 70);
  
  const subTitle = CITY_TITLE_MAP[city] || 'WORLD NEWS / 全球快報';
  ctx.font = '34px "Noto Sans TC", serif';
  ctx.fillText(subTitle, CANVAS_W / 2, 225);

  ctx.strokeStyle = INK_COLOR;
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(60, 280); ctx.lineTo(1020, 280);
  ctx.stroke();
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(60, 292); ctx.lineTo(1020, 292);
  ctx.stroke();

  const dateStr = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }).toUpperCase();
  ctx.font = '700 24px "Noto Sans TC", sans-serif';
  ctx.textAlign = 'left'; ctx.fillText('VOL. 0919-MOD', 65, 308);
  ctx.textAlign = 'right'; ctx.fillText(dateStr, 1015, 308);

  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(60, 345); ctx.lineTo(1020, 345);
  ctx.stroke();

  const contentY = 385;
  const contentW = 960;

  if (mode === 'news-big') {
    const mainH = 750;
    _drawPhoto(ctx, items[0], 60, contentY, contentW, mainH, isPreview);
    _drawColumns(ctx, 60, contentY + mainH + 45, contentW, CANVAS_H - (contentY + mainH + 90), 2);
  } else {
    const mainH = 620;
    const subset = [items[0], items[Math.floor(items.length / 2)], items[items.length - 1]];
    _drawPhoto(ctx, subset[0], 60, contentY, contentW, mainH, isPreview);
    
    const subW = 465;
    const subH = CANVAS_H - (contentY + mainH + 110);
    _drawPhoto(ctx, subset[1], 60, contentY + mainH + 35, subW, subH, isPreview);
    _drawPhoto(ctx, subset[2], 60 + subW + 30, contentY + mainH + 35, subW, subH, isPreview);
  }

  ctx.globalCompositeOperation = 'multiply';
  ctx.fillStyle = 'rgba(240, 232, 208, 0.4)';
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
  
  ctx.restore();
}

function _drawPhoto(ctx, img, x, y, w, h, isPreview) {
  if (!img) return;
  const natW = img.naturalWidth || img.width;
  const natH = img.naturalHeight || img.height;
  const iR = natW / natH;
  const cR = w / h;
  let sw, sh, sx, sy;
  if (iR > cR) { sh = natH; sw = sh * cR; sy = 0; sx = (natW - sw) / 2; }
  else { sw = natW; sh = sw / cR; sx = 0; sy = (natH - sh) / 2; }

  if (isPreview) {
    ctx.save();
    ctx.filter = 'grayscale(100%) contrast(1.15) brightness(0.95)';
    ctx.drawImage(img, sx, sy, sw, sh, x, y, w, h);
    ctx.restore();
    ctx.strokeStyle = INK_COLOR; ctx.lineWidth = 2; ctx.strokeRect(x, y, w, h);
    return;
  }

  const tmp = document.createElement('canvas'); tmp.width = w; tmp.height = h;
  const tCtx = tmp.getContext('2d');
  tCtx.filter = 'grayscale(100%) contrast(1.4) brightness(1.05)';
  tCtx.drawImage(img, sx, sy, sw, sh, 0, 0, w, h);
  const data = tCtx.getImageData(0, 0, w, h).data;
  const step = 4;
  ctx.fillStyle = INK_COLOR;
  for (let cy = 0; cy < h; cy += step) {
    for (let cx = 0; cx < w; cx += step) {
      const p = (Math.floor(cy) * Math.floor(w) + Math.floor(cx)) * 4;
      const b = (data[p] + data[p+1] + data[p+2]) / 3;
      const r = ((255 - b) / 255) * (step / 1.5);
      if (r > 0.4) { ctx.beginPath(); ctx.arc(x + cx, y + cy, r, 0, Math.PI * 2); ctx.fill(); }
    }
  }
  ctx.strokeStyle = INK_COLOR; ctx.lineWidth = 4; ctx.strokeRect(x, y, w, h);
}

function _drawColumns(ctx, x, y, w, h, cols) {
  const gap = 50; const colW = (w - gap * (cols - 1)) / cols;
  ctx.fillStyle = INK_COLOR;
  ctx.font = '18px serif';
  ctx.textAlign = 'justify';
  const text = "LOREM IPSUM DOLOR SIT AMET CONSECTETUR ADIPISCING ELIT SED DO EIUSMOD TEMPOR INCIDIDUNT UT LABORE ET DOLORE MAGNA ALIQUA UT ENIM AD MINIM VENIAM QUIS NOSTRUD EXERCITATION ULLAMCO LABORIS NISI UT ALIQUIP EX EA COMMODO CONSEQUAT DUIS AUTE IRURE DOLOR IN REPREHENDERIT IN VOLUPTATE VELIT ESSE CILLUM DOLORE EU FUGIAT NULLA PARIATUR EXCEPTEUR SINT OCCAECAT CUPIDATAT NON PROIDENT SUNT IN CULPA QUI OFFICIA DESERUNT MOLLIT ANIM ID EST LABORUM.";
  const words = text.split(' ');
  for (let i = 0; i < cols; i++) {
    let curY = y; let line = '';
    for (let n = 0; n < words.length; n++) {
      let test = line + words[n] + ' ';
      if (ctx.measureText(test).width > colW && n > 0) {
        ctx.fillText(line, x + i * (colW + gap), curY); line = words[n] + ' '; curY += 26;
        if (curY > y + h - 26) break;
      } else { line = test; }
    }
    if (curY < y + h) ctx.fillText(line, x + i * (colW + gap), curY);
  }
}

function _drawNoise(ctx, w, h) {
  const data = ctx.createImageData(w, h); const d = data.data;
  for (let i = 0; i < d.length; i += 4) { const v = Math.random() * 255; d[i] = d[i+1] = d[i+2] = v; d[i+3] = 18; }
  const tmp = document.createElement('canvas'); tmp.width = w; tmp.height = h;
  tmp.getContext('2d').putImageData(data, 0, 0); ctx.drawImage(tmp, 0, 0);
}

export async function generateNewspaperBlob(state) {
  const canvas = document.createElement('canvas');
  canvas.width = CANVAS_W; canvas.height = CANVAS_H;
  drawNewspaper(canvas.getContext('2d'), {
    items: state.segmentedItems, mode: state.outputMode, city: state.activeCity,
    name: state.newspaperName, width: CANVAS_W, height: CANVAS_H, isPreview: false
  });
  return new Promise(r => canvas.toBlob(r, 'image/jpeg', 0.92));
}
