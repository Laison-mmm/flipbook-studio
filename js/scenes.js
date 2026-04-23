/**
 * scenes.js — stable rollback
 */

let _manifest = null;

export async function loadManifest() {
  if (_manifest) return _manifest;
  const res = await fetch('assets/scenes/manifest.json');
  _manifest = await res.json();
  return _manifest;
}

export function getCountries(manifest) {
  return [...new Set(manifest.map(s => s.country))];
}

export function getCities(manifest, country) {
  return [...new Set(manifest.filter(s => s.country === country).map(s => s.city))];
}

export function getScenes(manifest, country, city) {
  return manifest.filter(s => s.country === country && s.city === city);
}

export function preloadSceneFrames(scene) {
  return Promise.all(scene.frames.map(src => new Promise((resolve, reject) => {
    const img = new Image();
    img.onload  = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed: ${src}`));
    img.src = src;
  })));
}
