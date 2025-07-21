import path from 'path';
import fs from 'fs';
import { createCanvas, loadImage } from 'canvas';
import { Resvg } from '@resvg/resvg-js';
import { getContracts } from '../../../../lib/contracts.js';

// Utilidad para elegir el Lambo (por ahora fijo, luego se puede parametrizar)
const LAMBO_FILE = 'Lambo_Variant_Yellow.svg';
const LAMBO_WIDTH = 188.6;
const LAMBO_HEIGHT = 52.275;
const CANVAS_SIZE = 1000;

export default async function handler(req, res) {
  // Permitir CORS universal
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  try {
    // Extraer tokenId
    const { tokenId } = req.query;
    const cleanTokenId = tokenId.replace('.png', '');
    if (!cleanTokenId || isNaN(parseInt(cleanTokenId))) {
      return res.status(400).json({ error: 'Invalid token ID' });
    }

    // Conectar con los contratos
    const { core } = await getContracts();
    // Obtener datos del token
    const tokenData = await core.getTokenData(cleanTokenId);
    const [generation] = tokenData;
    // Obtener skin del token
    const tokenSkinData = await core.getTokenSkin(cleanTokenId);
    const skinId = tokenSkinData[0].toString();
    const skinName = tokenSkinData[1];
    // Determinar el Adrian base
    let skinType;
    if (skinName === "Zero" || skinId === "0" || skinId === "1") {
      skinType = "Medium";
    } else if (skinId === "2" || skinName === "Dark") {
      skinType = "Dark";
    } else if (skinId === "3" || skinName === "Alien") {
      skinType = "Alien";
    } else {
      skinType = skinName || "Medium";
    }
    const baseImagePath = `ADRIAN/GEN${generation}-${skinType}.svg`;

    // Crear canvas
    const canvas = createCanvas(CANVAS_SIZE, CANVAS_SIZE);
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

    // 1. Renderizar el Lambo como base (centrado abajo)
    const lamboSvgPath = path.join(process.cwd(), 'public', 'lamboimages', LAMBO_FILE);
    const lamboSvgContent = fs.readFileSync(lamboSvgPath, 'utf8');
    const resvgLambo = new Resvg(lamboSvgContent, {
      fitTo: { mode: 'width', value: CANVAS_SIZE },
    });
    const lamboPng = resvgLambo.render().asPng();
    const lamboImg = await loadImage(lamboPng);
    // El Lambo va centrado horizontal y pegado abajo
    const lamboScale = CANVAS_SIZE / LAMBO_WIDTH;
    const lamboHeightPx = LAMBO_HEIGHT * lamboScale;
    ctx.drawImage(lamboImg, 0, CANVAS_SIZE - lamboHeightPx, CANVAS_SIZE, lamboHeightPx);

    // 2. Renderizar el AdrianZERO encima (centrado, más pequeño)
    const adrianSvgPath = path.join(process.cwd(), 'public', 'traits', 'ADRIAN', `GEN${generation}-${skinType}.svg`);
    const adrianSvgContent = fs.readFileSync(adrianSvgPath, 'utf8');
    // Escalamos el Adrian para que quede bien sobre el Lambo
    const adrianScale = 0.6; // Ajustable
    const adrianSize = CANVAS_SIZE * adrianScale;
    const adrianX = (CANVAS_SIZE - adrianSize) / 2;
    const adrianY = CANVAS_SIZE - lamboHeightPx - adrianSize + 60; // +60 para que sobresalga
    const resvgAdrian = new Resvg(adrianSvgContent, {
      fitTo: { mode: 'width', value: adrianSize },
    });
    const adrianPng = resvgAdrian.render().asPng();
    const adrianImg = await loadImage(adrianPng);
    ctx.drawImage(adrianImg, adrianX, adrianY, adrianSize, adrianSize);

    // Devolver imagen
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.status(200).send(canvas.toBuffer('image/png'));
  } catch (error) {
    console.error('[lambo-render] Error:', error);
    res.status(500).json({ error: 'Error interno del servidor', details: error.message });
  }
} 