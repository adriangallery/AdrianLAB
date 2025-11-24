#!/usr/bin/env node
/**
 * Script para optimizar SVGs pixelados convirtiéndolos a PNG embebido
 * Basado en el proceso documentado en optimize-svg-process.json
 * 
 * Uso: node scripts/optimize-svg.js {traitId}
 * Ejemplo: node scripts/optimize-svg.js 1123
 */

import { Resvg } from '@resvg/resvg-js';
import { createCanvas, loadImage } from 'canvas';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Obtener el traitId de los argumentos
const traitId = process.argv[2];

if (!traitId) {
  console.error('❌ Error: Debes proporcionar un traitId');
  console.log('Uso: node scripts/optimize-svg.js {traitId}');
  console.log('Ejemplo: node scripts/optimize-svg.js 1123');
  process.exit(1);
}

const svgPath = path.join(__dirname, '..', 'public', 'labimages', `${traitId}.svg`);
const pngPath = path.join(__dirname, '..', 'public', 'labimages', `${traitId}.png`);
const backupSvgPath = path.join(__dirname, '..', 'public', 'labimages', `${traitId}.svg.backup`);

console.log(`🔄 Optimizando ${traitId}.svg...`);
console.log(`📁 SVG original: ${svgPath}`);

// Verificar que el archivo existe
if (!fs.existsSync(svgPath)) {
  console.error(`❌ Error: El archivo ${svgPath} no existe`);
  process.exit(1);
}

try {
  // PASO 1: Crear backup del SVG original
  if (!fs.existsSync(backupSvgPath)) {
    console.log('💾 PASO 1 - Creando backup del SVG original...');
    fs.copyFileSync(svgPath, backupSvgPath);
  } else {
    console.log('💾 PASO 1 - Backup ya existe, omitiendo...');
  }

  // PASO 2: Leer el SVG original y convertir a PNG
  console.log('📊 PASO 2 - Leyendo SVG original...');
  const svgContent = fs.readFileSync(svgPath, 'utf8');
  const originalSize = fs.statSync(svgPath).size;
  console.log(`📊 Tamaño original: ${(originalSize / 1024 / 1024).toFixed(2)} MB`);

  console.log('🖼️  PASO 2 - Convirtiendo SVG a PNG...');
  
  let pngBuffer;
  
  // Intentar primero con Resvg (más rápido para archivos pequeños/medianos)
  try {
    console.log('   Intentando con Resvg...');
    const resvg = new Resvg(svgContent, {
      fitTo: {
        mode: 'width',
        value: 1000
      },
      font: {
        loadSystemFonts: false
      }
    });
    pngBuffer = resvg.render().asPng();
    console.log('   ✅ Resvg exitoso');
  } catch (resvgError) {
    // Si Resvg falla (por límite de nodos en archivos muy grandes), usar canvas
    if (resvgError.message.includes('nodes limit') || resvgError.message.includes('parsing failed')) {
      console.log('   ⚠️  Resvg falló (archivo muy grande), usando canvas como fallback...');
      const canvas = createCanvas(1000, 1000);
      const ctx = canvas.getContext('2d');
      
      // Cargar el SVG como imagen usando canvas
      const svgImage = await loadImage(Buffer.from(svgContent));
      
      // Dibujar en el canvas
      ctx.drawImage(svgImage, 0, 0, 1000, 1000);
      
      // Convertir a PNG
      pngBuffer = canvas.toBuffer('image/png');
      console.log('   ✅ Canvas exitoso');
    } else {
      throw resvgError;
    }
  }
  
  fs.writeFileSync(pngPath, pngBuffer);
  const pngSize = fs.statSync(pngPath).size;
  console.log(`✅ PNG creado: ${(pngSize / 1024 / 1024).toFixed(2)} MB (${((1 - pngSize/originalSize) * 100).toFixed(1)}% reducción)`);

  // PASO 3: Crear SVG optimizado con PNG embebido
  console.log('📝 PASO 3 - Creando SVG optimizado con PNG embebido...');
  const base64Png = pngBuffer.toString('base64');
  const optimizedSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="1000" viewBox="0 0 1000 1000" shape-rendering="crispEdges" style="image-rendering: pixelated">
  <image href="data:image/png;base64,${base64Png}" width="1000" height="1000"/>
</svg>`;
  
  // PASO 4: Reemplazar el SVG original con el optimizado
  console.log('💾 PASO 4 - Reemplazando SVG original con optimizado...');
  fs.writeFileSync(svgPath, optimizedSvg);
  const optimizedSize = fs.statSync(svgPath).size;
  console.log(`✅ SVG optimizado: ${(optimizedSize / 1024 / 1024).toFixed(2)} MB (${((1 - optimizedSize/originalSize) * 100).toFixed(1)}% reducción)`);

  // PASO 5: Limpiar archivos temporales (backup y PNG)
  console.log('🧹 PASO 5 - Limpiando archivos temporales...');
  
  if (fs.existsSync(backupSvgPath)) {
    fs.unlinkSync(backupSvgPath);
    console.log(`   ✅ Eliminado: ${backupSvgPath}`);
  }
  
  if (fs.existsSync(pngPath)) {
    fs.unlinkSync(pngPath);
    console.log(`   ✅ Eliminado: ${pngPath}`);
  }

  console.log('\n✅ Optimización completada exitosamente!');
  console.log(`📄 SVG optimizado: ${svgPath}`);
  console.log(`📊 Reducción total: ${((1 - optimizedSize/originalSize) * 100).toFixed(1)}%`);
  
} catch (error) {
  console.error('❌ Error durante la optimización:', error.message);
  if (error.stack) {
    console.error(error.stack);
  }
  
  // Si hay error, restaurar desde backup si existe
  if (fs.existsSync(backupSvgPath)) {
    console.log('🔄 Restaurando desde backup...');
    fs.copyFileSync(backupSvgPath, svgPath);
    console.log('✅ SVG original restaurado');
  }
  
  process.exit(1);
}

