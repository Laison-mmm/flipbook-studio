const CITY_TITLE_MAP = {
  '釜山': 'BUSAN DAILY\n부산 일보',
  '首爾': 'SEOUL MORNING\n서울 신문',
  '京都': 'KYOTO TIMES\n京都新聞',
  '大阪': 'OSAKA POST\n大阪日日',
  '東京': 'TOKYO EXPRESS\n東京新聞',
  '台北': 'TAIPEI TRIBUNE\n台北時報',
  '高雄': 'KAOHSIUNG NEWS\n高雄晨報',
  '香港': 'HONG KONG POST\n香港早報'
};

const PAPER_BG = '#f0e8d0';
const INK_COLOR = '#1a1a1a';
const OUT_W = 1080;
const OUT_H = 1350;

export async function generateNewspaper(items, mode, city) {
  const canvas = document.createElement('canvas');
  canvas.width = OUT_W;
  canvas.height = OUT_H;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = PAPER_BG;
  ctx.fillRect(0, 0, OUT_W, OUT_H);

  _drawNoise(ctx, OUT_W, OUT_H);

  const titleText = CITY_TITLE_MAP[city] || 'THE DAILY FLIP\nWORLD NEWS';
  const lines = titleText.split('\n');
  
  ctx.fillStyle = INK_COLOR;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  
  ctx.font = 'bold 120px "Bebas Neue", sans-serif';
  ctx.fillText(lines[0], OUT_W / 2, 80);
  
  ctx.font = '32px "Noto Sans TC", serif';
  ctx.fillText(lines[1] || 'SPECIAL EDITION', OUT_W / 2, 210);

  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(80, 270);
  ctx.lineTo(OUT_W - 80, 270);
  ctx.moveTo(80, 280);
  ctx.lineTo(OUT_W - 80, 280);
  ctx.stroke();

  const dateStr = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }).toUpperCase();
  ctx.font = '22px "Noto Sans TC", sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(`VOL. ${Math.floor(Math.random() * 99) + 1}`, 80, 295);
  ctx.textAlign = 'right';
  ctx.fillText(dateStr, OUT_W - 80, 295);

  ctx.beginPath();
  ctx.moveTo(80, 335);
  ctx.lineTo(OUT_W - 80, 335);
  ctx.stroke();

  if (mode === 'news-big') {
    await _renderBigLayout(ctx, items[0]);
  } else {
    await _renderGridLayout(ctx, items);
  }

  ctx.globalCompositeOperation = 'multiply';
  ctx.fillStyle = 'rgba(240, 232, 208, 0.45)';
  ctx.fillRect(0, 0, OUT_W, OUT_H);

  return new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.92));
}

async function _renderBigLayout(ctx, mainItem) {
  const boxY = 380;
  const boxW = OUT_W - 160;
  const boxH = OUT_H * 0.55;
  
  await _drawHalftoneImage(ctx, mainItem, 80, boxY, boxW, boxH);
  
  const textY = boxY + boxH + 40;
  _drawFakeColumns(ctx, 80, textY, boxW, OUT_H - textY - 60, 2);
}

async function _renderGridLayout(ctx, items) {
  const mainItem = items[0];
  const item2 = items[Math.floor(items.length / 3)] || items[0];
  const item3 = items[Math.floor(items.length * 2 / 3)] || items[0];

  const mainY = 380;
  const mainW = OUT_W - 160;
  const mainH = OUT_H * 0.45;
  await _drawHalftoneImage(ctx, mainItem, 80, mainY, mainW, mainH);

  const subY = mainY + mainH + 30;
  const subW = (mainW - 30) / 2;
  const subH = OUT_H - subY - 60;
  
  await _drawHalftoneImage(ctx, item2, 80, subY, subW, subH);
  await _drawHalftoneImage(ctx, item3, 80 + subW + 30, subY, subW, subH);
}

async function _drawHalftoneImage(ctx, img, x, y, w, h) {
  const tmpCanvas = document.createElement('canvas');
  tmpCanvas.width = w;
  tmpCanvas.height = h;
  const tCtx = tmpCanvas.getContext('2d');
  
  tCtx.fillStyle = '#fff';
  tCtx.fillRect(0, 0, w, h);
  
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
  
  tCtx.filter = 'grayscale(100%) contrast(1.2) brightness(1.05)';
  tCtx.drawImage(img, sx, sy, sw, sh, 0, 0, w, h);

  const imgData = tCtx.getImageData(0, 0, w, h);
  const data = imgData.data;
  const step = 5;
  
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();

  ctx.fillStyle = '#1a1a1a';
  for (let cy = 0; cy < h; cy += step) {
    for (let cx = 0; cx < w; cx += step) {
      const p = (cy * w + cx) * 4;
      const brightness = (data[p] + data[p+1] + data[p+2]) / 3;
      const radius = ((255 - brightness) / 255) * (step / 1.5);
      
      if (radius > 0.3) {
        ctx.beginPath();
        ctx.arc(x + cx, y + cy, radius, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  ctx.lineWidth = 3;
  ctx.strokeStyle = INK_COLOR;
  ctx.strokeRect(x, y, w, h);
  ctx.restore();
}

function _drawFakeColumns(ctx, x, y, w, h, cols) {
  const gap = 40;
  const colW = (w - gap * (cols - 1)) / cols;
  ctx.fillStyle = INK_COLOR;
  ctx.font = '16px serif';
  ctx.textAlign = 'justify';
  ctx.textBaseline = 'top';

  const fakeText = "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum. Curabitur pretium tincidunt lacus. Nulla gravida orci a odio. Nullam varius, turpis et commodo pharetra, est eros bibendum elit, nec luctus magna felis sollicitudin mauris. Integer in mauris eu nibh euismod gravida.";
  
  for (let i = 0; i < cols; i++) {
    let curY = y;
    let text = fakeText + " " + fakeText;
    let words = text.split(' ');
    let line = '';
    
    for (let n = 0; n < words.length; n++) {
      let testLine = line + words[n] + ' ';
      let metrics = ctx.measureText(testLine);
      if (metrics.width > colW && n > 0) {
        ctx.fillText(line, x + i * (colW + gap), curY);
        line = words[n] + ' ';
        curY += 24;
        if (curY > y + h - 24) break;
      } else {
        line = testLine;
      }
    }
    if (curY <= y + h - 24) {
      ctx.fillText(line, x + i * (colW + gap), curY);
    }
  }
}

function _drawNoise(ctx, w, h) {
  const imgData = ctx.createImageData(w, h);
  const data = imgData.data;
  for (let i = 0; i < data.length; i += 4) {
    const v = Math.random() * 255;
    data[i] = v;
    data[i+1] = v;
    data[i+2] = v;
    data[i+3] = 12;
  }
  const tmp = document.createElement('canvas');
  tmp.width = w; tmp.height = h;
  tmp.getContext('2d').putImageData(imgData, 0, 0);
  ctx.drawImage(tmp, 0, 0);
}