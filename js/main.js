import { loadManifest, getCountries, getCities, getScenes, preloadSceneFrames } from './scenes.js';
import { segmentImages } from './segmenter.js';
import { buildSequence, compositeFrame, OUTPUT_W, OUTPUT_H, FPS, INTERNAL_FPS } from './renderer.js';
import { encode } from './encoder.js';

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

const state = {
  manifest:       null,
  rawImages:      [],
  segmentedItems: [],
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

async function init() {
  state.manifest = await loadManifest();
  buildCountryTabs(state.manifest);
  const first = getCountries(state.manifest)[0];
  selectCountry(first);
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
  if (state.segmentDone) { renderPreviewFrame(state.previewFrame); updateSteps(2); }
}

uploadZone.addEventListener('dragover', e => { e.preventDefault(); uploadZone.classList.add('drag-over'); });
uploadZone.addEventListener('dragleave', () => uploadZone.classList.remove('drag-over'));
uploadZone.addEventListener('drop', e => { e.preventDefault(); uploadZone.classList.remove('drag-over'); handleFiles(e.dataTransfer.files); });
fileInput.addEventListener('change', () => handleFiles(fileInput.files));

async function handleFiles(fileList) {
  const files = Array.from(fileList).filter(f => f.type.startsWith('image/')).slice(0, 30);
  if (!files.length) return;

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
  startPreviewAnim();
  generateBtn.disabled = false;
  updateSteps(2);
}

function buildPhotoStrip() {
  photoStrip.innerHTML = '';
  state.rawImages.slice(0, 12).forEach((item, i) => {
    const div = document.createElement('div');
    div.className = 'thumb';
    div.innerHTML = `<img src="${item.blobUrl}" alt=""><span class="thumb-num">${i + 1}</span>`;
    photoStrip.appendChild(div);
  });
  if (state.rawImages.length > 12) {
    const more = document.createElement('div');
    more.className = 'thumb-more';
    more.textContent = `+${state.rawImages.length - 12}`;
    photoStrip.appendChild(more);
  }
}

function renderPreviewFrame(idx) {
  if (!state.segmentedItems.length) return;
  state.previewFrame = idx % state.segmentedItems.length;
  previewCanvas.width  = OUTPUT_W;
  previewCanvas.height = OUTPUT_H;

  const entry = {
    item:       state.segmentedItems[state.previewFrame],
    photoIdx:   state.previewFrame,
    subFrame:   0,
    posIdx:     state.previewFrame % 2,
    holdFrames: 24,
  };
  compositeFrame(previewCtx, entry, state.bgFrames);

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
  statFrames.textContent = `360 幀`;
  statDur.textContent    = `15.0 秒`;
  statRow.style.display  = 'flex';
}

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
    const sequence = buildSequence(state.segmentedItems);
    state.videoBlob = await encode({ sequence, bgFrames: state.bgFrames, workCanvas, onProgress: setProgress });
    const ext    = state.videoBlob.type.includes('mp4') ? 'MP4' : 'WebM';
    const sizeMB = (state.videoBlob.size / 1024 / 1024).toFixed(1);
    progressWrap.classList.remove('visible');
    resultPanel.classList.add('visible');
    resultMeta.textContent = `${state.segmentedItems.length} 張 · 15.0 秒 · ${sizeMB} MB · ${ext}`;
  } catch (err) {
    setProgress(0, `⚠️ 錯誤：${err.message}`);
  }

  state.generating = false;
  generateBtn.disabled = false;
  startPreviewAnim();
});

downloadBtn.addEventListener('click', async () => {
  if (!state.videoBlob) return;
  const ext      = state.videoBlob.type.includes('mp4') ? 'mp4' : 'webm';
  const filename = `flipbook_${Date.now()}.${ext}`;
  const isIOS    = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
  if (navigator.canShare && navigator.canShare({ files: [new File([state.videoBlob], filename, { type: state.videoBlob.type })] })) {
    try { await navigator.share({ files: [new File([state.videoBlob], filename, { type: state.videoBlob.type })], title: '脆翻書' }); return; } catch {}
  }
  if (isIOS) { window.open(URL.createObjectURL(state.videoBlob), '_blank'); return; }
  const url = URL.createObjectURL(state.videoBlob);
  const a   = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 10000);
});

resetBtn.addEventListener('click', () => {
  stopPreviewAnim();
  state.rawImages.forEach(i => URL.revokeObjectURL(i.blobUrl));
  state.rawImages = []; state.segmentedItems = []; state.segmentDone = false;
  state.videoBlob = null; state.previewFrame = 0;
  photoStrip.innerHTML = ''; uploadCount.textContent = '尚未選擇檔案';
  previewCanvas.style.display = 'none'; previewHolder.style.display = '';
  statRow.style.display = 'none'; resultPanel.classList.remove('visible');
  progressWrap.classList.remove('visible'); generateBtn.disabled = true;
  fileInput.value = ''; updateSteps(1);
});

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
