// API endpoint de test para renderizar tokens con traits externos
import { createCanvas, loadImage } from 'canvas';
import { getContracts } from '../../../../lib/contracts.js';
import { Resvg } from '@resvg/resvg-js';
import fs from 'fs';
import path from 'path';

// Función para normalizar categorías a mayúsculas
const normalizeCategory = (category) => {
  const categoryMap = {
    'PACKS': 'SWAG'  // Mapear PACKS a SWAG (discrepancia del contrato)
  };
  
  const normalized = categoryMap[category] || category;
  return normalized;
};

// Función para cargar SVG desde URL externa
const loadExternalSvg = async (url) => {
  try {
    console.log(`[test-external] Cargando SVG desde URL externa: ${url}`);
    
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const svgBuffer = await response.arrayBuffer();
    
    // Renderizar SVG a PNG
    const resvg = new Resvg(Buffer.from(svgBuffer), {
      fitTo: {
        mode: 'width',
        value: 1000
      }
    });
    
    const pngBuffer = resvg.render().asPng();
    return loadImage(pngBuffer);
  } catch (error) {
    console.error(`[test-external] Error cargando SVG externo:`, error.message);
    return null;
  }
};

// Función para cargar SVG desde sistema local
const loadLocalSvg = async (path) => {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://adrianlab.vercel.app';
    const imageUrl = `${baseUrl}/traits/${path}`;
    console.log(`[test-external] Cargando imagen local: ${imageUrl}`);

    const response = await fetch(imageUrl);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const svgBuffer = await response.arrayBuffer();
    
    // Renderizar SVG a PNG
    const resvg = new Resvg(Buffer.from(svgBuffer), {
      fitTo: {
        mode: 'width',
        value: 1000
      }
    });
    
    const pngBuffer = resvg.render().asPng();
    return loadImage(pngBuffer);
  } catch (error) {
    console.error(`[test-external] Error cargando SVG local ${path}:`, error.message);
    return null;
  }
};

// Función para cargar trait desde labimages
const loadTraitFromLabimages = async (traitId) => {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://adrianlab.vercel.app';
    const imageUrl = `${baseUrl}/labimages/${traitId}.svg`;
    console.log(`[test-external] Cargando trait desde labimages: ${imageUrl}`);

    const response = await fetch(imageUrl);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const svgBuffer = await response.arrayBuffer();
    
    // Renderizar SVG a PNG
    const resvg = new Resvg(Buffer.from(svgBuffer), {
      fitTo: {
        mode: 'width',
        value: 1000
      }
    });
    
    const pngBuffer = resvg.render().asPng();
    return loadImage(pngBuffer);
  } catch (error) {
    console.error(`[test-external] Error cargando trait ${traitId} desde labimages:`, error.message);
    return null;
  }
};

export default async function handler(req, res) {
  // Configurar CORS
  const allowedOrigins = [
    'https://adrianzero.com',
    'https://adrianlab.vercel.app'
  ];
  
  const origin = req.headers.origin;
  if (allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  try {
    // Extraer tokenId de la ruta
    const { tokenId } = req.query;
    const cleanTokenId = tokenId.replace('.png', '');
    console.log(`[test-external] Iniciando test de renderizado externo para token ${cleanTokenId}`);

    // Verificar tokenId
    if (!cleanTokenId || isNaN(parseInt(cleanTokenId))) {
      console.error(`[test-external] Token ID inválido: ${cleanTokenId}`);
      return res.status(400).json({ error: 'Invalid token ID' });
    }

    // Obtener parámetros de query para traits personalizados
    const customTraits = {};
    
    // Procesar parámetros de categorías directas
    Object.keys(req.query).forEach(key => {
      if (key !== 'tokenId' && key !== 'png' && key !== 'trait') {
        const traitValue = req.query[key];
        const traitId = parseInt(traitValue);
        if (!isNaN(traitId)) {
          customTraits[key.toUpperCase()] = traitId.toString();
          console.log(`[test-external] Categoría ${key.toUpperCase()} = ${traitId}`);
        }
      }
    });
    
    // Procesar parámetros "trait"
    if (req.query.trait) {
      const traitValues = Array.isArray(req.query.trait) ? req.query.trait : [req.query.trait];
      traitValues.forEach(traitValue => {
        const traitId = parseInt(traitValue);
        if (!isNaN(traitId)) {
          // Para este test, asumimos que trait 30003 es externo
          if (traitId === 30003) {
            customTraits['EXTERNAL_TEST'] = traitId.toString();
            console.log(`[test-external] Trait externo detectado: ${traitId}`);
          } else {
            customTraits['SWAG'] = traitId.toString();
            console.log(`[test-external] Trait normal: ${traitId}`);
          }
        }
      });
    }

    console.log(`[test-external] Traits personalizados:`, customTraits);

    // Conectar con los contratos
    console.log('[test-external] Conectando con los contratos...');
    const { core, traitsExtension } = await getContracts();

    // Obtener datos del token
    console.log('[test-external] Obteniendo datos del token...');
    const tokenData = await core.getTokenData(cleanTokenId);
    const [generation, mutationLevel, canReplicate, replicationCount, lastReplication, hasBeenModified] = tokenData;
    
    console.log('[test-external] TokenData:', {
      generation: generation.toString(),
      mutationLevel: mutationLevel.toString(),
      canReplicate,
      hasBeenModified
    });

    // Obtener skin del token
    console.log('[test-external] Obteniendo skin del token...');
    const tokenSkinData = await core.getTokenSkin(cleanTokenId);
    const skinId = tokenSkinData[0].toString();
    const skinName = tokenSkinData[1];
    
    console.log('[test-external] Skin info:', {
      skinId,
      skinName
    });

    // Obtener traits equipados actuales
    console.log('[test-external] Obteniendo traits equipados actuales...');
    const nested = await traitsExtension.getAllEquippedTraits(cleanTokenId);
    const categories = nested[0];
    const traitIds = nested[1];
    
    // Crear mapa de traits actuales
    const currentTraits = {};
    categories.forEach((category, index) => {
      const normalizedCategory = normalizeCategory(category);
      const traitId = traitIds[index].toString();
      currentTraits[normalizedCategory] = traitId;
    });

    console.log('[test-external] Traits actuales:', currentTraits);

    // Aplicar traits personalizados
    const normalizedCustomTraits = {};
    Object.entries(customTraits).forEach(([category, traitId]) => {
      normalizedCustomTraits[normalizeCategory(category)] = traitId;
    });
    
    const finalTraits = { ...currentTraits, ...normalizedCustomTraits };
    console.log('[test-external] Traits finales (con modificaciones):', finalTraits);

    // Crear canvas
    const canvas = createCanvas(1000, 1000);
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, 1000, 1000);

    // Determinar imagen base
    const gen = generation.toString();
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

    const baseImagePath = `ADRIAN/GEN${gen}-${skinType}.svg`;
    console.log('[test-external] Path de imagen base:', baseImagePath);

    // 1. Renderizar skin base
    console.log('[test-external] PASO 1 - Renderizando skin base');
    const baseImage = await loadLocalSvg(baseImagePath);
    if (baseImage) {
      ctx.drawImage(baseImage, 0, 0, 1000, 1000);
      console.log('[test-external] PASO 1 - Skin base renderizado correctamente');
    }

    // 2. Renderizar traits normales
    console.log('[test-external] PASO 2 - Renderizando traits normales');
    const traitOrder = ['BEARD', 'EAR', 'GEAR', 'HEAD', 'RANDOMSHIT', 'SWAG', 'HAIR', 'HAT', 'SKIN', 'EYES', 'MOUTH', 'NECK', 'NOSE'];

    for (const category of traitOrder) {
      if (finalTraits[category]) {
        const traitId = finalTraits[category];
        const traitImage = await loadTraitFromLabimages(traitId);
        if (traitImage) {
          ctx.drawImage(traitImage, 0, 0, 1000, 1000);
          console.log(`[test-external] PASO 2 - Trait ${category} (${traitId}) renderizado correctamente`);
        }
      }
    }

    // 3. Renderizar trait externo (TEST)
    if (finalTraits['EXTERNAL_TEST']) {
      console.log('[test-external] PASO 3 - Renderizando trait externo de test');
      const externalImage = await loadExternalSvg('https://adrianzero.com/designs/30004.svg');
      if (externalImage) {
        ctx.drawImage(externalImage, 0, 0, 1000, 1000);
        console.log('[test-external] PASO 3 - Trait externo renderizado correctamente');
      } else {
        console.error('[test-external] PASO 3 - Error al cargar trait externo');
      }
    }

    // 4. Renderizar TOP layers
    console.log('[test-external] PASO 4 - Renderizando TOP layers');
    if (finalTraits['TOP']) {
      const traitId = finalTraits['TOP'];
      const traitImage = await loadTraitFromLabimages(traitId);
      if (traitImage) {
        ctx.drawImage(traitImage, 0, 0, 1000, 1000);
        console.log(`[test-external] PASO 4 - TOP trait (${traitId}) renderizado correctamente`);
      }
    }

    // Configurar headers
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.setHeader('Surrogate-Control', 'no-store');
    
    // Enviar imagen
    const buffer = canvas.toBuffer('image/png');
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Content-Length', buffer.length);
    res.send(buffer);

    console.log('[test-external] Test de renderizado externo completado exitosamente');

  } catch (error) {
    console.error('[test-external] Error general:', error);
    console.error('[test-external] Stack trace:', error.stack);
    
    // En caso de error, devolver una imagen de error
    const canvas = createCanvas(1000, 1000);
    const ctx = canvas.getContext('2d');
    
    // Fondo gris
    ctx.fillStyle = '#cccccc';
    ctx.fillRect(0, 0, 1000, 1000);
    
    // Texto de error
    ctx.fillStyle = '#000000';
    ctx.font = 'bold 48px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('Error Test External Render', 500, 450);
    ctx.font = '24px Arial';
    ctx.fillText(`Token #${req.query.tokenId?.replace('.png', '') || 'Unknown'}`, 500, 500);
    ctx.font = '18px Arial';
    ctx.fillText(error.message.substring(0, 50), 500, 550);
    
    const buffer = canvas.toBuffer('image/png');
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Content-Length', buffer.length);
    res.send(buffer);
  }
} 