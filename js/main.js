/**
 * main.js  v2
 * 整合去背流程：上傳 → 立刻去背（進度條）→ 選場景 → 生成
 */

import { loadManifest, getCountries, getCities, getScenes, preloadSceneFrames } from './scenes.js';
import { Uploader } from './uploader.js';
import { segmentImages } from './segmenter.js';
import { buildSequence, compositeFrame, OUTPUT_W, OUTPUT_H, FPS } from './renderer.js';
import { encode } from './encoder.js';

/* ════════════════════════════════════
   DOM REFS
════════════════════════════════════ */
const uploadZone    = document.getElementById('upload-zone');
const fileInput     = document.getElementById('file-input');
const photoStrip    = document.getElementById('photo-strip');
const uploadCount   = document.getElementById('upload-count');
const countryTabs   = document.getElementById('country-tabs');
const cityTabs      = document.getElementById('city-tabs');
const sceneGrid     = document.getElementById('scene-grid');
const previewCanvas = document.getElementById('preview-canvas');
const previewHolder = document.getElementById('preview-placeholder');
const workCanvas    = document.getElementById('work-canvas');
const progressWrap  = document.getElementById('progress-wrap');
const progressFill  = document.getElementById('progress-fill');
const progressLabel = document.getElementById('progress-label');
const generateBtn   = document.getElementById('generate-btn');
const downloadBtn   = document.getElementById('download-btn');
const resetBtn      = document.getElementById('reset-btn');
const resultPanel   = document.getElementById('result-panel');
const resultMeta    = document.getElementById('result-meta');
const statRow       = document.getElementById('stat-row');
const statFrames    = document.getElementById('stat-frames');
const statDur       = document.getElementById('stat-dur');

const previewCtx    = previewCanvas.getContext('2d');

/* ════════════════════════════════════
   STATE
════════════════════════════════════ */
const state = {
  manifest:       null,
  rawImages:      [],       // { img, blobUrl }[] 原始
  segmentedItems: [],       // HTMLCanvasElement[]  去背後（與 rawImages 等長）
  segmentDone:    false,
  selectedScene:  null,
  bgFrames:       [],
  videoBlob:      null,
  generating:     false,
  activeCountry:  null,
  activeCity:     null,
  previewFrame:   0,
  previewAnimId:  null,
};

/* ════════════════════════════════════
   BOOT
════════════════════════════════════ */
async function init() {
  state.manifest = await loadManifest();
  buildCountryTabs(state.manifest);
  const firstCountry = getCountries(state.manifest)[0];
  selectCountry(firstCountry);
}

/* ════════════════════════════════════
   SCENE PICKER
════════════════════════════════════ */
function buildCountryTabs(manifest) {
  countryTabs.innerHTML = '';
  getCountries(manifest).forEach(country => {
    const btn = _tabBtn(country, () => selectCountry(country));
    countryTabs.appendChild(btn);
  });
}

function selectCountry(country) {
  state.activeCountry = country;
  _setActiveTab(countryTabs, country);
  cityTabs.innerHTML = '';
  const cities = getCities(state.manifest, country);
  cities.forEach((city, i) => {
    const btn = _tabBtn(city, () => selectCity(city));
    cityTabs.appendChild(btn);
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
    card.innerHTML = `
      <img src="${scene.frames[0]}" alt="${scene.name}" loading="lazy">
      <span class="scene-label">${scene.name}</span>
    `;
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
  badge.className = 'scene-selected-badge';
  badge.textContent = '✓';
  card.appendChild(badge);

  state.selectedScene = scene;
  try {
    state.bgFrames = await preloadSceneFrames(scene);
  } catch (e) {
    state.bgFrames = [];
  }

  if (state.segmentDone) {
    renderPreviewFrame(state.previewFrame);
    updateSteps(2);
  }
}

/* ════════════════════════════════════
   UPLOADER  +  自動去背
════════════════════════════════════ */
const uploader = new Uploader({
  zone:       uploadZone,
  input:      fileInput,
  strip:      photoStrip,
  countLabel: uploadCount,
  async onLoad(images) {
    state.rawImages     = images;
    state.segmentDone   = false;
    state.segmentedItems = [];
    generateBtn.disabled = true;
    stopPreviewAnim();

    // 顯示去背進度條
    progressWrap.classList.add('visible');
    setProgress(0, '載入去背模型…');

    try {
      const imgEls = images.map(i => i.img);

      state.segmentedItems = await segmentImages(imgEls, (cur, total, pct) => {
        setProgress(pct, `去背中 ${cur} / ${total} 張…`);
      });

      state.segmentDone = true;
      progressWrap.classList.remove('visible');

      updateStats();
      renderPreviewFrame(0);
      startPreviewAnim();
      generateBtn.disabled = false;
      updateSteps(2);

    } catch (err) {
      // 去背失敗 → fallback 用原圖
      console.warn('去背失敗，使用原圖：', err);
      state.segmentedItems = images.map(i => i.img);
      state.segmentDone    = true;
      progressWrap.classList.remove('visible');
      updateStats();
      renderPreviewFrame(0);
      startPreviewAnim();
      generateBtn.disabled = false;
      updateSteps(2);
    }
  },
});

/* ════════════════════════════════════
   PREVIEW
════════════════════════════════════ */
function renderPreviewFrame(idx) {
  if (!state.segmentedItems.length) return;
  state.previewFrame = idx % state.segmentedItems.length;

  previewCanvas.width  = OUTPUT_W;
  previewCanvas.height = OUTPUT_H;

  compositeFrame(
    previewCtx,
    state.segmentedItems[state.previewFrame],
    state.bgFrames,
    state.previewFrame,
    state.segmentedItems.length
  );

  previewCanvas.style.display = 'block';
  previewHolder.style.display = 'none';
}

function startPreviewAnim() {
  if (state.previewAnimId) cancelAnimationFrame(state.previewAnimId);
  let last = 0;
  const interval = 1000 / (FPS / 2);

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

/* ════════════════════════════════════
   STATS
════════════════════════════════════ */
function updateStats() {
  const n      = state.segmentedItems.length;
  const frames = 2 * n - 2;
  statFrames.textContent = `${frames} 幀`;
  statDur.textContent    = `${(frames / FPS).toFixed(1)} 秒`;
  statRow.style.display  = 'flex';
}

/* ════════════════════════════════════
   GENERATE
════════════════════════════════════ */
generateBtn.addEventListener('click', async () => {
  if (state.generating || !state.segmentedItems.length) return;
  state.generating = true;
  generateBtn.disabled = true;
  resultPanel.classList.remove('visible');
  stopPreviewAnim();

  progressWrap.classList.add('visible');
  setProgress(0, '初始化編碼器…');
  updateSteps(3);

  try {
    const sequence = buildSequence(state.segmentedItems);

    state.videoBlob = await encode({
      sequence,
      bgFrames:   state.bgFrames,
      workCanvas,
      onProgress: setProgress,
    });

    const ext    = state.videoBlob.type.includes('mp4') ? 'MP4' : 'WebM';
    const sizeMB = (state.videoBlob.size / 1024 / 1024).toFixed(1);
    const dur    = (sequence.length / FPS).toFixed(1);

    progressWrap.classList.remove('visible');
    resultPanel.classList.add('visible');
    resultMeta.textContent = `${sequence.length} 幀 · ${dur} 秒 · ${sizeMB} MB · ${ext}`;

  } catch (err) {
    console.error(err);
    setProgress(0, `⚠️ 錯誤：${err.message}`);
  }

  state.generating = false;
  generateBtn.disabled = false;
  startPreviewAnim();
});

/* ════════════════════════════════════
   DOWNLOAD / RESET
════════════════════════════════════ */
downloadBtn.addEventListener('click', () => {
  if (!state.videoBlob) return;
  const ext      = state.videoBlob.type.includes('mp4') ? 'mp4' : 'webm';
  const filename = `flipbook_${Date.now()}.${ext}`;
  const url      = URL.createObjectURL(state.videoBlob);

  // iOS Safari 不支援 <a download>，改用 window.open
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;

  if (isIOS) {
    const w = window.open(url, '_blank');
    if (!w) alert('請允許彈出視窗，或長按影片儲存');
  } else {
    const a    = document.createElement('a');
    a.href     = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  }
});

resetBtn.addEventListener('click', () => {
  stopPreviewAnim();
  uploader.reset();
  state.rawImages      = [];
  state.segmentedItems = [];
  state.segmentDone    = false;
  state.videoBlob      = null;
  state.previewFrame   = 0;
  previewCanvas.style.display = 'none';
  previewHolder.style.display = '';
  statRow.style.display = 'none';
  resultPanel.classList.remove('visible');
  progressWrap.classList.remove('visible');
  generateBtn.disabled = true;
  updateSteps(1);
});

/* ════════════════════════════════════
   HELPERS
════════════════════════════════════ */
function setProgress(pct, label) {
  progressFill.style.width  = `${pct}%`;
  progressLabel.textContent = label;
}

function updateSteps(active) {
  document.querySelectorAll('.step-item').forEach(el => {
    const n = +el.dataset.step;
    el.classList.remove('active', 'done');
    if      (n < active) el.classList.add('done');
    else if (n === active) el.classList.add('active');
  });
}

function _tabBtn(label, onClick) {
  const btn = document.createElement('button');
  btn.className   = 'tab-btn';
  btn.textContent = label;
  btn.addEventListener('click', onClick);
  return btn;
}

function _setActiveTab(container, label) {
  container.querySelectorAll('.tab-btn').forEach(b => {
    b.classList.toggle('active', b.textContent === label);
  });
}

/* ════════════════════════════════════
   START
════════════════════════════════════ */
init();
