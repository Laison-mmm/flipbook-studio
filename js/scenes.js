/**
 * scenes.js
 * 載入 manifest.json，提供場景資料與分組
 */

let _manifest = null;

export async function loadManifest() {
  if (_manifest) return _manifest;
  const res = await fetch('assets/scenes/manifest.json');
  _manifest = await res.json();
  return _manifest;
}

/**
 * 回傳所有國家（去重）
 */
export function getCountries(manifest) {
  return [...new Set(manifest.map(s => s.country))];
}

/**
 * 回傳某國家下的所有城市
 */
export function getCities(manifest, country) {
  return [...new Set(
    manifest.filter(s => s.country === country).map(s => s.city)
  )];
}

/**
 * 回傳某城市下的所有場景
 */
export function getScenes(manifest, country, city) {
  return manifest.filter(s => s.country === country && s.city === city);
}

/**
 * 預載入某場景的所有幀圖片
 * 回傳 HTMLImageElement[]，已載入完畢
 */
export function preloadSceneFrames(scene) {
  return Promise.all(
    scene.frames.map(src => new Promise((resolve, reject) => {
      const img = new Image();
      img.onload  = () => resolve(img);
      img.onerror = () => reject(new Error(`Failed to load ${src}`));
      img.src = src;
    }))
  );
}
