import { Resvg } from '@resvg/resvg-js';
import path from 'path';
import fs from 'fs';
import { textToSVGElement, linesToSVG } from '../../../lib/text-to-svg.js';

export default async function handler(req, res) {
  try {
    let { tokenId } = req.query;
    
    if (tokenId && tokenId.endsWith('.svg')) {
      tokenId = tokenId.replace('.svg', '');
    }
    
    if (!tokenId || isNaN(parseInt(tokenId))) {
      return res.status(400).json({ error: 'Invalid token ID' });
    }

    console.log(`[debug-floppy] ===== DEBUG FLOPPY RENDERER =====`);
    console.log(`[debug-floppy] Token ID: ${tokenId}`);

    // Datos mockup
    const tokenData = {
      name: `TRAIT #${tokenId}`,
      trait: "UNISEX",
      series: "1",
      category: "MOUTH",
      required: "NONE",
      origin: "UNIVERSAL",
      maxSupply: 300
    };

    // Función para obtener tag y color según maxSupply
      // Función para obtener tag y color según maxSupply (niveles actualizados)
  function getRarityTagAndColor(maxSupply) {
    if (maxSupply <= 6) return { tag: 'LEGENDARY', bg: '#ffd700' };    // Dorado
    if (maxSupply <= 14) return { tag: 'RARE', bg: '#da70d6' };        // Púrpura
    if (maxSupply <= 40) return { tag: 'UNCOMMON', bg: '#5dade2' };    // Azul
    return { tag: 'COMMON', bg: '#a9a9a9' };                           // Gris
  }

    const rarity = getRarityTagAndColor(tokenData.maxSupply);
    console.log(`[debug-floppy] Rarity:`, rarity);

    // Probar cada función individualmente
    console.log(`[debug-floppy] Probando textToSVGElement...`);
    
    const rarityElement = textToSVGElement(rarity.tag, {
      x: 164,
      y: 155,
      fontSize: 16,
      fill: '#ffffff'
    });
    console.log(`[debug-floppy] Rarity element:`, rarityElement);

    const nameElement = textToSVGElement(tokenData.name, {
      x: 384,
      y: 810,
      fontSize: 48,
      fill: '#ffffff'
    });
    console.log(`[debug-floppy] Name element:`, nameElement);

    const linesElement = linesToSVG([
      {
        text: `TRAIT: ${tokenData.trait}`,
        x: 84,
        y: 880,
        fontSize: 24,
        fill: '#333333'
      },
      {
        text: `SERIES: ${tokenData.series}`,
        x: 84,
        y: 915,
        fontSize: 24,
        fill: '#333333'
      }
    ]);
    console.log(`[debug-floppy] Lines element:`, linesElement);

    // Crear SVG de debug
    const debugSvg = `
      <svg width="768" height="1024" xmlns="http://www.w3.org/2000/svg">
        <!-- Fondo principal -->
        <rect width="768" height="1024" fill="#ffffff"/>
        
        <!-- Contenedor de imagen con fondo dinámico -->
        <rect x="84" y="120" width="600" height="600" fill="${rarity.bg}20"/>
        
        <!-- Tag de rareza (superior izquierda) - convertido a path -->
        <rect x="84" y="120" width="160" height="60" fill="${rarity.bg}"/>
        ${rarityElement}
        
        <!-- Nombre del trait (debajo de la imagen) - convertido a path -->
        <rect x="84" y="760" width="600" height="80" fill="#0f4e6d"/>
        ${nameElement}
        
        <!-- Bloque inferior de datos - convertido a paths -->
        ${linesElement}
        
        <!-- Texto normal para comparar -->
        <text x="84" y="950" font-family="Arial" font-size="24" fill="#888888">TEXTO NORMAL PARA COMPARAR</text>
        <text x="84" y="985" font-family="Arial" font-size="24" fill="#888888">CATEGORY: ${tokenData.category}</text>
      </svg>
    `;

    console.log(`[debug-floppy] SVG generado, longitud: ${debugSvg.length}`);

    // Devolver el SVG como texto para inspeccionar
    res.setHeader('Content-Type', 'image/svg+xml');
    res.status(200).send(debugSvg);
    
  } catch (error) {
    console.error('[debug-floppy] Error:', error);
    res.status(500).json({ error: 'Error interno del servidor', details: error.message });
  }
} 