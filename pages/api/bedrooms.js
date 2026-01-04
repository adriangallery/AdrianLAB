import path from 'path';
import fs from 'fs';
import sharp from 'sharp';

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://adrianlab.vercel.app';
const BEDROOM_PATH = path.join(process.cwd(), 'public', 'labimages', 'bedrooms', 'bedroom_pixelated_min.svg');
const BEDROOM_WIDTH = 1049.6;
const BEDROOM_HEIGHT = 548.375;

async function loadBufferFromUrl(url) {
  const resp = await fetch(url);
  if (!resp.ok) {
    throw new Error(`Fetch failed ${resp.status}: ${resp.statusText}`);
  }
  const arr = await resp.arrayBuffer();
  return Buffer.from(arr);
}

async function loadBedroomBase() {
  if (!fs.existsSync(BEDROOM_PATH)) {
    throw new Error('Bedroom base not found');
  }
  const svg = fs.readFileSync(BEDROOM_PATH);
  return sharp(svg, { density: 300 }).png().toBuffer();
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

async function loadAsset(id) {
  const hasExt = id.includes('.');
  const candidates = hasExt ? [id] : [`${id}.svg`, `${id}.png`, id];
  let lastError = null;
  for (const candidate of candidates) {
    const url = `${BASE_URL}/labimages/${candidate}`;
    try {
      return await loadBufferFromUrl(url);
    } catch (err) {
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
    const basePng = await loadBedroomBase();

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
      { input: basePng, left: 0, top: 0 },
      { input: adrianResized, left: Math.round(posX), top: Math.round(posY) },
      ...extrasBuffers
    ];

    const finalPng = await sharp({
      create: {
        width: Math.round(BEDROOM_WIDTH),
        height: Math.round(BEDROOM_HEIGHT),
        channels: 4,
        background: { r: 0, g: 0, b: 0, alpha: 0 }
      }
    })
      .composite(layers)
      .png()
      .toBuffer();

    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Cache-Control', 'public, max-age=60');
    res.setHeader('X-Bedroom-Size', `${BEDROOM_WIDTH}x${BEDROOM_HEIGHT}`);
    res.setHeader('X-Layers', layers.length.toString());
    return res.status(200).send(finalPng);
  } catch (err) {
    console.error('[bedrooms] error:', err);
    return res.status(500).json({ error: 'Bedroom render failed', details: err.message });
  }
}

