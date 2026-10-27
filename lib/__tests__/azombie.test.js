// AZombie — mask/traits decoding, metadata and composition. Synthetic data, no network.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import os from 'os';
import path from 'path';
import {
  ZOMBIE_GRID, ZOMBIE_MASK_BYTES, ZOMBIE_BG,
  normaliseMask, decodeMask, bitAt, decodeTraits, encodeTraits,
  skinErasedStats, parseZombieData, composeZombie, compositeOver,
  upscaleOnBackground, buildZombieMetadata, parseZombieResults,
} from '../v2/zombie/zombie-core.js';
// zombie-core is dependency-free (the Forja `unit` job runs without node_modules);
// the PNG pipeline test below needs sharp and is skipped when it is not installed.
let sharp = null;
let renderZombieRaw = null;
try {
  sharp = (await import('sharp')).default;
  ({ renderZombieRaw } = await import('../v2/zombie/zombie-render.js'));
} catch { /* no node_modules */ }

const N = ZOMBIE_GRID * ZOMBIE_GRID;

// Minimal synthetic spec: skin = left half of the grid; one option per slot.
function syntheticSpec() {
  const skin = Buffer.alloc(ZOMBIE_MASK_BYTES);
  for (let y = 0; y < ZOMBIE_GRID; y++) for (let x = 0; x < 18; x++) {
    const i = y * ZOMBIE_GRID + x; skin[i >> 3] |= 0x80 >> (i & 7);
  }
  return {
    skinBitmapHex: skin.toString('hex'),
    slots: ['BODY', 'MOUTH', 'EYES', 'HEAD', 'WEAPON'].map((name, k) => ({
      slot: k, name,
      options: [{ value: 1, name: `${name} One`, file: `${name.toLowerCase()}-1.png` },
                { value: 2, name: `${name} Two`, file: `${name.toLowerCase()}-2.png` }],
    })),
  };
}

function setBit(buf, x, y) { const i = y * ZOMBIE_GRID + x; buf[i >> 3] |= 0x80 >> (i & 7); }

// deterministic pseudo-random layer: binary alpha + a few semi-transparent pixels
function layer(seed, coverage = 0.5) {
  const a = new Uint8Array(N * 4);
  let s = seed >>> 0;
  const rnd = () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 2 ** 32);
  for (let p = 0; p < N; p++) {
    if (rnd() < coverage) {
      a[p * 4] = (rnd() * 256) | 0; a[p * 4 + 1] = (rnd() * 256) | 0; a[p * 4 + 2] = (rnd() * 256) | 0;
      a[p * 4 + 3] = rnd() < 0.1 ? 128 : 255;
    }
  }
  return a;
}

test('mask: bit i = y*37+x, byte = i>>3, bit = 0x80>>(i&7)', () => {
  const m = Buffer.alloc(ZOMBIE_MASK_BYTES);
  setBit(m, 0, 0);    // i=0   -> byte 0, 0x80
  setBit(m, 7, 0);    // i=7   -> byte 0, 0x01
  setBit(m, 1, 1);    // i=38  -> byte 4, 0x02
  setBit(m, 36, 36);  // i=1368 -> byte 171, 0x80
  assert.equal(m[0], 0x81);
  assert.equal(m[4], 0x02);
  assert.equal(m[171], 0x80);
  const d = decodeMask('0x' + m.toString('hex'));
  assert.equal(d.length, N);
  assert.deepEqual([...d.keys()].filter(i => d[i]), [0, 7, 38, 1368]);
  assert.ok(bitAt(m, 36, 36) && !bitAt(m, 35, 36));
  // short / long masks are normalised to 172 bytes
  assert.equal(normaliseMask('0x80').length, ZOMBIE_MASK_BYTES);
  assert.equal(decodeMask('0x80')[0], 1);
  assert.equal(normaliseMask(Buffer.alloc(200, 0xff)).length, ZOMBIE_MASK_BYTES);
});

test('traits uint40: slot k = (traits >> 8k) & 0xff, 0 = none', () => {
  assert.deepEqual(decodeTraits(0), [0, 0, 0, 0, 0]);
  const t = encodeTraits([7, 2, 1, 4, 3]);
  assert.equal(t, 0x0304010207n);
  assert.deepEqual(decodeTraits(t), [7, 2, 1, 4, 3]);
  assert.deepEqual(decodeTraits('1099511627775'), [255, 255, 255, 255, 255]); // 2^40-1
  assert.deepEqual(decodeTraits(0x0100000000n), [0, 0, 0, 0, 1]); // WEAPON only
});

test('parse zombieGetData result + facet-missing (revert) means not a zombie', () => {
  const z = parseZombieData(['0x' + 'ff'.repeat(172), 0x0102, 1, { toString: () => '41' }]);
  assert.equal(z.variant, 1); assert.equal(z.index, 41); assert.equal(z.traits, 0x0102n);
  assert.equal(z.mask.length, 172);
  assert.deepEqual(parseZombieResults({ success: false, data: null }, { success: false, data: null }),
    { minted: false, zombie: null });
  assert.deepEqual(parseZombieResults({ success: true, data: [false] }, null), { minted: false, zombie: null });
  const r = parseZombieResults({ success: true, data: [true] }, { success: true, data: ['0x', 0, 0, 0] });
  assert.equal(r.minted, true); assert.equal(r.zombie.index, 0);
  assert.deepEqual(parseZombieResults({ success: true, data: [true] }, { success: false }), { minted: true, zombie: null });
});

test('skin erased % and metadata', () => {
  const spec = syntheticSpec();
  const skinPixels = 18 * 37; // 666
  const m = Buffer.alloc(ZOMBIE_MASK_BYTES);
  for (let y = 0; y < 37; y++) for (let x = 0; x < 9; x++) setBit(m, x, y); // 333 = 50 %
  assert.deepEqual(skinErasedStats(m, spec), { erased: 333, total: skinPixels, percent: 50 });
  const md = buildZombieMetadata(1500, { mask: m, traits: encodeTraits([2, 0, 1, 0, 9]), variant: 1, index: 4 }, 'https://lab.example', spec);
  assert.equal(md.name, 'AZombie #5');
  assert.equal(md.description, 'Built by hand in the AZombie lab. BE REAL | BE ADRIAN | AZombie by HalfxTiger');
  assert.match(md.image, /^https:\/\/lab\.example\/api\/render\/1500\.png\?v=[0-9a-f]{8}$/);
  assert.deepEqual(md.attributes, [
    { trait_type: 'Generation', value: 'AZombie' },
    { trait_type: 'Type', value: 'Zombie0' },
    { trait_type: 'BODY', value: 'BODY Two' },
    { trait_type: 'MOUTH', value: 'None' },
    { trait_type: 'EYES', value: 'EYES One' },
    { trait_type: 'HEAD', value: 'None' },
    { trait_type: 'WEAPON', value: 'Unknown (9)' },
    { trait_type: 'Skin Erased', value: '50%' },
  ]);
  assert.equal(buildZombieMetadata(1, { mask: Buffer.alloc(172), traits: 0n, variant: 0, index: 0 }, '', spec)
    .attributes[1].value, 'Zombie');
});

test('compose: mask = 0 and traits = 0 -> exactly skin over skeleton', () => {
  const spec = syntheticSpec();
  const skeleton = layer(1, 0.7);
  const skin = layer(2, 0.5);
  const slots = { 'BODY:1': layer(3), 'HEAD:2': layer(4) }; // present but not selected
  const z = { mask: Buffer.alloc(ZOMBIE_MASK_BYTES), traits: 0n, variant: 0, index: 0 };
  const got = composeZombie({ skeleton, skin, slots }, z, spec);
  // independent reference: canvas-free "source-over" with binary alpha, then semi pixels
  for (let p = 0; p < N; p++) {
    const i = p * 4;
    const s = skin.subarray(i, i + 4), k = skeleton.subarray(i, i + 4), g = [...got.subarray(i, i + 4)];
    if (s[3] === 255) assert.deepEqual(g, [...s], `px ${p}`);
    else if (s[3] === 0) assert.deepEqual(g, [...k], `px ${p}`);
    else {
      const ref = compositeOver(Uint8Array.from(k), Uint8Array.from(s));
      assert.deepEqual(g, [...ref], `px ${p}`);
    }
  }
  // erasing everything / Zombie0 -> skeleton only
  const full = { ...z, mask: Buffer.alloc(ZOMBIE_MASK_BYTES, 0xff) };
  assert.deepEqual(composeZombie({ skeleton, skin, slots }, full, spec), Uint8Array.from(skeleton));
  assert.deepEqual(composeZombie({ skeleton, skin, slots }, { ...z, variant: 1 }, spec), Uint8Array.from(skeleton));
  // masked pixel shows skeleton, unmasked keeps skin
  const m = Buffer.alloc(ZOMBIE_MASK_BYTES); setBit(m, 3, 5);
  const one = composeZombie({ skeleton: Uint8Array.from(new Uint8Array(N * 4).fill(10)), skin: Uint8Array.from(new Uint8Array(N * 4).fill(255)), slots }, { ...z, mask: m }, spec);
  assert.deepEqual([...one.subarray((5 * 37 + 3) * 4, (5 * 37 + 3) * 4 + 4)], [10, 10, 10, 10]);
  assert.deepEqual([...one.subarray(0, 4)], [255, 255, 255, 255]);
  // trait order: later slots paint over earlier ones
  const red = new Uint8Array(N * 4); const blue = new Uint8Array(N * 4);
  for (let i = 0; i < N * 4; i += 4) { red[i] = 255; red[i + 3] = 255; blue[i + 2] = 255; blue[i + 3] = 255; }
  const o = composeZombie({ skeleton, skin, slots: { 'BODY:1': blue, 'WEAPON:1': red } }, { ...z, traits: encodeTraits([1, 0, 0, 0, 1]) }, spec);
  assert.deepEqual([...o.subarray(0, 4)], [255, 0, 0, 255]);
});

test('upscale: 37 -> 1000 with integer scale 27, nearest-neighbour blocks over the arcade background', () => {
  const small = layer(21, 0.6);
  const out = upscaleOnBackground(small);
  assert.equal(out.width, 1000); assert.equal(out.scale, 27); assert.equal(out.offset, 0);
  const px = (x, y) => [...out.data.subarray((y * 1000 + x) * 4, (y * 1000 + x) * 4 + 4)];
  for (let p = 0; p < N; p++) {
    const x = p % 37, y = (p / 37) | 0, a = small[p * 4 + 3] / 255;
    const exp = a === 0 ? ZOMBIE_BG
      : [0, 1, 2].map(c => Math.round(small[p * 4 + c] * a + ZOMBIE_BG[c] * (1 - a))).concat(255);
    assert.deepEqual(px(x * 27, y * 27), exp);
    assert.deepEqual(px(x * 27 + 26, y * 27 + 26), exp);
  }
  assert.deepEqual(px(999, 999), ZOMBIE_BG); // 1 px strip outside 37*27 = 999
});

test('render pipeline (PNG files -> 1000x1000, integer nearest-neighbour) equals upscaled skin over skeleton', { skip: !sharp && 'sharp not installed' }, async () => {
  const spec = syntheticSpec();
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'azombie-'));
  const skeleton = layer(11, 0.8);
  const skin = layer(12, 0.5);
  const toPng = (a, f) => sharp(Buffer.from(a), { raw: { width: 37, height: 37, channels: 4 } }).png().toFile(path.join(dir, f));
  await toPng(skeleton, 'skeleton.png');
  await toPng(skin, 'skin.png');
  const z = { mask: Buffer.alloc(ZOMBIE_MASK_BYTES), traits: 0n, variant: 0, index: 0 };
  const out = await renderZombieRaw(z, { layerDir: dir, spec });
  assert.equal(out.width, 1000); assert.equal(out.height, 1000);
  assert.equal(out.scale, 27); assert.equal(out.offset, 0);
  const ref = upscaleOnBackground(compositeOver(Uint8Array.from(skeleton), Uint8Array.from(skin)));
  assert.ok(Buffer.from(out.data).equals(Buffer.from(ref.data)));
  // spot-check the block structure and the background strip (999..1000)
  const px = (x, y) => [...out.data.subarray((y * 1000 + x) * 4, (y * 1000 + x) * 4 + 4)];
  assert.deepEqual(px(999, 500), ZOMBIE_BG);
  assert.deepEqual(px(27 * 5, 27 * 7), px(27 * 5 + 26, 27 * 7 + 26));
  fs.rmSync(dir, { recursive: true, force: true });
});
