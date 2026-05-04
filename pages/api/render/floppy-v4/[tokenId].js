// Independent v4 card render endpoint (PNG + GIF for animated traits).
// Path: /api/render/floppy-v4/[tokenId].png

import fs from 'fs';
import path from 'path';
import { renderV4CardPng } from '../../../../lib/renderers/card-v4-renderer.js';
import { isTraitAnimated } from '../../../../lib/animated-traits-helper.js';
import { generateFloppyGifV4 } from '../../../../lib/gif-generator.js';

async function getTotalMintedSafe(tokenIdNum, fallback) {
  try {
    const { getContracts } = await import('../../../../lib/contracts.js');
    const { traitsCore } = await Promise.race([
      getContracts(),
      new Promise((_, reject) => setTimeout(() => reject(new Error('getContracts timeout 8000ms')), 8000)),
    ]);
    const minted = await Promise.race([
      traitsCore.totalMintedPerAsset(tokenIdNum),
      new Promise((_, reject) => setTimeout(() => reject(new Error('totalMintedPerAsset timeout 5000ms')), 5000)),
    ]);
    return minted.toNumber();
  } catch (err) {
    console.warn(`[floppy-v4] totalMinted fallback for ${tokenIdNum}: ${err.message}`);
    return fallback;
  }
}

export default async function handler(req, res) {
  const allowedOrigins = [
    'https://adrianzero.com',
    'https://adrianpunks.com',
    'https://adriangallery.com',
    'https://opensea.io',
    'https://testnets.opensea.io',
    'https://rarible.com',
    'https://looksrare.org',
    'https://x2y2.io',
    'https://blur.io',
    'https://magiceden.io',
    'https://element.market',
    'https://tensor.trade',
  ];
  const origin = req.headers.origin;
  if (origin && allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  } else {
    res.setHeader('Access-Control-Allow-Origin', '*');
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    let { tokenId } = req.query;
    if (typeof tokenId === 'string') {
      tokenId = tokenId.replace(/\.(png|gif)$/, '');
    }
    const tokenIdNum = parseInt(tokenId, 10);
    if (!Number.isFinite(tokenIdNum) || tokenIdNum < 1 || tokenIdNum > 9999) {
      return res.status(400).json({ error: 'floppy-v4 supports traits 1-9999' });
    }

    const traitsPath = path.join(process.cwd(), 'public/labmetadata/traits.json');
    const traits = JSON.parse(fs.readFileSync(traitsPath, 'utf8'));
    const tokenData = traits.traits.find((t) => t.tokenId === tokenIdNum);
    if (!tokenData) {
      return res.status(404).json({ error: `Token ${tokenIdNum} not found` });
    }

    const totalMinted = await getTotalMintedSafe(tokenIdNum, tokenData.maxSupply || 0);
    const animated = await isTraitAnimated(tokenIdNum);

    if (animated) {
      console.log(`[floppy-v4] Rendering ANIMATED token ${tokenIdNum}`);
      const gif = await generateFloppyGifV4({ traitId: tokenIdNum, tokenData, totalMinted });
      res.setHeader('Content-Type', 'image/gif');
      res.setHeader('X-Version', 'FLOPPY-V4-GIF');
      res.setHeader('Cache-Control', 'public, max-age=300, s-maxage=300');
      return res.status(200).send(gif);
    }

    console.log(`[floppy-v4] Rendering PNG token ${tokenIdNum}`);
    const png = renderV4CardPng({ tokenIdNum, tokenData, totalMinted });
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('X-Version', 'FLOPPY-V4-PNG');
    res.setHeader('Cache-Control', 'public, max-age=300, s-maxage=300');
    return res.status(200).send(png);
  } catch (err) {
    console.error('[floppy-v4] Error:', err);
    return res.status(500).json({ error: err.message || 'Internal error' });
  }
}
