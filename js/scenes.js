export async function loadManifest() {
  const res = await fetch('assets/scenes/manifest.json');
  return res.json();
}

export function getCountries(manifest) {
  return Object.keys(manifest.scenes);
}

export function getCities(manifest, country) {
  return Object.keys(manifest.scenes[country] || {});
}

export function getScenes(manifest, country, city) {
  return manifest.scenes[country]?.[city] || [];
}

export async function preloadSceneFrames(scene) {
  const promises = scene.frames.map(url => new Promise(resolve => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = url;
  }));
  const results = await Promise.all(promises);
  const validFrames = results.filter(img => img !== null);
  if (validFrames.length === 0) throw new Error('Scene images not found');
  return validFrames;
}
