import sharp from 'sharp';
import { detectAnimatedVariants } from '../../lib/animated-traits-helper.js';

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://adrianlab.vercel.app';
const DEFAULT_SIZE = 1000;

async function fetchBuffer(url, label) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`${label} no disponible (${response.status} ${response.statusText})`);
  }
  const data = await response.arrayBuffer();
  return Buffer.from(data);
}

async function loadAdrianZeroRender(tokenId, size) {
  // Usa el render estándar de AdrianZERO como base
  const url = `${BASE_URL}/api/render/${tokenId}`;
  const baseBuffer = await fetchBuffer(url, 'Render AdrianZERO');

  // Normaliza el tamaño para garantizar consistencia con los traits
  return sharp(baseBuffer)
    .resize(size, size, {
      fit: 'contain',
      background: { r: 0, g: 0, b: 0, alpha: 0 }
    })
    .png()
    .toBuffer();
}

async function loadTraitPng(traitId, size) {
  const idStr = traitId.toString().trim();
  const suffix = idStr.toLowerCase().endsWith('.svg') ? '' : '.svg';
  const url = `${BASE_URL}/labimages/${idStr}${suffix}`;

  const svgBuffer = await fetchBuffer(url, `Trait ${traitId}`);
  return sharp(svgBuffer)
    .resize(size, size, {
      fit: 'contain',
      background: { r: 0, g: 0, b: 0, alpha: 0 }
    })
    .png()
    .toBuffer();
}

async function resolveTraitId(traitId) {
  // Si es animado, intenta usar la primera variante disponible (ej. 1165a); si no, usa el ID tal cual.
  try {
    const variants = await detectAnimatedVariants(traitId.toString());
    if (variants && variants.length > 0) {
      return variants[0];
    }
  } catch (err) {
    console.warn(`[v4] No se pudieron detectar variantes para ${traitId}: ${err.message}`);
  }
  return traitId;
}

export default async function handler(req, res) {
  try {
    const {
      adrianzero,
      tokenId,
      traits = '',
      fixed = '',
      frames = '',
      animated = '',
      size = DEFAULT_SIZE
    } = req.query;

    const targetSize = Math.max(64, Math.min(2000, parseInt(size, 10) || DEFAULT_SIZE));
    const adrianZeroId = adrianzero || tokenId;

    if (!adrianZeroId) {
      return res.status(400).json({ error: 'Se requiere el parámetro adrianzero (tokenId)' });
    }

    // Recolecta todos los traits en el orden recibido
    const traitOrder = [];
    const addTrait = (id) => {
      if (id && id.toString().trim()) {
        traitOrder.push(id.toString().trim());
      }
    };

    // traits explícitos
    traits.split(',').forEach(t => addTrait(t));

    // fixed (IDs separados por coma)
    fixed.split(',').forEach(t => addTrait(t));

    // frames en formato id:delay
    frames.split(',').forEach(frameStr => {
      if (!frameStr) return;
      const [id] = frameStr.split(':');
      addTrait(id);
    });

    // animated en formato baseId:delay
    animated.split(',').forEach(animStr => {
      if (!animStr) return;
      const [baseId] = animStr.split(':');
      addTrait(baseId);
    });

    // Elimina duplicados preservando orden
    const uniqueTraits = [];
    const seen = new Set();
    for (const id of traitOrder) {
      if (!seen.has(id)) {
        seen.add(id);
        uniqueTraits.push(id);
      }
    }

    // Construye capas: base AdrianZERO + traits
    const layers = [];
    const baseLayer = await loadAdrianZeroRender(adrianZeroId, targetSize);
    layers.push(baseLayer);

    for (const traitId of uniqueTraits) {
      try {
        const resolvedId = await resolveTraitId(traitId);
        const traitPng = await loadTraitPng(resolvedId, targetSize);
        layers.push(traitPng);
      } catch (err) {
        console.warn(`[v4] Trait ${traitId} omitido: ${err.message}`);
      }
    }

    if (layers.length === 0) {
      return res.status(500).json({ error: 'No se pudieron generar capas para el PNG' });
    }

    const compositeBuffer = await sharp({
      create: {
        width: targetSize,
        height: targetSize,
        channels: 4,
        background: { r: 0, g: 0, b: 0, alpha: 0 }
      }
    })
      .composite(layers.map(input => ({ input })))
      .png()
      .toBuffer();

    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Cache-Control', 'public, max-age=300');
    res.setHeader('X-Source', 'test-gif-simple-v4');
    return res.status(200).send(compositeBuffer);
  } catch (error) {
    console.error('[test-gif-simple-v4] Error general:', error);
    return res.status(500).json({ error: 'Error generando PNG', details: error.message });
  }
}

