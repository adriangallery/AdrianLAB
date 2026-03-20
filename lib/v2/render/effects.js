// ============================================
// V2 Effects — Shadow, glow, BN, UV, blackout, closeup, messages
// ============================================
// Pixel-level effects applied after composition.
// Reproduces V1 effects exactly.

import { createCanvas, registerFont } from 'canvas';
import path from 'path';

// ===== SHADOW =====
// Offset shadow: -40px left, +15px down, 30% opacity black silhouette
// Only if NOT glow active
export function applyShadow(canvas, contentCanvas) {
  const ctx = canvas.getContext('2d');
  const w = contentCanvas.width;
  const h = contentCanvas.height;

  const shadowCanvas = createCanvas(w, h);
  const shadowCtx = shadowCanvas.getContext('2d');
  shadowCtx.drawImage(contentCanvas, 0, 0, w, h);

  const imgData = shadowCtx.getImageData(0, 0, w, h);
  const data = imgData.data;
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] !== 0) {
      data[i] = 0;
      data[i + 1] = 0;
      data[i + 2] = 0;
      data[i + 3] = Math.round(data[i + 3] * 0.3);
    }
  }
  shadowCtx.putImageData(imgData, 0, 0);

  ctx.drawImage(shadowCanvas, -40, 15, 1000, 1000, 0, 0, 1000, 1000);
  ctx.drawImage(contentCanvas, 0, 0, 1000, 1000, 0, 0, 1000, 1000);
}

// ===== BLACKOUT =====
// Full black silhouette preserving alpha
// Only if NOT shadow and NOT glow active
export function applyBlackout(canvas, contentCanvas) {
  const ctx = canvas.getContext('2d');
  const w = contentCanvas.width;
  const h = contentCanvas.height;

  const blackoutCanvas = createCanvas(w, h);
  const blackoutCtx = blackoutCanvas.getContext('2d');
  blackoutCtx.drawImage(contentCanvas, 0, 0, w, h);

  const imgData = blackoutCtx.getImageData(0, 0, w, h);
  const data = imgData.data;
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] !== 0) {
      data[i] = 0;
      data[i + 1] = 0;
      data[i + 2] = 0;
      // Keep alpha as-is
    }
  }
  blackoutCtx.putImageData(imgData, 0, 0);

  ctx.drawImage(blackoutCanvas, 0, 0, 1000, 1000, 0, 0, 1000, 1000);
}

// ===== GLOW =====
// Rainbow glow: 5 layers scaled 1.05-1.25x, HSL coloring
// Has priority over shadow/blackout
export function applyGlow(canvas, contentCanvas, hasMessage = false) {
  const ctx = canvas.getContext('2d');

  const glowLayers = [
    { scale: 1.05, opacity: 0.6 },
    { scale: 1.10, opacity: 0.4 },
    { scale: 1.15, opacity: 0.3 },
    { scale: 1.20, opacity: 0.2 },
    { scale: 1.25, opacity: 0.15 },
  ];

  for (const layer of glowLayers) {
    const layerSize = Math.round(1000 * layer.scale);
    const layerOffset = (1000 - layerSize) / 2;

    const layerCanvas = createCanvas(layerSize, layerSize);
    const layerCtx = layerCanvas.getContext('2d');
    layerCtx.drawImage(contentCanvas, 0, 0, layerSize, layerSize);

    const imgData = layerCtx.getImageData(0, 0, layerSize, layerSize);
    const data = imgData.data;

    for (let i = 0; i < data.length; i += 4) {
      const a = data[i + 3];
      if (a === 0) continue;

      const x = (i / 4) % layerSize;
      const y = Math.floor((i / 4) / layerSize);
      const dx = x - layerSize / 2;
      const dy = y - layerSize / 2;
      const distance = Math.sqrt(dx * dx + dy * dy);
      const maxDist = layerSize / 2;
      const angle = (Math.atan2(dy, dx) + Math.PI) / (2 * Math.PI);

      const hue = (angle * 360 + distance * 0.1) % 360;
      const lightness = 50 + (distance / maxDist) * 30;
      const [r, g, b] = hslToRgb(hue / 360, 1, lightness / 100);

      data[i] = r;
      data[i + 1] = g;
      data[i + 2] = b;
      data[i + 3] = Math.round(a * layer.opacity);
    }
    layerCtx.putImageData(imgData, 0, 0);

    if (hasMessage) {
      ctx.drawImage(layerCanvas, layerOffset, layerOffset, 1000, 1000, 0, 0, 1000, 1000);
    } else {
      ctx.drawImage(layerCanvas, layerOffset, layerOffset);
    }
  }

  // Draw original on top
  if (hasMessage) {
    ctx.drawImage(contentCanvas, 0, 0, 1000, 1000, 0, 0, 1000, 1000);
  } else {
    ctx.drawImage(contentCanvas, 0, 0, 1000, 1000);
  }
}

// ===== CLOSEUP =====
// Crop 640x640 from (200, 85)
export function applyCloseup(canvas) {
  const closeupCanvas = createCanvas(640, 640);
  const closeupCtx = closeupCanvas.getContext('2d');
  closeupCtx.drawImage(canvas, 200, 85, 640, 640, 0, 0, 640, 640);
  return closeupCanvas;
}

// ===== BN (Black & White) =====
// Standard luminance grayscale: 0.299*R + 0.587*G + 0.114*B
export function applyBN(canvas) {
  const ctx = canvas.getContext('2d');
  const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imgData.data;

  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] === 0) continue;
    const gray = Math.round(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]);
    data[i] = gray;
    data[i + 1] = gray;
    data[i + 2] = gray;
  }
  ctx.putImageData(imgData, 0, 0);
}

// ===== UV (Blacklight) =====
// Map luminance to rainbow: Magenta→Cyan→Spring Green→Green Yellow→Black
export function applyUV(canvas) {
  const ctx = canvas.getContext('2d');
  const w = canvas.width;
  const h = canvas.height;

  const imgData = ctx.getImageData(0, 0, w, h);
  const srcData = imgData.data;
  const uvData = ctx.createImageData(w, h);

  for (let i = 0; i < srcData.length; i += 4) {
    if (srcData[i + 3] === 0) {
      uvData.data[i + 3] = 0;
      continue;
    }

    const gray = Math.round(0.299 * srcData[i] + 0.587 * srcData[i + 1] + 0.114 * srcData[i + 2]);
    let [r, g, b] = interpolateUV(gray);

    // Brightness boost (1.4x)
    r = Math.min(255, Math.round(r * 1.4));
    g = Math.min(255, Math.round(g * 1.4));
    b = Math.min(255, Math.round(b * 1.4));

    // Saturation boost (1.3x)
    const avg = (r + g + b) / 3;
    const factor = 1.3;
    r = Math.min(255, Math.max(0, Math.round(avg + (r - avg) * factor)));
    g = Math.min(255, Math.max(0, Math.round(avg + (g - avg) * factor)));
    b = Math.min(255, Math.max(0, Math.round(avg + (b - avg) * factor)));

    uvData.data[i] = r;
    uvData.data[i + 1] = g;
    uvData.data[i + 2] = b;
    uvData.data[i + 3] = 220;
  }

  // Apply blur (radius 2)
  const blurredData = boxBlur(uvData, w, h, 2);
  ctx.putImageData(blurredData, 0, 0);

  // Final alpha boost
  const finalData = ctx.getImageData(0, 0, w, h);
  for (let i = 0; i < finalData.data.length; i += 4) {
    if (finalData.data[i + 3] > 0) {
      finalData.data[i + 3] = Math.min(255, Math.round(finalData.data[i + 3] * 1.1));
    }
  }
  ctx.putImageData(finalData, 0, 0);
}

// ===== MESSAGES =====
// Comic speech bubble with pixel-art border
export function applyMessages(canvas, messageText, useAdrianFont = false) {
  const ctx = canvas.getContext('2d');

  // Register font
  try {
    const fontPath = path.join(process.cwd(), 'public', 'fonts', 'retro', 'PressStart2P-Regular.ttf');
    registerFont(fontPath, { family: 'PressStart2P' });
  } catch (e) { /* may already be registered */ }

  const fontFamily = useAdrianFont ? 'AdrianZERO' : 'PressStart2P';
  const fontSize = useAdrianFont ? 182 : 128;
  const margin = 10;
  const textX = 1400;
  const textY = 400;
  const px = 6;

  ctx.font = `${fontSize}px ${fontFamily}`;
  ctx.fillStyle = '#000000';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  const textMetrics = ctx.measureText(messageText);
  const textWidth = textMetrics.width;
  const textHeight = fontSize * 1.2;
  const bubbleHeight = textHeight + margin * 2;
  const bubbleWidth = textWidth + margin * 2;
  const bubbleX = textX - bubbleWidth / 2;
  const bubbleY = textY - bubbleHeight / 2;

  // Shadow
  ctx.fillStyle = 'rgba(0,0,0,0.1)';
  ctx.fillRect(bubbleX + px, bubbleY + bubbleHeight + px, bubbleWidth, px);
  ctx.fillRect(bubbleX + 2 * px, bubbleY + bubbleHeight + 2 * px, bubbleWidth - px, px);
  ctx.fillRect(bubbleX + bubbleWidth + px, bubbleY + px, px, bubbleHeight);
  ctx.fillRect(bubbleX + bubbleWidth + 2 * px, bubbleY + 2 * px, px, bubbleHeight - px);

  // White background
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(bubbleX, bubbleY, bubbleWidth, bubbleHeight);

  // Black border
  ctx.fillStyle = '#000000';
  ctx.fillRect(bubbleX, bubbleY - px, bubbleWidth, px);
  ctx.fillRect(bubbleX, bubbleY + bubbleHeight, bubbleWidth, px);
  ctx.fillRect(bubbleX - px, bubbleY, px, bubbleHeight);
  ctx.fillRect(bubbleX + bubbleWidth, bubbleY, px, bubbleHeight);

  // Rounded corners (2-level staircase)
  // Top-left
  ctx.fillRect(bubbleX - px, bubbleY - px, px, px);
  ctx.fillRect(bubbleX - 2 * px, bubbleY, px, px);
  ctx.fillRect(bubbleX, bubbleY - 2 * px, px, px);
  // Top-right
  ctx.fillRect(bubbleX + bubbleWidth, bubbleY - px, px, px);
  ctx.fillRect(bubbleX + bubbleWidth + px, bubbleY, px, px);
  ctx.fillRect(bubbleX + bubbleWidth - px, bubbleY - 2 * px, px, px);
  // Bottom-left
  ctx.fillRect(bubbleX - px, bubbleY + bubbleHeight, px, px);
  ctx.fillRect(bubbleX - 2 * px, bubbleY + bubbleHeight - px, px, px);
  ctx.fillRect(bubbleX, bubbleY + bubbleHeight + px, px, px);
  // Bottom-right
  ctx.fillRect(bubbleX + bubbleWidth, bubbleY + bubbleHeight, px, px);
  ctx.fillRect(bubbleX + bubbleWidth + px, bubbleY + bubbleHeight - px, px, px);
  ctx.fillRect(bubbleX + bubbleWidth - px, bubbleY + bubbleHeight + px, px, px);

  // Tail
  const tailBaseX = bubbleX + 3 * px;
  const tailBaseY = bubbleY + bubbleHeight;
  ctx.fillStyle = '#000000';
  ctx.fillRect(tailBaseX,          tailBaseY + px,     2 * px, px);
  ctx.fillRect(tailBaseX - px,     tailBaseY + 2 * px, 2 * px, px);
  ctx.fillRect(tailBaseX - 2 * px, tailBaseY + 3 * px, 2 * px, px);
  ctx.fillRect(tailBaseX - 3 * px, tailBaseY + 4 * px, 2 * px, px);
  ctx.fillRect(tailBaseX - 4 * px, tailBaseY + 5 * px, 2 * px, px);

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(tailBaseX,          tailBaseY,          2 * px, px);
  ctx.fillRect(tailBaseX - px,     tailBaseY + px,     2 * px, px);
  ctx.fillRect(tailBaseX - 2 * px, tailBaseY + 2 * px, 2 * px, px);
  ctx.fillRect(tailBaseX - 3 * px, tailBaseY + 3 * px, 2 * px, px);

  // Text
  ctx.fillStyle = '#000000';
  ctx.fillText(messageText, textX, textY);
}

// ===== PARENT TEXT =====
export function applyParentText(canvas, sourceId) {
  const ctx = canvas.getContext('2d');
  try {
    const fontPath = path.join(process.cwd(), 'public', 'fonts', 'retro', 'PressStart2P-Regular.ttf');
    registerFont(fontPath, { family: 'PressStart2P' });
  } catch (e) { /* may already be registered */ }

  ctx.font = 'bold 32px PressStart2P';
  ctx.fillStyle = '#FFFFFF';
  ctx.textBaseline = 'top';
  ctx.textAlign = 'left';
  ctx.fillText(`PARENT #${sourceId}`, 20, 20);
}

// ===== HELPERS =====

function hslToRgb(h, s, l) {
  let r, g, b;
  if (s === 0) {
    r = g = b = l;
  } else {
    const hue2rgb = (p, q, t) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    };
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1 / 3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1 / 3);
  }
  return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
}

function interpolateUV(value) {
  const colors = [
    [255, 0, 255],   // Magenta
    [0, 255, 255],   // Cyan
    [0, 250, 154],   // Medium Spring Green
    [173, 255, 47],  // Green Yellow
    [0, 0, 0],       // Black
  ];
  const steps = colors.length - 1;
  const step = 255 / steps;
  let index = Math.floor(value / step);
  if (index >= steps) index = steps - 1;
  const t = (value - step * index) / step;
  const [r1, g1, b1] = colors[index];
  const [r2, g2, b2] = colors[index + 1];
  return [
    Math.round(r1 + (r2 - r1) * t),
    Math.round(g1 + (g2 - g1) * t),
    Math.round(b1 + (b2 - b1) * t),
  ];
}

function boxBlur(imageData, w, h, radius) {
  const src = imageData.data;
  // Use createCanvas to get a valid ImageData (Node.js has no global ImageData)
  const tmpCanvas = createCanvas(w, h);
  const out = tmpCanvas.getContext('2d').createImageData(w, h);
  const dst = out.data;

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let r = 0, g = 0, b = 0, a = 0, count = 0;
      for (let dy = -radius; dy <= radius; dy++) {
        for (let dx = -radius; dx <= radius; dx++) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || nx >= w || ny < 0 || ny >= h) continue;
          const idx = (ny * w + nx) * 4;
          r += src[idx];
          g += src[idx + 1];
          b += src[idx + 2];
          a += src[idx + 3];
          count++;
        }
      }
      const idx = (y * w + x) * 4;
      dst[idx] = Math.round(r / count);
      dst[idx + 1] = Math.round(g / count);
      dst[idx + 2] = Math.round(b / count);
      dst[idx + 3] = Math.round(a / count);
    }
  }
  return out;
}
