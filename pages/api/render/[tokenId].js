import { createCanvas, loadImage } from 'canvas';
import { getTokenTraits } from '../../../lib/blockchain.js';
import { getCachedResult, setCachedResult } from '../../../lib/cache.js';
import path from 'path';
import fs from 'fs';
import { getCachedRender } from '../../../lib/cache';

export default async function handler(req, res) {
  try {
    const { tokenId } = req.query;
    
    // Verificar que el tokenId es válido
    if (!tokenId || isNaN(parseInt(tokenId))) {
      return res.status(400).json({ error: 'Token ID inválido' });
    }
    
    // Por ahora, devolvemos una respuesta temporal como SVG
    const svg = `
    <svg width="500" height="500" xmlns="http://www.w3.org/2000/svg">
      <rect width="100%" height="100%" fill="#f0f0f0"/>
      <text x="50%" y="50%" font-family="Arial" font-size="24" fill="black" text-anchor="middle">
        Token ID: ${tokenId}
      </text>
      <text x="50%" y="60%" font-family="Arial" font-size="16" fill="black" text-anchor="middle">
        API en desarrollo
      </text>
    </svg>
    `;
    
    res.setHeader('Content-Type', 'image/svg+xml');
    return res.status(200).send(svg);
  } catch (error) {
    console.error('Error al renderizar token:', error);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
}

async function drawLayer(ctx, category, traitId) {
  try {
    const imagePath = path.join(process.cwd(), 'public', 'traits', category, `${traitId}.png`);
    
    // Check if file exists
    if (!fs.existsSync(imagePath)) {
      console.warn(`Image not found: ${imagePath}`);
      return;
    }
    
    const image = await loadImage(imagePath);
    ctx.drawImage(image, 0, 0, 1000, 1000);
    
  } catch (error) {
    console.error(`Error loading layer ${category}/${traitId}:`, error);
  }
}

async function applyMutationEffect(ctx, mutationLevel) {
  try {
    let mutationFile;
    
    switch (mutationLevel) {
      case 1: // MILD
        mutationFile = 'mild.png';
        break;
      case 2: // MODERATE  
        mutationFile = 'moderate.png';
        break;
      case 3: // SEVERE
        mutationFile = 'severe.png';
        break;
      default:
        return;
    }
    
    const mutationPath = path.join(process.cwd(), 'public', 'traits', 'MUTATION', mutationFile);
    
    if (fs.existsSync(mutationPath)) {
      const mutationOverlay = await loadImage(mutationPath);
      ctx.drawImage(mutationOverlay, 0, 0, 1000, 1000);
    }
    
  } catch (error) {
    console.error('Error applying mutation effect:', error);
  }
}