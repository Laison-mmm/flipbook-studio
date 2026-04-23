import { loadManifest, getCountries, getCities, getScenes, preloadSceneFrames } from './scenes.js';
import { segmentImages } from './segmenter.js';
import { buildSequence, compositeFrame, OUTPUT_W, OUTPUT_H, INTERNAL_FPS } from './renderer.js';
import { encode } from './encoder.js';

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
};

async function init() {
  state.manifest = await loadManifest();
  buildCountryTabs(state.manifest);
  const first = getCountries(state.manifest)[0];
  selectCountry(first);
  bindEvents();
}

function bindEvents() {
  modeBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      modeBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.outputMode = btn.dataset.mode;
      updateModeUI();
    });
  });

  limitBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      limitBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.maxPhotos = parseInt(btn.dataset.limit, 10);
      if (state.rawImages.length > state.maxPhotos) {
        state.rawImages = state.rawImages.slice(0, state.maxPhotos);
        if (state.segmentedItems.length) state.segmentedItems = state.segmentedItems.slice(0, state.maxPhotos);
        buildPhotoStrip();
        updateStats();
        if (state.segmentDone) renderPreviewFrame(0);
      }
    });
  });

  uploadZone.addEventListener('dragover', e => { e.preventDefault(); uploadZone.classList.add('drag-over'); });
  uploadZone.addEventListener('dragleave', () => uploadZone.classList.remove('drag-over'));
  uploadZone.addEventListener('drop', e => { e.preventDefault(); uploadZone.classList.remove('drag-over'); handleFiles(e.dataTransfer.files); });
  fileInput.addEventListener('change', () => handleFiles(fileInput.files));
  generateBtn.addEventListener('click', handleGenerate);
  downloadBtn.addEventListener('click', handleDownload);
  resetBtn.addEventListener('click', handleReset);
  iosClose.addEventListener('click', () => { iosModal.classList.remove('visible'); iosVideo.pause(); });
}

function updateModeUI() {
  if (state.outputMode === 'flipbook') {
    panelScene.style.display = 'block';
    panelNewspaper.style.display = 'none';
    heroEm.textContent = '手翻書';
    heroDesc.textContent = '上傳連拍，3 步生成具有物理質感的循環影片，直接發 Threads。';
    previewIcon.textContent = '🎞';
    generateText.textContent = '生成手翻書影片';
    if (state.segmentDone) startPreviewAnim();
  } else {
    panelScene.style.display = 'none';
    panelNewspaper.style.display = 'block';
    heroEm.textContent = '報紙版面';
    heroDesc.textContent = '將照片轉為復古報紙風格的靜態圖片，適合紀錄旅行故事。';
    previewIcon.textContent = '📰';
    generateText.textContent = '生成報紙圖片';
    stopPreviewAnim();
    if (state.segmentDone) renderPreviewFrame(0);
  }
}

function buildCountryTabs(manifest) {
  countryTabs.innerHTML = '';
  getCountries(manifest).forEach(c => countryTabs.appendChild(_tabBtn(c, () => selectCountry(c))));
}

function selectCountry(country) {
  state.activeCountry = country;
  _setActiveTab(countryTabs, country);
  cityTabs.innerHTML = '';
  const cities = getCities(state.manifest, country);
  cities.forEach((city, i) => {
    cityTabs.appendChild(_tabBtn(city, () => selectCity(city)));
    if (i === 0) selectCity(city);
  });
}

function selectCity(city) {
  state.activeCity = city;
  _setActiveTab(cityTabs, city);
  buildSceneGrid(getScenes(state.manifest, state.activeCountry, city));
}

function buildSceneGrid(scenes) {
  sceneGrid.innerHTML = '';
  scenes.forEach(scene => {
    const card = document.createElement('div');
    card.className = 'scene-card loading';
    card.dataset.id = scene.id;
    card.innerHTML = `<img src="${scene.frames[0]}" alt="${scene.name}" loading="lazy"><span class="scene-label">${scene.name}</span>`;
    card.querySelector('img').onload = () => card.classList.remove('loading');
    card.addEventListener('click', () => selectScene(scene, card));
    sceneGrid.appendChild(card);
  });
}

async function selectScene(scene, card) {
  sceneGrid.querySelectorAll('.scene-card').forEach(c => {
    c.classList.remove('selected');
    c.querySelector('.scene-selected-badge')?.remove();
  });
  card.classList.add('selected');
  const badge = document.createElement('span');
  badge.className = 'scene-selected-badge'; badge.textContent = '✓';
  card.appendChild(badge);
  state.selectedScene = scene;
  try { state.bgFrames = await preloadSceneFrames(scene); } catch { state.bgFrames = []; }
  if (state.segmentDone && state.outputMode === 'flipbook') { renderPreviewFrame(state.previewFrame); updateSteps(2); }
}

async function handleFiles(fileList) {
  let files = Array.from(fileList).filter(f => f.type.startsWith('image/'));
  if (!files.length) return;
  
  if (files.length > state.maxPhotos) {
    files = files.slice(0, state.maxPhotos);
  }

  state.rawImages = [];
  state.segmentedItems = [];
  state.segmentDone = false;
  generateBtn.disabled = true;
  stopPreviewAnim();

  uploadCount.textContent = `載入中 ${files.length} 張…`;
  const loaded = await Promise.all(files.map((file, idx) => new Promise(resolve => {
    const blobUrl = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => resolve({ img, blobUrl, id: idx });
    img.src = blobUrl;
  })));
  state.rawImages = loaded;
  buildPhotoStrip();

  progressWrap.classList.add('visible');
  setProgress(0, '載入去背模型…');

  try {
    state.segmentedItems = await segmentImages(loaded.map(i => i.img), (cur, total, pct) => {
      setProgress(pct, `去背中 ${cur} / ${total} 張…`);
    });
  } catch (e) {
    state.segmentedItems = loaded.map(i => i.img);
  }

  state.segmentDone = true;
  progressWrap.classList.remove('visible');
  uploadCount.textContent = `已選擇 ${state.rawImages.length} 張照片`;
  updateStats();
  renderPreviewFrame(0);
  if (state.outputMode === 'flipbook') startPreviewAnim();
  generateBtn.disabled = false;
  updateSteps(2);
}

let draggedIndex = null;

function buildPhotoStrip() {
  photoStrip.innerHTML = '';
  state.rawImages.forEach((item, i) => {
    const div = document.createElement('div');
    div.className = 'thumb';
    div.draggable = true;
    div.dataset.index = i;
    
    const img = document.createElement('img');
    img.src = item.blobUrl;
    
    const num = document.createElement('span');
    num.className = 'thumb-num';
    num.textContent = i + 1;

    const del = document.createElement('span');
    del.className = 'thumb-delete';
    del.textContent = '✕';
    del.addEventListener('click', (e) => {
      e.stopPropagation();
      deletePhoto(i);
    });

    div.appendChild(img);
    div.appendChild(num);
    div.appendChild(del);

    div.addEventListener('dragstart', (e) => {
      draggedIndex = i;
      e.dataTransfer.effectAllowed = 'move';
      setTimeout(() => div.classList.add('dragging'), 0);
    });

    div.addEventListener('dragend', () => {
      div.classList.remove('dragging');
      draggedIndex = null;
    });

    div.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
    });

    div.addEventListener('drop', (e) => {
      e.preventDefault();
      if (draggedIndex === null || draggedIndex === i) return;
      swapPhotos(draggedIndex, i);
    });

    photoStrip.appendChild(div);
  });
  uploadCount.textContent = `已選擇 ${state.rawImages.length} 張照片`;
}

function swapPhotos(idx1, idx2) {
  const rawTemp = state.rawImages[idx1];
  state.rawImages[idx1] = state.rawImages[idx2];
  state.rawImages[idx2] = rawTemp;

  if (state.segmentDone && state.segmentedItems.length === state.rawImages.length) {
    const segTemp = state.segmentedItems[idx1];
    state.segmentedItems[idx1] = state.segmentedItems[idx2];
    state.segmentedItems[idx2] = segTemp;
  }

  buildPhotoStrip();
  if (state.segmentDone) {
    renderPreviewFrame(0);
    updateStats();
  }
}

function deletePhoto(idx) {
  URL.revokeObjectURL(state.rawImages[idx].blobUrl);
  state.rawImages.splice(idx, 1);
  if (state.segmentDone && state.segmentedItems.length > idx) {
    state.segmentedItems.splice(idx, 1);
  }
  buildPhotoStrip();
  
  if (state.rawImages.length === 0) {
    handleReset();
  } else if (state.segmentDone) {
    state.previewFrame = 0;
    renderPreviewFrame(0);
    updateStats();
  }
}

function renderPreviewFrame(idx) {
  if (!state.segmentedItems.length) return;
  state.previewFrame = idx % state.segmentedItems.length;
  previewCanvas.width = OUTPUT_W;
  previewCanvas.height = OUTPUT_H;

  const entry = {
    item: state.segmentedItems[state.previewFrame],
    photoIdx: state.previewFrame,
    subFrame: 0,
    posIdx: 1,
    holdFrames: 24,
  };
  
  if (state.outputMode === 'flipbook') {
    compositeFrame(previewCtx, entry, state.bgFrames);
  } else {
    previewCtx.fillStyle = '#f0e8d0';
    previewCtx.fillRect(0, 0, OUTPUT_W, OUTPUT_H);
    const item = state.segmentedItems[state.previewFrame];
    const natW = item.naturalWidth || item.width;
    const natH = item.naturalHeight || item.height;
    const w = OUTPUT_W * 0.7;
    const h = w * (natH / natW);
    previewCtx.drawImage(item, (OUTPUT_W - w)/2, (OUTPUT_H - h)/2, w, h);
  }

  previewCanvas.style.display = 'block';
  previewHolder.style.display = 'none';
}

function startPreviewAnim() {
  if (state.previewAnimId) cancelAnimationFrame(state.previewAnimId);
  let last = 0;
  const interval = 1000;
  function tick(ts) {
    if (ts - last > interval) {
      last = ts;
      state.previewFrame = (state.previewFrame + 1) % state.segmentedItems.length;
      renderPreviewFrame(state.previewFrame);
    }
    state.previewAnimId = requestAnimationFrame(tick);
  }
  state.previewAnimId = requestAnimationFrame(tick);
}

function stopPreviewAnim() {
  if (state.previewAnimId) cancelAnimationFrame(state.previewAnimId);
  state.previewAnimId = null;
}

function updateStats() {
  const n = state.segmentedItems.length;
  if (n === 0) return;
  if (state.outputMode === 'flipbook') {
    const yoyo = n === 1 ? 1 : 2 * n - 2;
    const holdFrames = Math.max(6, Math.round(14.5 / yoyo * INTERNAL_FPS));
    const dur = (yoyo * holdFrames / INTERNAL_FPS).toFixed(1);
    statFrames.textContent = `${yoyo} 張`;
    statDur.textContent = `約 ${dur} 秒`;
    statRow.style.display = 'flex';
  } else {
    statFrames.textContent = `靜態圖`;
    statDur.textContent = `1 張`;
    statRow.style.display = 'flex';
  }
}

async function handleGenerate() {
  if (state.generating || !state.segmentedItems.length) return;
  state.generating = true;
  generateBtn.disabled = true;
  resultPanel.classList.remove('visible');
  stopPreviewAnim();
  progressWrap.classList.add('visible');
  setProgress(0, '初始化…');
  updateSteps(3);

  try {
    if (state.outputMode === 'flipbook') {
      const sequence = buildSequence(state.segmentedItems);
      const yoyo = state.segmentedItems.length === 1 ? 1 : 2 * state.segmentedItems.length - 2;
      const dynamicHold = Math.max(6, Math.round(14.5 / yoyo * INTERNAL_FPS));
      sequence.forEach(s => s.holdFrames = dynamicHold);

      state.videoBlob = await encode({ sequence, bgFrames: state.bgFrames, workCanvas, onProgress: setProgress });
      const ext = state.videoBlob.type.includes('mp4') ? 'MP4' : 'WebM';
      const dur = (sequence.length * dynamicHold / INTERNAL_FPS).toFixed(1);
      const sizeMB = (state.videoBlob.size / 1024 / 1024).toFixed(1);
      resultMeta.textContent = `${state.segmentedItems.length} 張 · ${dur} 秒 · ${sizeMB} MB · ${ext}`;
    } else {
      setProgress(100, '報紙生成功能待下一階段部署');
      state.imageBlob = null; 
      resultMeta.textContent = `報紙模式`;
    }
    
    progressWrap.classList.remove('visible');
    resultPanel.classList.add('visible');
  } catch (err) {
    setProgress(0, `⚠️ 錯誤：${err.message}`);
  }

  state.generating = false;
  generateBtn.disabled = false;
  if (state.outputMode === 'flipbook') startPreviewAnim();
}

async function handleDownload() {
  if (state.outputMode === 'flipbook' && state.videoBlob) {
    const ext = state.videoBlob.type.includes('mp4') ? 'mp4' : 'webm';
    const filename = `flipbook_${Date.now()}.${ext}`;
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
    
    if (navigator.canShare && navigator.canShare({ files: [new File([state.videoBlob], filename, { type: state.videoBlob.type })] })) {
      try { await navigator.share({ files: [new File([state.videoBlob], filename, { type: state.videoBlob.type })], title: '脆翻書' }); return; } catch {}
    }
    
    if (isIOS) {
      iosVideo.src = URL.createObjectURL(state.videoBlob);
      iosVideo.style.display = 'block';
      iosImg.style.display = 'none';
      iosModal.classList.add('visible');
      return;
    }
    
    const url = URL.createObjectURL(state.videoBlob);
    const a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  }
}

function handleReset() {
  stopPreviewAnim();
  state.rawImages.forEach(i => URL.revokeObjectURL(i.blobUrl));
  state.rawImages = []; state.segmentedItems = []; state.segmentDone = false;
  state.videoBlob = null; state.imageBlob = null; state.previewFrame = 0;
  photoStrip.innerHTML = ''; uploadCount.textContent = '尚未選擇檔案';
  previewCanvas.style.display = 'none'; previewHolder.style.display = '';
  statRow.style.display = 'none'; resultPanel.classList.remove('visible');
  progressWrap.classList.remove('visible'); generateBtn.disabled = true;
  fileInput.value = ''; updateSteps(1);
}

function setProgress(pct, label) { progressFill.style.width = `${pct}%`; progressLabel.textContent = label; }

function updateSteps(active) {
  document.querySelectorAll('.step-item').forEach(el => {
    const n = +el.dataset.step; el.classList.remove('active', 'done');
    if (n < active) el.classList.add('done'); else if (n === active) el.classList.add('active');
  });
}

function _tabBtn(label, onClick) {
  const b = document.createElement('button');
  b.className = 'tab-btn'; b.textContent = label;
  b.addEventListener('click', onClick); return b;
}

function _setActiveTab(container, label) {
  container.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('active', b.textContent === label));
}

init();
