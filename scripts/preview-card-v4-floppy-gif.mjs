// Preview animated GIF v4 for a floppy/pack/serum.
// Reads each frame from the source GIF, embeds it into a card v4 frame, and
// re-encodes as a multi-frame GIF.
// Usage: node scripts/preview-card-v4-floppy-gif.mjs 10003

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { Resvg } from '@resvg/resvg-js';
import sharp from 'sharp';
import { GifFrame, BitmapImage, GifCodec, GifUtil } from 'gifwrap';
import { PNG } from 'pngjs';
import { buildV4CardSvg, V4_W, V4_HS } from '../lib/renderers/card-v4-renderer.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const tokenId = parseInt(process.argv[2] || '', 10);
if (!Number.isFinite(tokenId)) {
  console.error('Usage: node scripts/preview-card-v4-floppy-gif.mjs <tokenId>');
  process.exit(1);
}

function getTokenData(id) {
  // floppies first
  const floppyJson = path.join(ROOT, 'public/labmetadata/floppy.json');
  if (fs.existsSync(floppyJson)) {
    const f = JSON.parse(fs.readFileSync(floppyJson, 'utf8'));
    const found = f.floppys.find((x) => x.tokenId === id);
    if (found) return found;
  }
  // serums
  const serumsJson = path.join(ROOT, 'public/labmetadata/serums.json');
  if (fs.existsSync(serumsJson)) {
    const s = JSON.parse(fs.readFileSync(serumsJson, 'utf8'));
    const found = s.serums?.find((x) => x.tokenId === id);
    if (found) return found;
  }
  return null;
}

async function main() {
  const gifPath = path.join(ROOT, `public/labimages/${tokenId}.gif`);
  if (!fs.existsSync(gifPath)) {
    console.error(`No GIF for token ${tokenId} at ${gifPath}`);
    process.exit(1);
  }
  const tokenData = getTokenData(tokenId) || {
    name: `Token #${tokenId}`,
    category: 'UNKNOWN',
    maxSupply: 1,
    floppy: 'OG',
  };
  console.log(`[preview-gif] ${tokenId}: ${tokenData.name} | ${tokenData.category}`);

  const gifBuffer = fs.readFileSync(gifPath);
  const meta = await sharp(gifBuffer, { animated: true }).metadata();
  const totalFrames = meta.pages || 1;
  const pageHeight = meta.pageHeight || meta.height;
  const delayPerFrame = (meta.delay && meta.delay[0]) || 100; // ms
  console.log(`[preview-gif] ${totalFrames} frames, pageHeight=${pageHeight}, delay~${delayPerFrame}ms`);

  const frames = [];
  for (let i = 0; i < totalFrames; i++) {
    // Extract a SINGLE frame i. Use { pages: 1 } — without it, sharp returns
    // a vertical strip of all pages even when `page` is set.
    const framePngBuf = await sharp(gifBuffer, { page: i, pages: 1 })
      .resize(V4_HS, V4_HS, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png()
      .toBuffer();
    const traitB64 = `data:image/png;base64,${framePngBuf.toString('base64')}`;

    const svg = buildV4CardSvg({
      tokenIdNum: tokenId,
      tokenData,
      totalMinted: tokenData.maxSupply || 1,
      traitB64Override: traitB64,
      skipMannequin: true,
    });
    const cardPng = new Resvg(svg, { fitTo: { mode: 'width', value: V4_W } })
      .render()
      .asPng();
    const pngImage = PNG.sync.read(cardPng);
    const bitmap = new BitmapImage({
      width: pngImage.width,
      height: pngImage.height,
      data: pngImage.data,
    });
    const delayCs = Math.round(delayPerFrame / 10) || 50;
    frames.push(new GifFrame(bitmap, { delayCentisecs: delayCs }));
    console.log(`[preview-gif] frame ${i + 1}/${totalFrames} ✓`);
  }

  console.log(`[preview-gif] quantizing...`);
  GifUtil.quantizeSorokin(frames, 256);
  console.log(`[preview-gif] encoding...`);
  const codec = new GifCodec();
  const out = await codec.encodeGif(frames, { loops: 0 });

  const outPath = path.join(ROOT, `preview-v4-floppy-${tokenId}.gif`);
  fs.writeFileSync(outPath, out.buffer);
  console.log(`✓ ${outPath} (${(out.buffer.length / 1024).toFixed(1)} KB)`);
}

main().catch((err) => { console.error(err); process.exit(1); });
