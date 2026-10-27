// ============================================
// AZombie — PNG render (sharp: exact raw RGBA decode/encode, no premultiply loss)
// ============================================

import path from 'path';
import sharp from 'sharp';
import {
  ZOMBIE_GRID, ZOMBIE_CANVAS, ZOMBIE_BG,
  loadZombieSpec, composeZombie, upscaleOnBackground, zombieDnaVersion,
} from './zombie-core.js';

const _layerCache = new Map(); // `${dir}|${file}` -> Uint8Array
const _pngCache = new Map();   // `${tokenId}:${dna}` -> Buffer (art is immutable per token)
const PNG_CACHE_MAX = 300;

export function defaultLayerDir() {
  return path.join(process.cwd(), 'public', 'labimages', 'azombie');
}

async function loadLayer(dir, file) {
  const key = `${dir}|${file}`;
  if (_layerCache.has(key)) return _layerCache.get(key);
  const { data, info } = await sharp(path.join(dir, file))
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  if (info.width !== ZOMBIE_GRID || info.height !== ZOMBIE_GRID || info.channels !== 4) {
    throw new Error(`[azombie] layer ${file} is ${info.width}x${info.height}x${info.channels}, expected 37x37x4`);
  }
  const arr = new Uint8Array(data);
  _layerCache.set(key, arr);
  return arr;
}

/** Load every layer needed for this zombie */
export async function loadZombieLayers(z, { layerDir = defaultLayerDir(), spec = loadZombieSpec() } = {}) {
  const layers = { skeleton: null, skin: null, slots: {} };
  layers.skeleton = await loadLayer(layerDir, 'skeleton.png');
  if (z.variant !== 1) layers.skin = await loadLayer(layerDir, 'skin.png');
  const t = BigInt(z.traits);
  for (const slot of spec.slots) {
    const v = Number((t >> BigInt(8 * slot.slot)) & 0xffn);
    if (!v) continue;
    const opt = slot.options.find(o => o.value === v);
    if (!opt) continue;
    layers.slots[`${slot.name}:${v}`] = await loadLayer(layerDir, opt.file);
  }
  return layers;
}

/** Raw 1000x1000 RGBA render (before PNG encode) */
export async function renderZombieRaw(z, opts = {}) {
  const spec = opts.spec || loadZombieSpec();
  const layers = await loadZombieLayers(z, { ...opts, spec });
  const small = composeZombie(layers, z, spec);
  return upscaleOnBackground(small, opts.canvas || ZOMBIE_CANVAS, opts.bg || ZOMBIE_BG);
}

/** Final PNG buffer (memoised per tokenId + art fingerprint) */
export async function renderZombiePng(tokenId, z, opts = {}) {
  const key = `${tokenId}:${zombieDnaVersion(z)}`;
  if (!opts.noCache && _pngCache.has(key)) return _pngCache.get(key);
  const { data, width, height } = await renderZombieRaw(z, opts);
  const png = await sharp(Buffer.from(data.buffer, data.byteOffset, data.byteLength), {
    raw: { width, height, channels: 4 },
  }).png().toBuffer();
  if (!opts.noCache) {
    if (_pngCache.size >= PNG_CACHE_MAX) _pngCache.delete(_pngCache.keys().next().value);
    _pngCache.set(key, png);
  }
  return png;
}

/** Shared HTTP response for v1 and v2 render endpoints */
export async function sendZombieRender(res, tokenId, z, start = Date.now()) {
  const png = await renderZombiePng(tokenId, z);
  res.setHeader('Content-Type', 'image/png');
  // Art data is immutable on-chain once minted -> same TTL as a normal AdrianZERO render.
  res.setHeader('Cache-Control', 'public, max-age=604800, s-maxage=604800');
  res.setHeader('X-Version', 'AZOMBIE');
  res.setHeader('X-Render-Type', 'azombie');
  res.setHeader('X-Render-Time', `${Date.now() - start}ms`);
  return res.status(200).send(png);
}
