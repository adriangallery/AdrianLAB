/**
 * Endpoint simplificado para probar bounce animation con squash & stretch
 * y delay por categoría. Aislado del render principal — útil para iterar
 * en el editor /admin/bounce-builder.html sin tocar tokens reales.
 *
 * Query params:
 *  - base               skin base ('medium' | 'zero' | 'dark' | 'alien' | 'albino' | 'blankmannequin' | 'mannequin')
 *  - fixed              csv de traitIds (e.g. "12,247,1058")
 *  - bounce=true        REQUERIDO
 *  - bounceDir          'y' (default) | 'x' | 'both'
 *  - bounceDist         píxeles (default 30)
 *  - bounceCount        número de botes (default 2)
 *  - bounceFrames       frames totales del GIF (default 12)
 *  - bounceDelay        unidad de delay entre categorías en frames (default 1)
 *  - bounceFrameMs      ms por frame del GIF (default 80)
 *  - squash             squash en impacto, 0..0.3 (default 0.12)
 *  - stretch            stretch en cumbre, 0..0.2 (default 0.06)
 *  - anchorY            pivote Y del scale, 0..1 (default 0.92)
 *  - perCategory        'false' para desactivar delay por categoría (default true)
 *  - width / height     px del lienzo (default 400 — sirve para preview rápido)
 */

import { Resvg } from '@resvg/resvg-js';
import { createBounceSquashFrameGenerator, generateGifFromLayers } from '../../lib/gif-generator.js';
import fs from 'fs';
import path from 'path';

let traitsIndexCache = null;
function loadTraitsIndex() {
  if (traitsIndexCache) return traitsIndexCache;
  try {
    const file = path.join(process.cwd(), 'public', 'labmetadata', 'traits.json');
    const raw = JSON.parse(fs.readFileSync(file, 'utf-8'));
    const index = new Map();
    for (const t of raw.traits || []) {
      index.set(String(t.tokenId), t.category || null);
    }
    traitsIndexCache = index;
    return index;
  } catch (err) {
    console.warn('[bounce-test] No se pudo leer traits.json:', err.message);
    traitsIndexCache = new Map();
    return traitsIndexCache;
  }
}

function categoryForTraitId(traitId) {
  const idx = loadTraitsIndex();
  return idx.get(String(traitId)) || 'TOP'; // default a TOP (delay máximo)
}

const baseSkinMap = {
  medium: { url: '/traits/ADRIAN/GEN0-Medium.svg', category: 'SKIN' },
  zero: { url: '/traits/ADRIAN/GEN0-Medium.svg', category: 'SKIN' },
  dark: { url: '/traits/ADRIAN/GEN0-Dark.svg', category: 'SKIN' },
  darkadrian: { url: '/traits/ADRIAN/GEN0-Dark.svg', category: 'SKIN' },
  alien: { url: '/traits/ADRIAN/GEN0-Alien.svg', category: 'SKIN' },
  albino: { url: '/traits/ADRIAN/GEN0-Albino.svg', category: 'SKIN' },
  blankmannequin: { url: '/labimages/blankmannequin.svg', category: 'BODY' },
  mannequin: { url: '/labimages/mannequin.svg', category: 'BODY' },
};

export default async function handler(req, res) {
  try {
    const {
      base = 'medium',
      fixed = '',
      bounceDir = 'y',
      bounceDist,
      bounceCount,
      bounceFrames,
      bounceDelay,
      bounceFrameMs,
      squash,
      stretch,
      anchorY,
      perCategory,
      width = 400,
      height = 400,
    } = req.query;

    if (req.query.bounce !== 'true') {
      return res.status(400).json({ error: 'bounce=true is required' });
    }

    const fixedIds = fixed
      ? fixed.split(',').map(id => id.trim()).filter(Boolean)
      : [];

    if (fixedIds.length === 0) {
      return res.status(400).json({ error: 'At least one fixed trait is required' });
    }

    const bounceConfig = {
      enabled: true,
      direction: bounceDir,
      distance: parseFloat(bounceDist) || 30,
      bounces: parseInt(bounceCount) || 2,
      frames: parseInt(bounceFrames) || 12,
      delay: parseInt(bounceDelay) || 1,
      squash: squash !== undefined ? parseFloat(squash) : 0.12,
      stretch: stretch !== undefined ? parseFloat(stretch) : 0.06,
      anchorY: anchorY !== undefined ? parseFloat(anchorY) : 0.92,
      frameMs: parseInt(bounceFrameMs) || 80,
      perCategoryDelay: perCategory !== 'false',
    };

    const canvasWidth = parseInt(width) || 400;
    const canvasHeight = parseInt(height) || 400;

    console.log('[bounce-test] config:', { base, fixedIds, bounceConfig, canvasWidth });

    // SVG → PNG buffer
    const svgToPng = async (svgUrl) => {
      const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://adrianlab.vercel.app';
      const fullUrl = svgUrl.startsWith('http') ? svgUrl : `${baseUrl}${svgUrl}`;
      const response = await fetch(fullUrl);
      if (!response.ok) {
        throw new Error(`Failed to load ${fullUrl}: ${response.status}`);
      }
      const svgContent = await response.text();
      const resvg = new Resvg(Buffer.from(svgContent), {
        fitTo: { mode: 'width', value: canvasWidth },
        background: 'rgba(255, 255, 255, 0)',
      });
      return resvg.render().asPng();
    };

    // Construir capas con su categoría asociada (para delay por categoría)
    const layers = [];

    if (base) {
      const baseInfo = baseSkinMap[base];
      const url = baseInfo ? baseInfo.url : `/labimages/${base}.svg`;
      const category = baseInfo ? baseInfo.category : 'SKIN';
      const png = await svgToPng(url);
      layers.push({ pngBuffer: png, category });
    }

    for (const traitId of fixedIds) {
      const png = await svgToPng(`/labimages/${traitId}.svg`);
      const category = categoryForTraitId(traitId);
      layers.push({ pngBuffer: png, category });
      console.log(`[bounce-test] trait ${traitId} → categoría ${category}`);
    }

    const customGen = createBounceSquashFrameGenerator({
      layers,
      animatedTraits: [],
      bounceConfig,
      width: canvasWidth,
      height: canvasHeight,
      delay: bounceConfig.frameMs,
    });

    const gifBuffer = await generateGifFromLayers({
      stableLayers: [],
      animatedTraits: [],
      width: canvasWidth,
      height: canvasHeight,
      delay: bounceConfig.frameMs,
      customFrameGenerator: customGen,
      totalFrames: bounceConfig.frames,
    });

    console.log(`[bounce-test] GIF generado: ${gifBuffer.length} bytes`);
    res.setHeader('Content-Type', 'image/gif');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.setHeader('X-Bounce', 'enabled');
    res.status(200).send(gifBuffer);
  } catch (error) {
    console.error('[bounce-test] Error:', error);
    res.status(500).json({
      error: 'Error generating bounce GIF',
      message: error.message,
      stack: error.stack,
    });
  }
}
