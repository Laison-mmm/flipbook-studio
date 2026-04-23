/**
 * segmenter.js — stable rollback
 * 侵蝕 4px + 對比門檻 120/180 + 高斯模糊
 */

const MEDIAPIPE_CDN = 'https://cdn.jsdelivr.net/npm/@mediapipe/selfie_segmentation@0.1/selfie_segmentation.js';
const SOLUTION_CDN  = 'https://cdn.jsdelivr.net/npm/@mediapipe/selfie_segmentation@0.1';
let _segmenter = null;

async function initSegmenter() {
  if (_segmenter) return _segmenter;
  await _loadScript(MEDIAPIPE_CDN);
  return new Promise((resolve, reject) => {
    const seg = new window.SelfieSegmentation({ locateFile: f => `${SOLUTION_CDN}/${f}` });
    seg.setOptions({ modelSelection: 1, selfieMode: false });
    seg.onResults(() => {});
    seg.initialize().then(() => { _segmenter = seg; resolve(seg); }).catch(reject);
  });
}

export async function segmentImages(imgElements, onProgress) {
  const seg = await initSegmenter();
  const results = [];
  for (let i = 0; i < imgElements.length; i++) {
    results.push(await _segmentOne(seg, imgElements[i]));
    if (onProgress) onProgress(i+1, imgElements.length, Math.round(((i+1)/imgElements.length)*100));
    await _sleep(10);
  }
  return results;
}

function _segmentOne(seg, imgEl) {
  return new Promise((resolve, reject) => {
    const MAX = 768;
    const scale = Math.min(MAX/imgEl.naturalWidth, MAX/imgEl.naturalHeight, 1);
    const w = Math.round(imgEl.naturalWidth*scale);
    const h = Math.round(imgEl.naturalHeight*scale);

    const inp = document.createElement('canvas');
    inp.width=w; inp.height=h;
    inp.getContext('2d').drawImage(imgEl, 0, 0, w, h);

    seg.onResults(result => {
      const mC = document.createElement('canvas');
      mC.width=w; mC.height=h;
      const mCtx = mC.getContext('2d');
      mCtx.drawImage(result.segmentationMask, 0, 0, w, h);
      const raw = mCtx.getImageData(0,0,w,h).data;

      const mask = new Float32Array(w*h);
      for (let i=0; i<w*h; i++) {
        const v = raw[i*4];
        mask[i] = v < 120 ? 0 : v > 180 ? 255 : ((v-120)/60)*255;
      }

      const eroded  = _erode(mask, w, h, 4);
      const blurred = _gaussianBlur(eroded, w, h, 2);

      const out = document.createElement('canvas');
      out.width=w; out.height=h;
      const outCtx = out.getContext('2d');
      outCtx.drawImage(result.image, 0, 0, w, h);
      const imgData = outCtx.getImageData(0,0,w,h);
      const px = imgData.data;
      for (let i=0; i<w*h; i++) px[i*4+3] = Math.round(Math.min(255, blurred[i]));
      outCtx.putImageData(imgData, 0, 0);
      resolve(out);
    });
    seg.send({ image: inp }).catch(reject);
  });
}

function _erode(data, w, h, r) {
  const res = new Float32Array(w*h);
  for (let y=0; y<h; y++) for (let x=0; x<w; x++) {
    let min=255;
    for (let dy=-r; dy<=r; dy++) for (let dx=-r; dx<=r; dx++) {
      const v = data[Math.min(Math.max(y+dy,0),h-1)*w + Math.min(Math.max(x+dx,0),w-1)];
      if (v<min) min=v;
    }
    res[y*w+x]=min;
  }
  return res;
}

function _gaussianBlur(data, w, h, r) {
  const tmp=new Float32Array(w*h), res=new Float32Array(w*h);
  for (let y=0; y<h; y++) for (let x=0; x<w; x++) {
    let s=0,wt=0;
    for (let dx=-r; dx<=r; dx++) {
      const g=Math.exp(-(dx*dx)/(2*r*r));
      s+=data[y*w+Math.min(Math.max(x+dx,0),w-1)]*g; wt+=g;
    }
    tmp[y*w+x]=s/wt;
  }
  for (let y=0; y<h; y++) for (let x=0; x<w; x++) {
    let s=0,wt=0;
    for (let dy=-r; dy<=r; dy++) {
      const g=Math.exp(-(dy*dy)/(2*r*r));
      s+=tmp[Math.min(Math.max(y+dy,0),h-1)*w+x]*g; wt+=g;
    }
    res[y*w+x]=s/wt;
  }
  return res;
}

function _loadScript(src) {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) { resolve(); return; }
    const s=document.createElement('script'); s.src=src; s.crossOrigin='anonymous';
    s.onload=resolve; s.onerror=()=>reject(new Error(`Failed: ${src}`));
    document.head.appendChild(s);
  });
}
const _sleep = ms => new Promise(r => setTimeout(r, ms));
