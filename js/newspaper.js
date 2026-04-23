const CITY_TITLE_MAP = {
  '釜山': 'BUSAN DAILY / 부산 일보',
  '首爾': 'SEOUL MORNING / 서울 신門',
  '京都': 'KYOTO TIMES / 京都新聞',
  '大阪': 'OSAKA POST / 大阪日日',
  '東京': 'TOKYO EXPRESS / 東京新聞',
  '台北': 'TAIPEI TRIBUNE / 台北時報',
  '高雄': 'KAOHSIUNG NEWS / 高雄晨報',
  '香港': 'HONG KONG POST / 香港早報'
};

const PAPER_BG = '#f0e8d0';
const INK_COLOR = '#1a1a1a';

export const NEWS_NAMES = [
  'THE DAILY FLIP', 'BUSAN DAILY', 'SEOUL MORNING', 'KYOTO TIMES', 'OSAKA POST',
  'TOKYO EXPRESS', 'TAIPEI TRIBUNE', 'KAOHSIUNG NEWS', 'HONG KONG POST'
];

export function drawNewspaper(ctx, { items, mode, city, name, width, height, isPreview = false }) {
  const S = width / 1080;
  ctx.fillStyle = PAPER_BG;
  ctx.fillRect(0, 0, width, height);

  _drawNoise(ctx, width, height);

  ctx.fillStyle = INK_COLOR;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  
  ctx.font = `bold ${110 * S}px "Bebas Neue", sans-serif`;
  ctx.fillText(name || 'THE DAILY FLIP', width / 2, 80 * S);
  
  const titleText = CITY_TITLE_MAP[city] || 'WORLD NEWS / 全球快報';
  ctx.font = `${30 * S}px "Noto Sans TC", serif`;
  ctx.fillText(titleText, width / 2, 205 * S);

  ctx.lineWidth = 2.5 * S;
  ctx.beginPath();
  ctx.moveTo(70 * S, 260 * S); ctx.lineTo(width - 70 * S, 260 * S);
  ctx.moveTo(70 * S, 272 * S); ctx.lineTo(width - 70 * S, 272 * S);
  ctx.stroke();

  const date = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }).toUpperCase();
  ctx.font = `${22 * S}px "Noto Sans TC", sans-serif`;
  ctx.textAlign = 'left'; ctx.fillText('VOL. 09.19', 75 * S, 288 * S);
  ctx.textAlign = 'right'; ctx.fillText(date, width - 75 * S, 288 * S);

  ctx.beginPath();
  ctx.moveTo(70 * S, 325 * S); ctx.lineTo(width - 70 * S, 325 * S);
  ctx.stroke();

  const contentY = 360 * S;
  const boxW = width - 140 * S;

  if (mode === 'news-big') {
    const boxH = height * 0.54;
    _drawPhoto(ctx, items[0], 70 * S, contentY, boxW, boxH, S, isPreview);
    _drawColumns(ctx, 70 * S, contentY + boxH + 40 * S, boxW, height - (contentY + boxH + 80 * S), 2, S);
  } else {
    const mainH = height * 0.44;
    const subset = [items[0], items[Math.floor(items.length / 2)], items[items.length - 1]];
    _drawPhoto(ctx, subset[0], 70 * S, contentY, boxW, mainH, S, isPreview);
    
    const subW = (boxW - 30 * S) / 2;
    const subH = height - (contentY + mainH + 80 * S);
    _drawPhoto(ctx, subset[1], 70 * S, contentY + mainH + 30 * S, subW, subH, S, isPreview);
    _drawPhoto(ctx, subset[2], 70 * S + subW + 30 * S, contentY + mainH + 30 * S, subW, subH, S, isPreview);
  }

  ctx.globalCompositeOperation = 'multiply';
  ctx.fillStyle = 'rgba(240, 232, 208, 0.4)';
  ctx.fillRect(0, 0, width, height);
  ctx.globalCompositeOperation = 'source-over';
}

function _drawPhoto(ctx, img, x, y, w, h, S, isPreview) {
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
    ctx.filter = 'grayscale(100%) contrast(1.1) brightness(0.98)';
    ctx.drawImage(img, sx, sy, sw, sh, x, y, w, h);
    ctx.restore();
    ctx.strokeStyle = INK_COLOR; ctx.lineWidth = 1 * S; ctx.strokeRect(x, y, w, h);
    return;
  }

  const tmp = document.createElement('canvas'); tmp.width = w; tmp.height = h;
  const tCtx = tmp.getContext('2d');
  tCtx.filter = 'grayscale(100%) contrast(1.25) brightness(1.02)';
  tCtx.drawImage(img, sx, sy, sw, sh, 0, 0, w, h);
  const data = tCtx.getImageData(0, 0, w, h).data;
  const step = 4;
  ctx.fillStyle = INK_COLOR;
  for (let cy = 0; cy < h; cy += step) {
    for (let cx = 0; cx < w; cx += step) {
      const p = (Math.floor(cy) * Math.floor(w) + Math.floor(cx)) * 4;
      const b = (data[p] + data[p+1] + data[p+2]) / 3;
      const r = ((255 - b) / 255) * (step / 1.55);
      if (r > 0.45) { ctx.beginPath(); ctx.arc(x + cx, y + cy, r, 0, Math.PI * 2); ctx.fill(); }
    }
  }
  ctx.strokeStyle = INK_COLOR; ctx.lineWidth = 2.5 * S; ctx.strokeRect(x, y, w, h);
}

function _drawColumns(ctx, x, y, w, h, cols, S) {
  const gap = 40 * S; const colW = (w - gap * (cols - 1)) / cols;
  ctx.fillStyle = INK_COLOR; ctx.font = `${16 * S}px serif`;
  const text = "LOREM IPSUM DOLOR SIT AMET CONSECTETUR ADIPISCING ELIT SED DO EIUSMOD TEMPOR INCIDIDUNT UT LABORE ET DOLORE MAGNA ALIQUA UT ENIM AD MINIM VENIAM QUIS NOSTRUD EXERCITATION ULLAMCO LABORIS NISI UT ALIQUIP EX EA COMMODO CONSEQUAT DUIS AUTE IRURE DOLOR IN REPREHENDERIT IN VOLUPTATE VELIT ESSE CILLUM DOLORE EU FUGIAT NULLA PARIATUR.";
  const words = text.split(' ');
  for (let i = 0; i < cols; i++) {
    let curY = y; let line = '';
    for (let n = 0; n < words.length; n++) {
      let test = line + words[n] + ' ';
      if (ctx.measureText(test).width > colW && n > 0) {
        ctx.fillText(line, x + i * (colW + gap), curY); line = words[n] + ' '; curY += 22 * S;
        if (curY > y + h - 22 * S) break;
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
  const canvas = document.createElement('canvas'); canvas.width = 1080; canvas.height = 1350;
  drawNewspaper(canvas.getContext('2d'), {
    items: state.segmentedItems, mode: state.outputMode, city: state.activeCity,
    name: state.newspaperName, width: 1080, height: 1350, isPreview: false
  });
  return new Promise(r => canvas.toBlob(r, 'image/jpeg', 0.9));
}
