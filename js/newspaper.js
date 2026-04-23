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

export const NEWS_NAMES = [
  'THE DAILY FLIP', 'BUSAN DAILY', 'SEOUL MORNING', 'KYOTO TIMES', 'OSAKA POST',
  'TOKYO EXPRESS', 'TAIPEI TRIBUNE', 'KAOHSIUNG NEWS', 'HONG KONG POST',
  'GLOBAL CHRONICLE', 'THE URBAN VIBE', 'METRO GAZETTE', 'TIMELESS POST',
  'NEON JOURNAL', 'TRAVELER HERALD', 'THE FRIDAY NEWS', 'FLIPBOOK GAZETTE',
  'MORNING STAR', 'CITY MONITOR', 'THE ARCHIVE'
];

export function drawNewspaper(ctx, { items, mode, city, name, width, height, isPreview = false }) {
  const scale = width / 1080;
  ctx.fillStyle = PAPER_BG;
  ctx.fillRect(0, 0, width, height);

  _drawNoise(ctx, width, height);

  const cityName = CITY_TITLE_MAP[city] || 'THE DAILY FLIP / WORLD NEWS';
  
  ctx.fillStyle = INK_COLOR;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  
  ctx.font = `bold ${100 * scale}px "Bebas Neue", sans-serif`;
  ctx.fillText(name || 'THE DAILY FLIP', width / 2, 70 * scale);
  
  ctx.font = `${28 * scale}px "Noto Sans TC", serif`;
  ctx.fillText(cityName, width / 2, 185 * scale);

  ctx.lineWidth = 3 * scale;
  ctx.beginPath();
  ctx.moveTo(60 * scale, 240 * scale);
  ctx.lineTo(width - 60 * scale, 240 * scale);
  ctx.moveTo(60 * scale, 250 * scale);
  ctx.lineTo(width - 60 * scale, 250 * scale);
  ctx.stroke();

  const dateStr = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }).toUpperCase();
  ctx.font = `${20 * scale}px "Noto Sans TC", sans-serif`;
  ctx.textAlign = 'left';
  ctx.fillText(`VOL. 0919`, 60 * scale, 265 * scale);
  ctx.textAlign = 'right';
  ctx.fillText(dateStr, width - 60 * scale, 265 * scale);

  ctx.beginPath();
  ctx.moveTo(60 * scale, 300 * scale);
  ctx.lineTo(width - 60 * scale, 300 * scale);
  ctx.stroke();

  if (mode === 'news-big') {
    _renderLayout(ctx, [items[0]], 340 * scale, width, height, scale, isPreview);
  } else {
    const subset = [
      items[0],
      items[Math.floor(items.length / 2)],
      items[items.length - 1]
    ];
    _renderLayout(ctx, subset, 340 * scale, width, height, scale, isPreview, true);
  }

  ctx.globalCompositeOperation = 'multiply';
  ctx.fillStyle = 'rgba(240, 232, 208, 0.3)';
  ctx.fillRect(0, 0, width, height);
  ctx.globalCompositeOperation = 'source-over';
}

function _renderLayout(ctx, photos, startY, W, H, scale, isPreview, isGrid = false) {
  const boxW = W - 120 * scale;
  if (!isGrid) {
    const boxH = H * 0.52;
    _drawPhoto(ctx, photos[0], 60 * scale, startY, boxW, boxH, scale, isPreview);
    _drawFakeColumns(ctx, 60 * scale, startY + boxH + 30 * scale, boxW, H - (startY + boxH + 60 * scale), 2, scale);
  } else {
    const mainH = H * 0.42;
    _drawPhoto(ctx, photos[0], 60 * scale, startY, boxW, mainH, scale, isPreview);
    const subW = (boxW - 20 * scale) / 2;
    const subH = H - (startY + mainH + 60 * scale);
    _drawPhoto(ctx, photos[1], 60 * scale, startY + mainH + 20 * scale, subW, subH, scale, isPreview);
    _drawPhoto(ctx, photos[2], 60 * scale + subW + 20 * scale, startY + mainH + 20 * scale, subW, subH, scale, isPreview);
  }
}

function _drawPhoto(ctx, img, x, y, w, h, scale, isPreview) {
  if (!img) return;
  const natW = img.naturalWidth || img.width;
  const natH = img.naturalHeight || img.height;
  const iR = natW / natH;
  const cR = w / h;
  let sw, sh, sx, sy;
  if (iR > cR) {
    sh = natH; sw = sh * cR; sy = 0; sx = (natW - sw) / 2;
  } else {
    sw = natW; sh = sw / cR; sx = 0; sy = (natH - sh) / 2;
  }

  if (isPreview) {
    ctx.save();
    ctx.filter = 'grayscale(100%) contrast(1.1)';
    ctx.drawImage(img, sx, sy, sw, sh, x, y, w, h);
    ctx.restore();
    ctx.strokeStyle = INK_COLOR;
    ctx.lineWidth = 1 * scale;
    ctx.strokeRect(x, y, w, h);
    return;
  }

  const tmp = document.createElement('canvas');
  tmp.width = w; tmp.height = h;
  const tCtx = tmp.getContext('2d');
  tCtx.filter = 'grayscale(100%) contrast(1.2)';
  tCtx.drawImage(img, sx, sy, sw, sh, 0, 0, w, h);
  const data = tCtx.getImageData(0, 0, w, h).data;
  const step = 4;
  ctx.fillStyle = INK_COLOR;
  for (let cy = 0; cy < h; cy += step) {
    for (let cx = 0; cx < w; cx += step) {
      const p = (Math.floor(cy) * Math.floor(w) + Math.floor(cx)) * 4;
      const b = (data[p] + data[p+1] + data[p+2]) / 3;
      const r = ((255 - b) / 255) * (step / 1.6);
      if (r > 0.4) {
        ctx.beginPath();
        ctx.arc(x + cx, y + cy, r, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
  ctx.strokeStyle = INK_COLOR;
  ctx.lineWidth = 2 * scale;
  ctx.strokeRect(x, y, w, h);
}

function _drawFakeColumns(ctx, x, y, w, h, cols, scale) {
  const gap = 30 * scale;
  const colW = (w - gap * (cols - 1)) / cols;
  ctx.fillStyle = INK_COLOR;
  ctx.font = `${14 * scale}px serif`;
  const text = "LOREM IPSUM DOLOR SIT AMET CONSECTETUR ADIPISCING ELIT SED DO EIUSMOD TEMPOR INCIDIDUNT UT LABORE ET DOLORE MAGNA ALIQUA UT ENIM AD MINIM VENIAM QUIS NOSTRUD EXERCITATION ULLAMCO LABORIS NISI UT ALIQUIP EX EA COMMODO CONSEQUAT DUIS AUTE IRURE DOLOR IN REPREHENDERIT IN VOLUPTATE VELIT ESSE CILLUM DOLORE EU FUGIAT NULLA PARIATUR EXCEPTEUR SINT OCCAECAT CUPIDATAT NON PROIDENT SUNT IN CULPA QUI OFFICIA DESERUNT MOLLIT ANIM ID EST LABORUM.";
  const words = text.split(' ');
  for (let i = 0; i < cols; i++) {
    let curY = y;
    let line = '';
    for (let n = 0; n < words.length; n++) {
      let test = line + words[n] + ' ';
      if (ctx.measureText(test).width > colW && n > 0) {
        ctx.fillText(line, x + i * (colW + gap), curY);
        line = words[n] + ' '; curY += 20 * scale;
        if (curY > y + h - 20 * scale) break;
      } else { line = test; }
    }
    if (curY < y + h) ctx.fillText(line, x + i * (colW + gap), curY);
  }
}

function _drawNoise(ctx, w, h) {
  const data = ctx.createImageData(w, h);
  const d = data.data;
  for (let i = 0; i < d.length; i += 4) {
    const v = Math.random() * 255;
    d[i] = d[i+1] = d[i+2] = v; d[i+3] = 15;
  }
  const tmp = document.createElement('canvas');
  tmp.width = w; tmp.height = h;
  tmp.getContext('2d').putImageData(data, 0, 0);
  ctx.drawImage(tmp, 0, 0);
}

export async function generateNewspaperBlob(state) {
  const canvas = document.createElement('canvas');
  canvas.width = 1080; canvas.height = 1350;
  drawNewspaper(canvas.getContext('2d'), {
    items: state.segmentedItems,
    mode: state.outputMode,
    city: state.activeCity,
    name: state.newspaperName,
    width: 1080, height: 1350, isPreview: false
  });
  return new Promise(r => canvas.toBlob(r, 'image/jpeg', 0.9));
}
