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

    console.log(`[test-text] ===== DEBUG MULTI-RENDERER INICIADO =====`);
    console.log(`[test-text] Token ID: ${tokenId}`);

    // Crear canvas grande para probar múltiples renderers
    const canvas = createCanvas(1200, 1600);
    const ctx = canvas.getContext('2d');
    
    // Fondo blanco
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, 1200, 1600);
    
    // ===== SECCIÓN 1: FUENTES GENÉRICAS BÁSICAS =====
    console.log(`[test-text] SECCIÓN 1: FUENTES GENÉRICAS BÁSICAS`);
    
    const basicFonts = [
      { font: '16px sans-serif', color: '#ff0000', y: 50, label: 'SANS-SERIF 16' },
      { font: '24px sans-serif', color: '#00ff00', y: 80, label: 'SANS-SERIF 24' },
      { font: '32px sans-serif', color: '#0000ff', y: 120, label: 'SANS-SERIF 32' },
      { font: '48px sans-serif', color: '#ff00ff', y: 170, label: 'SANS-SERIF 48' },
      { font: '16px monospace', color: '#ff6600', y: 230, label: 'MONOSPACE 16' },
      { font: '24px monospace', color: '#800080', y: 260, label: 'MONOSPACE 24' },
      { font: '16px serif', color: '#008000', y: 300, label: 'SERIF 16' },
      { font: '24px serif', color: '#000080', y: 330, label: 'SERIF 24' }
    ];

    basicFonts.forEach((test, index) => {
      ctx.font = test.font;
      ctx.fillStyle = test.color;
      ctx.textAlign = 'left';
      console.log(`[test-text] Test ${index + 1}: "${test.font}" -> "${ctx.font}"`);
      ctx.fillText(test.label, 50, test.y);
    });

    // ===== SECCIÓN 2: FUENTES DEL SISTEMA ESPECÍFICAS =====
    console.log(`[test-text] SECCIÓN 2: FUENTES DEL SISTEMA ESPECÍFICAS`);
    
    const systemFonts = [
      { font: '16px Arial', color: '#ff0000', y: 380, label: 'ARIAL 16' },
      { font: '24px Arial', color: '#00ff00', y: 410, label: 'ARIAL 24' },
      { font: '16px Helvetica', color: '#0000ff', y: 450, label: 'HELVETICA 16' },
      { font: '24px Helvetica', color: '#ff00ff', y: 480, label: 'HELVETICA 24' },
      { font: '16px Times', color: '#ff6600', y: 520, label: 'TIMES 16' },
      { font: '24px Times', color: '#800080', y: 550, label: 'TIMES 24' },
      { font: '16px Courier', color: '#008000', y: 590, label: 'COURIER 16' },
      { font: '24px Courier', color: '#000080', y: 620, label: 'COURIER 24' }
    ];

    systemFonts.forEach((test, index) => {
      ctx.font = test.font;
      ctx.fillStyle = test.color;
      ctx.textAlign = 'left';
      console.log(`[test-text] Test ${index + 9}: "${test.font}" -> "${ctx.font}"`);
      ctx.fillText(test.label, 50, test.y);
    });

    // ===== SECCIÓN 3: FUENTES CON FALLBACKS =====
    console.log(`[test-text] SECCIÓN 3: FUENTES CON FALLBACKS`);
    
    const fallbackFonts = [
      { font: '16px Arial, sans-serif', color: '#ff0000', y: 670, label: 'ARIAL+SANS' },
      { font: '24px Arial, sans-serif', color: '#00ff00', y: 700, label: 'ARIAL+SANS 24' },
      { font: '16px Helvetica, Arial, sans-serif', color: '#0000ff', y: 740, label: 'HELV+ARIAL+SANS' },
      { font: '24px Helvetica, Arial, sans-serif', color: '#ff00ff', y: 770, label: 'HELV+ARIAL+SANS 24' },
      { font: '16px "Times New Roman", Times, serif', color: '#ff6600', y: 810, label: 'TIMES+NEW+ROMAN' },
      { font: '24px "Times New Roman", Times, serif', color: '#800080', y: 840, label: 'TIMES+NEW+ROMAN 24' }
    ];

    fallbackFonts.forEach((test, index) => {
      ctx.font = test.font;
      ctx.fillStyle = test.color;
      ctx.textAlign = 'left';
      console.log(`[test-text] Test ${index + 17}: "${test.font}" -> "${ctx.font}"`);
      ctx.fillText(test.label, 50, test.y);
    });

    // ===== SECCIÓN 4: FUENTES CON PESOS =====
    console.log(`[test-text] SECCIÓN 4: FUENTES CON PESOS`);
    
    const weightFonts = [
      { font: 'normal 16px sans-serif', color: '#ff0000', y: 890, label: 'NORMAL SANS' },
      { font: 'bold 16px sans-serif', color: '#00ff00', y: 920, label: 'BOLD SANS' },
      { font: 'normal 24px sans-serif', color: '#0000ff', y: 960, label: 'NORMAL SANS 24' },
      { font: 'bold 24px sans-serif', color: '#ff00ff', y: 990, label: 'BOLD SANS 24' },
      { font: 'normal 16px Arial', color: '#ff6600', y: 1030, label: 'NORMAL ARIAL' },
      { font: 'bold 16px Arial', color: '#800080', y: 1060, label: 'BOLD ARIAL' }
    ];

    weightFonts.forEach((test, index) => {
      ctx.font = test.font;
      ctx.fillStyle = test.color;
      ctx.textAlign = 'left';
      console.log(`[test-text] Test ${index + 23}: "${test.font}" -> "${ctx.font}"`);
      ctx.fillText(test.label, 50, test.y);
    });

    // ===== SECCIÓN 5: TEXTO CENTRADO Y ALINEADO =====
    console.log(`[test-text] SECCIÓN 5: TEXTO CENTRADO Y ALINEADO`);
    
    ctx.font = 'bold 32px sans-serif';
    ctx.fillStyle = '#000000';
    ctx.textAlign = 'center';
    ctx.fillText('TEXTO CENTRADO SANS-SERIF', 600, 1120);
    
    ctx.font = 'bold 32px Arial';
    ctx.fillStyle = '#ff0000';
    ctx.fillText('TEXTO CENTRADO ARIAL', 600, 1160);
    
    ctx.font = '24px monospace';
    ctx.fillStyle = '#0000ff';
    ctx.fillText('TEXTO CENTRADO MONOSPACE', 600, 1200);

    // ===== SECCIÓN 6: TEXTO CON STROKE =====
    console.log(`[test-text] SECCIÓN 6: TEXTO CON STROKE`);
    
    ctx.font = 'bold 24px sans-serif';
    ctx.strokeStyle = '#00ff00';
    ctx.lineWidth = 2;
    ctx.strokeText('STROKE SANS-SERIF', 600, 1250);
    
    ctx.font = 'bold 24px Arial';
    ctx.strokeStyle = '#ff00ff';
    ctx.strokeText('STROKE ARIAL', 600, 1290);
    
    // ===== SECCIÓN 7: TEXTO CON FILL Y STROKE =====
    console.log(`[test-text] SECCIÓN 7: TEXTO CON FILL Y STROKE`);
    
    ctx.font = 'bold 24px sans-serif';
    ctx.fillStyle = '#000000';
    ctx.fillText('FILL+STROKE SANS-SERIF', 600, 1340);
    
    ctx.font = 'bold 24px Arial';
    ctx.fillStyle = '#000000';
    ctx.fillText('FILL+STROKE ARIAL', 600, 1380);

    // ===== SECCIÓN 8: TEXTO CON NÚMEROS Y SÍMBOLOS =====
    console.log(`[test-text] SECCIÓN 8: TEXTO CON NÚMEROS Y SÍMBOLOS`);
    
    ctx.font = '24px sans-serif';
    ctx.fillStyle = '#000000';
    ctx.textAlign = 'left';
    ctx.fillText(`Token #${tokenId} - AdrianLAB`, 50, 1430);
    ctx.fillText('¡Hola! @#$%^&*() 1234567890', 50, 1460);
    
    ctx.font = '24px Arial';
    ctx.fillStyle = '#ff0000';
    ctx.fillText(`Token #${tokenId} - AdrianLAB`, 50, 1500);
    ctx.fillText('¡Hola! @#$%^&*() 1234567890', 50, 1530);

    // ===== SECCIÓN 9: MEDICIÓN DE TEXTO =====
    console.log(`[test-text] SECCIÓN 9: MEDICIÓN DE TEXTO`);
    
    const testText = 'AdrianLAB';
    ctx.font = '24px sans-serif';
    const metricsSans = ctx.measureText(testText);
    console.log(`[test-text] Métricas sans-serif "${testText}":`, {
      width: metricsSans.width,
      actualBoundingBoxAscent: metricsSans.actualBoundingBoxAscent,
      actualBoundingBoxDescent: metricsSans.actualBoundingBoxDescent
    });
    
    ctx.font = '24px Arial';
    const metricsArial = ctx.measureText(testText);
    console.log(`[test-text] Métricas Arial "${testText}":`, {
      width: metricsArial.width,
      actualBoundingBoxAscent: metricsArial.actualBoundingBoxAscent,
      actualBoundingBoxDescent: metricsArial.actualBoundingBoxDescent
    });

    // Dibujar métricas en la imagen
    ctx.font = '16px sans-serif';
    ctx.fillStyle = '#666666';
    ctx.fillText(`Sans-serif width: ${metricsSans.width.toFixed(2)}`, 50, 1570);
    ctx.fillText(`Arial width: ${metricsArial.width.toFixed(2)}`, 50, 1590);

    console.log(`[test-text] ===== DEBUG MULTI-RENDERER COMPLETADO =====`);

    // Configurar headers
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    
    // Generar y enviar buffer
    const buffer = canvas.toBuffer('image/png');
    console.log(`[test-text] Buffer generado, tamaño: ${buffer.length} bytes`);
    
    res.status(200).send(buffer);
    console.log(`[test-text] ===== DEBUG FINALIZADO =====`);
    
  } catch (error) {
    console.error('[test-text] Error:', error);
    console.error('[test-text] Stack:', error.stack);
    res.status(500).json({ error: 'Error en debug multi-renderer', details: error.message });
  }
} 