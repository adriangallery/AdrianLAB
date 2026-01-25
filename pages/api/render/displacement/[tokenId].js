// API endpoint for rendering displacement animation with explode effect
import { getContracts } from '../../../../lib/contracts.js';
import { generateGifFromLayers } from '../../../../lib/gif-generator.js';
import { calculateExplodeDisplacement } from '../../../../lib/animation-helpers.js';
import { loadTraitWithDisplacement } from '../../../../lib/displacement-loader.js';
import { loadImage } from 'canvas';
import { createCanvas } from 'canvas';

const DEFAULT_FRAMES = 20;
const DEFAULT_DELAY = 50; // ms
const DEFAULT_DISTANCE = 200; // píxeles
const DEFAULT_WIDTH = 1000;
const DEFAULT_HEIGHT = 1000;

/**
 * Crea un generador de frames personalizado para el efecto de explosión con displacement
 * @param {Object} config - Configuración
 * @returns {Function} - Generador de frames (frameIndex, totalFrames) => { pngBuffer, delay }
 */
function createDisplacementFrameGenerator(config) {
  const {
    traits = [], // Array de { traitId, layers: { backLayer?, frontLayer?, normalLayer? }, hasDisplacement }
    width = DEFAULT_WIDTH,
    height = DEFAULT_HEIGHT,
    totalFrames = DEFAULT_FRAMES,
    distance = DEFAULT_DISTANCE,
    delay = DEFAULT_DELAY
  } = config;
  
  return async (frameIndex, totalFrames) => {
    console.log(`[displacement] Generando frame ${frameIndex + 1}/${totalFrames} con ${traits.length} traits`);
    
    const frameLayers = [];
    
    // Para cada trait, calcular posición de explosión y renderizar
    for (let traitIndex = 0; traitIndex < traits.length; traitIndex++) {
      const trait = traits[traitIndex];
      
      if (!trait.layers) {
        console.warn(`[displacement] Trait ${trait.traitId} sin capas, saltando`);
        continue;
      }
      
      // Calcular posición de explosión para este trait
      const explodeTransform = calculateExplodeDisplacement(
        frameIndex,
        totalFrames,
        traitIndex,
        traits.length,
        distance,
        'ease-out'
      );
      
      console.log(`[displacement] Trait ${trait.traitId} (${traitIndex + 1}/${traits.length}): x=${explodeTransform.x.toFixed(2)}, y=${explodeTransform.y.toFixed(2)}, scale=${explodeTransform.scale.toFixed(2)}`);
      
      if (trait.hasDisplacement && trait.layers.backLayer && trait.layers.frontLayer) {
        // Trait con displacement: renderizar back layer con offset adicional, luego front layer
        try {
          // Back layer: offset adicional para efecto 3D (más atrás)
          const backTransform = {
            x: explodeTransform.x * 0.8, // Back layer se mueve menos
            y: explodeTransform.y * 0.8,
            scale: explodeTransform.scale * 0.95, // Ligeramente más pequeño
            rotation: explodeTransform.rotation * 0.5 // Menos rotación
          };
          
          frameLayers.push({
            pngBuffer: trait.layers.backLayer,
            transform: backTransform
          });
          
          // Front layer: posición principal de explosión
          frameLayers.push({
            pngBuffer: trait.layers.frontLayer,
            transform: explodeTransform
          });
        } catch (error) {
          console.error(`[displacement] Error cargando capas para trait ${trait.traitId}:`, error.message);
        }
      } else if (trait.layers.normalLayer) {
        // Trait normal: solo una capa
        try {
          frameLayers.push({
            pngBuffer: trait.layers.normalLayer,
            transform: explodeTransform
          });
        } catch (error) {
          console.error(`[displacement] Error cargando capa normal para trait ${trait.traitId}:`, error.message);
        }
      }
    }
    
    console.log(`[displacement] Frame ${frameIndex + 1}: ${frameLayers.length} capas para componer`);
    
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
 * @param {Array} layers - Array de capas: [{ pngBuffer, transform?: { x, y, scale, rotation } }, ...]
 * @param {number} width - Ancho del canvas
 * @param {number} height - Alto del canvas
 * @returns {Promise<Buffer>} Buffer PNG del resultado
 */
async function compositeLayers(layers, width = DEFAULT_WIDTH, height = DEFAULT_HEIGHT) {
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');
  
  // Fondo blanco (como en el render normal)
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);
  
  // Dibujar cada capa en orden
  for (let i = 0; i < layers.length; i++) {
    const layer = layers[i];
    
    if (!layer.pngBuffer) {
      console.warn(`[displacement] Capa ${i + 1} sin pngBuffer, saltando`);
      continue;
    }
    
    try {
      const img = await loadImage(layer.pngBuffer);
      
      // Obtener dimensiones reales de la imagen
      const imgWidth = img.width;
      const imgHeight = img.height;
      
      // Si hay transformación, aplicarla
      if (layer.transform) {
        const { x = 0, y = 0, scale = 1, rotation = 0 } = layer.transform;
        
        ctx.save();
        
        // Aplicar transformaciones desde el centro del canvas
        ctx.translate(width / 2 + x, height / 2 + y);
        
        if (rotation !== 0) {
          ctx.rotate(rotation * Math.PI / 180);
        }
        
        if (scale !== 1) {
          ctx.scale(scale, scale);
        }
        
        // Dibujar centrado usando las dimensiones reales de la imagen
        ctx.drawImage(img, -imgWidth / 2, -imgHeight / 2, imgWidth, imgHeight);
        
        ctx.restore();
      } else {
        // Sin transformación, dibujar centrado
        ctx.drawImage(img, (width - imgWidth) / 2, (height - imgHeight) / 2, imgWidth, imgHeight);
      }
    } catch (error) {
      console.error(`[displacement] Error dibujando capa ${i + 1}:`, error.message);
      console.error(`[displacement] Stack:`, error.stack);
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
    
    // Parámetros opcionales
    const frames = parseInt(req.query.frames) || DEFAULT_FRAMES;
    const delay = parseInt(req.query.delay) || DEFAULT_DELAY;
    const distance = parseInt(req.query.distance) || DEFAULT_DISTANCE;
    
    console.log(`[displacement] Configuración: frames=${frames}, delay=${delay}ms, distance=${distance}px`);
    
    // Conectar con los contratos
    const { core, traitsExtension } = await getContracts();
    
    // Obtener traits equipados del token
    console.log(`[displacement] Obteniendo traits equipados para token ${cleanTokenId}...`);
    const nested = await traitsExtension.getAllEquippedTraits(cleanTokenId);
    const categories = nested[0];
    const traitIds = nested[1];
    
    console.log(`[displacement] Traits encontrados: ${traitIds.length} traits`);
    
    if (traitIds.length === 0) {
      return res.status(400).json({ error: 'Token has no equipped traits' });
    }
    
    // Cargar cada trait con displacement
    const traitsWithDisplacement = [];
    for (let i = 0; i < traitIds.length; i++) {
      const traitId = traitIds[i].toString();
      const category = categories[i];
      
      console.log(`[displacement] Cargando trait ${i + 1}/${traitIds.length}: ${traitId} (${category})`);
      
      try {
        const traitLayers = await loadTraitWithDisplacement(traitId, true);
        console.log(`[displacement] ✅ Trait ${traitId} cargado:`, {
          hasDisplacement: traitLayers.hasDisplacement || false,
          hasBackLayer: !!traitLayers.backLayer,
          hasFrontLayer: !!traitLayers.frontLayer,
          hasNormalLayer: !!traitLayers.normalLayer
        });
        traitsWithDisplacement.push({
          traitId,
          category,
          layers: traitLayers,
          hasDisplacement: traitLayers.hasDisplacement || false
        });
      } catch (error) {
        console.error(`[displacement] ❌ Error cargando trait ${traitId}:`, error.message);
        console.error(`[displacement] Stack:`, error.stack);
        // Continuar con los demás traits
      }
    }
    
    if (traitsWithDisplacement.length === 0) {
      return res.status(500).json({ error: 'No traits could be loaded' });
    }
    
    console.log(`[displacement] ✅ ${traitsWithDisplacement.length} traits cargados exitosamente de ${traitIds.length} totales`);
    
    // Crear generador de frames personalizado
    const frameGenerator = createDisplacementFrameGenerator({
      traits: traitsWithDisplacement,
      width: DEFAULT_WIDTH,
      height: DEFAULT_HEIGHT,
      totalFrames: frames,
      distance: distance,
      delay: delay
    });
    
    // Generar GIF usando el sistema existente
    console.log(`[displacement] 🎬 Generando GIF con ${frames} frames...`);
    const gifConfig = {
      stableLayers: [], // Todo se mueve, no hay capas estables
      animatedTraits: [],
      width: DEFAULT_WIDTH,
      height: DEFAULT_HEIGHT,
      delay: delay,
      totalFrames: frames, // IMPORTANTE: pasar totalFrames para customFrameGenerator
      customFrameGenerator: frameGenerator
    };
    
    const gifBuffer = await generateGifFromLayers(gifConfig);
    
    console.log(`[displacement] ✅ GIF generado exitosamente (${gifBuffer.length} bytes)`);
    
    // Headers de respuesta
    res.setHeader('Content-Type', 'image/gif');
    res.setHeader('Cache-Control', 'public, max-age=3600'); // Cache por 1 hora
    res.setHeader('X-Displacement-Frames', frames.toString());
    res.setHeader('X-Displacement-Distance', distance.toString());
    res.setHeader('X-Displacement-Traits', traitsWithDisplacement.length.toString());
    
    return res.status(200).send(gifBuffer);
    
  } catch (error) {
    console.error(`[displacement] ❌ Error generando animación de displacement:`, error.message);
    console.error(`[displacement] Stack:`, error.stack);
    
    return res.status(500).json({
      error: 'Error generating displacement animation',
      details: error.message
    });
  }
}
