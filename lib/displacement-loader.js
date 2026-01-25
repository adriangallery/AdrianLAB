/**
 * Loader para traits con displacement/extrude
 * Carga archivos extruded cuando están disponibles, o genera displacement on-the-fly
 */

import { Resvg } from '@resvg/resvg-js';
import { loadImage } from 'canvas';
import { getCachedSvgPng, setCachedSvgPng } from './svg-png-cache.js';
import { loadLabimagesAsset } from './github-storage.js';
import fs from 'fs';
import path from 'path';

/**
 * Carga un trait con displacement (extruded) si está disponible
 * @param {string|number} traitId - ID del trait
 * @param {boolean} useExtruded - Si intentar cargar versión extruded (default: true)
 * @returns {Promise<Object>} - Objeto con { backLayer, frontLayer } o { normalLayer }
 */
export async function loadTraitWithDisplacement(traitId, useExtruded = true) {
  const traitIdStr = String(traitId);
  
  if (useExtruded) {
    // Intentar cargar versión extruded
    try {
      const extrudedPath = path.join(process.cwd(), 'displacement', `${traitIdStr}_extruded.svg`);
      
      if (fs.existsSync(extrudedPath)) {
        console.log(`[displacement-loader] ✅ Archivo extruded encontrado: ${traitIdStr}_extruded.svg`);
        return await loadExtrudedSvg(extrudedPath, traitIdStr);
      } else {
        console.log(`[displacement-loader] ⚠️ Archivo extruded no encontrado: ${traitIdStr}_extruded.svg, usando versión normal`);
      }
    } catch (error) {
      console.error(`[displacement-loader] ❌ Error cargando extruded para trait ${traitIdStr}:`, error.message);
    }
  }
  
  // Fallback: cargar versión normal
  return await loadNormalTrait(traitIdStr);
}

/**
 * Carga un SVG extruded y separa las capas back y front
 * @param {string} svgPath - Ruta al archivo SVG extruded
 * @param {string} traitId - ID del trait para caché
 * @returns {Promise<Object>} - Objeto con { backLayer, frontLayer } como PNG buffers
 */
async function loadExtrudedSvg(svgPath, traitId) {
  try {
    const svgContent = fs.readFileSync(svgPath, 'utf-8');
    
    // Parsear SVG para extraer grupos extrude_back y extrude_front
    // Usar regex simple para extraer los grupos
    const backMatch = svgContent.match(/<g[^>]*id="extrude_back"[^>]*>([\s\S]*?)<\/g>/);
    const frontMatch = svgContent.match(/<g[^>]*id="extrude_front"[^>]*>([\s\S]*?)<\/g>/);
    
    // Extraer atributos del SVG raíz (width, height)
    const svgMatch = svgContent.match(/<svg[^>]*>/);
    const svgAttrs = svgMatch ? svgMatch[0] : '<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="1000">';
    
    let backLayer = null;
    let frontLayer = null;
    
    // Generar SVG solo con back layer
    if (backMatch) {
      const backSvg = `${svgAttrs}${backMatch[1]}</svg>`;
      backLayer = await svgToPngBuffer(backSvg, traitId + '_back');
    }
    
    // Generar SVG solo con front layer
    if (frontMatch) {
      const frontSvg = `${svgAttrs}${frontMatch[1]}</svg>`;
      frontLayer = await svgToPngBuffer(frontSvg, traitId + '_front');
    }
    
    if (backLayer && frontLayer) {
      return { backLayer, frontLayer, hasDisplacement: true };
    } else {
      console.warn(`[displacement-loader] ⚠️ No se pudieron extraer ambas capas del SVG extruded, usando versión normal`);
      return await loadNormalTrait(traitId);
    }
  } catch (error) {
    console.error(`[displacement-loader] ❌ Error procesando SVG extruded:`, error.message);
    return await loadNormalTrait(traitId);
  }
}

/**
 * Carga un trait normal (sin displacement)
 * @param {string} traitId - ID del trait
 * @returns {Promise<Object>} - Objeto con { normalLayer } como PNG buffer
 */
async function loadNormalTrait(traitId) {
  try {
    // Intentar cargar desde labimages (usando la misma lógica que otros endpoints)
    const assetPath = `${traitId}.svg`;
    const svgBuffer = await loadLabimagesAsset(assetPath);
    
    if (!svgBuffer) {
      throw new Error(`Asset no encontrado: ${assetPath}`);
    }
    
    const svgContent = svgBuffer.toString();
    
    // Verificar caché SVG→PNG
    const cachedPng = getCachedSvgPng(svgContent);
    if (cachedPng) {
      return { normalLayer: cachedPng, hasDisplacement: false };
    }
    
    // Convertir SVG a PNG
    const pngBuffer = await svgToPngBuffer(svgContent, traitId);
    
    // Guardar en caché
    setCachedSvgPng(svgContent, pngBuffer);
    
    return { normalLayer: pngBuffer, hasDisplacement: false };
  } catch (error) {
    console.error(`[displacement-loader] ❌ Error cargando trait normal ${traitId}:`, error.message);
    throw error;
  }
}

/**
 * Convierte SVG a PNG buffer con caché
 * @param {string|Buffer} svgContent - Contenido SVG
 * @param {string} cacheKey - Clave para el caché
 * @returns {Promise<Buffer>} - Buffer PNG
 */
async function svgToPngBuffer(svgContent, cacheKey) {
  const svgStr = typeof svgContent === 'string' ? svgContent : svgContent.toString();
  
  // Verificar caché
  const cachedPng = getCachedSvgPng(svgStr);
  if (cachedPng) {
    return cachedPng;
  }
  
  // Convertir SVG a PNG
  const resvg = new Resvg(Buffer.from(svgStr), {
    fitTo: {
      mode: 'width',
      value: 1000
    },
    background: 'rgba(255, 255, 255, 0)' // Transparente
  });
  
  const pngBuffer = resvg.render().asPng();
  
  // Guardar en caché
  setCachedSvgPng(svgStr, pngBuffer);
  
  return pngBuffer;
}

/**
 * Genera displacement on-the-fly desde un SVG normal
 * @param {string|Buffer} svgContent - Contenido SVG original
 * @param {number} depth - Profundidad del extrude (default: 10)
 * @param {number} dx - Desplazamiento X por capa (default: 1.0)
 * @param {number} dy - Desplazamiento Y por capa (default: 1.0)
 * @param {number} farFactor - Factor de oscurecimiento en capas lejanas (default: 0.55)
 * @param {number} nearFactor - Factor de oscurecimiento en capas cercanas (default: 0.80)
 * @returns {Promise<Object>} - Objeto con { backLayer, frontLayer } como PNG buffers
 */
export async function generateDisplacementOnTheFly(svgContent, depth = 10, dx = 1.0, dy = 1.0, farFactor = 0.55, nearFactor = 0.80) {
  // Por ahora, esta función es un placeholder
  // La generación completa de displacement requiere parsear el SVG y crear múltiples capas
  // Por simplicidad, retornamos la versión normal hasta que se implemente completamente
  console.log(`[displacement-loader] ⚠️ Generación on-the-fly no implementada completamente, usando versión normal`);
  
  const svgStr = typeof svgContent === 'string' ? svgContent : svgContent.toString();
  const normalLayer = await svgToPngBuffer(svgStr, 'on-the-fly');
  
  return { normalLayer, hasDisplacement: false };
}
