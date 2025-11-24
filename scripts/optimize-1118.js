#!/usr/bin/env node
/**
 * Script para optimizar el SVG 1118.svg convirtiéndolo a PNG
 * El SVG actual tiene 56MB porque tiene un rect por cada píxel
 * Un PNG optimizado será mucho más pequeño
 */

import { Resvg } from '@resvg/resvg-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const svgPath = path.join(__dirname, '..', 'public', 'labimages', '1118.svg');
const pngPath = path.join(__dirname, '..', 'public', 'labimages', '1118.png');
const backupSvgPath = path.join(__dirname, '..', 'public', 'labimages', '1118.svg.backup');

console.log('🔄 Optimizando 1118.svg...');
console.log(`📁 SVG original: ${svgPath}`);

try {
  // Hacer backup del SVG original
  if (!fs.existsSync(backupSvgPath)) {
    console.log('💾 Creando backup del SVG original...');
    fs.copyFileSync(svgPath, backupSvgPath);
  }

  // Leer el SVG original
  const svgContent = fs.readFileSync(svgPath, 'utf8');
  const originalSize = fs.statSync(svgPath).size;
  console.log(`📊 Tamaño original: ${(originalSize / 1024 / 1024).toFixed(2)} MB`);

  // Convertir SVG a PNG
  console.log('🖼️  Convirtiendo SVG a PNG...');
  const resvg = new Resvg(svgContent, {
    fitTo: {
      mode: 'width',
      value: 1000
    }
  });
  
  const pngBuffer = resvg.render().asPng();
  fs.writeFileSync(pngPath, pngBuffer);
  const pngSize = fs.statSync(pngPath).size;
  console.log(`✅ PNG creado: ${(pngSize / 1024 / 1024).toFixed(2)} MB (${((1 - pngSize/originalSize) * 100).toFixed(1)}% reducción)`);

  // Crear un SVG optimizado que referencie el PNG como imagen embebida
  // Esto mantendrá la compatibilidad pero será mucho más pequeño
  const base64Png = pngBuffer.toString('base64');
  const optimizedSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="1000" viewBox="0 0 1000 1000" shape-rendering="crispEdges" style="image-rendering: pixelated">
  <image href="data:image/png;base64,${base64Png}" width="1000" height="1000"/>
</svg>`;
  
  // Reemplazar el SVG original con el optimizado
  fs.writeFileSync(svgPath, optimizedSvg);
  const optimizedSize = fs.statSync(svgPath).size;
  console.log(`✅ SVG optimizado: ${(optimizedSize / 1024 / 1024).toFixed(2)} MB (${((1 - optimizedSize/originalSize) * 100).toFixed(1)}% reducción)`);

  console.log('\n✅ Optimización completada!');
  console.log(`📦 Backup guardado en: ${backupSvgPath}`);
  console.log(`🖼️  PNG disponible en: ${pngPath}`);
  console.log(`📄 SVG optimizado reemplazó el original`);
  
} catch (error) {
  console.error('❌ Error:', error.message);
  if (error.stack) {
    console.error(error.stack);
  }
  process.exit(1);
}
