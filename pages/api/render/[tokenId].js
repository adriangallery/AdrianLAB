// API endpoint para renderizar tokens por tokenId
import { createCanvas, loadImage } from 'canvas';
import fs from 'fs';
import path from 'path';
import { getTokenTraits } from '../../../lib/blockchain.js';

export default async function handler(req, res) {
  try {
    const { tokenId } = req.query;
    
    // Verificar que el tokenId es válido
    if (!tokenId || isNaN(parseInt(tokenId))) {
      return res.status(400).json({ error: 'Token ID inválido' });
    }
    
    // Obtener datos del token desde la blockchain (simulado)
    let tokenData;
    try {
      tokenData = await getTokenTraits(parseInt(tokenId));
    } catch (error) {
      console.error(`Error obteniendo datos del token ${tokenId}:`, error);
      // Si hay error en obtener los datos, usamos el SVG de respaldo
      return renderFallbackSVG(res, tokenId);
    }
    
    // Comprobar si podemos usar imágenes PNG
    const traitsFolderExists = fs.existsSync(path.join(process.cwd(), 'public', 'traits'));
    
    if (traitsFolderExists) {
      try {
        // Crear un canvas para la imagen
        const canvas = createCanvas(1000, 1000);
        const ctx = canvas.getContext('2d');
        
        // Dibujar cada capa en orden según los traits del token
        for (let i = 0; i < tokenData.categories.length; i++) {
          const category = tokenData.categories[i];
          const traitId = tokenData.traitIds[i];
          
          // Solo dibujar si el traitId es mayor que 0 (0 = no trait)
          if (traitId > 0) {
            await drawLayer(ctx, category, traitId, tokenData);
          }
        }
        
        // Aplicar efecto de mutación si existe
        if (tokenData.mutationLevel > 0) {
          await applyMutationEffect(ctx, tokenData.mutationLevel);
        }
        
        // Convertir a buffer PNG
        const buffer = canvas.toBuffer('image/png');
        
        // Enviar la imagen
        res.setHeader('Content-Type', 'image/png');
        return res.status(200).send(buffer);
      } catch (error) {
        console.error('Error rendering PNG:', error);
        // Si falla, volvemos al SVG de respaldo
        return renderFallbackSVG(res, tokenId);
      }
    } else {
      return renderFallbackSVG(res, tokenId);
    }
  } catch (error) {
    console.error('Error al renderizar token:', error);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
}

async function drawLayer(ctx, category, traitId, tokenData) {
  try {
    let imagePath;
    
    // Si es la capa BASE, usar el body type específico
    if (category === "BASE") {
      if (tokenData.bodyTypeId > 0) {
        // Usar imagen específica del body type
        imagePath = path.join(process.cwd(), 'public', 'traits', 'BASE', `${tokenData.bodyTypeName.toLowerCase()}.png`);
        
        // Fallback a imagen por ID si no existe por nombre
        if (!fs.existsSync(imagePath)) {
          imagePath = path.join(process.cwd(), 'public', 'traits', 'BASE', `body_${tokenData.bodyTypeId}.png`);
        }
      } else {
        // Body type básico
        imagePath = path.join(process.cwd(), 'public', 'traits', 'BASE', 'basic.png');
      }
    } else {
      // Para otras capas, usar el sistema normal
      imagePath = path.join(process.cwd(), 'public', 'traits', category, `${traitId}.png`);
    }
    
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

function renderFallbackSVG(res, tokenId) {
  // Por defecto o como respaldo, devolvemos SVG
  const svg = `
  <svg width="500" height="500" xmlns="http://www.w3.org/2000/svg">
    <rect width="100%" height="100%" fill="#f0f0f0"/>
    <text x="50%" y="50%" font-family="Arial" font-size="24" fill="black" text-anchor="middle">
      BareAdrian #${tokenId}
    </text>
    <text x="50%" y="60%" font-family="Arial" font-size="16" fill="black" text-anchor="middle">
      API en desarrollo
    </text>
  </svg>
  `;
  
  res.setHeader('Content-Type', 'image/svg+xml');
  return res.status(200).send(svg);
}