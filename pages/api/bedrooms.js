import path from 'path';
import fs from 'fs';
import sharp from 'sharp';
import { Resvg } from '@resvg/resvg-js';

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://adrianlab.vercel.app';
const BEDROOM_SVG_PATH = path.join(process.cwd(), 'public', 'labimages', 'bedrooms', 'bedroom_pixelated_min.svg');
const BEDROOM_PNG_PATH = path.join(process.cwd(), 'public', 'labimages', 'bedrooms', 'bedr.png');
const BEDROOM_WIDTH = 1049.6;
const BEDROOM_HEIGHT = 548.375;
const BEDROOM_ASSET_BASE_LAYERS = [
  'bedrooms/assets/Layer_3_Floor.png',
  'bedrooms/assets/Layer_2.png',
  'bedrooms/assets/Window_1.png',
  'bedrooms/assets/Layer4_Window-Its_Ok.png'
];

let cachedBaseLayers = null;
let cachedFallbackPng = null;
let bedroomWidth = BEDROOM_WIDTH;
let bedroomHeight = BEDROOM_HEIGHT;
const LABIMAGES_ROOT = path.join(process.cwd(), 'public', 'labimages');

async function loadBufferFromUrl(url) {
  const resp = await fetch(url);
  if (!resp.ok) {
    throw new Error(`Fetch failed ${resp.status}: ${resp.statusText}`);
  }
  const arr = await resp.arrayBuffer();
  return Buffer.from(arr);
}

async function loadBedroomBase() {
  if (cachedBaseLayers) {
    return { layers: cachedBaseLayers, width: bedroomWidth, height: bedroomHeight };
  }

  const baseLayers = [];

  for (const file of BEDROOM_ASSET_BASE_LAYERS) {
    try {
      const raw = await loadAsset(file);
      const png = await rasterizeIfSvg(raw);
      const meta = await sharp(png).metadata();
      if (meta.width && meta.height) {
        bedroomWidth = meta.width;
        bedroomHeight = meta.height;
      }
      baseLayers.push({ input: png, left: 0, top: 0 });
    } catch (err) {
      console.warn(`[bedrooms] capa base ${file} no cargó: ${err.message}`);
    }
  }

  if (baseLayers.length > 0) {
    cachedBaseLayers = baseLayers;
    return { layers: cachedBaseLayers, width: bedroomWidth, height: bedroomHeight };
  }

  if (fs.existsSync(BEDROOM_PNG_PATH)) {
    cachedFallbackPng = fs.readFileSync(BEDROOM_PNG_PATH);
    try {
      const meta = await sharp(cachedFallbackPng).metadata();
      if (meta.width && meta.height) {
        bedroomWidth = meta.width;
        bedroomHeight = meta.height;
      }
    } catch (e) {
      console.warn('[bedrooms] metadata PNG no disponible:', e.message);
    }
    cachedBaseLayers = [{ input: cachedFallbackPng, left: 0, top: 0 }];
    return { layers: cachedBaseLayers, width: bedroomWidth, height: bedroomHeight };
  }

  if (!fs.existsSync(BEDROOM_SVG_PATH)) {
    throw new Error('Bedroom base not found');
  }
  const svgContent = fs.readFileSync(BEDROOM_SVG_PATH, 'utf8');
  // Rasterizador manual para evitar límite de nodos: interpreta los <use> y pinta un mapa de píxeles
  const width = Math.round(bedroomWidth);
  const height = Math.round(bedroomHeight);
  const buffer = Buffer.alloc(width * height * 4, 0);

  const regex = /x="([\d.]+)" y="([\d.]+)" fill="rgba\((\d+),(\d+),(\d+),([\d.]+)\)"/g;
  let match;
  while ((match = regex.exec(svgContent)) !== null) {
    const x = Math.round(parseFloat(match[1]));
    const y = Math.round(parseFloat(match[2]));
    if (x < 0 || y < 0 || x >= width || y >= height) continue;
    const r = parseInt(match[3], 10);
    const g = parseInt(match[4], 10);
    const b = parseInt(match[5], 10);
    const a = Math.max(0, Math.min(1, parseFloat(match[6])));
    const idx = (y * width + x) * 4;
    buffer[idx] = r;
    buffer[idx + 1] = g;
    buffer[idx + 2] = b;
    buffer[idx + 3] = Math.round(a * 255);
  }

  const rasterized = await sharp(buffer, {
    raw: { width, height, channels: 4 }
  }).png().toBuffer();

  cachedBaseLayers = [{ input: rasterized, left: 0, top: 0 }];
  return { layers: cachedBaseLayers, width: bedroomWidth, height: bedroomHeight };
}

function parseExtrasParam(extrasParam) {
  if (!extrasParam) return [];
  return extrasParam.split(',').map(item => {
    const [idPart, coords] = item.split('@');
    if (!idPart) return null;
    const [xStr, yStr, scaleStr] = (coords || '').split(',');
    const x = parseFloat(xStr ?? '0') || 0;
    const y = parseFloat(yStr ?? '0') || 0;
    const scale = parseFloat(scaleStr ?? '1') || 1;
    return { id: idPart.trim(), x, y, scale };
  }).filter(Boolean);
}

function tryLoadLocalAsset(candidate) {
  const relPaths = [];
  if (candidate.startsWith('labimages/')) {
    relPaths.push(candidate.replace(/^labimages\//, ''));
  } else if (candidate.startsWith('bedrooms/')) {
    relPaths.push(candidate);
  } else {
    relPaths.push(`bedrooms/assets/${candidate}`, candidate);
  }
  for (const rel of relPaths) {
    const full = path.join(LABIMAGES_ROOT, rel);
    if (fs.existsSync(full)) {
      return fs.readFileSync(full);
    }
  }
  return null;
}

async function loadAsset(id) {
  const hasExt = id.includes('.');
  const candidates = hasExt ? [id] : [`${id}.svg`, `${id}.png`, id];
  let lastError = null;
  for (const candidate of candidates) {
    const local = tryLoadLocalAsset(candidate);
    if (local) return local;

    let url;
    if (candidate.startsWith('http')) {
      url = candidate;
    } else if (candidate.startsWith('labimages/')) {
      url = `${BASE_URL}/${candidate}`;
    } else if (candidate.startsWith('bedrooms/')) {
      url = `${BASE_URL}/labimages/${candidate}`;
    } else {
      url = `${BASE_URL}/labimages/bedrooms/assets/${candidate}`;
    }
    try {
      return await loadBufferFromUrl(url);
    } catch (err) {
      if (!candidate.startsWith('labimages/') && !candidate.startsWith('bedrooms/')) {
        const fallbackUrl = `${BASE_URL}/labimages/${candidate}`;
        try {
          return await loadBufferFromUrl(fallbackUrl);
        } catch (err2) {
          lastError = err2;
          continue;
        }
      }
      lastError = err;
    }
  }
  throw lastError || new Error(`Asset not found: ${id}`);
}

async function rasterizeIfSvg(buffer) {
  // Detect SVG by header
  const header = buffer.subarray(0, 100).toString('utf8').toLowerCase();
  const isSvg = header.includes('<svg');
  if (!isSvg) return buffer;
  return sharp(buffer, { density: 300 }).png().toBuffer();
}

async function loadAdrianZero(tokenId) {
  const url = `${BASE_URL}/api/render/${tokenId}`;
  return loadBufferFromUrl(url);
}

export default async function handler(req, res) {
  try {
    const { tokenId, ax, ay, ascale, extras } = req.query;
    if (!tokenId) {
      return res.status(400).json({ error: 'tokenId requerido' });
    }

    const posX = parseFloat(ax ?? '40') || 40;
    const posY = parseFloat(ay ?? '90') || 90;
    const scale = parseFloat(ascale ?? '0.45') || 0.45;

    // Cargar base bedroom
    const base = await loadBedroomBase();

    // Cargar AdrianZERO
    const adrianBuffer = await loadAdrianZero(tokenId);
    const adrianPng = await rasterizeIfSvg(adrianBuffer);
    const adrianSharp = sharp(adrianPng);
    const adrianMeta = await adrianSharp.metadata();
    const targetWidth = (adrianMeta.width || 1000) * scale;
    const targetHeight = (adrianMeta.height || 1000) * scale;
    const adrianResized = await adrianSharp
      .resize(Math.round(targetWidth), Math.round(targetHeight), { fit: 'contain' })
      .toBuffer();

    // Extras
    const extrasList = parseExtrasParam(extras);
    const extrasBuffers = [];
    for (const ex of extrasList) {
      try {
        const raw = await loadAsset(ex.id);
        const png = await rasterizeIfSvg(raw);
        const meta = await sharp(png).metadata();
        const ew = (meta.width || 100) * (ex.scale ?? 1);
        const eh = (meta.height || 100) * (ex.scale ?? 1);
        const resized = await sharp(png)
          .resize(Math.round(ew), Math.round(eh), { fit: 'contain' })
          .toBuffer();
        extrasBuffers.push({
          input: resized,
          left: Math.round(ex.x || 0),
          top: Math.round(ex.y || 0)
        });
      } catch (err) {
        console.warn(`[bedrooms] extra ${ex.id} skipped: ${err.message}`);
      }
    }

    // Componer
    const layers = [
      ...base.layers,
      { input: adrianResized, left: Math.round(posX), top: Math.round(posY) },
      ...extrasBuffers
    ];

    const finalPng = await sharp({
      create: {
        width: Math.round(bedroomWidth),
        height: Math.round(bedroomHeight),
        channels: 4,
        background: { r: 0, g: 0, b: 0, alpha: 0 }
      }
    })
      .composite(layers)
      .png()
      .toBuffer();

    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Cache-Control', 'public, max-age=60');
    res.setHeader('X-Bedroom-Size', `${Math.round(bedroomWidth)}x${Math.round(bedroomHeight)}`);
    res.setHeader('X-Layers', layers.length.toString());
    return res.status(200).send(finalPng);
  } catch (err) {
    console.error('[bedrooms] error:', err);
    return res.status(500).json({ error: 'Bedroom render failed', details: err.message });
  }
}

