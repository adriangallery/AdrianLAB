#!/usr/bin/env node
// Generador de grids de ZERO (AdrianLAB) para promo en redes.
// Reutiliza los builders del repo: renders públicos de /api/render, resvg para
// el logo y text-to-svg con la fuente ADRIAN_ZERO para el título; sharp compone.
// No necesita claves ni servicios del mini: baja los renders por HTTP y los
// guarda en caché local. Uso: ver scripts/zero-grid/README.md

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import sharp from 'sharp';
import { Resvg } from '@resvg/resvg-js';
import TextToSVG from 'text-to-svg';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../..');

const RENDER_BASE = process.env.ZERO_RENDER_BASE || 'https://lab.adrianzero.com/api/render';
const META_BASE = process.env.ZERO_META_BASE || 'https://lab.adrianzero.com/api/metadata';
const RPC = process.env.ZERO_RPC || 'https://mainnet.base.org';
const CORE = '0x6E369BF0E4e0c106192D606FB6d85836d684DA75'; // AdrianLabCore (Base)
const CACHE = process.env.ZERO_GRID_CACHE || '/var/tmp/zero-grid/cache';

// Paleta de ZERO (zero-diamond/frontend/src/app/globals.css)
const C = { acid: '#EDFF00', black: '#000000', white: '#FFFFFF', grayDark: '#333333', grayMid: '#666666' };
const THEMES = {
  dark: { bg: C.black, gap: C.black, text: C.acid, sub: C.grayMid, logoTile: C.acid, logoInk: C.black },
  acid: { bg: C.acid, gap: C.acid, text: C.black, sub: C.grayDark, logoTile: C.black, logoInk: C.acid },
};
const FORMATS = {
  square: { w: 1080, h: 1080, grid: '4x4' },
  portrait: { w: 1080, h: 1350, grid: '4x4' },
  x: { w: 1200, h: 675, grid: '6x3' },
};

// ---------- argumentos ----------
function parseArgs(argv) {
  const a = { format: 'square', theme: 'dark', logos: null, title: '', subtitle: '', seed: Date.now() };
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i];
    const v = () => argv[++i];
    if (k === '--ids') a.ids = v();
    else if (k === '--random') a.random = true;
    else if (k === '--latest') a.latest = true;
    else if (k === '--grid') a.grid = v();
    else if (k === '--format') a.format = v();
    else if (k === '--theme') a.theme = v();
    else if (k === '--logos') a.logos = parseInt(v(), 10);
    else if (k === '--title') a.title = v();
    else if (k === '--subtitle') a.subtitle = v();
    else if (k === '--all') a.all = true;
    else if (k === '--seed') a.seed = parseInt(v(), 10);
    else if (k === '--out') a.out = v();
    else if (k === '-h' || k === '--help') a.help = true;
    else throw new Error(`Argumento desconocido: ${k}`);
  }
  return a;
}

const HELP = `Uso: node scripts/zero-grid/zero-grid.mjs [origen] [opciones]
Origen (uno):  --ids 12,57,300-310 | --random (por defecto) | --latest
Opciones:      --grid 4x4 (o 3, 4, 5…)  --format square|portrait|x
               --title "TEXTO"  --subtitle "texto"  --theme dark|acid
               --logos N (casillas con el logo; por defecto ~1/4)  --seed N  --out ruta.png
               --all (con --random/--latest incluye también los ZERO «desnudos», sin traits)`;

// ---------- utilidades ----------
function mulberry32(seed) {
  let t = seed >>> 0;
  return () => {
    t = (t + 0x6d2b79f5) >>> 0;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}
function shuffle(arr, rnd) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
function parseIds(s) {
  const out = [];
  for (const part of s.split(',').map((x) => x.trim()).filter(Boolean)) {
    const m = part.match(/^(\d+)-(\d+)$/);
    if (m) for (let i = +m[1]; i <= +m[2]; i++) out.push(i);
    else out.push(parseInt(part, 10));
  }
  return out.filter((n) => Number.isFinite(n));
}

async function totalSupply() {
  const res = await fetch(RPC, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_call', params: [{ to: CORE, data: '0x18160ddd' }, 'latest'] }),
  });
  const j = await res.json();
  if (!j.result) throw new Error(`totalSupply falló: ${JSON.stringify(j.error || j)}`);
  return parseInt(j.result, 16);
}

async function fetchRender(id) {
  fs.mkdirSync(CACHE, { recursive: true });
  const file = path.join(CACHE, `${id}.png`);
  if (fs.existsSync(file) && fs.statSync(file).size > 0) return fs.readFileSync(file);
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(`${RENDER_BASE}/${id}`, { signal: AbortSignal.timeout(60000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const buf = Buffer.from(await res.arrayBuffer());
      fs.writeFileSync(file, buf);
      return buf;
    } catch (e) {
      if (attempt === 3) throw new Error(`render ${id}: ${e.message}`);
      await new Promise((r) => setTimeout(r, 1500 * attempt));
    }
  }
}

// Un ZERO «vestido» tiene algún trait más allá de los de base (los recién
// minteados o sin equipar salen desnudos y lucen poco en un grid de promo).
const BASE_TRAITS = /^(Generation|DupGeneration|Skin|Mutation Level|Mutation Type|Mutation Stage|UsedSerum)$/;
async function isDressed(id) {
  const file = path.join(CACHE, `${id}.json`);
  let meta;
  if (fs.existsSync(file)) meta = JSON.parse(fs.readFileSync(file, 'utf8'));
  else {
    try {
      const res = await fetch(`${META_BASE}/${id}`, { signal: AbortSignal.timeout(30000) });
      if (!res.ok) return false;
      meta = await res.json();
      fs.mkdirSync(CACHE, { recursive: true });
      fs.writeFileSync(file, JSON.stringify(meta));
    } catch { return false; }
  }
  return (meta.attributes || []).some((t) => !BASE_TRAITS.test(t.trait_type));
}
async function pickDressed(candidates, n) {
  const out = [];
  for (let i = 0; i < candidates.length && out.length < n && i < 600; i += 8) {
    const batch = candidates.slice(i, i + 8);
    const ok = await Promise.all(batch.map(isDressed));
    batch.forEach((id, j) => ok[j] && out.push(id));
  }
  return out.slice(0, n);
}

// Coloca las casillas del logo repartidas (sin tocarse en horizontal/vertical si cabe).
function logoPositions(cols, rows, n, rnd) {
  const cells = shuffle([...Array(cols * rows).keys()], rnd);
  const chosen = [];
  const touches = (a, b) => Math.abs((a % cols) - (b % cols)) + Math.abs(Math.floor(a / cols) - Math.floor(b / cols)) <= 1;
  for (const c of cells) if (chosen.length < n && !chosen.some((x) => touches(x, c))) chosen.push(c);
  for (const c of cells) if (chosen.length < n && !chosen.includes(c)) chosen.push(c);
  return new Set(chosen);
}

// ---------- builders de SVG ----------
const tts = TextToSVG.loadSync(path.join(ROOT, 'public/fonts/ADRIAN_ZERO.otf'));
const WORDMARK = fs.readFileSync(path.join(__dirname, 'zero-wordmark.svg'), 'utf8');

function wordmarkPng(width, color) {
  const svg = WORDMARK.replace(/#EDFF00/gi, color);
  return new Resvg(svg, { fitTo: { mode: 'width', value: Math.round(width) } }).render().asPng();
}

function textSvg(text, { fontSize, color, maxWidth }) {
  let size = fontSize;
  while (size > 12 && tts.getMetrics(text, { fontSize: size }).width > maxWidth) size -= 2;
  const m = tts.getMetrics(text, { fontSize: size });
  const d = tts.getD(text, { x: 0, y: 0, fontSize: size, anchor: 'left top' });
  const w = Math.ceil(m.width), h = Math.ceil(m.height);
  return { svg: Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><path d="${d}" fill="${color}"/></svg>`), w, h };
}

// ---------- principal ----------
async function main() {
  const a = parseArgs(process.argv.slice(2));
  if (a.help) return console.log(HELP);
  const fmt = FORMATS[a.format];
  if (!fmt) throw new Error(`Formato desconocido: ${a.format} (square|portrait|x)`);
  const th = THEMES[a.theme];
  if (!th) throw new Error(`Tema desconocido: ${a.theme} (dark|acid)`);
  const g = String(a.grid || fmt.grid);
  const [cols, rows] = g.includes('x') ? g.split('x').map(Number) : [Number(g), Number(g)];
  if (!(cols > 0 && rows > 0)) throw new Error(`Grid no válido: ${g}`);
  const cellsTotal = cols * rows;
  const rnd = mulberry32(a.seed);
  const nLogos = Math.min(cellsTotal - 1, a.logos ?? Math.round(cellsTotal / 4));
  const nTokens = cellsTotal - nLogos;

  // Origen de IDs
  let ids;
  if (a.ids) ids = parseIds(a.ids);
  else {
    const supply = await totalSupply();
    const all = [...Array(supply).keys()].map((i) => i + 1);
    const cand = a.latest ? all.slice(1).reverse() : shuffle(all.slice(1), rnd); // #1 = token de prueba
    ids = a.all ? cand : await pickDressed(cand, nTokens);
  }
  ids = ids.slice(0, nTokens);
  if (ids.length < nTokens) console.warn(`Aviso: ${ids.length} IDs para ${nTokens} casillas; el resto, logo.`);

  // Maquetación: cabecera arriba (logo + título), grid debajo, pie con subtítulo.
  const { w: W, h: H } = fmt;
  const pad = Math.round(Math.min(W, H) * 0.045);
  const hasHeader = a.format !== 'square' || a.title;
  const headerH = hasHeader ? Math.round(H * (a.format === 'x' ? 0.14 : 0.13)) : 0;
  const footerH = a.subtitle ? Math.round(H * 0.06) : 0;
  const availW = W - 2 * pad;
  const availH = H - 2 * pad - headerH - footerH;
  const gapRatio = 0.045;
  const tile = Math.floor(Math.min(availW / (cols + (cols - 1) * gapRatio), availH / (rows + (rows - 1) * gapRatio)));
  const gap = Math.max(4, Math.round(tile * gapRatio));
  const gridW = cols * tile + (cols - 1) * gap;
  const gridH = rows * tile + (rows - 1) * gap;
  const gx = Math.round((W - gridW) / 2);
  const gy = pad + headerH + Math.round((availH - gridH) / 2);

  const layers = [];

  // Cabecera
  if (hasHeader) {
    const wmW = Math.round(headerH * 0.62 * (278 / 99));
    const wm = wordmarkPng(wmW, th.text);
    const wmMeta = await sharp(wm).metadata();
    const hy = pad + Math.round((headerH - wmMeta.height) / 2) - Math.round(headerH * 0.08);
    if (a.title) {
      layers.push({ input: wm, left: gx, top: hy });
      const t = textSvg(a.title, { fontSize: Math.round(headerH * 0.5), color: th.text, maxWidth: gridW - wmW - pad });
      layers.push({ input: t.svg, left: gx + gridW - t.w, top: hy + Math.round((wmMeta.height - t.h) / 2) });
    } else {
      layers.push({ input: wm, left: Math.round((W - wmMeta.width) / 2), top: hy });
    }
  }
  if (a.subtitle) {
    const t = textSvg(a.subtitle, { fontSize: Math.round(footerH * 0.55), color: th.sub, maxWidth: gridW });
    layers.push({ input: t.svg, left: Math.round((W - t.w) / 2), top: gy + gridH + Math.round((footerH - t.h) / 2) + Math.round(pad * 0.3) });
  }

  // Casillas
  const logos = logoPositions(cols, rows, cellsTotal - ids.length, rnd);
  const logoTile = await sharp({ create: { width: tile, height: tile, channels: 4, background: th.logoTile } })
    .composite([{ input: wordmarkPng(tile * 0.62, th.logoInk), gravity: 'center' }])
    .png()
    .toBuffer();
  const renders = await Promise.all(ids.map(async (id) => {
    const buf = await fetchRender(id);
    return sharp(buf).resize(tile, tile, { kernel: 'nearest' }).png().toBuffer();
  }));
  let k = 0;
  const grid = [];
  for (let i = 0; i < cellsTotal; i++) {
    const left = (i % cols) * (tile + gap);
    const top = Math.floor(i / cols) * (tile + gap);
    grid.push({ input: logos.has(i) ? logoTile : renders[k++], left, top });
  }
  const radius = Math.round(tile * 0.09);
  const mask = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${gridW}" height="${gridH}"><rect width="${gridW}" height="${gridH}" rx="${radius}" ry="${radius}" fill="#fff"/></svg>`);
  const gridPng = await sharp({ create: { width: gridW, height: gridH, channels: 4, background: th.gap } })
    .composite([...grid, { input: mask, blend: 'dest-in' }])
    .png()
    .toBuffer();
  layers.unshift({ input: gridPng, left: gx, top: gy });

  const out = a.out || `/var/tmp/zero-grid/zero-grid-${a.format}-${cols}x${rows}-${Date.now()}.png`;
  fs.mkdirSync(path.dirname(path.resolve(out)), { recursive: true });
  await sharp({ create: { width: W, height: H, channels: 4, background: th.bg } }).composite(layers).png().toFile(out);
  console.log(`OK ${out} (${W}×${H}, ${cols}×${rows}, IDs: ${ids.join(',')})`);
}

main().catch((e) => {
  console.error(`Error: ${e.message}`);
  process.exit(1);
});
