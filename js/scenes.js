/**
 * scenes.js  v2
 * 加入白天/黃昏/夜晚分類
 */

let _manifest = null;

export async function loadManifest() {
  if (_manifest) return _manifest;
  const res = await fetch('assets/scenes/manifest.json');
  _manifest = await res.json();
  return _manifest;
}

// 根據場景名稱自動判斷時段
function getTimeOfDay(scene) {
  const name = scene.name + ' ' + (scene.id || '');
  if (/夜|night|neon|霓虹|夜景/i.test(name))          return 'night';
  if (/日落|夕陽|sunset|黃昏|golden|傍晚/i.test(name)) return 'dusk';
  return 'day';
}

export function getCountries(manifest) {
  return [...new Set(manifest.map(s => s.country))];
}

export function getCities(manifest, country) {
  return [...new Set(manifest.filter(s => s.country === country).map(s => s.city))];
}

export function getScenes(manifest, country, city, timeFilter = 'all') {
  return manifest.filter(s => {
    if (s.country !== country || s.city !== city) return false;
    if (timeFilter === 'all') return true;
    return getTimeOfDay(s) === timeFilter;
  });
}

export function preloadSceneFrames(scene) {
  return Promise.all(scene.frames.map(src => new Promise((resolve, reject) => {
    const img = new Image();
    img.onload  = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed: ${src}`));
    img.src = src;
  })));
}
