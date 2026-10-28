// ============================================
// AZombie — pure logic (no RPC, no I/O beyond the spec JSON)
// ============================================
// AZombie = AdrianZERO variant built by hand in the AZombie lab (HalfxTiger + Adrian).
// Each token is an AdrianLabCore token minted by ZombieMintFacet (Diamond) through
// AdrianLabDelegator. All art data lives on-chain per token:
//   zombieGetData(tokenId) -> (bytes mask, uint40 traits, uint8 variant, uint256 index)
//
// Grid 37x37. Paint order: skeleton -> skin (masked; omitted when variant=1)
//   -> BODY -> MOUTH -> EYES -> HEAD -> WEAPON.
// Mask: bit i = y*37+x; byte = i>>3; bit = 0x80>>(i&7); 1 = skin pixel erased.
// Traits: slot k = (traits >> 8k) & 0xff; 0 = none, 1..n = option (azombie.json).
//
// Spec registry: public/labmetadata/azombie.json (copy of zombie-spec.json).
// Layers:        public/labimages/azombie/*.png (37x37 RGBA, clean alpha).

import fs from 'fs';
import path from 'path';

export const ZOMBIE_TAG = 'AZombie';
export const ZOMBIE_GRID = 37;
export const ZOMBIE_MASK_BYTES = 172; // ceil(37*37/8)
export const ZOMBIE_DESCRIPTION = 'Built by hand in the Zombie lab. BE REAL | BE ADRIAN | Zombie by HalfxTiger';
// Same output size as every other AdrianZERO render (v1 /api/render = 1000x1000).
export const ZOMBIE_CANVAS = 1000;
// No single AdrianZERO default background exists (BACKGROUND is a trait; the bare
// canvas is white), so AZombie uses a dark arcade green.
export const ZOMBIE_BG = [0x0d, 0x1f, 0x0d, 0xff];

let _spec = null;

/** Load (once) the AZombie spec registry from public/labmetadata/azombie.json */
export function loadZombieSpec() {
  if (_spec) return _spec;
  const p = path.join(process.cwd(), 'public', 'labmetadata', 'azombie.json');
  _spec = JSON.parse(fs.readFileSync(p, 'utf8'));
  return _spec;
}

/** Normalise the mask (hex string / Uint8Array / Buffer) to a Buffer of exactly 172 bytes */
export function normaliseMask(mask) {
  let buf;
  if (mask == null) buf = Buffer.alloc(0);
  else if (typeof mask === 'string') buf = Buffer.from(mask.replace(/^0x/i, ''), 'hex');
  else buf = Buffer.from(mask);
  if (buf.length === ZOMBIE_MASK_BYTES) return buf;
  const out = Buffer.alloc(ZOMBIE_MASK_BYTES);
  buf.copy(out, 0, 0, Math.min(buf.length, ZOMBIE_MASK_BYTES));
  return out;
}

/** true if pixel (x,y) is set in a 37x37 bitmap (mask or skin bitmap) */
export function bitAt(bitmap, x, y) {
  const i = y * ZOMBIE_GRID + x;
  return (bitmap[i >> 3] & (0x80 >> (i & 7))) !== 0;
}

/** Decode the mask to a Uint8Array(37*37) of 0/1 (1 = skin erased) */
export function decodeMask(mask) {
  const buf = normaliseMask(mask);
  const out = new Uint8Array(ZOMBIE_GRID * ZOMBIE_GRID);
  for (let i = 0; i < out.length; i++) {
    out[i] = (buf[i >> 3] & (0x80 >> (i & 7))) ? 1 : 0;
  }
  return out;
}

/** Decode the uint40 traits to [BODY, MOUTH, EYES, HEAD, WEAPON] option values */
export function decodeTraits(traits) {
  const t = BigInt(traits == null ? 0 : String(traits));
  const out = [];
  for (let k = 0; k < 5; k++) out.push(Number((t >> BigInt(8 * k)) & 0xffn));
  return out;
}

/** Encode slot values back to the uint40 (tests / tooling) */
export function encodeTraits(slots) {
  let t = 0n;
  slots.forEach((v, k) => { t |= (BigInt(v) & 0xffn) << BigInt(8 * k); });
  return t;
}

/** Skin-erased stats: erased skin pixels / opaque skin pixels (spec skinBitmapHex) */
export function skinErasedStats(mask, spec = loadZombieSpec()) {
  const m = normaliseMask(mask);
  const skin = normaliseMask(spec.skinBitmapHex);
  let total = 0;
  let erased = 0;
  for (let i = 0; i < ZOMBIE_GRID * ZOMBIE_GRID; i++) {
    const bit = 0x80 >> (i & 7);
    if (skin[i >> 3] & bit) {
      total++;
      if (m[i >> 3] & bit) erased++;
    }
  }
  const percent = total > 0 ? Math.round((erased * 100) / total) : 0;
  return { erased, total, percent };
}

/** Normalise the raw zombieGetData() multicall result */
export function parseZombieData(data) {
  if (!data) return null;
  const mask = data.mask ?? data[0];
  const traits = data.traits ?? data[1];
  const variant = data.variant ?? data[2];
  const index = data.index ?? data[3];
  return {
    mask: normaliseMask(mask),
    traits: BigInt(String(traits ?? 0)),
    variant: Number(String(variant ?? 0)),
    index: Number(String(index ?? 0)),
  };
}

/** Parse the (wasMintedHere, getData) pair of multicall results */
export function parseZombieResults(mintedRes, dataRes) {
  const minted = Boolean(mintedRes && mintedRes.success && mintedRes.data && mintedRes.data[0] === true);
  if (!minted) return { minted: false, zombie: null };
  if (!dataRes || !dataRes.success) return { minted: true, zombie: null };
  return { minted: true, zombie: parseZombieData(dataRes.data) };
}

/** Short stable fingerprint of the art data (cache keys + ?v= of the image URL) */
export function zombieDnaVersion(z) {
  // FNV-1a 32 over mask || traits || variant — deterministic and dependency-free.
  let h = 0x811c9dc5;
  const feed = (b) => { h ^= b; h = Math.imul(h, 0x01000193) >>> 0; };
  for (const b of z.mask) feed(b);
  for (const ch of `${z.traits.toString(16)}:${z.variant}`) feed(ch.charCodeAt(0));
  return h.toString(16).padStart(8, '0');
}

/** Resolve the slot option entries (null when 0 / unknown) */
export function resolveSlotOptions(traits, spec = loadZombieSpec()) {
  const values = decodeTraits(traits);
  return spec.slots.map((slot, k) => {
    const v = values[slot.slot ?? k];
    if (!v) return { slot: slot.name, value: 0, option: null };
    const option = slot.options.find(o => o.value === v) || null;
    return { slot: slot.name, value: v, option };
  });
}

// ===== COMPOSITION (raw RGBA, straight alpha) =====

/** In-place source-over of src onto dst (both straight-alpha RGBA, same size) */
export function compositeOver(dst, src, skip = null) {
  for (let p = 0, i = 0; i < dst.length; p++, i += 4) {
    if (skip && skip[p]) continue;
    const sa = src[i + 3];
    if (sa === 0) continue;
    if (sa === 255) {
      dst[i] = src[i]; dst[i + 1] = src[i + 1]; dst[i + 2] = src[i + 2]; dst[i + 3] = 255;
      continue;
    }
    const s = sa / 255;
    const d = dst[i + 3] / 255;
    const oa = s + d * (1 - s);
    for (let c = 0; c < 3; c++) {
      dst[i + c] = Math.round((src[i + c] * s + dst[i + c] * d * (1 - s)) / oa);
    }
    dst[i + 3] = Math.round(oa * 255);
  }
  return dst;
}

/**
 * Compose the 37x37 AZombie.
 * @param {Object} layers - { skeleton: Uint8Array, skin: Uint8Array, slots: { 'BODY:1': Uint8Array, ... } }
 *                          each a 37*37*4 straight-alpha RGBA buffer
 * @param {Object} z      - parsed zombie data { mask, traits, variant }
 * @returns {Uint8Array}  - 37*37*4 RGBA
 */
export function composeZombie(layers, z, spec = loadZombieSpec()) {
  const out = new Uint8Array(ZOMBIE_GRID * ZOMBIE_GRID * 4);
  if (layers.skeleton) compositeOver(out, layers.skeleton);
  if (z.variant !== 1 && layers.skin) {
    compositeOver(out, layers.skin, decodeMask(z.mask));
  }
  for (const s of resolveSlotOptions(z.traits, spec)) {
    if (!s.option) continue;
    const layer = layers.slots?.[`${s.slot}:${s.value}`];
    if (layer) compositeOver(out, layer);
  }
  return out;
}

/**
 * Integer nearest-neighbour upscale onto an opaque background canvas.
 * scale = floor(canvas / 37) (27 -> 999px), centred.
 */
export function upscaleOnBackground(src, canvas = ZOMBIE_CANVAS, bg = ZOMBIE_BG) {
  const scale = Math.floor(canvas / ZOMBIE_GRID);
  const off = Math.floor((canvas - ZOMBIE_GRID * scale) / 2);
  const out = new Uint8Array(canvas * canvas * 4);
  for (let i = 0; i < out.length; i += 4) {
    out[i] = bg[0]; out[i + 1] = bg[1]; out[i + 2] = bg[2]; out[i + 3] = 255;
  }
  // flatten each source pixel over bg once, then fill its block
  for (let y = 0; y < ZOMBIE_GRID; y++) {
    for (let x = 0; x < ZOMBIE_GRID; x++) {
      const si = (y * ZOMBIE_GRID + x) * 4;
      const a = src[si + 3] / 255;
      if (a === 0) continue;
      const r = Math.round(src[si] * a + bg[0] * (1 - a));
      const g = Math.round(src[si + 1] * a + bg[1] * (1 - a));
      const b = Math.round(src[si + 2] * a + bg[2] * (1 - a));
      for (let dy = 0; dy < scale; dy++) {
        let o = ((off + y * scale + dy) * canvas + off + x * scale) * 4;
        for (let dx = 0; dx < scale; dx++, o += 4) {
          out[o] = r; out[o + 1] = g; out[o + 2] = b; out[o + 3] = 255;
        }
      }
    }
  }
  return { data: out, width: canvas, height: canvas, scale, offset: off };
}

// ===== METADATA =====

/**
 * OpenSea metadata for an AZombie token.
 * @param {number|string} tokenId
 * @param {Object} z - parsed zombie data
 * @param {string} baseUrl
 */
export function buildZombieMetadata(tokenId, z, baseUrl, spec = loadZombieSpec()) {
  const image = `${baseUrl}/api/render/${tokenId}.png?v=${zombieDnaVersion(z)}`;
  const slotAttrs = resolveSlotOptions(z.traits, spec).map(s => ({
    trait_type: s.slot,
    value: s.option ? s.option.name : (s.value ? `Unknown (${s.value})` : 'None'),
  }));
  const { percent } = skinErasedStats(z.mask, spec);
  return {
    // Numbered like the rest of the AdrianZERO collection (tokenId), as GumballZERO does.
    name: `Zombie #${tokenId}`,
    description: ZOMBIE_DESCRIPTION,
    image,
    external_url: 'https://adrianzero.com/',
    metadata_version: '2',
    attributes: [
      { trait_type: 'Generation', value: 'Zombie' },
      { trait_type: 'Type', value: z.variant === 1 ? 'Zombie0' : 'Zombie' },
      ...slotAttrs,
      { trait_type: 'Skin Erased', value: `${percent}%` },
    ],
  };
}
