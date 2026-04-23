/**
 * newspaper.js
 * 報紙靜態圖合成
 * 模式一：大頭版（單張人物）
 * 模式二：一大兩小（三張人物）
 */

export const NP_W = 540;
export const NP_H = 675;

// 假報紙名稱候選
const PAPER_NAMES = {
  '釜山':   ['BUSAN DAILY', '부산일보', 'THE BUSAN TIMES'],
  '首爾':   ['SEOUL MORNING', '서울신문', 'THE KOREA HERALD'],
  '京都':   ['KYOTO GAZETTE', '京都新聞', 'KYOTO TIMES'],
  '大阪':   ['OSAKA JOURNAL', '大阪日日新聞', 'THE OSAKA TIMES'],
  '東京':   ['TOKYO TRIBUNE', '東京新聞', 'THE JAPAN TIMES'],
  '台北':   ['TAIPEI TIMES', '台北日報', 'THE TAIPEI DAILY'],
  '高雄':   ['KAOHSIUNG POST', '高雄日報', 'SOUTHERN DAILY'],
  '香港':   ['HK MORNING POST', '香港日報', 'THE HK TIMES'],
  'DEFAULT':['THE DAILY FLIP', 'MORNING EDITION', 'THE CITY POST'],
};

const HEADLINES = {
  '釜山': ['세젤귀 소녀 부산 상륙！', 'Ultimate Cutie Lands in Busan', '神秘美少女 釜山現身'],
  '首爾': ['서울 중심부에 나타난 소녀', 'Mystery Girl Spotted in Seoul', '首爾街頭 神秘目擊'],
  '京都': ['謎の美少女が京都に出現', 'Mysterious Beauty in Kyoto', '京都の街に謎の訪問者'],
  '大阪': ['大阪で謎の美少女を目撃！', 'Osaka Sighting Confirmed', '道頓堀 謎の美少女現る'],
  '東京': ['東京で謎の美少女が出現！', 'Tokyo Mystery Girl Spotted', '渋谷で目撃情報相次ぐ'],
  '台北': ['台北現神秘女孩！目擊者眾', 'Mystery Girl in Taipei', '台北街頭 神秘美少女現身'],
  '高雄': ['高雄驚見神秘美少女', 'Mystery Girl Spotted in Kaohsiung', '高雄港邊 目擊神秘少女'],
  '香港': ['香港驚現神秘美少女！', 'HK Mystery Girl Goes Viral', '維港旁 神秘女孩驚現'],
  'DEFAULT': ['神秘少女今日目擊！', 'Mystery Girl Spotted Today', 'Breaking: Local Cutie Appears'],
};

// 假文字段落（用來填版面）
const LOREM_KO = '해당 목격자에 따르면 소녀는 매우 밝은 미소를 지으며 사라졌다고 한다. 현지 주민들은 이 소식에 큰 관심을 보이고 있으며 SNS에서도 빠르게 확산되고 있다. 관계자는 추가 조사를 진행 중이라고 밝혔다.';
const LOREM_EN = 'According to local witnesses, the mysterious figure was seen smiling brightly before disappearing into the crowd. Residents have expressed great interest and the story is spreading rapidly on social media. Officials say further investigation is underway.';
const LOREM_ZH = '據目擊者稱，神秘少女面帶燦爛笑容後消失在人群中。當地居民對此高度關注，相關消息在社群媒體上迅速擴散，相關部門表示將展開進一步調查。';
const LOREM_JA = '目撃者によると、謎の少女は明るい笑顔を見せた後、群衆の中に消えたという。地元住民の間で大きな話題となっており、SNSでも急速に広まっている。当局はさらなる調査を進めると述べた。';

function getPaperName(city, custom) {
  if (custom) return custom;
  const list = PAPER_NAMES[city] || PAPER_NAMES['DEFAULT'];
  return list[Math.floor(Math.random() * list.length)];
}

function getHeadline(city) {
  const list = HEADLINES[city] || HEADLINES['DEFAULT'];
  return list[Math.floor(Math.random() * list.length)];
}

function getBodyText(city) {
  if (['釜山','首爾'].includes(city))   return LOREM_KO;
  if (['京都','大阪','東京'].includes(city)) return LOREM_JA;
  if (['台北','高雄','香港'].includes(city)) return LOREM_ZH;
  return LOREM_EN;
}

function formatDate() {
  const d = new Date();
  return `${d.getFullYear()}.${String(d.getMonth()+1).padStart(2,'0')}.${String(d.getDate()).padStart(2,'0')}`;
}

function randomIssue() {
  return `No.${Math.floor(Math.random()*9000)+1000}`;
}

/**
 * toGrayscale(canvas) — 把 canvas 轉灰階
 */
function toGrayscale(srcCanvas) {
  const w = srcCanvas.width, h = srcCanvas.height;
  const out = document.createElement('canvas');
  out.width=w; out.height=h;
  const ctx = out.getContext('2d');
  ctx.drawImage(srcCanvas, 0, 0);
  const d = ctx.getImageData(0,0,w,h);
  for (let i=0; i<d.data.length; i+=4) {
    const g = 0.299*d.data[i] + 0.587*d.data[i+1] + 0.114*d.data[i+2];
    d.data[i]=d.data[i+1]=d.data[i+2]=g;
  }
  ctx.putImageData(d,0,0);
  return out;
}

/**
 * applyHalftone(ctx, x, y, w, h) — 輕微網點效果
 */
function applyHalftone(ctx, x, y, w, h) {
  ctx.save();
  ctx.globalAlpha = 0.06;
  const dotSize = 3;
  ctx.fillStyle = '#000';
  for (let dy=y; dy<y+h; dy+=dotSize*2) {
    for (let dx=x; dx<x+w; dx+=dotSize*2) {
      ctx.beginPath();
      ctx.arc(dx, dy, dotSize*0.4, 0, Math.PI*2);
      ctx.fill();
    }
  }
  ctx.restore();
}

/**
 * drawWrinkle(ctx, W, H) — 輕微皺摺感
 */
function drawWrinkle(ctx, W, H) {
  ctx.save();
  ctx.globalAlpha = 0.04;
  // 對角皺摺線
  for (let i=0; i<3; i++) {
    const x1 = Math.random()*W, y1 = 0;
    const x2 = x1 + (Math.random()-0.5)*80, y2 = H;
    const grad = ctx.createLinearGradient(x1, y1, x2, y2);
    grad.addColorStop(0,   'rgba(0,0,0,0)');
    grad.addColorStop(0.5, 'rgba(0,0,0,0.5)');
    grad.addColorStop(1,   'rgba(0,0,0,0)');
    ctx.strokeStyle = grad;
    ctx.lineWidth   = Math.random()*2+1;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.bezierCurveTo(x1+20, H/3, x2-20, H*2/3, x2, y2);
    ctx.stroke();
  }
  ctx.restore();
}

/**
 * wrapText — 自動換行文字
 */
function wrapText(ctx, text, x, y, maxW, lineH) {
  const chars = text.split('');
  let line = '', cy = y;
  for (const ch of chars) {
    const test = line + ch;
    if (ctx.measureText(test).width > maxW && line) {
      ctx.fillText(line, x, cy);
      line = ch; cy += lineH;
    } else { line = test; }
  }
  if (line) ctx.fillText(line, x, cy);
  return cy;
}

/**
 * renderNewspaper1(personCanvas, city, paperName)
 * 模式一：大頭版
 */
export function renderNewspaper1(personCanvas, city, paperName) {
  const W=NP_W, H=NP_H;
  const canvas = document.createElement('canvas');
  canvas.width=W; canvas.height=H;
  const ctx = canvas.getContext('2d');

  // ── 紙張底色 ──
  ctx.fillStyle = '#f0e8d0';
  ctx.fillRect(0,0,W,H);

  // 輕微漸層（上淺下略深）
  const paperGrad = ctx.createLinearGradient(0,0,0,H);
  paperGrad.addColorStop(0, 'rgba(255,250,235,0.6)');
  paperGrad.addColorStop(1, 'rgba(200,185,155,0.3)');
  ctx.fillStyle = paperGrad;
  ctx.fillRect(0,0,W,H);

  // ── 報頭區 ──
  const headerH = 72;
  ctx.fillStyle = '#1a1008';
  ctx.fillRect(0, 0, W, headerH);

  const name = getPaperName(city, paperName);
  ctx.fillStyle = '#f0e8d0';
  ctx.font      = `bold ${name.length > 15 ? 22 : 28}px 'Georgia', serif`;
  ctx.textAlign = 'center';
  ctx.fillText(name, W/2, 42);

  ctx.font      = '11px Georgia, serif';
  ctx.fillStyle = '#c8b890';
  ctx.fillText(`${formatDate()}  ·  ${randomIssue()}  ·  SPECIAL EDITION`, W/2, 62);

  // ── 分隔線 ──
  ctx.strokeStyle = '#1a1008';
  ctx.lineWidth   = 1.5;
  ctx.beginPath(); ctx.moveTo(12, headerH+8); ctx.lineTo(W-12, headerH+8); ctx.stroke();
  ctx.lineWidth   = 0.5;
  ctx.beginPath(); ctx.moveTo(12, headerH+12); ctx.lineTo(W-12, headerH+12); ctx.stroke();

  // ── 標題 ──
  const headline = getHeadline(city);
  ctx.fillStyle  = '#1a1008';
  ctx.font       = `bold 18px 'Georgia', serif`;
  ctx.textAlign  = 'center';
  ctx.fillText(headline, W/2, headerH+32);

  // ── 人物照片區（灰階，居中）──
  const photoY = headerH + 46;
  const photoH = 310;
  const photoW = W - 48;
  const photoX = 24;

  const gray = toGrayscale(personCanvas);
  // cover-fit 進照片框
  const natW = gray.width, natH = gray.height;
  const iR = natW/natH, cR = photoW/photoH;
  let sw,sh,sx,sy;
  if (iR>cR) { sh=photoH; sw=sh*iR; sy=photoY; sx=photoX-(sw-photoW)/2; }
  else       { sw=photoW; sh=sw/iR; sx=photoX; sy=photoY-(sh-photoH)/2; }

  ctx.save();
  ctx.beginPath(); ctx.rect(photoX, photoY, photoW, photoH); ctx.clip();
  ctx.drawImage(gray, sx, sy, sw, sh);
  // 照片內上方漸層（讓頂部融入）
  const topFade = ctx.createLinearGradient(0, photoY, 0, photoY+40);
  topFade.addColorStop(0, 'rgba(240,232,208,0.5)');
  topFade.addColorStop(1, 'rgba(240,232,208,0)');
  ctx.fillStyle = topFade; ctx.fillRect(photoX, photoY, photoW, 40);
  ctx.restore();

  applyHalftone(ctx, photoX, photoY, photoW, photoH);

  // 照片邊框
  ctx.strokeStyle = '#1a1008'; ctx.lineWidth = 1;
  ctx.strokeRect(photoX, photoY, photoW, photoH);

  // ── 內文欄（兩欄）──
  const bodyY    = photoY + photoH + 14;
  const bodyText = getBodyText(city);
  const colW     = (W - 48 - 12) / 2;

  ctx.fillStyle = '#1a1008';
  ctx.font      = '10px Georgia, serif';
  ctx.textAlign = 'left';

  // 左欄
  wrapText(ctx, bodyText, 24, bodyY, colW, 14);
  // 右欄
  wrapText(ctx, bodyText, 24+colW+12, bodyY, colW, 14);

  // 欄間分隔線
  ctx.strokeStyle = '#888'; ctx.lineWidth = 0.5;
  ctx.beginPath();
  ctx.moveTo(24+colW+6, bodyY-4);
  ctx.lineTo(24+colW+6, H-16);
  ctx.stroke();

  // ── 底部版權 ──
  ctx.fillStyle = '#888'; ctx.font = '8px Georgia, serif'; ctx.textAlign = 'center';
  ctx.fillText(`© ${new Date().getFullYear()} ${name}  All Rights Reserved`, W/2, H-8);

  // ── 皺摺紋理 ──
  drawWrinkle(ctx, W, H);

  return canvas;
}

/**
 * renderNewspaper2(person1, person2, person3, city, paperName)
 * 模式二：一大兩小
 */
export function renderNewspaper2(person1, person2, person3, city, paperName) {
  const W=NP_W, H=NP_H;
  const canvas = document.createElement('canvas');
  canvas.width=W; canvas.height=H;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#f0e8d0';
  ctx.fillRect(0,0,W,H);
  const paperGrad = ctx.createLinearGradient(0,0,0,H);
  paperGrad.addColorStop(0,'rgba(255,250,235,0.6)');
  paperGrad.addColorStop(1,'rgba(200,185,155,0.3)');
  ctx.fillStyle=paperGrad; ctx.fillRect(0,0,W,H);

  // 報頭
  const headerH = 64;
  ctx.fillStyle='#1a1008'; ctx.fillRect(0,0,W,headerH);
  const name = getPaperName(city, paperName);
  ctx.fillStyle='#f0e8d0';
  ctx.font=`bold ${name.length>15?20:26}px Georgia, serif`;
  ctx.textAlign='center';
  ctx.fillText(name, W/2, 38);
  ctx.font='10px Georgia, serif'; ctx.fillStyle='#c8b890';
  ctx.fillText(`${formatDate()}  ·  ${randomIssue()}`, W/2, 56);

  // 分隔線
  ctx.strokeStyle='#1a1008'; ctx.lineWidth=1.5;
  ctx.beginPath(); ctx.moveTo(12,headerH+6); ctx.lineTo(W-12,headerH+6); ctx.stroke();

  // 標題
  ctx.fillStyle='#1a1008'; ctx.font='bold 16px Georgia, serif'; ctx.textAlign='center';
  ctx.fillText(getHeadline(city), W/2, headerH+24);

  // ── 照片區 ──
  const photoAreaY = headerH + 36;
  const photoAreaH = 360;
  const bigW  = Math.round(W*0.58) - 28;
  const bigH  = photoAreaH;
  const bigX  = 16;
  const bigY  = photoAreaY;

  const smW   = W - bigW - 36;
  const smH   = Math.round(photoAreaH/2) - 6;
  const smX   = bigX + bigW + 12;
  const sm1Y  = photoAreaY;
  const sm2Y  = photoAreaY + smH + 12;

  function drawPhoto(srcCanvas, x, y, w, h) {
    const gray = toGrayscale(srcCanvas);
    const natW=gray.width, natH=gray.height;
    const iR=natW/natH, cR=w/h;
    let sw,sh,sx,sy;
    if (iR>cR) { sh=h; sw=sh*iR; sy=y; sx=x-(sw-w)/2; }
    else       { sw=w; sh=sw/iR; sx=x; sy=y-(sh-h)/2; }
    ctx.save();
    ctx.beginPath(); ctx.rect(x,y,w,h); ctx.clip();
    ctx.drawImage(gray,sx,sy,sw,sh);
    ctx.restore();
    applyHalftone(ctx,x,y,w,h);
    ctx.strokeStyle='#1a1008'; ctx.lineWidth=1;
    ctx.strokeRect(x,y,w,h);
  }

  drawPhoto(person1, bigX, bigY, bigW, bigH);
  if (person2) drawPhoto(person2, smX, sm1Y, smW, smH);
  if (person3) drawPhoto(person3, smX, sm2Y, smW, smH);

  // 內文
  const bodyY = photoAreaY + photoAreaH + 12;
  const bodyText = getBodyText(city);
  const colW = (W-48-12)/2;
  ctx.fillStyle='#1a1008'; ctx.font='10px Georgia, serif'; ctx.textAlign='left';
  wrapText(ctx, bodyText, 24, bodyY, colW, 14);
  wrapText(ctx, bodyText, 24+colW+12, bodyY, colW, 14);
  ctx.strokeStyle='#888'; ctx.lineWidth=0.5;
  ctx.beginPath(); ctx.moveTo(24+colW+6,bodyY-4); ctx.lineTo(24+colW+6,H-16); ctx.stroke();

  ctx.fillStyle='#888'; ctx.font='8px Georgia, serif'; ctx.textAlign='center';
  ctx.fillText(`© ${new Date().getFullYear()} ${name}  All Rights Reserved`, W/2, H-8);

  drawWrinkle(ctx, W, H);
  return canvas;
}
