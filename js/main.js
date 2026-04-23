import { loadManifest, getCountries, getCities, getScenes, preloadSceneFrames } from './scenes.js';
import { segmentImages } from './segmenter.js';
import { buildSequence, compositeFrame, OUTPUT_W, OUTPUT_H, INTERNAL_FPS } from './renderer.js';
import { encode } from './encoder.js';
import { NEWS_NAMES, drawNewspaper, generateNewspaperBlob } from './newspaper.js';

const uploadZone = document.getElementById('upload-zone');
const fileInput = document.getElementById('file-input');
const photoStrip = document.getElementById('photo-strip');
const uploadCount = document.getElementById('upload-count');
const countryTabs = document.getElementById('country-tabs');
const cityTabs = document.getElementById('city-tabs');
const sceneGrid = document.getElementById('scene-grid');
const previewCanvas = document.getElementById('preview-canvas');
const previewHolder = document.getElementById('preview-placeholder');
const workCanvas = document.getElementById('work-canvas');
const progressWrap = document.getElementById('progress-wrap');
const progressFill = document.getElementById('progress-fill');
const progressLabel = document.getElementById('progress-label');
const generateBtn = document.getElementById('generate-btn');
const downloadBtn = document.getElementById('download-btn');
const resetBtn = document.getElementById('reset-btn');
const resultPanel = document.getElementById('result-panel');
const resultMeta = document.getElementById('result-meta');
const statRow = document.getElementById('stat-row');
const statFrames = document.getElementById('stat-frames');
const statDur = document.getElementById('stat-dur');
const previewCtx = previewCanvas.getContext('2d');
const limitBtns = document.querySelectorAll('.limit-btn');
const modeBtns = document.querySelectorAll('.mode-btn');
const panelScene = document.getElementById('panel-scene');
const panelNewspaper = document.getElementById('panel-newspaper');
const heroEm = document.getElementById('hero-em');
const heroDesc = document.getElementById('hero-desc');
const previewIcon = document.getElementById('preview-icon');
const generateText = document.getElementById('generate-text');
const iosModal = document.getElementById('ios-modal');
const iosVideo = document.getElementById('ios-video');
const iosImg = document.getElementById('ios-img');
const iosClose = document.getElementById('ios-close');
const newsNameInput = document.getElementById('news-name-input');
const newsNameRand = document.getElementById('news-name-rand');
const newsNamePresets = document.getElementById('news-name-presets');

const state = {
  manifest: null,
  rawImages: [],
  segmentedItems: [],
  segmentDone: false,
  selectedScene: null,
  bgFrames: [],
  videoBlob: null,
  imageBlob: null,
  generating: false,
  activeCountry: null,
  activeCity: null,
  previewFrame: 0,
  previewAnimId: null,
  maxPhotos: 20,
  outputMode: 'flipbook',
  newspaperName: 'THE DAILY FLIP'
};

async function init() {
  state.manifest = await loadManifest();
  buildCountryTabs(state.manifest);
  selectCountry(getCountries(state.manifest)[0]);
  buildNewsPresets();
  bindEvents();
}

function bindEvents() {
  modeBtns.forEach(btn => btn.addEventListener('click', () => {
    modeBtns.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    state.outputMode = btn.dataset.mode;
    updateModeUI();
    if (state.segmentDone) renderPreviewFrame(0);
  }));

  newsNameInput.addEventListener('input', (e) => {
    state.newspaperName = e.target.value.toUpperCase();
    if (state.segmentDone) renderPreviewFrame(0);
  });

  newsNameRand.addEventListener('click', () => {
    const name = NEWS_NAMES[Math.floor(Math.random() * NEWS_NAMES.length)];
    newsNameInput.value = name;
    state.newspaperName = name;
    if (state.segmentDone) renderPreviewFrame(0);
  });

  limitBtns.forEach(btn => btn.addEventListener('click', () => {
    limitBtns.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    state.maxPhotos = parseInt(btn.dataset.limit, 10);
    if (state.rawImages.length > state.maxPhotos) {
      state.rawImages = state.rawImages.slice(0, state.maxPhotos);
      state.segmentedItems = state.segmentedItems.slice(0, state.maxPhotos);
      buildPhotoStrip(); updateStats();
      if (state.segmentDone) renderPreviewFrame(0);
    }
  }));

  uploadZone.addEventListener('dragover', e => { e.preventDefault(); uploadZone.classList.add('drag-over'); });
  uploadZone.addEventListener('dragleave', () => uploadZone.classList.remove('drag-over'));
  uploadZone.addEventListener('drop', e => { e.preventDefault(); uploadZone.classList.remove('drag-over'); handleFiles(e.dataTransfer.files); });
  fileInput.addEventListener('change', () => handleFiles(fileInput.files));
  generateBtn.addEventListener('click', handleGenerate);
  downloadBtn.addEventListener('click', handleDownload);
  resetBtn.addEventListener('click', handleReset);
  iosClose.addEventListener('click', () => { iosModal.classList.remove('visible'); iosVideo.pause(); });
}

function buildNewsPresets() {
  newsNamePresets.innerHTML = '';
  NEWS_NAMES.slice(0, 6).forEach(name => {
    const b = document.createElement('button');
    b.className = 'tab-btn-small'; b.textContent = name;
    b.onclick = () => { newsNameInput.value = name; state.newspaperName = name; if (state.segmentDone) renderPreviewFrame(0); };
    newsNamePresets.appendChild(b);
  });
}

function updateModeUI() {
  const isFlip = state.outputMode === 'flipbook';
  panelScene.style.display = isFlip ? 'block' : 'none';
  panelNewspaper.style.display = isFlip ? 'none' : 'block';
  heroEm.textContent = isFlip ? '手翻書' : '報紙版面';
  heroDesc.textContent = isFlip ? '上傳連拍，3 步生成具有物理質感的循環影片。' : '將照片轉為復古報紙風格的靜態圖片。';
  previewIcon.textContent = isFlip ? '🎞' : '📰';
  generateText.textContent = isFlip ? '生成手翻書影片' : '生成報紙圖片';
  if (isFlip) { if (state.segmentDone) startPreviewAnim(); } else { stopPreviewAnim(); }
}

function buildCountryTabs(manifest) {
  countryTabs.innerHTML = '';
  getCountries(manifest).forEach(c => countryTabs.appendChild(_tabBtn(c, () => selectCountry(c))));
}

function selectCountry(country) {
  state.activeCountry = country; _setActiveTab(countryTabs, country);
  cityTabs.innerHTML = '';
  const cities = getCities(state.manifest, country);
  cities.forEach((city, i) => {
    cityTabs.appendChild(_tabBtn(city, () => selectCity(city)));
    if (i === 0) selectCity(city);
  });
}

function selectCity(city) {
  state.activeCity = city; _setActiveTab(cityTabs, city);
  buildSceneGrid(getScenes(state.manifest, state.activeCountry, city));
  if (state.segmentDone && state.outputMode !== 'flipbook') renderPreviewFrame(0);
}

function buildSceneGrid(scenes) {
  sceneGrid.innerHTML = '';
  scenes.forEach(scene => {
    const card = document.createElement('div');
    card.className = 'scene-card loading'; card.dataset.id = scene.id;
    card.innerHTML = `<img src="${scene.frames[0]}" alt="${scene.name}" loading="lazy"><span class="scene-label">${scene.name}</span>`;
    card.querySelector('img').onload = () => card.classList.remove('loading');
    card.onclick = () => selectScene(scene, card);
    sceneGrid.appendChild(card);
  });
}

async function selectScene(scene, card) {
  sceneGrid.querySelectorAll('.scene-card').forEach(c => { c.classList.remove('selected'); c.querySelector('.scene-selected-badge')?.remove(); });
  card.classList.add('selected');
  const badge = document.createElement('span'); badge.className = 'scene-selected-badge'; badge.textContent = '✓';
  card.appendChild(badge);
  state.selectedScene = scene;
  state.bgFrames = await preloadSceneFrames(scene);
  if (state.segmentDone && state.outputMode === 'flipbook') renderPreviewFrame(state.previewFrame);
}

async function handleFiles(fileList) {
  let files = Array.from(fileList).filter(f => f.type.startsWith('image/')).slice(0, state.maxPhotos);
  if (!files.length) return;
  state.rawImages = []; state.segmentedItems = []; state.segmentDone = false;
  generateBtn.disabled = true; stopPreviewAnim();
  const loaded = await Promise.all(files.map((file, idx) => new Promise(resolve => {
    const blobUrl = URL.createObjectURL(file); const img = new Image();
    img.onload = () => resolve({ img, blobUrl, id: idx }); img.src = blobUrl;
  })));
  state.rawImages = loaded; buildPhotoStrip();
  progressWrap.classList.add('visible'); setProgress(0, '載入去背模型…');
  try {
    state.segmentedItems = await segmentImages(loaded.map(i => i.img), (cur, total, pct) => setProgress(pct, `去背中 ${cur} / ${total}…`));
  } catch { state.segmentedItems = loaded.map(i => i.img); }
  state.segmentDone = true; progressWrap.classList.remove('visible');
  updateStats(); renderPreviewFrame(0);
  if (state.outputMode === 'flipbook') startPreviewAnim();
  generateBtn.disabled = false; updateSteps(2);
}

function buildPhotoStrip() {
  photoStrip.innerHTML = '';
  state.rawImages.forEach((item, i) => {
    const div = document.createElement('div'); div.className = 'thumb'; div.draggable = true;
    div.innerHTML = `<img src="${item.blobUrl}"><span class="thumb-num">${i + 1}</span><span class="thumb-delete">✕</span>`;
    div.querySelector('.thumb-delete').onclick = (e) => { e.stopPropagation(); deletePhoto(i); };
    div.ondragstart = () => { window.draggedIdx = i; div.classList.add('dragging'); };
    div.ondragend = () => div.classList.remove('dragging');
    div.ondragover = e => e.preventDefault();
    div.ondrop = () => { if (window.draggedIdx !== i) swapPhotos(window.draggedIdx, i); };
    photoStrip.appendChild(div);
  });
}

function swapPhotos(a, b) {
  [state.rawImages[a], state.rawImages[b]] = [state.rawImages[b], state.rawImages[a]];
  if (state.segmentDone) [state.segmentedItems[a], state.segmentedItems[b]] = [state.segmentedItems[b], state.segmentedItems[a]];
  buildPhotoStrip(); renderPreviewFrame(0);
}

function deletePhoto(idx) {
  URL.revokeObjectURL(state.rawImages[idx].blobUrl);
  state.rawImages.splice(idx, 1); if (state.segmentDone) state.segmentedItems.splice(idx, 1);
  if (!state.rawImages.length) handleReset(); else { buildPhotoStrip(); updateStats(); renderPreviewFrame(0); }
}

function renderPreviewFrame(idx) {
  if (!state.segmentedItems.length) return;
  previewCanvas.width = OUTPUT_W; previewCanvas.height = OUTPUT_H;
  if (state.outputMode === 'flipbook') {
    compositeFrame(previewCtx, { item: state.segmentedItems[idx % state.segmentedItems.length], photoIdx: idx, subFrame: 0, posIdx: 1 }, state.bgFrames);
  } else {
    drawNewspaper(previewCtx, {
      items: state.segmentedItems, mode: state.outputMode,
      city: state.activeCity, name: state.newspaperName,
      width: OUTPUT_W, height: OUTPUT_H, isPreview: true
    });
  }
  previewCanvas.style.display = 'block'; previewHolder.style.display = 'none';
}

function startPreviewAnim() {
  stopPreviewAnim(); let last = 0;
  const tick = ts => {
    if (ts - last > 1000) { last = ts; state.previewFrame = (state.previewFrame + 1) % state.segmentedItems.length; renderPreviewFrame(state.previewFrame); }
    state.previewAnimId = requestAnimationFrame(tick);
  };
  state.previewAnimId = requestAnimationFrame(tick);
}

function stopPreviewAnim() { if (state.previewAnimId) cancelAnimationFrame(state.previewAnimId); }

function updateStats() {
  const n = state.segmentedItems.length; if (!n) return;
  if (state.outputMode === 'flipbook') {
    const y = n === 1 ? 1 : 2 * n - 2; const d = (y * Math.max(6, Math.round(14.5 / y * INTERNAL_FPS)) / INTERNAL_FPS).toFixed(1);
    statFrames.textContent = `${y} 張`; statDur.textContent = `約 ${d} 秒`;
  } else { statFrames.textContent = `靜態圖`; statDur.textContent = `1 張`; }
  statRow.style.display = 'flex';
}

async function handleGenerate() {
  state.generating = true; generateBtn.disabled = true; resultPanel.classList.remove('visible');
  progressWrap.classList.add('visible'); setProgress(0, '初始化…'); updateSteps(3);
  try {
    if (state.outputMode === 'flipbook') {
      const seq = buildSequence(state.segmentedItems);
      const h = Math.max(6, Math.round(14.5 / (state.segmentedItems.length === 1 ? 1 : 2 * state.segmentedItems.length - 2) * INTERNAL_FPS));
      seq.forEach(s => s.holdFrames = h);
      state.videoBlob = await encode({ sequence: seq, bgFrames: state.bgFrames, workCanvas, onProgress: setProgress });
      resultMeta.textContent = `${state.segmentedItems.length} 張 · 約 ${(seq.length * h / INTERNAL_FPS).toFixed(1)} 秒`;
    } else {
      setProgress(50, '正在網點化渲染…');
      state.imageBlob = await generateNewspaperBlob(state);
      resultMeta.textContent = `報紙模式 · JPEG · ${(state.imageBlob.size / 1024 / 1024).toFixed(1)} MB`;
      setProgress(100, '完成');
    }
    progressWrap.classList.remove('visible'); resultPanel.classList.add('visible');
  } catch (e) { setProgress(0, `錯誤: ${e.message}`); }
  state.generating = false; generateBtn.disabled = false;
}

async function handleDownload() {
  const isFlip = state.outputMode === 'flipbook';
  const blob = isFlip ? state.videoBlob : state.imageBlob; if (!blob) return;
  const name = `${isFlip ? 'flip' : 'news'}_${Date.now()}.${isFlip ? 'mp4' : 'jpg'}`;
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
  if (isIOS) {
    const url = URL.createObjectURL(blob);
    if (isFlip) { iosVideo.src = url; iosVideo.style.display = 'block'; iosImg.style.display = 'none'; }
    else { iosImg.src = url; iosImg.style.display = 'block'; iosVideo.style.display = 'none'; }
    iosModal.classList.add('visible');
  } else {
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; a.click();
  }
}

function handleReset() {
  stopPreviewAnim(); state.rawImages.forEach(i => URL.revokeObjectURL(i.blobUrl));
  state.rawImages = []; state.segmentedItems = []; state.videoBlob = null; state.imageBlob = null;
  photoStrip.innerHTML = ''; previewCanvas.style.display = 'none'; previewHolder.style.display = '';
  statRow.style.display = 'none'; resultPanel.classList.remove('visible'); updateSteps(1);
}

function setProgress(p, l) { progressFill.style.width = `${p}%`; progressLabel.textContent = l; }
function updateSteps(a) { document.querySelectorAll('.step-item').forEach(el => { const n = +el.dataset.step; el.classList.remove('active', 'done'); if (n < a) el.classList.add('done'); else if (n === a) el.classList.add('active'); }); }
function _tabBtn(l, c) { const b = document.createElement('button'); b.className = 'tab-btn'; b.textContent = l; b.onclick = c; return b; }
function _setActiveTab(p, l) { p.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('active', b.textContent === l)); }

init();
