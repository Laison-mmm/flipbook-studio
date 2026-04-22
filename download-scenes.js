/**
 * download-scenes.js  v2
 * 雙來源：Unsplash + Pexels 同時抓取
 * 每個場景各抓 5 張，合計 10 張，品質更高、純風景更穩定
 *
 * 使用方式：
 *   npm install node-fetch
 *   node download-scenes.js
 */

import fetch from 'node-fetch';
import fs from 'fs';
import path from 'path';
import { pipeline } from 'stream';
import { promisify } from 'util';

const streamPipeline = promisify(pipeline);

// ─────────────────────────────────────
//  API Keys
// ─────────────────────────────────────
const UNSPLASH_KEY = 'IvTfv6slrW03_fRfvPCD2PGzRF6rsnz0ovQjqYkJoR0';
const PEXELS_KEY   = 'UafedbqAwzKxGBO6UDV2X5IVxm2r7MwQTqstyM2xEXPqYVsOMyUHhHLV';

const IMAGE_WIDTH  = 1080;
const PER_SOURCE   = 5;   // 每個來源抓幾張（共 10 張/場景）

// ─────────────────────────────────────
//  場景清單
// ─────────────────────────────────────
const SCENES = [

  // ── 韓國 釜山 ──
  {
    id: 'kr-busan-haeundae',
    country: '韓國', city: '釜山', name: '海雲台日落',
    unsplashQuery: 'busan beach sunset golden hour cityscape',
    pexelsQuery:   'busan haeundae beach sunset korea',
  },
  {
    id: 'kr-busan-gamcheon',
    country: '韓國', city: '釜山', name: '甘川洞彩村',
    unsplashQuery: 'gamcheon village colorful houses hillside korea',
    pexelsQuery:   'gamcheon culture village busan colorful',
  },
  {
    id: 'kr-busan-gwangalli',
    country: '韓國', city: '釜山', name: '廣安里橋夜景',
    unsplashQuery: 'busan gwangalli bridge night reflection cityscape',
    pexelsQuery:   'busan bridge night cityscape reflection korea',
  },
  {
    id: 'kr-busan-capsule',
    country: '韓國', city: '釜山', name: '天空膠囊列車海景',
    unsplashQuery: 'busan coastal railway sea cliff landscape korea',
    pexelsQuery:   'busan sea train coastal korea landscape',
  },
  {
    id: 'kr-busan-jagalchi',
    country: '韓國', city: '釜山', name: '札嘎其港口夕陽',
    unsplashQuery: 'busan port harbor sunset ships cityscape',
    pexelsQuery:   'busan harbor sunset port korea',
  },

  // ── 韓國 首爾 ──
  {
    id: 'kr-seoul-namsan',
    country: '韓國', city: '首爾', name: '南山塔夜景',
    unsplashQuery: 'seoul namsan tower night cityscape skyline',
    pexelsQuery:   'seoul namsan night skyline city korea',
  },
  {
    id: 'kr-seoul-bukchon',
    country: '韓國', city: '首爾', name: '北村韓屋村',
    unsplashQuery: 'bukchon hanok village rooftop traditional korea',
    pexelsQuery:   'bukchon hanok seoul traditional village',
  },
  {
    id: 'kr-seoul-han',
    country: '韓國', city: '首爾', name: '漢江夜景',
    unsplashQuery: 'han river seoul bridge night reflection city',
    pexelsQuery:   'han river seoul night bridge korea',
  },
  {
    id: 'kr-seoul-hongdae',
    country: '韓國', city: '首爾', name: '弘大霓虹街',
    unsplashQuery: 'seoul hongdae neon night street signs',
    pexelsQuery:   'seoul korea neon night street signs',
  },

  // ── 日本 京都 ──
  {
    id: 'jp-kyoto-arashiyama',
    country: '日本', city: '京都', name: '嵐山竹林',
    unsplashQuery: 'arashiyama bamboo grove kyoto green light japan',
    pexelsQuery:   'kyoto bamboo forest arashiyama japan',
  },
  {
    id: 'jp-kyoto-fushimi',
    country: '日本', city: '京都', name: '伏見稻荷鳥居',
    unsplashQuery: 'fushimi inari torii gates red kyoto japan',
    pexelsQuery:   'fushimi inari shrine torii kyoto japan',
  },
  {
    id: 'jp-kyoto-gion',
    country: '日本', city: '京都', name: '祇園花見小路',
    unsplashQuery: 'gion kyoto traditional street lantern evening',
    pexelsQuery:   'kyoto gion street night lantern japan',
  },
  {
    id: 'jp-kyoto-kinkaku',
    country: '日本', city: '京都', name: '金閣寺倒影',
    unsplashQuery: 'kinkaku-ji golden pavilion reflection pond kyoto',
    pexelsQuery:   'kinkakuji golden pavilion kyoto reflection japan',
  },

  // ── 日本 大阪 ──
  {
    id: 'jp-osaka-dotonbori',
    country: '日本', city: '大阪', name: '道頓堀霓虹',
    unsplashQuery: 'dotonbori osaka neon reflection canal night',
    pexelsQuery:   'dotonbori osaka night neon canal japan',
  },
  {
    id: 'jp-osaka-castle',
    country: '日本', city: '大阪', name: '大阪城夜景',
    unsplashQuery: 'osaka castle night illumination japan',
    pexelsQuery:   'osaka castle night light japan',
  },
  {
    id: 'jp-osaka-shinsekai',
    country: '日本', city: '大阪', name: '新世界夜景',
    unsplashQuery: 'shinsekai osaka retro neon night japan',
    pexelsQuery:   'osaka shinsekai night retro neon japan',
  },

  // ── 日本 東京 ──
  {
    id: 'jp-tokyo-shibuya',
    country: '日本', city: '東京', name: '澀谷夜景',
    unsplashQuery: 'shibuya tokyo night neon cityscape aerial',
    pexelsQuery:   'shibuya tokyo night cityscape neon japan',
  },
  {
    id: 'jp-tokyo-shinjuku',
    country: '日本', city: '東京', name: '新宿歌舞伎町',
    unsplashQuery: 'shinjuku tokyo neon night cityscape signs',
    pexelsQuery:   'shinjuku tokyo night neon signs japan',
  },
  {
    id: 'jp-tokyo-asakusa',
    country: '日本', city: '東京', name: '淺草雷門夜景',
    unsplashQuery: 'senso-ji asakusa tokyo lantern night japan',
    pexelsQuery:   'asakusa senso-ji temple night tokyo japan',
  },
  {
    id: 'jp-tokyo-skytree',
    country: '日本', city: '東京', name: '晴空塔夜景',
    unsplashQuery: 'tokyo skytree night illumination cityscape',
    pexelsQuery:   'tokyo skytree night city japan',
  },
  {
    id: 'jp-tokyo-rainbow',
    country: '日本', city: '東京', name: '彩虹橋夜景',
    unsplashQuery: 'rainbow bridge tokyo bay night reflection',
    pexelsQuery:   'tokyo rainbow bridge night bay japan',
  },

  // ── 台灣 台北 ──
  {
    id: 'tw-taipei-jiufen',
    country: '台灣', city: '台北', name: '九份夜景',
    unsplashQuery: 'jiufen taiwan night lantern red village',
    pexelsQuery:   'jiufen night taiwan lanterns village',
  },
  {
    id: 'tw-taipei-elephant',
    country: '台灣', city: '台北', name: '象山101夜景',
    unsplashQuery: 'taipei 101 night skyline city lights taiwan',
    pexelsQuery:   'taipei 101 night skyline taiwan',
  },
  {
    id: 'tw-taipei-danshui',
    country: '台灣', city: '台北', name: '淡水夕陽',
    unsplashQuery: 'tamsui sunset river golden hour taiwan',
    pexelsQuery:   'tamsui danshui sunset river taiwan',
  },
  {
    id: 'tw-taipei-ximending',
    country: '台灣', city: '台北', name: '西門町霓虹',
    unsplashQuery: 'ximending taipei night neon street taiwan',
    pexelsQuery:   'ximending taipei night neon taiwan',
  },

  // ── 台灣 高雄 ──
  {
    id: 'tw-kaohsiung-pier2',
    country: '台灣', city: '高雄', name: '駁二夕陽',
    unsplashQuery: 'kaohsiung pier harbor sunset golden taiwan',
    pexelsQuery:   'kaohsiung pier harbor sunset taiwan',
  },
  {
    id: 'tw-kaohsiung-lotus',
    country: '台灣', city: '高雄', name: '蓮池潭龍虎塔',
    unsplashQuery: 'lotus pond dragon tiger pagoda kaohsiung reflection',
    pexelsQuery:   'kaohsiung lotus pond pagoda taiwan reflection',
  },
  {
    id: 'tw-kaohsiung-cijin',
    country: '台灣', city: '高雄', name: '旗津海岸夕陽',
    unsplashQuery: 'cijin beach sunset kaohsiung taiwan coast',
    pexelsQuery:   'cijin island kaohsiung beach sunset taiwan',
  },
  {
    id: 'tw-kaohsiung-formosa',
    country: '台灣', city: '高雄', name: '美麗島捷運站',
    unsplashQuery: 'formosa boulevard station kaohsiung glass dome colorful',
    pexelsQuery:   'kaohsiung mrt formosa station colorful taiwan',
  },

  // ── 香港 ──
  {
    id: 'hk-victoria',
    country: '香港', city: '香港', name: '維多利亞港夜景',
    unsplashQuery: 'victoria harbour hong kong night skyline',
    pexelsQuery:   'hong kong victoria harbour night skyline',
  },
  {
    id: 'hk-peak',
    country: '香港', city: '香港', name: '太平山頂夜景',
    unsplashQuery: 'victoria peak hong kong night city view',
    pexelsQuery:   'victoria peak hong kong night cityscape',
  },
  {
    id: 'hk-mongkok',
    country: '香港', city: '香港', name: '旺角霓虹街道',
    unsplashQuery: 'mongkok hong kong neon signs night street',
    pexelsQuery:   'hong kong neon signs night street',
  },
  {
    id: 'hk-tsimsha',
    country: '香港', city: '香港', name: '尖沙咀海濱夜景',
    unsplashQuery: 'tsim sha tsui hong kong harbour night promenade',
    pexelsQuery:   'tsim sha tsui hong kong night harbour',
  },
];

// ─────────────────────────────────────
//  工具函式
// ─────────────────────────────────────
const sleep = ms => new Promise(r => setTimeout(r, ms));

function ensureDir(p) {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
}

async function downloadImage(url, dest) {
  const res = await fetch(url, { headers: { 'User-Agent': 'FlipbookStudio/2.0' } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  await streamPipeline(res.body, fs.createWriteStream(dest));
}

async function fetchUnsplash(query, count) {
  const url = new URL('https://api.unsplash.com/search/photos');
  url.searchParams.set('query', query);
  url.searchParams.set('per_page', count * 2);
  url.searchParams.set('orientation', 'portrait');
  url.searchParams.set('content_filter', 'high');

  const res = await fetch(url.toString(), {
    headers: { Authorization: `Client-ID ${UNSPLASH_KEY}` },
  });
  if (!res.ok) throw new Error(`Unsplash ${res.status}`);
  const data = await res.json();

  return data.results.slice(0, count).map(p => ({
    src: `${p.urls.raw}&w=${IMAGE_WIDTH}&q=85&fm=jpg&fit=crop&crop=entropy`,
  }));
}

async function fetchPexels(query, count) {
  const url = new URL('https://api.pexels.com/v1/search');
  url.searchParams.set('query', query);
  url.searchParams.set('per_page', count * 2);
  url.searchParams.set('orientation', 'portrait');

  const res = await fetch(url.toString(), {
    headers: { Authorization: PEXELS_KEY },
  });
  if (!res.ok) throw new Error(`Pexels ${res.status}`);
  const data = await res.json();

  return (data.photos || []).slice(0, count).map(p => ({
    src: p.src.large2x || p.src.large,
  }));
}

// ─────────────────────────────────────
//  主流程
// ─────────────────────────────────────
async function main() {
  const baseDir = path.join(process.cwd(), 'assets', 'scenes');

  // 刪除舊照片
  console.log('\n🗑   清除舊場景圖片…');
  if (fs.existsSync(baseDir)) {
    fs.rmSync(baseDir, { recursive: true, force: true });
    console.log('     已清除\n');
  }
  ensureDir(baseDir);

  const manifest = [];
  let totalOK = 0, totalFail = 0;

  console.log(`🎬  脆翻書場景下載器 v2  (Unsplash + Pexels 雙來源)`);
  console.log(`📦  共 ${SCENES.length} 個景點，每景最多 ${PER_SOURCE * 2} 張\n`);

  for (const scene of SCENES) {
    const sceneDir = path.join(baseDir, scene.id);
    ensureDir(sceneDir);

    process.stdout.write(`  ⬇  ${scene.country} · ${scene.city} · ${scene.name}  `);

    // 雙來源並行
    const [unsRes, pxRes] = await Promise.allSettled([
      fetchUnsplash(scene.unsplashQuery, PER_SOURCE),
      fetchPexels(scene.pexelsQuery, PER_SOURCE),
    ]);

    const photos = [
      ...(unsRes.status === 'fulfilled' ? unsRes.value : []),
      ...(pxRes.status  === 'fulfilled' ? pxRes.value  : []),
    ];

    if (!photos.length) {
      console.log('⚠️  無法取得');
      totalFail++;
      continue;
    }

    const frameFiles = [];
    for (let i = 0; i < photos.length; i++) {
      const filename = `frame-${String(i + 1).padStart(2, '0')}.jpg`;
      const dest = path.join(sceneDir, filename);
      try {
        await downloadImage(photos[i].src, dest);
        frameFiles.push(`assets/scenes/${scene.id}/${filename}`);
        process.stdout.write('.');
        totalOK++;
      } catch {
        process.stdout.write('✗');
        totalFail++;
      }
      await sleep(150);
    }

    console.log(`  (${frameFiles.length}張)`);

    manifest.push({
      id: scene.id,
      country: scene.country,
      city: scene.city,
      name: scene.name,
      frames: frameFiles,
      frameCount: frameFiles.length,
    });

    await sleep(400);
  }

  // 寫 manifest
  fs.writeFileSync(
    path.join(baseDir, 'manifest.json'),
    JSON.stringify(manifest, null, 2),
    'utf-8'
  );

  console.log('\n' + '─'.repeat(52));
  console.log(`✅  完成！`);
  console.log(`   下載成功：${totalOK} 張`);
  console.log(`   下載失敗：${totalFail} 張`);
  console.log(`   景點數量：${manifest.length} 個`);
  console.log('─'.repeat(52));
  console.log('\n⚠️  請手動開啟 assets/scenes/ 各資料夾');
  console.log('   刪除有人物的照片，保留純風景\n');
}

main().catch(err => {
  console.error('\n❌  錯誤：', err.message);
  process.exit(1);
});
