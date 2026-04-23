export async function loadManifest() {
  const res = await fetch('assets/scenes/manifest.json');
  return res.json();
}

export function getCountries(manifest) {
  const countries = new Set();
  manifest.forEach(scene => {
    if (scene.country) countries.add(scene.country);
  });
  return Array.from(countries);
}

export function getCities(manifest, country) {
  const cities = new Set();
  manifest.forEach(scene => {
    if (scene.country === country && scene.city) {
      cities.add(scene.city);
    }
  });
  return Array.from(cities);
}

export function getScenes(manifest, country, city) {
  return manifest.filter(scene => scene.country === country && scene.city === city);
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
