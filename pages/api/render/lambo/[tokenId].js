import path from 'path';
import fs from 'fs';
import { createCanvas, loadImage } from 'canvas';
import { Resvg } from '@resvg/resvg-js';
import { getContracts } from '../../../../lib/contracts.js';

const LAMBO_DEFAULT = 'Lambo_Variant_Yellow';
const LAMBO_WIDTH = 188.6;
const LAMBO_HEIGHT = 52.275;
const CANVAS_WIDTH = 1500;
const CANVAS_HEIGHT = 500;
const ADRIAN_SCALE = 0.25; // 1/4 del tamaño original
const ADRIAN_SIZE = 1000 * ADRIAN_SCALE; // Mantener el tamaño del AdrianZERO basado en 1000px

// Utilidad para cargar y renderizar un trait SVG desde labimages
async function loadTraitFromLabimages(traitId) {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://adrianlab.vercel.app';
    const imageUrl = `${baseUrl}/labimages/${traitId}.svg`;
    const response = await fetch(imageUrl);
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    const svgBuffer = await response.arrayBuffer();
    const resvg = new Resvg(Buffer.from(svgBuffer), { fitTo: { mode: 'width', value: 1000 } });
    const pngBuffer = resvg.render().asPng();
    return loadImage(pngBuffer);
  } catch (error) {
    console.error(`[lambo-render] Error cargando trait ${traitId} desde labimages:`, error.message);
    return null;
  }
}

// Utilidad para cargar y renderizar un SVG desde traits/
async function loadAndRenderSvg(svgPath) {
  try {
    const svgContent = fs.readFileSync(path.join(process.cwd(), 'public', 'traits', svgPath), 'utf8');
    const resvg = new Resvg(svgContent, { fitTo: { mode: 'width', value: 1000 } });
    const pngBuffer = resvg.render().asPng();
    return loadImage(pngBuffer);
  } catch (error) {
    console.error(`[lambo-render] Error cargando SVG ${svgPath}:`, error.message);
    return null;
  }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  try {
    // Token y lambo
    const { tokenId, lambo } = req.query;
    const cleanTokenId = tokenId.replace('.png', '');
    if (!cleanTokenId || isNaN(parseInt(cleanTokenId))) {
      return res.status(400).json({ error: 'Invalid token ID' });
    }
    const lamboFile = `${lambo || LAMBO_DEFAULT}.svg`;

    // Conectar con los contratos
    const { core, traitsExtension } = await getContracts();
    // Obtener datos del token
    const tokenData = await core.getTokenData(cleanTokenId);
    const [generation] = tokenData;
    // Obtener skin del token
    const tokenSkinData = await core.getTokenSkin(cleanTokenId);
    const skinId = tokenSkinData[0].toString();
    const skinName = tokenSkinData[1];
    // Obtener traits equipados
    const nested = await traitsExtension.getAllEquippedTraits(cleanTokenId);
    const categories = nested[0];
    const traitIds = nested[1];
    // Mapear traits
    const equippedTraits = {};
    categories.forEach((category, index) => {
      equippedTraits[category.toUpperCase()] = traitIds[index].toString();
    });

    // Lógica de skin
    let skinType;
    let useMannequin = false;
    if (skinId === "0") useMannequin = true;
    else if (skinId === "1" || skinName === "Zero") skinType = "Medium";
    else if (skinId === "2" || skinName === "Dark") skinType = "Dark";
    else if (skinId === "3" || skinName === "Alien") skinType = "Alien";
    else if (skinId === "4" || skinName === "Albino") skinType = "Albino";
    else skinType = skinName || "Medium";
    const gen = generation.toString();
    let baseImagePath = !useMannequin ? `ADRIAN/GEN${gen}-${skinType}.svg` : null;

    // Crear canvas final
    const canvas = createCanvas(CANVAS_WIDTH, CANVAS_HEIGHT);
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // 1. Renderizar BACKGROUND si existe (en el canvas final, ocupa todo)
    if (equippedTraits['BACKGROUND']) {
      const bgPath = `BACKGROUND/${equippedTraits['BACKGROUND']}.svg`;
      const bgImage = await loadAndRenderSvg(bgPath);
      if (bgImage) ctx.drawImage(bgImage, 0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    }

    // 2. Renderizar AdrianZERO completo en un buffer temporal (1000x1000)
    const adrianBuffer = createCanvas(1000, 1000);
    const adrianCtx = adrianBuffer.getContext('2d');
    adrianCtx.clearRect(0, 0, 1000, 1000);

    // SKIN base o mannequin
    if (useMannequin) {
      const mannequinPath = path.join(process.cwd(), 'public', 'labimages', 'mannequin.svg');
      const svgContent = fs.readFileSync(mannequinPath, 'utf8');
      const resvg = new Resvg(svgContent, { fitTo: { mode: 'width', value: 1000 } });
      const pngBuffer = resvg.render().asPng();
      const mannequinImage = await loadImage(pngBuffer);
      adrianCtx.drawImage(mannequinImage, 0, 0, 1000, 1000);
    } else {
      const baseImage = await loadAndRenderSvg(baseImagePath);
      if (baseImage) adrianCtx.drawImage(baseImage, 0, 0, 1000, 1000);
    }

    // Traits adicionales (orden visual)
    const traitOrder = ['BEARD', 'EAR', 'GEAR', 'HAIR', 'HEAD', 'RANDOMSHIT', 'SWAG', 'HAT', 'SKIN', 'SERUMS', 'EYES', 'MOUTH', 'NECK', 'NOSE', 'FLOPPY DISCS', 'PAGERS'];
    for (const category of traitOrder) {
      if (equippedTraits[category]) {
        const traitId = equippedTraits[category];
        const traitImage = await loadTraitFromLabimages(traitId);
        if (traitImage) adrianCtx.drawImage(traitImage, 0, 0, 1000, 1000);
      }
    }

    // TOP layers
    if (equippedTraits['TOP']) {
      const traitId = equippedTraits['TOP'];
      const traitImage = await loadTraitFromLabimages(traitId);
      if (traitImage) adrianCtx.drawImage(traitImage, 0, 0, 1000, 1000);
    }

    // 3. Dibujar el AdrianZERO pequeño en el canvas final
    const adrianX = (CANVAS_WIDTH - ADRIAN_SIZE) / 2 - 30; // mover 30px a la izquierda
    const originalLamboScale = 1000 / LAMBO_WIDTH; // Usar el tamaño original de 1000px
    const originalLamboHeightPx = LAMBO_HEIGHT * originalLamboScale;
    const adrianY = CANVAS_HEIGHT - originalLamboHeightPx - ADRIAN_SIZE + 10 + 100 - 20; // subir 20px
    ctx.drawImage(adrianBuffer, adrianX, adrianY, ADRIAN_SIZE, ADRIAN_SIZE);

    // 4. Renderizar el Lambo como capa superior
    const lamboSvgPath = path.join(process.cwd(), 'public', 'lamboimages', lamboFile);
    const lamboSvgContent = fs.readFileSync(lamboSvgPath, 'utf8');
    const resvgLambo = new Resvg(lamboSvgContent, { fitTo: { mode: 'width', value: 1000 } }); // Mantener el tamaño original de 1000px
    const lamboPng = resvgLambo.render().asPng();
    const lamboImg = await loadImage(lamboPng);
    const lamboX = (CANVAS_WIDTH - 1000) / 2; // Centrar el Lambo horizontalmente
    ctx.drawImage(lamboImg, lamboX, CANVAS_HEIGHT - originalLamboHeightPx, 1000, originalLamboHeightPx);

    // Devolver imagen
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.status(200).send(canvas.toBuffer('image/png'));
  } catch (error) {
    console.error('[lambo-render] Error:', error);
    res.status(500).json({ error: 'Error interno del servidor', details: error.message });
  }
} 