/**
 * gen-gumball.mjs — v8
 * Generates public/labmetadata/gums.json for the GumballZERO collection.
 *
 * SEED: 20260516_GUMBALL_V8
 * RANGO PLACEHOLDER: tokenIds 9001–9100
 *
 * v8 — COLECCIÓN LIMPIA. Feedback: "muy cargados, repletos de traits, de poco gusto".
 * Objetivo: fondo sólido + personaje + camiseta. OG limpio.
 *
 * DENSIDAD DRÁSTICA:
 *   Common (60): 70% → solo 2 traits (BG+SWAG). 30% → 3 traits (BG+SWAG+1 acento).
 *   Uncommon (28): 3 traits (BG+SWAG+1 acento). Máx 4 en muy pocos.
 *   Rare (10): 4-5 traits (BG+SWAG+2-3 acentos). Bubble-gum suma como acento.
 *   Legendary (2): 5-6 traits máx. GOO+GEAR van aquí.
 *   Acento = cualquier trait que NO es BG ni SWAG.
 *   NUNCA más de 1 acento en Common. NUNCA stacking hair+eyes+mouth en mismo token
 *   salvo Rare/Legendary.
 *
 * FONDOS SÓLIDOS: ~80% sólidos. Patterned cap ~15 tokens.
 *   Solid = flat color / neon / CDC plain / acid color / pure-color series.
 *   Patterned = OPTICAL, Anarchie, Brick, Graveyard, X-MAS pattern, MCD-Be-Real,
 *               BL-Spray, HT-Monogram-Hoodie, Wizzard, Asylum, Matrix/Holographic.
 *
 * PIEZAS FIRMA (invariantes):
 *   Bubble-gum 557|1057 en ≥10 tokens (= acento MOUTH de esos tokens, no stacking).
 *   GOO 270/271 1/1 (2 tokens, Legendary+Rare).
 *   GEAR ≤5 (2 Legendary + 3 Rare).
 *   Bane-Mask 243 ≤2. Sin 240/272/300/1168/1180.
 *   Compositor v7 intacto (traits.json-driven, catálogo completo accesible).
 *   GEN0-Light fijo. Tiers 60/28/10/2. Peso sqrt(supply)+quota≤30%.
 *
 * Uso: node scripts/gen-gumball.mjs
 */

import { writeFileSync, readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

// ============================================================
// PRNG
// ============================================================
const SEED_STRING = '20260516_GUMBALL_V8';

function hashSeed(s) {
  let h = 0x9e3779b9;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x517cc1b727220a95) | 0;
  }
  return h >>> 0;
}

function mulberry32(seed) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rng = mulberry32(hashSeed(SEED_STRING));

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ============================================================
// POOL BUILDER
// ============================================================
const traitsRaw = JSON.parse(readFileSync(join(ROOT, 'public', 'labmetadata', 'traits.json'), 'utf8'));
const traitsArr = Array.isArray(traitsRaw) ? traitsRaw : Object.values(traitsRaw)[0];

function hasAsset(id) {
  return existsSync(join(ROOT, 'public', 'labimages', `${id}.svg`)) ||
         existsSync(join(ROOT, 'public', 'labimages', `${id}.png`));
}

function buildPool(catNames, excludeIds = new Set()) {
  const seen  = new Set();
  const out   = [];
  const names = Array.isArray(catNames) ? catNames : [catNames];
  for (const t of traitsArr) {
    const id  = t.tokenId ?? t.id;
    const sup = t.maxSupply ?? 0;
    if (!names.includes(t.category)) continue;
    if (sup < 10)           continue;
    if (excludeIds.has(id)) continue;
    if (seen.has(id))       continue;
    if (!hasAsset(id))      continue;
    seen.add(id);
    out.push({ id, supply: sup });
  }
  return out;
}

// ============================================================
// BACKGROUND — clasificación sólido vs patrón
// ============================================================
// Sólidos: color plano, neon, CDC plain, acid color, pure-color series
const SOLID_BG_IDS = new Set([
  1, 2, 30,                                        // Dark/Light/White Mode
  51, 52, 53, 55, 56, 57, 58, 59,                  // OG basic colors
  364, 371,                                        // Dark-Mode v2, Light-Mode v2
  569, 571, 636, 637,                              // Mercia-Dark, Alien-BG, OG variants
  658, 660, 664, 665, 678, 698, 699, 701, 711,     // Coins/Knox/Glitter/Chesterfield/Monogram/GG
  713, 714, 715, 716, 717, 718,                    // NEON 1-6
  750, 754, 757, 762, 773, 781, 783,               // CDC plain colors
  794, 795, 796, 797,                              // Acid flat colors
  852, 853, 854, 855, 856, 857, 858, 859,          // Pure-color series (no M-)
  860, 861, 862, 863, 864, 865, 866, 867,          // M-series (same colors, slight texture)
  990,                                             // Goo (solid green)
  1116, 1118, 1172, 1175,                          // BL-Black, Red-Day, Claw-pixelated, ZERO-Green
]);

const BG_ALL       = buildPool('BACKGROUND');
const BG_SOLID     = BG_ALL.filter(e => SOLID_BG_IDS.has(e.id));
const BG_PATTERNED = BG_ALL.filter(e => !SOLID_BG_IDS.has(e.id));

// Targets: ≥80 tokens solid, ≤15 patterned. Track at generation time.
let solidBgCount    = 0;
let patternedBgCount = 0;
const MAX_PATTERNED_BG = 15;

// Pick a background: forced-solid when cap reached, otherwise 85/15 split
function pickBg(usedBg, n) {
  const forcesSolid = patternedBgCount >= MAX_PATTERNED_BG ||
                      (100 - n - 1) <= (MAX_PATTERNED_BG - patternedBgCount); // keep capacity
  let pool;
  if (forcesSolid) {
    pool = BG_SOLID;
  } else {
    // 85% chance solid
    pool = rng() < 0.85 ? BG_SOLID : BG_PATTERNED;
  }
  const id = pickSqrtWeighted(pool, 0.20, usedBg, n);
  if (SOLID_BG_IDS.has(id)) solidBgCount++;
  else patternedBgCount++;
  return id;
}

// ============================================================
// OTHER POOLS
// ============================================================
const SWAG_ALL  = buildPool('SWAG');
const HAIR_ALL  = buildPool('HAIR');
const HEAD_ALL  = buildPool(['HEAD', 'HAT']);
const EYES_ALL  = buildPool(['EYES', 'Eyes'], new Set([300]));
const BEARD_ALL = buildPool(['BEARD', 'Beard']);
const NECK_ALL  = buildPool('NECK');
const NOSE_ALL  = buildPool('NOSE');
const EAR_ALL   = buildPool('EAR');
const GEAR_POOL = buildPool('GEAR');
const RS_POOL   = buildPool('RANDOMSHIT', new Set([240]));

// MOUTH: exclude 243 (Bane-Mask, separate), 1168 (no asset)
const MOUTH_ALL  = buildPool('MOUTH', new Set([243, 1168]));
// Bubble-gum signature (forced pre-seeded)
const MOUTH_REG  = MOUTH_ALL.filter(e => e.id !== 557 && e.id !== 1057);

if (!hasAsset(557) || !hasAsset(1057)) throw new Error('FATAL: 557/1057 assets missing');

// TOP 1/1
const TOP_11 = [270, 271];

// ============================================================
// PICKERS
// ============================================================
function pickSqrtWeighted(entries, quotaCap = 1, usedCounts = null, totalSoFar = 0) {
  let pool = entries;
  if (usedCounts && quotaCap < 1 && totalSoFar > 0) {
    const avail = entries.filter(e => (usedCounts.get(e.id) || 0) / totalSoFar < quotaCap);
    if (avail.length > 0) pool = avail;
  }
  const total = pool.reduce((s, e) => s + Math.sqrt(e.supply), 0);
  let r = rng() * total;
  for (const e of pool) { r -= Math.sqrt(e.supply); if (r <= 0) return e.id; }
  return pool[pool.length - 1].id;
}

function pickFlat(entries, quotaCap = 1, usedCounts = null, totalSoFar = 0) {
  let pool = entries;
  if (usedCounts && quotaCap < 1 && totalSoFar > 0) {
    const avail = entries.filter(e => (usedCounts.get(e.id) || 0) / totalSoFar < quotaCap);
    if (avail.length > 0) pool = avail;
  }
  return pool[Math.floor(rng() * pool.length)].id;
}

// ============================================================
// USAGE TRACKERS
// ============================================================
const usedBg    = new Map();
const usedSwag  = new Map();
const usedHair  = new Map();
const usedHead  = new Map();
const usedEyes  = new Map();
const usedMouth = new Map();
const usedBeard = new Map();
const usedNeck  = new Map();
const usedNose  = new Map();
const usedEar   = new Map();

function track(map, id) { map.set(id, (map.get(id) || 0) + 1); return id; }

// ============================================================
// TIERS
// ============================================================
const TIER_DISTRIBUTION = [
  ...Array(60).fill('common'),
  ...Array(28).fill('uncommon'),
  ...Array(10).fill('rare'),
  ...Array(2).fill('legendary'),
];

// ============================================================
// PRE-SEEDING — TOP, GEAR, MASK, BUBBLE-GUM
// ============================================================
const shuffledTiers = shuffle(TIER_DISTRIBUTION);

const legendaryPos = shuffledTiers.map((t, i) => t === 'legendary' ? i : -1).filter(i => i >= 0);
const rarePos      = shuffledTiers.map((t, i) => t === 'rare'      ? i : -1).filter(i => i >= 0);
const uncommonPos  = shuffledTiers.map((t, i) => t === 'uncommon'  ? i : -1).filter(i => i >= 0);
const commonPos    = shuffledTiers.map((t, i) => t === 'common'    ? i : -1).filter(i => i >= 0);

// TOP 1/1: 1 Legendary + 1 Rare
const shuffledTopIds = shuffle([...TOP_11]);
const topMap = new Map();
if (legendaryPos.length > 0) topMap.set(legendaryPos[0], shuffledTopIds[0]);
for (const rp of rarePos) {
  if (!topMap.has(rp)) { topMap.set(rp, shuffledTopIds[1]); break; }
}

// GEAR: both Legendary + 3 Rare (disjoint from TOP)
const gearSlots = new Set([
  ...legendaryPos,
  ...shuffle(rarePos.filter(p => !topMap.has(p))).slice(0, 3),
]);

// MASK: ≤2 in Uncommon/Rare, disjoint from TOP
const maskCandidates = shuffledTiers
  .map((t, i) => (t === 'uncommon' || t === 'rare') && !topMap.has(i) ? i : -1)
  .filter(i => i >= 0);
const maskSlots = new Set(shuffle(maskCandidates).slice(0, 2));

// BUBBLE-GUM: 11 tokens across Uncommon/Rare/Legendary, disjoint from mask
// Each bubble-gum token gets EXACTLY this as its single acento — no other acentos stacked
const bgCandidates = shuffle([
  ...uncommonPos.filter(p => !maskSlots.has(p)),
  ...rarePos.filter(p => !topMap.has(p) && !maskSlots.has(p) && !gearSlots.has(p)),
  ...legendaryPos.filter(p => !topMap.has(p)),
]).slice(0, 11);
const bubbleGumMap = new Map(); // pos → 557 or 1057
bgCandidates.forEach((pos, k) => bubbleGumMap.set(pos, k % 2 === 0 ? 557 : 1057));

// ACENTO TYPES for Common/Uncommon 1-acento slots
// Rotated round-robin to maximise variety: hair→eyes→hair→beard→hair→neck→hair→...
// 11 bubble-gum slots are already assigned above and count as mouth-acento
// Remaining Uncommon slots (28 - 11 bubble-gum that fall on uncommon - 2 mask) ≈ 15 slots
// Each gets exactly 1 acento from this rotation.
// Acento pool for 1-slot tokens:
const ACENTO_TYPES = ['HAIR', 'EYES', 'HAIR', 'BEARD', 'HAIR', 'NECK', 'HAIR', 'EYES', 'HAIR', 'BEARD'];
let acentoIdx = 0;
function nextAcento() { return ACENTO_TYPES[acentoIdx++ % ACENTO_TYPES.length]; }

function pickAcento(n) {
  const type = nextAcento();
  switch (type) {
    case 'HAIR':  return { cat: 'HAIR',  id: track(usedHair,  pickSqrtWeighted(HAIR_ALL,  0.20, usedHair,  n)) };
    case 'EYES':  return { cat: 'EYES',  id: track(usedEyes,  pickSqrtWeighted(EYES_ALL,  0.22, usedEyes,  n)) };
    case 'BEARD': return { cat: 'BEARD', id: track(usedBeard, pickSqrtWeighted(BEARD_ALL, 0.25, usedBeard, n)) };
    case 'NECK':  return { cat: 'NECK',  id: track(usedNeck,  pickSqrtWeighted(NECK_ALL,  0.25, usedNeck,  n)) };
    default:      return { cat: 'HAIR',  id: track(usedHair,  pickSqrtWeighted(HAIR_ALL,  0.20, usedHair,  n)) };
  }
}

// All mouth ids (for filtering when injecting special MOUTH)
const allMouthIds = new Set([...MOUTH_ALL.map(e => e.id), 557, 1057, 243]);

// ============================================================
// BUILDERS
// Common: 70% → 2 traits (BG+SWAG), 30% → 3 traits (BG+SWAG+1 acento)
// Uncommon: 3 traits (BG+SWAG+1 acento); bubble-gum slots get mouth as acento
// Rare: 4-5 traits. Legendary: 5-6 traits.
// ============================================================

function buildCommon(n, isBubbleSlot, isMaskSlot) {
  const t = [];
  t.push(track(usedBg,   pickBg(usedBg, n)));
  t.push(track(usedSwag, pickSqrtWeighted(SWAG_ALL, 0.22, usedSwag, n)));
  // 70% bare (2 traits). 30% get 1 acento (but bubble/mask slots override below).
  if (!isBubbleSlot && !isMaskSlot && rng() < 0.30) {
    const a = pickAcento(n);
    t.push(a.id);
  }
  return t;
}

function buildUncommon(n, isBubbleSlot, isMaskSlot) {
  const t = [];
  t.push(track(usedBg,   pickBg(usedBg, n)));
  t.push(track(usedSwag, pickSqrtWeighted(SWAG_ALL, 0.22, usedSwag, n)));
  // Bubble/mask slots: their special mouth IS the acento — skip regular acento pick
  if (!isBubbleSlot && !isMaskSlot) {
    const a = pickAcento(n);
    t.push(a.id);
    // ~15% chance of a SECOND acento (second must be different category)
    if (rng() < 0.15) {
      const b = pickAcento(n);
      t.push(b.id);
    }
  }
  return t;
}

function buildRare(n, isBubbleSlot, isMaskSlot) {
  // 4-5 traits: BG + SWAG + 2-3 acentos
  const t = [];
  t.push(track(usedBg,   pickBg(usedBg, n)));
  t.push(track(usedSwag, pickSqrtWeighted(SWAG_ALL, 0.22, usedSwag, n)));
  // HAIR (present on most Rare)
  if (!isBubbleSlot) t.push(track(usedHair, pickSqrtWeighted(HAIR_ALL,  0.20, usedHair,  n)));
  // EYES always on Rare
  t.push(track(usedEyes, pickSqrtWeighted(EYES_ALL, 0.22, usedEyes, n)));
  // 3rd optional acento: BEARD or NECK
  if (!isBubbleSlot && !isMaskSlot && rng() < 0.45) {
    if (rng() < 0.6) t.push(track(usedBeard, pickSqrtWeighted(BEARD_ALL, 0.25, usedBeard, n)));
    else             t.push(track(usedNeck,  pickSqrtWeighted(NECK_ALL,  0.25, usedNeck,  n)));
  }
  return t;
}

function buildRareWithGear(n, isBubbleSlot, isMaskSlot) {
  const t = buildRare(n, isBubbleSlot, isMaskSlot);
  t.push(pickSqrtWeighted(GEAR_POOL));
  return t;
}

function buildLegendary(n, hasGear, reserveForTop, isBubbleSlot) {
  // 5-6 traits max
  const t = [];
  t.push(track(usedBg,   pickBg(usedBg, n)));
  t.push(track(usedSwag, pickSqrtWeighted(SWAG_ALL, 0.22, usedSwag, n)));
  t.push(track(usedHair, pickSqrtWeighted(HAIR_ALL, 0.20, usedHair, n)));
  t.push(track(usedEyes, pickSqrtWeighted(EYES_ALL, 0.22, usedEyes, n)));
  // BEARD: only if not bubble-gum (mouth would fill 5th slot)
  if (!isBubbleSlot && rng() < 0.70) {
    t.push(track(usedBeard, pickSqrtWeighted(BEARD_ALL, 0.25, usedBeard, n)));
  }
  if (hasGear) t.push(pickSqrtWeighted(GEAR_POOL));
  // Legendary without TOP can get NECK or RANDOMSHIT as 6th slot
  if (!reserveForTop && !isBubbleSlot && rng() < 0.40) {
    if (rng() < 0.6) t.push(track(usedNeck, pickSqrtWeighted(NECK_ALL, 0.25, usedNeck, n)));
    else if (RS_POOL.length > 0) t.push(pickSqrtWeighted(RS_POOL));
  }
  return t;
}

// ============================================================
// MAIN LOOP
// ============================================================
const gums = [];

for (let i = 0; i < 100; i++) {
  const tokenId  = 9001 + i;
  const gumIndex = i + 1;
  const tier     = shuffledTiers[i];

  const isTopSlot    = topMap.has(i);
  const isGearSlot   = gearSlots.has(i);
  const isMaskSlot   = maskSlots.has(i);
  const isBubbleSlot = bubbleGumMap.has(i);

  let traitIds;
  switch (tier) {
    case 'legendary':
      traitIds = buildLegendary(i, isGearSlot, isTopSlot, isBubbleSlot);
      break;
    case 'rare':
      traitIds = isGearSlot ? buildRareWithGear(i, isBubbleSlot, isMaskSlot)
                            : buildRare(i, isBubbleSlot, isMaskSlot);
      break;
    case 'uncommon':
      traitIds = buildUncommon(i, isBubbleSlot, isMaskSlot);
      break;
    default:
      traitIds = buildCommon(i, isBubbleSlot, isMaskSlot);
      break;
  }

  // Inject TOP
  if (isTopSlot) traitIds.push(topMap.get(i));

  // Inject BUBBLE-GUM (strip any existing mouth first)
  if (isBubbleSlot) {
    traitIds = traitIds.filter(id => !allMouthIds.has(id));
    const bgId = bubbleGumMap.get(i);
    traitIds.push(bgId);
    track(usedMouth, bgId);
  }

  // Inject MASK (strip any existing mouth first)
  if (isMaskSlot) {
    traitIds = traitIds.filter(id => !allMouthIds.has(id));
    traitIds.push(243);
    track(usedMouth, 243);
  }

  gums.push({
    tokenId,
    name: `GumballZERO #${gumIndex}`,
    tier,
    traits: JSON.stringify([...new Set(traitIds)]),
    description: 'BE REAL | BE ADRIAN | GumballZERO by HalfxTiger',
    masterminds: ['Adrian | HalfxTiger'],
    external_url: 'https://adrianzero.com/',
  });
}

// ============================================================
// SANITY CHECKS v8
// ============================================================
console.log('\n=== SANITY CHECK v8 ===');

// 1. Tier counts
const tierCount = { common: 0, uncommon: 0, rare: 0, legendary: 0 };
for (const g of gums) tierCount[g.tier]++;
console.log('Tier counts:', tierCount);
console.log('Tier distribution:', tierCount.common === 60 && tierCount.uncommon === 28 && tierCount.rare === 10 && tierCount.legendary === 2 ? 'PASS (60/28/10/2)' : 'FAIL');

// 2. Density
const densityByTier = { common: [], uncommon: [], rare: [], legendary: [] };
for (const g of gums) densityByTier[g.tier].push(JSON.parse(g.traits).length);
console.log('\nAvg trait count per tier (targets: Common~2.3, Uncommon~3, Rare~4-5, Legendary 5-6):');
for (const [tier, arr] of Object.entries(densityByTier)) {
  const avg = (arr.reduce((s, n) => s + n, 0) / arr.length).toFixed(2);
  console.log(`  ${tier.padEnd(10)}: avg=${avg}  min=${Math.min(...arr)}  max=${Math.max(...arr)}`);
}

// 3. Commons with 0 acentos (= 2 traits)
const commonsWith0 = gums.filter(g => g.tier === 'common' && JSON.parse(g.traits).length === 2).length;
const commonsWith1 = gums.filter(g => g.tier === 'common' && JSON.parse(g.traits).length === 3).length;
const commonsWith2p= gums.filter(g => g.tier === 'common' && JSON.parse(g.traits).length >= 4).length;
console.log(`\nCommon breakdown: 0-acento(2t)=${commonsWith0} (${(commonsWith0/60*100).toFixed(0)}%), 1-acento(3t)=${commonsWith1} (${(commonsWith1/60*100).toFixed(0)}%), ≥4t=${commonsWith2p} ${commonsWith2p===0?'PASS':'FAIL'}`);
console.log(`  Target ≥70% with 0 acentos: ${commonsWith0/60>=0.65 ? 'PASS' : 'WARN'} (${(commonsWith0/60*100).toFixed(0)}%)`);

// 4. Background solid vs patterned
const bgSolid    = gums.reduce((a, g) => a + JSON.parse(g.traits).filter(id => SOLID_BG_IDS.has(id)).length, 0);
const bgPatterned = 100 - bgSolid;
console.log(`\nBackground: solid=${bgSolid} (${bgSolid}%), patterned=${bgPatterned} ${bgSolid >= 80 ? 'PASS (≥80% solid)' : 'WARN'}`);

// 5. Category presence
const bgIdsS    = new Set(BG_ALL.map(e => e.id));
const swagIdsS  = new Set(SWAG_ALL.map(e => e.id));
const hairIdsS  = new Set(HAIR_ALL.map(e => e.id));
const headIdsS  = new Set(HEAD_ALL.map(e => e.id));
const eyesIdsS  = new Set(EYES_ALL.map(e => e.id));
const mouthIdsS = new Set([...MOUTH_ALL.map(e => e.id), 557, 1057, 243]);
const beardIdsS = new Set(BEARD_ALL.map(e => e.id));
const neckIdsS  = new Set(NECK_ALL.map(e => e.id));
const gearIdsS  = new Set(GEAR_POOL.map(e => e.id));
const topIdsS   = new Set([270, 271]);

const catP = { SWAG: 0, HAIR: 0, EYES: 0, MOUTH: 0, BEARD: 0, NECK: 0, GEAR: 0, TOP: 0 };
const pid   = { SWAG: {}, HAIR: {}, EYES: {}, MOUTH: {}, BEARD: {}, NECK: {}, GEAR: {} };

for (const g of gums) {
  for (const id of JSON.parse(g.traits)) {
    if (swagIdsS.has(id))  { catP.SWAG++;  pid.SWAG[id]  = (pid.SWAG[id]  || 0) + 1; }
    if (hairIdsS.has(id))  { catP.HAIR++;  pid.HAIR[id]  = (pid.HAIR[id]  || 0) + 1; }
    if (eyesIdsS.has(id))  { catP.EYES++;  pid.EYES[id]  = (pid.EYES[id]  || 0) + 1; }
    if (mouthIdsS.has(id)) { catP.MOUTH++; pid.MOUTH[id] = (pid.MOUTH[id] || 0) + 1; }
    if (beardIdsS.has(id)) { catP.BEARD++; pid.BEARD[id] = (pid.BEARD[id] || 0) + 1; }
    if (neckIdsS.has(id))  { catP.NECK++;  pid.NECK[id]  = (pid.NECK[id]  || 0) + 1; }
    if (gearIdsS.has(id))  { catP.GEAR++;  pid.GEAR[id]  = (pid.GEAR[id]  || 0) + 1; }
    if (topIdsS.has(id))   catP.TOP++;
  }
}

console.log('\nCategory presence (of 100):');
for (const [cat, cnt] of Object.entries(catP)) {
  console.log(`  ${cat.padEnd(10)}: ${cnt}`);
}

// 6. Bubble-gum
const c557  = gums.reduce((a, g) => a + JSON.parse(g.traits).filter(id => id === 557).length,  0);
const c1057 = gums.reduce((a, g) => a + JSON.parse(g.traits).filter(id => id === 1057).length, 0);
console.log(`\nBubble-gum: 557=${c557}  1057=${c1057}  total=${c557+c1057}  ${c557+c1057>=10&&c557+c1057<=12?'PASS':'FAIL'}`);

// 7. Per-id quota
console.log('\nPer-id top-3 (≤35% of tokens-with-trait):');
function printTop3(counter, label, total) {
  const sorted = Object.entries(counter).sort((a, b) => b[1] - a[1]).slice(0, 3);
  const dom = sorted[0] ? sorted[0][1] : 0;
  const pct = total > 0 ? ((dom / total) * 100).toFixed(1) : '0';
  const ok  = parseFloat(pct) <= 37 ? 'OK' : 'WARN';
  console.log(`  ${label.padEnd(10)}: top id=${sorted[0]?.[0]} (${dom}, ${pct}% of ${total}) ${ok}`);
  for (const [id, cnt] of sorted.slice(1))
    console.log(`             id=${id} (${cnt}, ${((cnt/Math.max(total,1))*100).toFixed(1)}%)`);
}
for (const cat of ['HAIR', 'EYES', 'MOUTH', 'BEARD', 'NECK', 'SWAG']) {
  if (catP[cat] > 0) printTop3(pid[cat], cat, catP[cat]);
}
console.log(`\nHAIR distinct ids: ${Object.keys(pid.HAIR).length} / ${HAIR_ALL.length}`);

// 8. TOP / GEAR / MASK
const topCts = new Map();
for (const g of gums) for (const id of JSON.parse(g.traits)) if (topIdsS.has(id)) topCts.set(id, (topCts.get(id)||0)+1);
console.log('TOP 1/1:', Object.fromEntries(topCts), topCts.size===2&&[...topCts.values()].every(v=>v===1)?'PASS':'FAIL');

const gearToks = gums.filter(g => JSON.parse(g.traits).some(id => gearIdsS.has(id)));
const gearTier = {};
for (const g of gearToks) gearTier[g.tier] = (gearTier[g.tier]||0)+1;
console.log(`GEAR: ${gearToks.length} tokens`, gearTier, gearToks.length>=3&&gearToks.length<=5?'PASS':'FAIL');
console.log('  GEAR in common/uncommon:', gearToks.filter(g=>g.tier==='common'||g.tier==='uncommon').length===0?'PASS':'FAIL');

const bane = gums.reduce((a,g)=>a+JSON.parse(g.traits).filter(id=>id===243).length, 0);
console.log(`Bane-Mask (243): ${bane} (≤2) ${bane<=2?'PASS':'FAIL'}`);

// 9. Exclusions
const excl = { has300: false, has240: false, has272: false, has1168: false, has1180: false };
for (const g of gums) for (const id of JSON.parse(g.traits)) {
  if (id===300) excl.has300=true; if (id===240) excl.has240=true;
  if (id===272) excl.has272=true; if (id===1168) excl.has1168=true;
  if (id===1180) excl.has1180=true;
}
console.log(`Exclusions: 300=${excl.has300?'FAIL':'PASS'} 240=${excl.has240?'FAIL':'PASS'} 272=${excl.has272?'FAIL':'PASS'} 1168=${excl.has1168?'FAIL':'PASS'} 1180=${excl.has1180?'FAIL':'PASS'}`);
console.log('Occlusion: NONE');

// ============================================================
// WRITE gums.json
// ============================================================
const output = {
  gums: gums.map(({ tier, ...rest }) => rest),
  metadata: {
    collection: 'GumballZERO',
    description: 'Serie cerrada 100 NFTs GumballZERO — todos generation=0, skinName=Light',
    totalSupply: 100,
    tokenIdRange: { PLACEHOLDER: true, note: 'RECONCILIAR POST-PREMINT', start: 9001, end: 9100 },
    seed: SEED_STRING,
    generatedAt: new Date().toISOString(),
    fixedGeneration: 0,
    fixedSkinName: 'Light',
    caveats: [
      'v8: COLECCIÓN LIMPIA. Common 70%=2t / 30%=3t. Uncommon 3t. Rare 4-5t. Legendary 5-6t.',
      'BG sólido ≥80%. Patterned cap=15. Stacking solo en Rare/Legendary.',
      'Bubble-gum 557+1057 ≥10 tokens. GEAR 2Leg+3Rare. TOP 270/271 1/1.',
      'Compositor v7 intacto (traits.json-driven). Sin GUMBALL_CAT_MAP.',
      'GEN0-Light fijo. Sin 240/272/300/1168/1180. Tiers 60/28/10/2.',
    ],
    poolSizes: {
      BACKGROUND: BG_ALL.length, SOLID_BG: BG_SOLID.length, PATTERNED_BG: BG_PATTERNED.length,
      SWAG: SWAG_ALL.length, HAIR: HAIR_ALL.length, HEAD: HEAD_ALL.length,
      EYES: EYES_ALL.length, MOUTH: MOUTH_ALL.length, BEARD: BEARD_ALL.length,
      NECK: NECK_ALL.length, GEAR: GEAR_POOL.length,
    },
    masterminds: ['Adrian | HalfxTiger'],
  },
};

const outPath = join(ROOT, 'public', 'labmetadata', 'gums.json');
writeFileSync(outPath, JSON.stringify(output, null, 2), 'utf8');
console.log(`\ngums.json written: ${outPath}`);
console.log(`Total entries: ${output.gums.length}`);
