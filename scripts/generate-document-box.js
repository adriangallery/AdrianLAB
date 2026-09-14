/**
 * Script para generar una caja de documentos cerrada en pixel art
 * Tamaño: 1024x1024 píxeles
 */

import { createCanvas } from 'canvas';
import fs from 'fs';
import path from 'path';

// Configuración
const SIZE = 1024;
const PIXEL_SIZE = 8; // Tamaño de cada "píxel" para el estilo pixel art
const PIXELS_PER_UNIT = SIZE / PIXEL_SIZE; // 128 píxeles lógicos

// Colores en formato RGB - Estilo cartón
const colors = {
  cardboard: { r: 218, g: 195, b: 165 },   // Color cartón beige
  cardboardDark: { r: 180, g: 160, b: 135 }, // Cartón oscuro (sombras)
  cardboardLight: { r: 235, g: 220, b: 195 }, // Cartón claro (brillos)
  cardboardLines: { r: 200, g: 180, b: 150 }, // Líneas de textura del cartón
  label: { r: 255, g: 255, b: 255 },      // Etiqueta blanca
  labelBorder: { r: 200, g: 200, b: 200 }, // Borde de etiqueta
  labelText: { r: 30, g: 30, b: 30 },     // Texto de etiqueta oscuro
  labelShadow: { r: 220, g: 220, b: 220 }, // Sombra de etiqueta (pegada)
  shadow: { r: 0, g: 0, b: 0, a: 0.25 },   // Sombra del suelo
  background: { r: 245, g: 245, b: 245 }  // Fondo claro
};

function createPixelArtDocumentBox() {
  // Crear canvas
  const canvas = createCanvas(SIZE, SIZE);
  const ctx = canvas.getContext('2d');
  
  // Desactivar suavizado para estilo pixel art
  ctx.imageSmoothingEnabled = false;
  
  // Fondo
  ctx.fillStyle = `rgb(${colors.background.r}, ${colors.background.g}, ${colors.background.b})`;
  ctx.fillRect(0, 0, SIZE, SIZE);
  
  // Función helper para dibujar un píxel lógico
  const drawPixel = (x, y, color) => {
    const pixelX = Math.floor(x * PIXEL_SIZE);
    const pixelY = Math.floor(y * PIXEL_SIZE);
    ctx.fillStyle = `rgb(${color.r}, ${color.g}, ${color.b})`;
    ctx.fillRect(pixelX, pixelY, PIXEL_SIZE, PIXEL_SIZE);
  };
  
  // Función helper para dibujar rectángulo de píxeles
  const drawRect = (x, y, width, height, color) => {
    for (let py = 0; py < height; py++) {
      for (let px = 0; px < width; px++) {
        drawPixel(x + px, y + py, color);
      }
    }
  };
  
  // Centro de la caja (en coordenadas de píxeles lógicos)
  const centerX = PIXELS_PER_UNIT / 2;
  const centerY = PIXELS_PER_UNIT / 2;
  
  // Dimensiones de la caja (en píxeles lógicos)
  const boxWidth = 40;
  const boxHeight = 30;
  const boxDepth = 25;
  
  // Posición de la caja (centrada)
  const boxX = centerX - boxWidth / 2;
  const boxY = centerY - boxHeight / 2;
  
  // 1. Sombra en el suelo
  const shadowX = boxX + 2;
  const shadowY = boxY + boxDepth + 2;
  const shadowWidth = boxWidth + 4;
  const shadowHeight = 4;
  
  ctx.fillStyle = `rgba(${colors.shadow.r}, ${colors.shadow.g}, ${colors.shadow.b}, ${colors.shadow.a})`;
  ctx.fillRect(
    shadowX * PIXEL_SIZE,
    shadowY * PIXEL_SIZE,
    shadowWidth * PIXEL_SIZE,
    shadowHeight * PIXEL_SIZE
  );
  
  // 2. Cara frontal de la caja (la más visible)
  const frontX = boxX;
  const frontY = boxY + boxDepth;
  const frontWidth = boxWidth;
  const frontHeight = boxHeight;
  
  // Base cartón
  drawRect(frontX, frontY, frontWidth, frontHeight, colors.cardboard);
  
  // Textura de cartón - líneas horizontales
  for (let i = 2; i < frontHeight - 2; i += 3) {
    drawRect(frontX + 1, frontY + i, frontWidth - 2, 1, colors.cardboardLines);
  }
  
  // Borde superior (más claro)
  drawRect(frontX, frontY, frontWidth, 2, colors.cardboardLight);
  
  // Borde inferior (más oscuro)
  drawRect(frontX, frontY + frontHeight - 2, frontWidth, 2, colors.cardboardDark);
  
  // Bordes laterales
  drawRect(frontX, frontY, 2, frontHeight, colors.cardboardDark);
  drawRect(frontX + frontWidth - 2, frontY, 2, frontHeight, colors.cardboardLight);
  
  // Líneas de doblez del cartón (verticales en los bordes)
  for (let i = 2; i < frontHeight - 2; i += 2) {
    drawPixel(frontX + 1, frontY + i, colors.cardboardDark);
    drawPixel(frontX + frontWidth - 2, frontY + i, colors.cardboardLight);
  }
  
  // 3. Etiqueta en el frente (más grande y visible)
  const labelX = frontX + 6;
  const labelY = frontY + 8;
  const labelWidth = 28;
  const labelHeight = 12;
  
  // Sombra de la etiqueta (efecto de pegada)
  drawRect(labelX + 1, labelY + 1, labelWidth, labelHeight, colors.labelShadow);
  
  // Fondo de etiqueta blanca
  drawRect(labelX, labelY, labelWidth, labelHeight, colors.label);
  
  // Borde de etiqueta (gris claro)
  drawRect(labelX, labelY, labelWidth, 1, colors.labelBorder);
  drawRect(labelX, labelY + labelHeight - 1, labelWidth, 1, colors.labelBorder);
  drawRect(labelX, labelY, 1, labelHeight, colors.labelBorder);
  drawRect(labelX + labelWidth - 1, labelY, 1, labelHeight, colors.labelBorder);
  
  // Texto "DOCS" en la etiqueta (más grande y legible)
  const textX = labelX + 5;
  const textY = labelY + 3;
  
  // D (más grande)
  drawRect(textX, textY, 4, 6, colors.labelText);
  drawRect(textX + 1, textY, 3, 1, colors.labelText);
  drawRect(textX + 1, textY + 5, 3, 1, colors.labelText);
  drawRect(textX + 2, textY + 1, 1, 4, colors.labelText);
  
  // O (más grande)
  drawRect(textX + 6, textY, 4, 6, colors.labelText);
  drawRect(textX + 7, textY + 1, 1, 4, colors.labelText);
  drawRect(textX + 9, textY + 1, 1, 4, colors.labelText);
  
  // C (más grande)
  drawRect(textX + 12, textY, 4, 6, colors.labelText);
  drawRect(textX + 12, textY + 1, 1, 4, colors.labelText);
  
  // S (más grande)
  drawRect(textX + 18, textY, 4, 6, colors.labelText);
  drawRect(textX + 18, textY + 2, 3, 1, colors.labelText);
  drawRect(textX + 19, textY + 4, 3, 1, colors.labelText);
  
  // 4. Cara superior de la caja (perspectiva)
  const topX = boxX + 3;
  const topY = boxY;
  const topWidth = boxWidth;
  const topDepth = boxDepth;
  
  // Base cartón
  drawRect(topX, topY, topWidth, topDepth, colors.cardboard);
  
  // Textura de cartón - líneas horizontales
  for (let i = 2; i < topDepth - 2; i += 3) {
    drawRect(topX + 1, topY + i, topWidth - 2, 1, colors.cardboardLines);
  }
  
  // Borde frontal (más claro)
  drawRect(topX, topY, topWidth, 2, colors.cardboardLight);
  
  // Borde trasero (más oscuro)
  drawRect(topX, topY + topDepth - 2, topWidth, 2, colors.cardboardDark);
  
  // Borde izquierdo
  drawRect(topX, topY, 2, topDepth, colors.cardboardDark);
  
  // Borde derecho
  drawRect(topX + topWidth - 2, topY, 2, topDepth, colors.cardboardLight);
  
  // 5. Cara lateral izquierda (perspectiva)
  const sideX = boxX;
  const sideY = boxY + 2;
  const sideWidth = 3;
  const sideHeight = boxHeight;
  
  // Base cartón
  drawRect(sideX, sideY, sideWidth, sideHeight, colors.cardboard);
  
  // Textura de cartón - líneas verticales
  for (let i = 2; i < sideHeight - 2; i += 3) {
    drawRect(sideX + 1, sideY + i, sideWidth - 2, 1, colors.cardboardLines);
  }
  
  // Borde superior
  drawRect(sideX, sideY, sideWidth, 2, colors.cardboardLight);
  
  // Borde inferior
  drawRect(sideX, sideY + sideHeight - 2, sideWidth, 2, colors.cardboardDark);
  
  // Borde izquierdo (más oscuro)
  drawRect(sideX, sideY, 1, sideHeight, colors.cardboardDark);
  
  // 6. Líneas de doblez del cartón (típicas de cajas de cartón)
  // Línea vertical en el centro del frente (doblez)
  for (let i = 2; i < frontHeight - 2; i += 2) {
    drawPixel(frontX + Math.floor(frontWidth / 2), frontY + i, colors.cardboardDark);
  }
  
  // 7. Reflejos sutiles para dar profundidad
  // Reflejo en el frente (luz desde arriba)
  for (let i = 0; i < 4; i++) {
    drawPixel(frontX + 8 + i, frontY + 3 + i, colors.cardboardLight);
  }
  
  // Reflejo en la parte superior
  for (let i = 0; i < 3; i++) {
    drawPixel(topX + 8 + i, topY + 2 + i, colors.cardboardLight);
  }
  
  return canvas;
}

// Generar la imagen
console.log('🎨 Generando caja de documentos en pixel art...');
const canvas = createPixelArtDocumentBox();
const buffer = canvas.toBuffer('image/png');

// Guardar el archivo
const outputPath = path.join(process.cwd(), 'public', 'document-box-1024.png');
fs.writeFileSync(outputPath, buffer);

console.log(`✅ Imagen generada exitosamente: ${outputPath}`);
console.log(`📦 Tamaño: ${SIZE}x${SIZE} píxeles`);
console.log(`🎮 Estilo: Pixel art (${PIXEL_SIZE}x${PIXEL_SIZE} píxeles lógicos)`);
