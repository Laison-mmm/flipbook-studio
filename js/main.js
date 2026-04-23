/**
 * main.js  v3
 * 三種模式：手翻書 / 報紙大版 / 報紙三格
 * 照片拖拉排序 + 刪除
 * 場景白天/黃昏/夜晚 Tab
 */

import { loadManifest, getCountries, getCities, getScenes, preloadSceneFrames } from './scenes.js';
import { segmentImages } from './segmenter.js';
import { buildSequence, compositeFrame, OUTPUT_W, OUTPUT_H, getFPS, calcHoldFrames } from './renderer.js';
import { encode } from './encoder.js';
import { renderNewspaper1, renderNewspaper2, NP_W, NP_H } from './newspaper.js';

/* ── DOM ── */
const uploadZone    = document.getElementById('upload-zone');
const fileInput     = document.getElementById('file-input');
const photoStrip    = document.getElementById('photo-strip');
const uploadCount   = document.getElementById('upload-count');
const countryTabs   = document.getElementById('country-tabs');
const cityTabs      = document.getElementById('city-tabs');
const timeTabs      = document.getElementById('time-tabs');
const sceneGrid     = document.getElementById('scene-grid');
const previewCanvas = document.getElementById('preview-canvas');
const previewHolder = document.getElementById('preview-placeholder');
const workCanvas    = document.getElementById('work-canvas');
const progressWrap  = document.getElementById('progress-wrap');
const progressFill  = document.getElementById('progress-fill');
const progressLabel = document.getElementById('progress-label');
const generateBtn   = document.getElementById('generate-btn');
const generateLabel = document.getElementById('generate-label');
const downloadBtn   = document.getElementById('download-btn');
const resetBtn      = document.getElementById('reset-btn');
const resultPanel   = document.getElementById('result-panel');
const resultTitle   = document.getElementById('result-title');
const resultMeta    = document.getElementById('result-meta');
const statRow       = document.getElementById('stat-row');
const statFrames    = document.getElementById('stat-frames');
const statDur       = document.getElementById('stat-dur');
const panelScene    = document.getElementById('panel-scene');
const panelNewspaper= document.getElementById('panel-newspaper');
const npNameInput   = document.getElementById('np-name-input');
const npRandomBtn   = document.getElementById('np-random-btn');
const npCitySelect  = document.getElementById('np-city-select');
const np2Manual     = document.getElementById('np2-manual');
const np2AutoBtn    = document.getElementById('np2-auto-btn');
const np2ManualBtn  = document.getElementById('np2-manual-btn');
const previewCtx    = previewCanvas.getContext('2d');

/* ── STATE ── */
const state = {
  mode:           'flipbook',   // 'flipbook' | 'newspaper1' | 'newspaper2'
  manifest:       null,
  rawImages:      [],           // { img, blobUrl, id }[]
  segmentedItems: [],
  segmentDone:    false,
  selectedScene:  null,
  bgFrames:       [],
  videoBlob:      null,
  imageBlob:      null,
  generating:     false,
  activeCountry:  null,
  activeCity:     null,
  timeFilter:     'all',
  maxCount:       20,
  previewFrame:   0,
  previewAnimId:  null,
  np2Mode:        'auto',       // 'auto' | 'manual'
  np2Slots:       [0, null, null], // photoIdx for each slot
  np2SelectingSlot: null,
};

const PAPER_NAMES_RANDOM = [
  'THE DAILY FLIP','MORNING EDITION','THE CITY POST',
  'FLASH DAILY','THE WEEKEND POST','METRO TIMES',
];

/* ── BOOT ── */
async function init() {
  state.manifest = await loadManifest();
  buildCountryTabs(state.manifest);
  const first = getCountries(state.manifest)[0];
  selectCountry(first);
  bindModeSwitch();
  bindCountSelector();
  bindTimeTabs();
  bindNewspaperControls();
}

/* ── MODE SWITCH ── */
function bindModeSwitch() {
  document.querySelectorAll('.mode-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.mode-tab').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.mode = btn.dataset.mode;

      const isFlip = state.mode === 'flipbook';
      panelScene.style.display     = isFlip ? '' : 'none';
      panelNewspaper.style.display = isFlip ? 'none' : '';
      np2Manual.style.display      = state.mode === 'newspaper2' ? '' : 'none';

      generateLabel.textContent = isFlip ? '生成手翻書影片' : '生成報紙圖片';

      if (state.segmentDone) renderPreviewFrame(0);
      updateStats();
    });
  });
}

/* ── COUNT SELECTOR ── */
function bindCountSelector() {
  document.querySelectorAll('.count-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.count-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.maxCount = +btn.dataset.count;
      document.getElementById('count-limit').textContent = `上限 ${state.maxCount} 張`;
    });
  });
}

/* ── TIME TABS ── */
function bindTimeTabs() {
  timeTabs.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      timeTabs.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.timeFilter = btn.dataset.time;
      if (state.activeCountry && state.activeCity) {
        buildSceneGrid(getScenes(state.manifest, state.activeCountry, state.activeCity, state.timeFilter));
      }
    });
  });
}

/* ── NEWSPAPER CONTROLS ── */
function bindNewspaperControls() {
  npRandomBtn.addEventListener('click', () => {
    npNameInput.value = PAPER_NAMES_RANDOM[Math.floor(Math.random()*PAPER_NAMES_RANDOM.length)];
    if (state.segmentDone) renderPreviewFrame(0);
  });
  npNameInput.addEventListener('input', () => { if (state.segmentDone) renderPreviewFrame(0); });
  npCitySelect.addEventListener('change', () => { if (state.segmentDone) renderPreviewFrame(0); });

  np2AutoBtn.addEventListener('click', () => {
    state.np2Mode = 'auto';
    state.np2Slots = [0, null, null];
    updateNp2SlotUI();
    if (state.segmentDone) renderPreviewFrame(0);
  });

  np2ManualBtn.addEventListener('click', () => {
    state.np2Mode = 'manual';
    state.np2SelectingSlot = 0;
    updateNp2SlotUI();
  });

  document.querySelectorAll('.np2-slot').forEach(slot => {
    slot.addEventListener('click', () => {
      if (state.np2Mode !== 'manual') return;
      state.np2SelectingSlot = +slot.dataset.slot;
      slot.classList.add('selecting');
    });
  });
}

function updateNp2SlotUI() {
  [0,1,2].forEach(i => {
    const el = document.getElementById(`slot${i}`);
    el.textContent = state.np2Slots[i] !== null ? `第 ${state.np2Slots[i]+1} 張` : '點選指定';
  });
}

/* ── SCENE PICKER ── */
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
  buildSceneGrid(getScenes(state.manifest, state.activeCountry, city, state.timeFilter));
}

function buildSceneGrid(scenes) {
  sceneGrid.innerHTML = '';
  if (!scenes.length) {
    sceneGrid.innerHTML = '<p style="color:var(--text3);font-size:0.8rem;padding:8px">此分類暫無場景</p>';
    return;
  }
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
  if (state.segmentDone) { renderPreviewFrame(state.previewFrame); updateSteps(2); }
}

/* ── UPLOAD + 去背 ── */
uploadZone.addEventListener('dragover', e => { e.preventDefault(); uploadZone.classList.add('drag-over'); });
uploadZone.addEventListener('dragleave', () => uploadZone.classList.remove('drag-over'));
uploadZone.addEventListener('drop', e => { e.preventDefault(); uploadZone.classList.remove('drag-over'); handleFiles(e.dataTransfer.files); });
fileInput.addEventListener('change', () => handleFiles(fileInput.files));

async function handleFiles(fileList) {
  const files = Array.from(fileList).filter(f => f.type.startsWith('image/')).slice(0, state.maxCount);
  if (!files.length) return;

  state.segmentDone = false;
  state.segmentedItems = [];
  generateBtn.disabled = true;
  stopPreviewAnim();

  // 載入圖片
  uploadCount.textContent = `載入中 ${files.length} 張…`;
  const loaded = await Promise.all(files.map((file, idx) => new Promise(resolve => {
    const blobUrl = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => resolve({ img, blobUrl, id: idx });
    img.src = blobUrl;
  })));
  state.rawImages = loaded;
  buildPhotoStrip();

  // 去背
  progressWrap.classList.add('visible');
  setProgress(0, '載入去背模型…');

  try {
    state.segmentedItems = await segmentImages(loaded.map(i => i.img), (cur, total, pct) => {
      setProgress(pct, `去背中 ${cur} / ${total} 張…`);
    });
  } catch (e) {
    console.warn('去背失敗，使用原圖:', e);
    state.segmentedItems = loaded.map(i => i.img);
  }

  state.segmentDone = true;
  progressWrap.classList.remove('visible');
  uploadCount.textContent = `已選擇 ${state.rawImages.length} 張照片`;
  updateStats();
  renderPreviewFrame(0);
  startPreviewAnim();
  generateBtn.disabled = false;
  updateSteps(2);
}

/* ── PHOTO STRIP（拖拉排序 + 刪除）── */
function buildPhotoStrip() {
  photoStrip.innerHTML = '';
  state.rawImages.forEach((item, i) => {
    const div = document.createElement('div');
    div.className   = 'thumb';
    div.draggable   = true;
    div.dataset.idx = i;
    div.innerHTML   = `
      <img src="${item.blobUrl}" alt="">
      <span class="thumb-num">${i+1}</span>
      <button class="thumb-del" data-idx="${i}">✕</button>
    `;
    div.addEventListener('dragstart', onDragStart);
    div.addEventListener('dragover',  onDragOver);
    div.addEventListener('drop',      onDrop);
    div.addEventListener('dragend',   onDragEnd);
    div.querySelector('.thumb-del').addEventListener('click', e => {
      e.stopPropagation();
      deletePhoto(+e.target.dataset.idx);
    });
    photoStrip.appendChild(div);

    // 若在 manual 模式，點縮圖指定 slot
    div.addEventListener('click', () => {
      if (state.np2Mode === 'manual' && state.np2SelectingSlot !== null) {
        state.np2Slots[state.np2SelectingSlot] = i;
        document.querySelectorAll('.np2-slot').forEach(s => s.classList.remove('selecting'));
        state.np2SelectingSlot = null;
        updateNp2SlotUI();
        if (state.segmentDone) renderPreviewFrame(0);
      }
    });
  });
}

let _dragSrcIdx = null;
function onDragStart(e) { _dragSrcIdx = +this.dataset.idx; this.classList.add('dragging'); }
function onDragOver(e)  { e.preventDefault(); }
function onDrop(e) {
  e.preventDefault();
  const toIdx = +this.dataset.idx;
  if (_dragSrcIdx === null || _dragSrcIdx === toIdx) return;
  // swap in rawImages + segmentedItems
  [state.rawImages[_dragSrcIdx], state.rawImages[toIdx]] = [state.rawImages[toIdx], state.rawImages[_dragSrcIdx]];
  if (state.segmentedItems.length > toIdx && state.segmentedItems.length > _dragSrcIdx) {
    [state.segmentedItems[_dragSrcIdx], state.segmentedItems[toIdx]] = [state.segmentedItems[toIdx], state.segmentedItems[_dragSrcIdx]];
  }
  buildPhotoStrip();
  if (state.segmentDone) renderPreviewFrame(0);
}
function onDragEnd() { this.classList.remove('dragging'); _dragSrcIdx = null; }

function deletePhoto(idx) {
  URL.revokeObjectURL(state.rawImages[idx].blobUrl);
  state.rawImages.splice(idx, 1);
  if (state.segmentedItems.length > idx) state.segmentedItems.splice(idx, 1);
  buildPhotoStrip();
  uploadCount.textContent = `已選擇 ${state.rawImages.length} 張照片`;
  updateStats();
  if (state.segmentDone && state.rawImages.length > 0) renderPreviewFrame(0);
  if (!state.rawImages.length) generateBtn.disabled = true;
}

/* ── PREVIEW ── */
function renderPreviewFrame(idx) {
  if (!state.segmentedItems.length) return;
  state.previewFrame = idx % state.segmentedItems.length;
  previewCanvas.width  = OUTPUT_W;
  previewCanvas.height = OUTPUT_H;

  if (state.mode === 'flipbook') {
    const entry = { item: state.segmentedItems[state.previewFrame], photoIdx: state.previewFrame, subFrame: 0, posIdx: 1, holdFrames: 24 };
    compositeFrame(previewCtx, entry, state.bgFrames);
  } else if (state.mode === 'newspaper1') {
    const np = renderNewspaper1(
      state.segmentedItems[state.previewFrame],
      npCitySelect.value,
      npNameInput.value || null
    );
    previewCtx.drawImage(np, 0, 0, OUTPUT_W, OUTPUT_H);
  } else if (state.mode === 'newspaper2') {
    const [i0, i1, i2] = getNp2Indices();
    const np = renderNewspaper2(
      state.segmentedItems[i0],
      state.segmentedItems[i1] || null,
      state.segmentedItems[i2] || null,
      npCitySelect.value,
      npNameInput.value || null
    );
    previewCtx.drawImage(np, 0, 0, OUTPUT_W, OUTPUT_H);
  }

  previewCanvas.style.display = 'block';
  previewHolder.style.display = 'none';
}

function getNp2Indices() {
  const n = state.segmentedItems.length;
  if (state.np2Mode === 'auto' || state.np2Slots[0] === null) {
    return [0, Math.floor(n/3), Math.floor(2*n/3)].map(i => Math.min(i, n-1));
  }
  return state.np2Slots.map(i => i ?? 0);
}

function startPreviewAnim() {
  if (state.mode !== 'flipbook') return;
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

/* ── STATS ── */
function updateStats() {
  const n = state.segmentedItems.length || state.rawImages.length;
  if (!n) return;
  if (state.mode === 'flipbook') {
    const hold   = calcHoldFrames(n);
    const yoyo   = 2*n-2;
    const dur    = ((yoyo * hold) / getFPS()).toFixed(1);
    statFrames.textContent = `${yoyo} 張`;
    statDur.textContent    = `約 ${dur} 秒`;
  } else {
    statFrames.textContent = `${n} 張`;
    statDur.textContent    = `靜態圖`;
  }
  statRow.style.display = 'flex';
}

/* ── GENERATE ── */
generateBtn.addEventListener('click', async () => {
  if (state.generating || !state.segmentedItems.length) return;
  state.generating = true;
  generateBtn.disabled = true;
  resultPanel.classList.remove('visible');
  stopPreviewAnim();
  progressWrap.classList.add('visible');
  setProgress(0, '初始化…');
  updateSteps(3);

  try {
    if (state.mode === 'flipbook') {
      await generateFlipbook();
    } else {
      await generateNewspaper();
    }
  } catch (err) {
    console.error(err);
    setProgress(0, `⚠️ 錯誤：${err.message}`);
  }

  state.generating = false;
  generateBtn.disabled = false;
  if (state.mode === 'flipbook') startPreviewAnim();
});

async function generateFlipbook() {
  const sequence = buildSequence(state.segmentedItems);
  state.videoBlob = await encode({ sequence, bgFrames: state.bgFrames, workCanvas, onProgress: setProgress });
  const ext = state.videoBlob.type.includes('mp4') ? 'MP4' : 'WebM';
  const dur = ((sequence.length / getFPS())).toFixed(1);
  progressWrap.classList.remove('visible');
  resultPanel.classList.add('visible');
  resultTitle.textContent = '影片已生成 🎉';
  resultMeta.textContent  = `${state.segmentedItems.length} 張 · ${dur} 秒 · ${(state.videoBlob.size/1024/1024).toFixed(1)} MB · ${ext}`;
  state.imageBlob = null;
}

async function generateNewspaper() {
  setProgress(50, '合成報紙…');
  let np;
  if (state.mode === 'newspaper1') {
    np = renderNewspaper1(state.segmentedItems[state.previewFrame], npCitySelect.value, npNameInput.value||null);
  } else {
    const [i0,i1,i2] = getNp2Indices();
    np = renderNewspaper2(state.segmentedItems[i0], state.segmentedItems[i1]||null, state.segmentedItems[i2]||null, npCitySelect.value, npNameInput.value||null);
  }

  setProgress(90, '輸出圖片…');
  await new Promise(r => np.toBlob(blob => { state.imageBlob = blob; state.videoBlob = null; r(); }, 'image/jpeg', 0.92));
  setProgress(100, '完成！');
  progressWrap.classList.remove('visible');
  resultPanel.classList.add('visible');
  resultTitle.textContent = '報紙已生成 🗞';
  resultMeta.textContent  = `${(state.imageBlob.size/1024).toFixed(0)} KB · JPEG`;
}

/* ── DOWNLOAD ── */
downloadBtn.addEventListener('click', async () => {
  const blob = state.videoBlob || state.imageBlob;
  if (!blob) return;
  const isVideo = !!state.videoBlob;
  const ext     = isVideo ? (blob.type.includes('mp4') ? 'mp4' : 'webm') : 'jpg';
  const filename= `flipbook_${Date.now()}.${ext}`;

  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
  if (!isVideo && isIOS) {
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
    return;
  }
  if (navigator.canShare && navigator.canShare({ files: [new File([blob], filename, { type: blob.type })] })) {
    try { await navigator.share({ files: [new File([blob], filename, { type: blob.type })], title: '脆翻書' }); return; } catch {}
  }
  const url = URL.createObjectURL(blob);
  const a   = document.createElement('a');
  a.href=url; a.download=filename; document.body.appendChild(a); a.click(); document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 10000);
});

/* ── RESET ── */
resetBtn.addEventListener('click', () => {
  stopPreviewAnim();
  state.rawImages.forEach(i => URL.revokeObjectURL(i.blobUrl));
  state.rawImages=[]; state.segmentedItems=[]; state.segmentDone=false;
  state.videoBlob=null; state.imageBlob=null; state.previewFrame=0;
  photoStrip.innerHTML=''; uploadCount.textContent='尚未選擇檔案';
  previewCanvas.style.display='none'; previewHolder.style.display='';
  statRow.style.display='none'; resultPanel.classList.remove('visible');
  progressWrap.classList.remove('visible'); generateBtn.disabled=true;
  fileInput.value='';
  updateSteps(1);
});

/* ── HELPERS ── */
function setProgress(pct, label) { progressFill.style.width=`${pct}%`; progressLabel.textContent=label; }
function updateSteps(active) {
  document.querySelectorAll('.step-item').forEach(el => {
    const n=+el.dataset.step; el.classList.remove('active','done');
    if (n<active) el.classList.add('done'); else if (n===active) el.classList.add('active');
  });
}
function _tabBtn(label, onClick) {
  const b=document.createElement('button'); b.className='tab-btn'; b.textContent=label;
  b.addEventListener('click', onClick); return b;
}
function _setActiveTab(container, label) {
  container.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('active', b.textContent===label));
}

init();
