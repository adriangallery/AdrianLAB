// API endpoint for rendering displacement animation with explode effect
// Renders the complete AdrianZERO character (skin + traits) and animates an "explode" effect
// like an Apple product reveal showing all pieces separating
import { getContracts } from '../../../../lib/contracts.js';
import { generateGifFromLayers } from '../../../../lib/gif-generator.js';
import { calculateExplodeDisplacement, calculateAppleExplodeZ } from '../../../../lib/animation-helpers.js';
import { loadTraitWithDisplacement } from '../../../../lib/displacement-loader.js';
import { loadImage } from 'canvas';
import { createCanvas } from 'canvas';
import { Resvg } from '@resvg/resvg-js';
import { getCachedSvgPng, setCachedSvgPng } from '../../../../lib/svg-png-cache.js';

// === CONFIGURACIÓN DEFAULT PARA APPLE EXPLODED VIEW ===
// Timeline comprimido: spec 4.2s@60fps = 252 frames → adaptado a GIF con ~20 frames
const DEFAULT_FRAMES = 20; // Frames para timeline de 5 fases
const DEFAULT_DELAY = 80; // ms por frame (~12.5 fps para GIF suave)
const DEFAULT_DISTANCE = 60; // Offset Z simulado (píxeles) - sutil según spec
const DEFAULT_SIZE = 500; // Tamaño reducido para mejor rendimiento

// Límites para evitar timeouts
const MAX_FRAMES = 30; // Max frames para timeline completo
const MAX_DISTANCE = 120; // Max offset Z (muy sutil según spec)
const MIN_DELAY = 40; // Min delay para animación legible
const MAX_DELAY = 150; // Max delay
const MIN_SIZE = 300; // Min size para calidad
const MAX_SIZE = 800; // Max size para rendimiento

// Stagger según spec: 45ms entre capas
const DEFAULT_STAGGER = 1; // Frames de delay (~45ms con delay=45)

// Orden de renderizado de traits (igual que adrianzero-renderer)
const TRAIT_ORDER = ['BEARD', 'EAR', 'GEAR', 'RANDOMSHIT', 'SWAG', 'HAIR', 'HAT', 'HEAD', 'SKIN', 'SERUMS', 'EYES', 'MOUTH', 'NECK', 'NOSE', 'FLOPPY DISCS', 'PAGERS'];
const TOP_ORDER = ['TOP'];

/**
 * Carga SVG desde URL y lo convierte a PNG buffer
 * @param {string} url - URL del SVG
 * @param {string} cacheKey - Clave para el caché
 * @returns {Promise<Buffer>} - Buffer PNG
 */
async function loadSvgFromUrl(url, cacheKey) {
  try {
    console.log(`[displacement] Cargando SVG desde: ${url}`);
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const svgBuffer = await response.arrayBuffer();
    const svgContent = Buffer.from(svgBuffer).toString();
    
    // Verificar caché
    const cachedPng = getCachedSvgPng(svgContent);
    if (cachedPng) {
      console.log(`[displacement] ✅ Cache hit para ${cacheKey}`);
      return cachedPng;
    }
    
    // Convertir SVG a PNG
    const resvg = new Resvg(svgContent, {
      fitTo: {
        mode: 'width',
        value: 1000
      },
      background: 'rgba(255, 255, 255, 0)' // Transparente
    });
    
    const pngBuffer = resvg.render().asPng();
    
    // Guardar en caché
    setCachedSvgPng(svgContent, pngBuffer);
    
    return pngBuffer;
  } catch (error) {
    console.error(`[displacement] Error cargando SVG ${url}:`, error.message);
    return null;
  }
}

/**
 * Normaliza categoría (igual que adrianzero-renderer)
 */
function normalizeCategory(category) {
  const categoryMap = {
    'PACKS': 'SWAG'
  };
  return categoryMap[category] || category;
}

/**
 * Crea un generador de frames para efecto "Apple Exploded View"
 * Timeline de 5 fases: FLAT → PREP → EXPLODE → HOLD → CLOSE
 * 
 * RESTRICCIONES (spec):
 * - NO redibuja traits - usa SVG original
 * - Solo translate(x,y), rotateZ (max 6°), scale (simula Z)
 * - Coordenadas redondeadas a enteros (pixel-perfect)
 * 
 * @param {Object} config - Configuración
 * @returns {Function} - Generador de frames (frameIndex, totalFrames) => { pngBuffer, delay }
 */
async function createDisplacementFrameGenerator(config) {
  const {
    traits = [], // Array de { traitId, category, layers, hasDisplacement, isBaseSkin }
    width = DEFAULT_SIZE,
    height = DEFAULT_SIZE,
    totalFrames = DEFAULT_FRAMES,
    distance = DEFAULT_DISTANCE, // maxZOffset para simular Z
    delay = DEFAULT_DELAY,
    staggerFrames = DEFAULT_STAGGER
  } = config;
  
  // OPTIMIZACIÓN: Pre-cargar todas las imágenes una vez
  console.log(`[displacement] Pre-cargando ${traits.length} traits...`);
  const preloadedImages = new Map();
  
  for (const trait of traits) {
    if (!trait.layers) continue;
    
    if (trait.hasDisplacement && trait.layers.backLayer && trait.layers.frontLayer) {
      // Pre-cargar back y front layers
      try {
        const backImg = await loadImage(trait.layers.backLayer);
        const frontImg = await loadImage(trait.layers.frontLayer);
        preloadedImages.set(`${trait.traitId}_back`, backImg);
        preloadedImages.set(`${trait.traitId}_front`, frontImg);
      } catch (error) {
        console.error(`[displacement] Error pre-cargando imágenes para trait ${trait.traitId}:`, error.message);
      }
    } else if (trait.layers.normalLayer) {
      // Pre-cargar normal layer
      try {
        const normalImg = await loadImage(trait.layers.normalLayer);
        preloadedImages.set(`${trait.traitId}_normal`, normalImg);
      } catch (error) {
        console.error(`[displacement] Error pre-cargando imagen normal para trait ${trait.traitId}:`, error.message);
      }
    }
  }
  
  console.log(`[displacement] ✅ ${preloadedImages.size} imágenes pre-cargadas`);
  
  // Preparar lista de capas para animación (todas excepto BACKGROUND)
  // El BACKGROUND se mantiene fijo
  const animatedLayers = [];
  const fixedLayers = [];
  
  traits.forEach((trait, index) => {
    if (trait.isBackground) {
      fixedLayers.push({ trait, originalIndex: index });
    } else {
      animatedLayers.push({ trait, originalIndex: index });
    }
  });
  
  console.log(`[displacement] 🎬 Animación estilo Apple: ${animatedLayers.length} capas animadas, ${fixedLayers.length} fijas`);
  
  return async (frameIndex, totalFrames) => {
    // Log solo cada 5 frames para reducir ruido
    if (frameIndex % 5 === 0 || frameIndex === 0 || frameIndex === totalFrames - 1) {
      console.log(`[displacement] Generando frame ${frameIndex + 1}/${totalFrames}`);
    }
    
    const frameLayers = [];
    
    // 1. Primero añadir las capas fijas (BACKGROUND) sin transformación
    for (const { trait } of fixedLayers) {
      if (trait.layers?.normalLayer) {
        const img = preloadedImages.get(`${trait.traitId}_normal`);
        if (img) {
          frameLayers.push({
            image: img,
            transform: { x: 0, y: 0, scale: 1, rotation: 0 }
          });
        }
      }
    }
    
    // 2. Luego añadir las capas animadas con efecto Apple Z-explode
    for (let layerIndex = 0; layerIndex < animatedLayers.length; layerIndex++) {
      const { trait } = animatedLayers[layerIndex];
      
      if (!trait.layers) {
        continue;
      }
      
      // Calcular transformación estilo Apple (separación por Z simulado)
      // Pasar categoría para usar el z-band correcto
      const appleTransform = calculateAppleExplodeZ({
        frameIndex,
        totalFrames,
        layerIndex,
        totalLayers: animatedLayers.length,
        category: trait.category || 'features', // Usar categoría del trait
        maxZOffset: distance,
        staggerFrames: staggerFrames,
        withOvershoot: true,
        loopAnimation: false // NO loop - usamos timeline de 5 fases
      });
      
      if (trait.hasDisplacement && trait.layers.backLayer && trait.layers.frontLayer) {
        // Trait con displacement: renderizar back layer con offset adicional, luego front layer
        const backImg = preloadedImages.get(`${trait.traitId}_back`);
        const frontImg = preloadedImages.get(`${trait.traitId}_front`);
        
        if (backImg && frontImg) {
          // Back layer: offset adicional para simular grosor 3D
          const backTransform = {
            x: appleTransform.x - 2, // Ligeramente atrás
            y: appleTransform.y + 3, // Ligeramente abajo (más lejos)
            scale: appleTransform.scale * 0.98,
            rotation: appleTransform.rotation * 0.7
          };
          
          frameLayers.push({
            image: backImg,
            transform: backTransform
          });
          
          // Front layer: posición principal
          frameLayers.push({
            image: frontImg,
            transform: appleTransform
          });
        }
      } else if (trait.layers.normalLayer) {
        // Trait normal: solo una capa
        const normalImg = preloadedImages.get(`${trait.traitId}_normal`);
        
        if (normalImg) {
          frameLayers.push({
            image: normalImg,
            transform: appleTransform
          });
        }
      }
    }
    
    // Componer todas las capas en un frame
    const compositePng = await compositeLayers(frameLayers, width, height);
    
    return {
      pngBuffer: compositePng,
      delay: delay
    };
  };
}

/**
 * Componer múltiples capas PNG en un solo canvas con transformaciones
 * OPTIMIZADO: Recibe imágenes ya cargadas en lugar de buffers
 * Estilo Apple: transformaciones suaves con escala y offset
 * @param {Array} layers - Array de capas: [{ image, transform?: { x, y, scale, rotation } }, ...]
 * @param {number} width - Ancho del canvas
 * @param {number} height - Alto del canvas
 * @returns {Promise<Buffer>} Buffer PNG del resultado
 */
async function compositeLayers(layers, width = DEFAULT_SIZE, height = DEFAULT_SIZE) {
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');
  
  // Fondo blanco (como en el render normal)
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);
  
  // Configurar para rendering pixel-perfect (estilo Apple pero sin blur)
  ctx.imageSmoothingEnabled = false;
  
  // Dibujar cada capa en orden
  for (let i = 0; i < layers.length; i++) {
    const layer = layers[i];
    
    if (!layer.image) {
      continue;
    }
    
    const img = layer.image;
    const imgWidth = img.width;
    const imgHeight = img.height;
    
    // Calcular escala para ajustar imagen al canvas (mantener proporción)
    const fitScale = Math.min(width / imgWidth, height / imgHeight);
    const scaledWidth = imgWidth * fitScale;
    const scaledHeight = imgHeight * fitScale;
    
    // Si hay transformación, aplicarla
    if (layer.transform) {
      const { x = 0, y = 0, scale = 1, rotation = 0 } = layer.transform;
      
      ctx.save();
      
      // Aplicar transformaciones desde el centro del canvas
      ctx.translate(width / 2 + x, height / 2 + y);
      
      if (rotation !== 0) {
        ctx.rotate(rotation * Math.PI / 180);
      }
      
      // Aplicar escala adicional del efecto (sobre la escala de ajuste)
      const finalScale = fitScale * scale;
      
      // Dibujar centrado con la escala final
      ctx.drawImage(
        img,
        (-imgWidth * finalScale) / 2,
        (-imgHeight * finalScale) / 2,
        imgWidth * finalScale,
        imgHeight * finalScale
      );
      
      ctx.restore();
    } else {
      // Sin transformación, dibujar centrado y escalado para ajustar
      ctx.drawImage(
        img,
        (width - scaledWidth) / 2,
        (height - scaledHeight) / 2,
        scaledWidth,
        scaledHeight
      );
    }
  }
  
  return canvas.toBuffer('image/png');
}

export default async function handler(req, res) {
  // Configurar CORS
  const allowedOrigins = [
    'https://adrianzero.com',
    'https://adrianlab.vercel.app',
    'http://localhost:3000'
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
  
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  
  try {
    // Extraer tokenId de la ruta
    const { tokenId } = req.query;
    const cleanTokenId = tokenId.toString().replace(/\.(gif|png)$/, '');
    
    if (!cleanTokenId || isNaN(parseInt(cleanTokenId))) {
      return res.status(400).json({ error: 'Invalid token ID' });
    }
    
    console.log(`[displacement] 🎬 Iniciando animación de displacement para token ${cleanTokenId}`);
    
    // Parámetros opcionales con límites de seguridad
    let frames = parseInt(req.query.frames) || DEFAULT_FRAMES;
    let delay = parseInt(req.query.delay) || DEFAULT_DELAY;
    let distance = parseInt(req.query.distance) || DEFAULT_DISTANCE;
    let size = parseInt(req.query.size) || DEFAULT_SIZE;
    
    // Aplicar límites
    frames = Math.min(Math.max(1, frames), MAX_FRAMES);
    delay = Math.min(Math.max(MIN_DELAY, delay), MAX_DELAY);
    distance = Math.min(Math.max(50, distance), MAX_DISTANCE);
    size = Math.min(Math.max(MIN_SIZE, size), MAX_SIZE);
    
    // Ajustar distancia proporcionalmente al tamaño
    const scaledDistance = Math.round(distance * (size / 1000));
    
    console.log(`[displacement] Configuración: frames=${frames}, delay=${delay}ms, distance=${distance}px (scaled: ${scaledDistance}px), size=${size}px`);
    
    // Conectar con los contratos
    const { core, traitsExtension, serumModule } = await getContracts();
    
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://adrianlab.vercel.app';
    
    // ===== 1. OBTENER DATOS DEL TOKEN (SKIN, GENERACIÓN) =====
    console.log(`[displacement] Obteniendo datos del token ${cleanTokenId}...`);
    const tokenData = await core.getTokenData(cleanTokenId);
    const [generation, mutationLevel, canReplicate, replicationCount, lastReplication, hasBeenModified] = tokenData;
    const gen = generation.toString();
    
    console.log(`[displacement] Token generación: ${gen}`);
    
    // Obtener skin del token
    const tokenSkinData = await core.getTokenSkin(cleanTokenId);
    const skinId = tokenSkinData[0].toString();
    const skinName = tokenSkinData[1];
    
    console.log(`[displacement] Skin del token: skinId=${skinId}, skinName=${skinName}`);
    
    // Determinar el tipo de skin
    let skinType = "Medium"; // Default
    let useMannequin = false;
    
    if (skinId === "0") {
      useMannequin = true;
      console.log('[displacement] Skin no asignado (skinId = 0), usando mannequin');
    } else if (skinId === "1" || skinName === "Zero") {
      skinType = "Medium";
    } else if (skinId === "2" || skinName === "Dark") {
      skinType = "Dark";
    } else if (skinId === "3" || skinName === "Alien") {
      skinType = "Alien";
    } else if (skinId === "4" || skinName === "Albino") {
      skinType = "Albino";
    } else {
      skinType = skinName || "Medium";
    }
    
    console.log(`[displacement] Tipo de skin resuelto: ${skinType}`);
    
    // ===== 2. CARGAR EL SKIN BASE (ADRIAN) =====
    const traitsForAnimation = [];
    
    // Cargar skin base del Adrian
    let baseImagePath;
    if (useMannequin) {
      baseImagePath = `${baseUrl}/traits/ADRIAN/mannequin.svg`;
    } else {
      baseImagePath = `${baseUrl}/traits/ADRIAN/GEN${gen}-${skinType}.svg`;
    }
    
    console.log(`[displacement] Cargando skin base: ${baseImagePath}`);
    const skinPngBuffer = await loadSvgFromUrl(baseImagePath, `skin_${cleanTokenId}`);
    
    if (skinPngBuffer) {
      traitsForAnimation.push({
        traitId: 'SKIN_BASE',
        category: 'ADRIAN',
        layers: { normalLayer: skinPngBuffer, hasDisplacement: false },
        hasDisplacement: false,
        isBaseSkin: true // Marcar como skin base (se moverá menos en la explosión)
      });
      console.log(`[displacement] ✅ Skin base cargado correctamente`);
    } else {
      console.error(`[displacement] ❌ Error cargando skin base`);
    }
    
    // ===== 3. OBTENER TRAITS EQUIPADOS =====
    console.log(`[displacement] Obteniendo traits equipados para token ${cleanTokenId}...`);
    const nested = await traitsExtension.getAllEquippedTraits(cleanTokenId);
    const categories = nested[0];
    const traitIds = nested[1];
    
    console.log(`[displacement] Traits encontrados: ${traitIds.length} traits`);
    
    // Crear mapa de traits equipados por categoría
    const equippedTraits = {};
    categories.forEach((category, index) => {
      const normalizedCategory = normalizeCategory(category);
      const traitId = traitIds[index].toString();
      equippedTraits[normalizedCategory] = traitId;
    });
    
    console.log(`[displacement] Traits equipados:`, Object.keys(equippedTraits).join(', '));
    
    // ===== 4. CARGAR BACKGROUND SI EXISTE =====
    if (equippedTraits['BACKGROUND']) {
      const bgTraitId = equippedTraits['BACKGROUND'];
      const bgUrl = `${baseUrl}/labimages/${bgTraitId}.svg`;
      
      console.log(`[displacement] Cargando BACKGROUND: ${bgUrl}`);
      const bgPngBuffer = await loadSvgFromUrl(bgUrl, `bg_${bgTraitId}`);
      
      if (bgPngBuffer) {
        // Insertar al principio (detrás de todo, incluso del skin)
        traitsForAnimation.unshift({
          traitId: bgTraitId,
          category: 'BACKGROUND',
          layers: { normalLayer: bgPngBuffer, hasDisplacement: false },
          hasDisplacement: false,
          isBaseSkin: true, // BACKGROUND también se queda fijo
          isBackground: true
        });
        console.log(`[displacement] ✅ BACKGROUND (${bgTraitId}) cargado`);
      }
    }
    
    // ===== 5. CARGAR TRAITS EN ORDEN CORRECTO (como adrianzero-renderer) =====
    // Los traits normales en orden
    for (const category of TRAIT_ORDER) {
      if (equippedTraits[category]) {
        const traitId = equippedTraits[category];
        
        // LÓGICA DE EXCLUSIVIDAD: SERUMS solo si NO hay EYES
        if (category === 'SERUMS') {
          const eyesTrait = equippedTraits['EYES'];
          if (eyesTrait && eyesTrait !== 'None' && eyesTrait !== '') {
            console.log(`[displacement] 🚫 Saltando SERUMS porque hay EYES activo`);
            continue;
          }
        }
        
        try {
          const traitLayers = await loadTraitWithDisplacement(traitId, true);
          traitsForAnimation.push({
            traitId,
            category,
            layers: traitLayers,
            hasDisplacement: traitLayers.hasDisplacement || false,
            isBaseSkin: false
          });
          console.log(`[displacement] ✅ Trait ${category} (${traitId}) cargado`);
        } catch (error) {
          console.error(`[displacement] ❌ Error cargando trait ${category} (${traitId}):`, error.message);
        }
      }
    }
    
    // ===== 6. CARGAR TOP TRAITS =====
    for (const category of TOP_ORDER) {
      if (equippedTraits[category]) {
        const traitId = equippedTraits[category];
        
        try {
          const traitLayers = await loadTraitWithDisplacement(traitId, true);
          traitsForAnimation.push({
            traitId,
            category,
            layers: traitLayers,
            hasDisplacement: traitLayers.hasDisplacement || false,
            isBaseSkin: false
          });
          console.log(`[displacement] ✅ TOP trait ${category} (${traitId}) cargado`);
        } catch (error) {
          console.error(`[displacement] ❌ Error cargando TOP trait ${category} (${traitId}):`, error.message);
        }
      }
    }
    
    if (traitsForAnimation.length === 0) {
      return res.status(500).json({ error: 'No traits could be loaded' });
    }
    
    console.log(`[displacement] ✅ ${traitsForAnimation.length} capas cargadas para animación (incluyendo skin base)`);
    
    // Crear generador de frames con efecto Apple Exploded View (5 fases)
    // Stagger adaptativo: ~45ms equivalente en frames
    const staggerMs = 45;
    const msPerFrame = delay;
    const staggerFramesCalc = Math.max(1, Math.round(staggerMs / msPerFrame));
    
    const frameGenerator = await createDisplacementFrameGenerator({
      traits: traitsForAnimation,
      width: size,
      height: size,
      totalFrames: frames,
      distance: scaledDistance,
      delay: delay,
      staggerFrames: staggerFramesCalc
    });
    
    // Generar GIF usando el sistema existente
    console.log(`[displacement] 🎬 Generando GIF con ${frames} frames a ${size}x${size}px...`);
    const gifConfig = {
      stableLayers: [], // Todo se mueve, no hay capas estables
      animatedTraits: [],
      width: size,
      height: size,
      delay: delay,
      totalFrames: frames, // IMPORTANTE: pasar totalFrames para customFrameGenerator
      customFrameGenerator: frameGenerator
    };
    
    const gifBuffer = await generateGifFromLayers(gifConfig);
    
    console.log(`[displacement] ✅ GIF generado exitosamente (${gifBuffer.length} bytes, ${size}x${size}px)`);
    
    // Headers de respuesta
    res.setHeader('Content-Type', 'image/gif');
    res.setHeader('Cache-Control', 'public, max-age=3600'); // Cache por 1 hora
    res.setHeader('X-Displacement-Frames', frames.toString());
    res.setHeader('X-Displacement-Distance', distance.toString());
    res.setHeader('X-Displacement-Size', size.toString());
    res.setHeader('X-Displacement-Traits', traitsForAnimation.length.toString());
    
    return res.status(200).send(gifBuffer);
    
  } catch (error) {
    console.error(`[displacement] ❌ Error generando animación de displacement:`, error.message);
    console.error(`[displacement] Stack:`, error.stack);
    
    // Detectar si es un timeout
    if (error.message.includes('timeout') || error.message.includes('TIMEOUT') || error.name === 'AbortError') {
      return res.status(504).json({
        error: 'Request timeout',
        message: 'La generación del GIF tomó demasiado tiempo. Intenta con menos frames o menor distancia.',
        suggestion: `Usa frames=${Math.max(1, Math.floor(frames * 0.7))} o distance=${Math.max(50, Math.floor(distance * 0.7))}`
      });
    }
    
    return res.status(500).json({
      error: 'Error generating displacement animation',
      details: error.message
    });
  }
}
