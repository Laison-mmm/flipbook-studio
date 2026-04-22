/**
 * segmenter.js
 * MediaPipe Selfie Segmentation — 瀏覽器端人像去背
 *
 * 流程：
 *   1. 懶載入 MediaPipe script（只在第一次呼叫時載入）
 *   2. 對每張 HTMLImageElement 產生去背後的 canvas（背景透明）
 *   3. 回傳 HTMLCanvasElement[]，可直接用於 renderer.js
 */

const MEDIAPIPE_CDN = 'https://cdn.jsdelivr.net/npm/@mediapipe/selfie_segmentation@0.1/selfie_segmentation.js';
const SOLUTION_CDN  = 'https://cdn.jsdelivr.net/npm/@mediapipe/selfie_segmentation@0.1';

let _segmenter = null;  // 單例，避免重複初始化

/**
 * initSegmenter()
 * 載入並初始化 MediaPipe，回傳 SelfieSegmentation 實例
 */
async function initSegmenter() {
  if (_segmenter) return _segmenter;

  // 動態載入 MediaPipe script
  await _loadScript(MEDIAPIPE_CDN);

  return new Promise((resolve, reject) => {
    const seg = new window.SelfieSegmentation({
      locateFile: file => `${SOLUTION_CDN}/${file}`,
    });

    seg.setOptions({
      modelSelection: 1,  // 1 = 全身模型（比 0 臉部更適合全身照）
      selfieMode: false,
    });

    seg.onResults(() => {}); // 佔位，後面 per-image 會替換

    seg.initialize()
      .then(() => {
        _segmenter = seg;
        resolve(seg);
      })
      .catch(reject);
  });
}

/**
 * segmentImages(imgElements, onProgress)
 * imgElements : HTMLImageElement[]
 * onProgress  : (current, total, pct) => void
 * returns     : HTMLCanvasElement[]  每張都是去背後的 canvas（含 alpha）
 */
export async function segmentImages(imgElements, onProgress) {
  const seg = await initSegmenter();
  const results = [];

  for (let i = 0; i < imgElements.length; i++) {
    const canvas = await _segmentOne(seg, imgElements[i]);
    results.push(canvas);

    if (onProgress) {
      const pct = Math.round(((i + 1) / imgElements.length) * 100);
      onProgress(i + 1, imgElements.length, pct);
    }

    // 讓 UI 呼吸一下
    await _sleep(10);
  }

  return results;
}

/**
 * _segmentOne(seg, imgEl)
 * 對單張圖片執行去背，回傳透明背景的 canvas
 */
function _segmentOne(seg, imgEl) {
  return new Promise((resolve, reject) => {
    // 建立工作 canvas（縮至合理尺寸，避免 GPU OOM）
    const MAX = 512;
    const scale = Math.min(MAX / imgEl.naturalWidth, MAX / imgEl.naturalHeight, 1);
    const w = Math.round(imgEl.naturalWidth  * scale);
    const h = Math.round(imgEl.naturalHeight * scale);

    const inputCanvas = document.createElement('canvas');
    inputCanvas.width  = w;
    inputCanvas.height = h;
    const inputCtx = inputCanvas.getContext('2d');
    inputCtx.drawImage(imgEl, 0, 0, w, h);

    // 輸出 canvas（維持原始比例）
    const outputCanvas = document.createElement('canvas');
    outputCanvas.width  = w;
    outputCanvas.height = h;
    const outputCtx = outputCanvas.getContext('2d');

    // 替換 onResults callback
    seg.onResults(result => {
      // result.segmentationMask 是灰階圖，白=人、黑=背景
      outputCtx.clearRect(0, 0, w, h);

      // 1. 畫人像
      outputCtx.drawImage(result.image, 0, 0, w, h);

      // 2. 用遮罩把背景變透明
      //    destination-in：保留與遮罩白色區域重疊的部分
      outputCtx.globalCompositeOperation = 'destination-in';
      outputCtx.drawImage(result.segmentationMask, 0, 0, w, h);
      outputCtx.globalCompositeOperation = 'source-over';

      // 3. 羽化邊緣（模糊遮罩邊緣，讓合成更自然）
      _featherEdges(outputCtx, w, h);

      resolve(outputCanvas);
    });

    // 送進 MediaPipe
    seg.send({ image: inputCanvas }).catch(reject);
  });
}

/**
 * _featherEdges
 * 對 alpha 通道做輕微模糊，讓人像邊緣不那麼硬
 */
function _featherEdges(ctx, w, h) {
  // 取得像素資料
  const imageData = ctx.getImageData(0, 0, w, h);
  const data = imageData.data;

  // 簡易 alpha 侵蝕：把邊緣半透明像素再降低 alpha
  // 完整的羽化需要 convolution，這裡用輕量版本
  for (let i = 3; i < data.length; i += 4) {
    const a = data[i];
    if (a > 0 && a < 200) {
      // 邊緣過渡區：讓它更透明，避免硬邊
      data[i] = Math.round(a * 0.6);
    }
  }

  ctx.putImageData(imageData, 0, 0);
}

// ─────────────────────────────────────
//  Helpers
// ─────────────────────────────────────
function _loadScript(src) {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) {
      resolve(); return;
    }
    const s = document.createElement('script');
    s.src = src;
    s.crossOrigin = 'anonymous';
    s.onload  = resolve;
    s.onerror = () => reject(new Error(`Failed to load ${src}`));
    document.head.appendChild(s);
  });
}

const _sleep = ms => new Promise(r => setTimeout(r, ms));
