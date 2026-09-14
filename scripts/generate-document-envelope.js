/**
 * Script para generar un sobre de documentos en pixel art
 * Tamaño: 1024x1024 píxeles
 */

import { createCanvas } from 'canvas';
import fs from 'fs';
import path from 'path';

// Configuración
const SIZE = 1024;
const PIXEL_SIZE = 8; // Tamaño de cada "píxel" para el estilo pixel art
const PIXELS_PER_UNIT = SIZE / PIXEL_SIZE; // 128 píxeles lógicos

// Colores en formato RGB - Estilo sobre de documentos
const colors = {
  envelope: { r: 245, g: 245, b: 240 },     // Color sobre beige claro
  envelopeDark: { r: 220, g: 220, b: 210 }, // Sobre oscuro (sombras)
  envelopeLight: { r: 255, g: 255, b: 250 }, // Sobre claro (brillos)
  envelopeFold: { r: 200, g: 200, b: 190 }, // Líneas de doblez
  flap: { r: 230, g: 230, b: 225 },         // Solapa del sobre
  flapDark: { r: 210, g: 210, b: 200 },     // Solapa oscura
  window: { r: 200, g: 220, b: 240 },       // Ventana transparente (azul claro)
  windowBorder: { r: 150, g: 170, b: 190 }, // Borde de ventana
  seal: { r: 200, g: 50, b: 50 },           // Sello rojo
  sealGloss: { r: 255, g: 100, b: 100 },     // Brillo del sello
  address: { r: 50, g: 50, b: 50 },         // Texto de dirección
  addressLines: { r: 180, g: 180, b: 180 }, // Líneas de dirección
  shadow: { r: 0, g: 0, b: 0, a: 0.2 },     // Sombra del sobre
  background: { r: 250, g: 250, b: 250 }    // Fondo claro
};

function createPixelArtDocumentEnvelope() {
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
  
  // Centro del sobre (en coordenadas de píxeles lógicos)
  const centerX = PIXELS_PER_UNIT / 2;
  const centerY = PIXELS_PER_UNIT / 2;
  
  // Dimensiones del sobre (en píxeles lógicos)
  const envelopeWidth = 35;
  const envelopeHeight = 25;
  
  // Posición del sobre (centrada)
  const envelopeX = centerX - envelopeWidth / 2;
  const envelopeY = centerY - envelopeHeight / 2;
  
  // 1. Sombra del sobre
  const shadowX = envelopeX + 2;
  const shadowY = envelopeY + envelopeHeight + 2;
  const shadowWidth = envelopeWidth + 1;
  const shadowHeight = 3;
  
  ctx.fillStyle = `rgba(${colors.shadow.r}, ${colors.shadow.g}, ${colors.shadow.b}, ${colors.shadow.a})`;
  ctx.fillRect(
    shadowX * PIXEL_SIZE,
    shadowY * PIXEL_SIZE,
    shadowWidth * PIXEL_SIZE,
    shadowHeight * PIXEL_SIZE
  );
  
  // 2. Cuerpo principal del sobre (rectángulo)
  const bodyX = envelopeX;
  const bodyY = envelopeY + 5; // Espacio para la solapa
  const bodyWidth = envelopeWidth;
  const bodyHeight = envelopeHeight - 5;
  
  // Base del sobre
  drawRect(bodyX, bodyY, bodyWidth, bodyHeight, colors.envelope);
  
  // Bordes del sobre
  drawRect(bodyX, bodyY, bodyWidth, 1, colors.envelopeDark);
  drawRect(bodyX, bodyY + bodyHeight - 1, bodyWidth, 1, colors.envelopeDark);
  drawRect(bodyX, bodyY, 1, bodyHeight, colors.envelopeDark);
  drawRect(bodyX + bodyWidth - 1, bodyY, 1, bodyHeight, colors.envelopeDark);
  
  // 3. Solapa triangular del sobre (parte superior)
  const flapX = envelopeX;
  const flapY = envelopeY;
  const flapWidth = envelopeWidth;
  const flapHeight = 5;
  
  // Dibujar solapa triangular
  for (let y = 0; y < flapHeight; y++) {
    const widthAtY = flapWidth - (y * 2);
    const xOffset = y;
    drawRect(flapX + xOffset, flapY + y, widthAtY, 1, colors.flap);
    
    // Borde de la solapa
    if (y === 0) {
      // Borde superior (línea diagonal)
      for (let x = 0; x < flapWidth; x++) {
        if (x < y + 1 || x >= flapWidth - y - 1) {
          drawPixel(flapX + x, flapY + y, colors.flapDark);
        }
      }
    }
  }
  
  // Línea de doblez de la solapa
  drawRect(flapX, bodyY, flapWidth, 1, colors.envelopeFold);
  
  // 4. Ventana transparente en el sobre (típica de sobres de documentos)
  const windowX = bodyX + 8;
  const windowY = bodyY + 6;
  const windowWidth = 19;
  const windowHeight = 8;
  
  // Fondo de la ventana (azul claro, simulando plástico transparente)
  drawRect(windowX, windowY, windowWidth, windowHeight, colors.window);
  
  // Borde de la ventana
  drawRect(windowX, windowY, windowWidth, 1, colors.windowBorder);
  drawRect(windowX, windowY + windowHeight - 1, windowWidth, 1, colors.windowBorder);
  drawRect(windowX, windowY, 1, windowHeight, colors.windowBorder);
  drawRect(windowX + windowWidth - 1, windowY, 1, windowHeight, colors.windowBorder);
  
  // Líneas internas de la ventana (simulando transparencia)
  drawRect(windowX + 2, windowY + 2, windowWidth - 4, 1, colors.windowBorder);
  drawRect(windowX + 2, windowY + 5, windowWidth - 4, 1, colors.windowBorder);
  
  // 5. Dirección visible a través de la ventana (simulada)
  const addressX = windowX + 2;
  const addressY = windowY + 3;
  
  // Líneas de dirección (simulando texto)
  drawRect(addressX, addressY, windowWidth - 4, 1, colors.addressLines);
  drawRect(addressX, addressY + 2, windowWidth - 4, 1, colors.addressLines);
  drawRect(addressX, addressY + 4, Math.floor((windowWidth - 4) / 2), 1, colors.addressLines);
  
  // 6. Sello de cierre (en la solapa)
  const sealX = envelopeX + Math.floor(envelopeWidth / 2) - 2;
  const sealY = bodyY - 2;
  const sealSize = 4;
  
  // Sello rojo circular
  drawRect(sealX, sealY, sealSize, sealSize, colors.seal);
  
  // Brillo del sello
  drawPixel(sealX + 1, sealY + 1, colors.sealGloss);
  
  // Borde del sello
  drawRect(sealX, sealY, sealSize, 1, colors.envelopeDark);
  drawRect(sealX, sealY + sealSize - 1, sealSize, 1, colors.envelopeDark);
  drawRect(sealX, sealY, 1, sealSize, colors.envelopeDark);
  drawRect(sealX + sealSize - 1, sealY, 1, sealSize, colors.envelopeDark);
  
  // 7. Líneas de dirección en el sobre (debajo de la ventana)
  const addressLineX = bodyX + 6;
  const addressLineY = bodyY + 16;
  const addressLineWidth = 23;
  
  // Líneas de dirección
  drawRect(addressLineX, addressLineY, addressLineWidth, 1, colors.addressLines);
  drawRect(addressLineX, addressLineY + 2, addressLineWidth, 1, colors.addressLines);
  drawRect(addressLineX, addressLineY + 4, Math.floor(addressLineWidth * 0.7), 1, colors.addressLines);
  
  // 8. Sello de correos (opcional, en la esquina superior derecha)
  const stampX = bodyX + bodyWidth - 8;
  const stampY = bodyY + 2;
  const stampWidth = 6;
  const stampHeight = 5;
  
  // Fondo del sello (blanco)
  drawRect(stampX, stampY, stampWidth, stampHeight, colors.envelopeLight);
  
  // Borde del sello (diseño de sello postal)
  drawRect(stampX, stampY, stampWidth, 1, colors.address);
  drawRect(stampX, stampY + stampHeight - 1, stampWidth, 1, colors.address);
  drawRect(stampX, stampY, 1, stampHeight, colors.address);
  drawRect(stampX + stampWidth - 1, stampY, 1, stampHeight, colors.address);
  
  // Diseño del sello (líneas dentadas)
  for (let i = 1; i < stampWidth - 1; i += 2) {
    drawPixel(stampX + i, stampY, colors.address);
    drawPixel(stampX + i, stampY + stampHeight - 1, colors.address);
  }
  for (let i = 1; i < stampHeight - 1; i += 2) {
    drawPixel(stampX, stampY + i, colors.address);
    drawPixel(stampX + stampWidth - 1, stampY + i, colors.address);
  }
  
  // 9. Reflejos y sombras para dar profundidad
  // Reflejo en el sobre (luz desde arriba-izquierda)
  for (let i = 0; i < 3; i++) {
    drawPixel(bodyX + 3 + i, bodyY + 3 + i, colors.envelopeLight);
  }
  
  // Sombra en el borde inferior derecho
  for (let i = 0; i < 2; i++) {
    drawPixel(bodyX + bodyWidth - 3 - i, bodyY + bodyHeight - 2 - i, colors.envelopeDark);
  }
  
  // 10. Líneas de doblez en las esquinas (típicas de sobres)
  // Esquina superior izquierda
  drawPixel(bodyX + 1, bodyY + 1, colors.envelopeFold);
  drawPixel(bodyX + 2, bodyY + 1, colors.envelopeFold);
  drawPixel(bodyX + 1, bodyY + 2, colors.envelopeFold);
  
  // Esquina superior derecha
  drawPixel(bodyX + bodyWidth - 2, bodyY + 1, colors.envelopeFold);
  drawPixel(bodyX + bodyWidth - 3, bodyY + 1, colors.envelopeFold);
  drawPixel(bodyX + bodyWidth - 2, bodyY + 2, colors.envelopeFold);
  
  return canvas;
}

// Generar la imagen
console.log('🎨 Generando sobre de documentos en pixel art...');
const canvas = createPixelArtDocumentEnvelope();
const buffer = canvas.toBuffer('image/png');

// Guardar el archivo
const outputPath = path.join(process.cwd(), 'public', 'document-envelope-1024.png');
fs.writeFileSync(outputPath, buffer);

console.log(`✅ Imagen generada exitosamente: ${outputPath}`);
console.log(`📦 Tamaño: ${SIZE}x${SIZE} píxeles`);
console.log(`🎮 Estilo: Pixel art (${PIXEL_SIZE}x${PIXEL_SIZE} píxeles lógicos)`);
console.log(`✉️  Contenido: Sobre de documentos con ventana transparente`);
