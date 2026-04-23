export async function loadManifest() {
  const res = await fetch('assets/scenes/manifest.json');
  return res.json();
}

export function getCountries(manifest) {
  const countries = new Set();
  manifest.forEach(s => { if (s.country) countries.add(s.country); });
  return Array.from(countries);
}

export function getCities(manifest, country) {
  const cities = new Set();
  manifest.forEach(s => { if (s.country === country && s.city) cities.add(s.city); });
  return Array.from(cities);
}

export function getScenes(manifest, country, city) {
  return manifest.filter(s => s.country === country && s.city === city);
}

export async function preloadSceneFrames(scene) {
  if (!scene || !scene.frames) return [];
  const promises = scene.frames.map(url => new Promise(resolve => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = url;
  }));
  const results = await Promise.all(promises);
  const valid = results.filter(i => i !== null);
  return valid;
}
