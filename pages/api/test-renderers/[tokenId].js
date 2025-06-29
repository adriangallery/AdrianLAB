import { createCanvas, loadImage } from 'canvas';
import { Resvg } from '@resvg/resvg-js';
import path from 'path';
import fs from 'fs';

export default async function handler(req, res) {
  try {
    let { tokenId } = req.query;
    
    if (tokenId && tokenId.endsWith('.png')) {
      tokenId = tokenId.replace('.png', '');
    }
    
    if (!tokenId || isNaN(parseInt(tokenId))) {
      return res.status(400).json({ error: 'Invalid token ID' });
    }

    console.log(`[test-renderers] ===== COMPARACIÓN DE RENDERERS =====`);
    console.log(`[test-renderers] Token ID: ${tokenId}`);

    // Crear canvas grande para comparar renderers
    const canvas = createCanvas(1600, 1200);
    const ctx = canvas.getContext('2d');
    
    // Fondo blanco
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, 1600, 1200);
    
    // ===== RENDERER 1: CANVAS BÁSICO =====
    console.log(`[test-renderers] RENDERER 1: CANVAS BÁSICO`);
    
    // Sección 1: Canvas básico
    ctx.fillStyle = '#f0f0f0';
    ctx.fillRect(50, 50, 700, 500);
    
    ctx.fillStyle = '#000000';
    ctx.font = 'bold 24px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('RENDERER 1: CANVAS BÁSICO', 400, 100);
    
    // Texto con diferentes fuentes
    const fonts1 = [
      { font: '16px sans-serif', color: '#ff0000', y: 150, label: 'SANS-SERIF 16' },
      { font: '24px sans-serif', color: '#00ff00', y: 180, label: 'SANS-SERIF 24' },
      { font: '32px sans-serif', color: '#0000ff', y: 220, label: 'SANS-SERIF 32' },
      { font: '16px Arial', color: '#ff00ff', y: 270, label: 'ARIAL 16' },
      { font: '24px Arial', color: '#ff6600', y: 300, label: 'ARIAL 24' },
      { font: '16px monospace', color: '#800080', y: 340, label: 'MONOSPACE 16' },
      { font: '24px monospace', color: '#008000', y: 370, label: 'MONOSPACE 24' }
    ];

    fonts1.forEach((test, index) => {
      ctx.font = test.font;
      ctx.fillStyle = test.color;
      ctx.textAlign = 'left';
      ctx.fillText(test.label, 100, test.y);
    });

    // ===== RENDERER 2: CANVAS CON STROKE =====
    console.log(`[test-renderers] RENDERER 2: CANVAS CON STROKE`);
    
    // Sección 2: Canvas con stroke
    ctx.fillStyle = '#e0e0e0';
    ctx.fillRect(800, 50, 700, 500);
    
    ctx.fillStyle = '#000000';
    ctx.font = 'bold 24px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('RENDERER 2: CANVAS CON STROKE', 1150, 100);
    
    // Texto con stroke
    const fonts2 = [
      { font: '16px sans-serif', color: '#ff0000', stroke: '#000000', y: 150, label: 'SANS-STROKE' },
      { font: '24px sans-serif', color: '#00ff00', stroke: '#000000', y: 180, label: 'SANS-STROKE 24' },
      { font: '32px sans-serif', color: '#0000ff', stroke: '#ffffff', y: 220, label: 'SANS-STROKE 32' },
      { font: '16px Arial', color: '#ff00ff', stroke: '#000000', y: 270, label: 'ARIAL-STROKE' },
      { font: '24px Arial', color: '#ff6600', stroke: '#000000', y: 300, label: 'ARIAL-STROKE 24' },
      { font: '16px monospace', color: '#800080', stroke: '#000000', y: 340, label: 'MONO-STROKE' },
      { font: '24px monospace', color: '#008000', stroke: '#000000', y: 370, label: 'MONO-STROKE 24' }
    ];

    fonts2.forEach((test, index) => {
      ctx.font = test.font;
      ctx.fillStyle = test.color;
      ctx.strokeStyle = test.stroke;
      ctx.lineWidth = 1;
      ctx.textAlign = 'left';
      ctx.strokeText(test.label, 850, test.y);
      ctx.fillText(test.label, 850, test.y);
    });

    // ===== RENDERER 3: CANVAS CON FONDO =====
    console.log(`[test-renderers] RENDERER 3: CANVAS CON FONDO`);
    
    // Sección 3: Canvas con fondo de texto
    ctx.fillStyle = '#d0d0d0';
    ctx.fillRect(50, 600, 700, 500);
    
    ctx.fillStyle = '#000000';
    ctx.font = 'bold 24px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('RENDERER 3: CANVAS CON FONDO', 400, 650);
    
    // Texto con fondo
    const fonts3 = [
      { font: '16px sans-serif', color: '#ffffff', bg: '#ff0000', y: 700, label: 'SANS-BG-RED' },
      { font: '24px sans-serif', color: '#ffffff', bg: '#00ff00', y: 740, label: 'SANS-BG-GREEN' },
      { font: '32px sans-serif', color: '#ffffff', bg: '#0000ff', y: 790, label: 'SANS-BG-BLUE' },
      { font: '16px Arial', color: '#ffffff', bg: '#ff00ff', y: 840, label: 'ARIAL-BG-MAGENTA' },
      { font: '24px Arial', color: '#ffffff', bg: '#ff6600', y: 880, label: 'ARIAL-BG-ORANGE' },
      { font: '16px monospace', color: '#ffffff', bg: '#800080', y: 920, label: 'MONO-BG-PURPLE' },
      { font: '24px monospace', color: '#ffffff', bg: '#008000', y: 960, label: 'MONO-BG-GREEN' }
    ];

    fonts3.forEach((test, index) => {
      // Fondo
      ctx.fillStyle = test.bg;
      ctx.fillRect(100, test.y - 20, 600, 30);
      
      // Texto
      ctx.font = test.font;
      ctx.fillStyle = test.color;
      ctx.textAlign = 'left';
      ctx.fillText(test.label, 120, test.y);
    });

    // ===== RENDERER 4: CANVAS CON SHADOW =====
    console.log(`[test-renderers] RENDERER 4: CANVAS CON SHADOW`);
    
    // Sección 4: Canvas con sombra
    ctx.fillStyle = '#c0c0c0';
    ctx.fillRect(800, 600, 700, 500);
    
    ctx.fillStyle = '#000000';
    ctx.font = 'bold 24px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('RENDERER 4: CANVAS CON SHADOW', 1150, 650);
    
    // Texto con sombra
    const fonts4 = [
      { font: '16px sans-serif', color: '#ff0000', y: 700, label: 'SANS-SHADOW' },
      { font: '24px sans-serif', color: '#00ff00', y: 740, label: 'SANS-SHADOW 24' },
      { font: '32px sans-serif', color: '#0000ff', y: 790, label: 'SANS-SHADOW 32' },
      { font: '16px Arial', color: '#ff00ff', y: 840, label: 'ARIAL-SHADOW' },
      { font: '24px Arial', color: '#ff6600', y: 880, label: 'ARIAL-SHADOW 24' },
      { font: '16px monospace', color: '#800080', y: 920, label: 'MONO-SHADOW' },
      { font: '24px monospace', color: '#008000', y: 960, label: 'MONO-SHADOW 24' }
    ];

    fonts4.forEach((test, index) => {
      ctx.font = test.font;
      ctx.fillStyle = '#000000';
      ctx.textAlign = 'left';
      ctx.fillText(test.label, 870, test.y);
      
      ctx.fillStyle = test.color;
      ctx.fillText(test.label, 850, test.y - 2);
    });

    // ===== INFORMACIÓN DE DEBUG =====
    console.log(`[test-renderers] ===== INFORMACIÓN DE DEBUG =====`);
    
    // Medir texto para debug
    const testText = 'AdrianLAB';
    ctx.font = '24px sans-serif';
    const metricsSans = ctx.measureText(testText);
    
    ctx.font = '24px Arial';
    const metricsArial = ctx.measureText(testText);
    
    // Dibujar información de debug
    ctx.fillStyle = '#666666';
    ctx.font = '16px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`Token #${tokenId} - Debug Info:`, 50, 1150);
    ctx.fillText(`Sans-serif width: ${metricsSans.width.toFixed(2)}`, 50, 1170);
    ctx.fillText(`Arial width: ${metricsArial.width.toFixed(2)}`, 50, 1190);

    console.log(`[test-renderers] ===== COMPARACIÓN COMPLETADA =====`);

    // Configurar headers
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    
    // Generar y enviar buffer
    const buffer = canvas.toBuffer('image/png');
    console.log(`[test-renderers] Buffer generado, tamaño: ${buffer.length} bytes`);
    
    res.status(200).send(buffer);
    console.log(`[test-renderers] ===== DEBUG FINALIZADO =====`);
    
  } catch (error) {
    console.error('[test-renderers] Error:', error);
    console.error('[test-renderers] Stack:', error.stack);
    res.status(500).json({ error: 'Error en comparación de renderers', details: error.message });
  }
} 