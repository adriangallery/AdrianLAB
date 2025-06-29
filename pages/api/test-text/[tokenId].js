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

    console.log(`[test-text] ===== TEST DE TEXTO INICIADO =====`);
    console.log(`[test-text] Token ID: ${tokenId}`);

    // Crear canvas
    const canvas = createCanvas(768, 1024);
    const ctx = canvas.getContext('2d');
    
    // Fondo blanco
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, 768, 1024);
    
    // ===== TEST 1: Usar Arial como en generate-test-images.js =====
    console.log(`[test-text] TEST 1: Usando Arial`);
    ctx.fillStyle = '#000000';
    ctx.font = '48px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('AdrianLAB TEST 1', 384, 200);
    console.log(`[test-text] Test 1 completado`);
    
    // ===== TEST 2: Usar monospace =====
    console.log(`[test-text] TEST 2: Usando monospace`);
    ctx.fillStyle = '#ff0000';
    ctx.font = '48px monospace';
    ctx.fillText('AdrianLAB TEST 2', 384, 300);
    console.log(`[test-text] Test 2 completado`);
    
    // ===== TEST 3: Usar sans-serif =====
    console.log(`[test-text] TEST 3: Usando sans-serif`);
    ctx.fillStyle = '#00ff00';
    ctx.font = '48px sans-serif';
    ctx.fillText('AdrianLAB TEST 3', 384, 400);
    console.log(`[test-text] Test 3 completado`);
    
    // ===== TEST 4: Usar serif =====
    console.log(`[test-text] TEST 4: Usando serif`);
    ctx.fillStyle = '#0000ff';
    ctx.font = '48px serif';
    ctx.fillText('AdrianLAB TEST 4', 384, 500);
    console.log(`[test-text] Test 4 completado`);
    
    // ===== TEST 5: Usar Courier =====
    console.log(`[test-text] TEST 5: Usando Courier`);
    ctx.fillStyle = '#ff00ff';
    ctx.font = '48px Courier';
    ctx.fillText('AdrianLAB TEST 5', 384, 600);
    console.log(`[test-text] Test 5 completado`);
    
    // ===== TEST 6: Usar Times =====
    console.log(`[test-text] TEST 6: Usando Times`);
    ctx.fillStyle = '#00ffff';
    ctx.font = '48px Times';
    ctx.fillText('AdrianLAB TEST 6', 384, 700);
    console.log(`[test-text] Test 6 completado`);
    
    // ===== TEST 7: Usar Helvetica =====
    console.log(`[test-text] TEST 7: Usando Helvetica`);
    ctx.fillStyle = '#ffff00';
    ctx.font = '48px Helvetica';
    ctx.fillText('AdrianLAB TEST 7', 384, 800);
    console.log(`[test-text] Test 7 completado`);
    
    // ===== TEST 8: Usar fuente genérica =====
    console.log(`[test-text] TEST 8: Usando fuente genérica`);
    ctx.fillStyle = '#800080';
    ctx.font = '48px';
    ctx.fillText('AdrianLAB TEST 8', 384, 900);
    console.log(`[test-text] Test 8 completado`);
    
    // ===== TEST 9: Medir texto para debug =====
    console.log(`[test-text] TEST 9: Medición de texto`);
    ctx.font = '48px Arial';
    const testText = 'AdrianLAB';
    const metrics = ctx.measureText(testText);
    console.log(`[test-text] Métricas de "${testText}":`, {
      width: metrics.width,
      actualBoundingBoxAscent: metrics.actualBoundingBoxAscent,
      actualBoundingBoxDescent: metrics.actualBoundingBoxDescent,
      fontBoundingBoxAscent: metrics.fontBoundingBoxAscent,
      fontBoundingBoxDescent: metrics.fontBoundingBoxDescent
    });
    
    // ===== TEST 10: Texto con números y símbolos =====
    console.log(`[test-text] TEST 10: Texto con números`);
    ctx.fillStyle = '#000000';
    ctx.font = '32px Arial';
    ctx.fillText(`Token #${tokenId} - AdrianLAB`, 384, 950);
    ctx.fillText('¡Hola! @#$%^&*()', 384, 1000);
    console.log(`[test-text] Test 10 completado`);

    console.log(`[test-text] ===== TODOS LOS TESTS COMPLETADOS =====`);

    // Configurar headers
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    
    // Generar y enviar buffer
    const buffer = canvas.toBuffer('image/png');
    console.log(`[test-text] Buffer generado, tamaño: ${buffer.length} bytes`);
    
    res.status(200).send(buffer);
    console.log(`[test-text] ===== TEST FINALIZADO =====`);
    
  } catch (error) {
    console.error('[test-text] Error:', error);
    console.error('[test-text] Stack:', error.stack);
    res.status(500).json({ error: 'Error en test de texto', details: error.message });
  }
} 