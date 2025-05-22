// API endpoint para renderizar tokens por tokenId
import { createCanvas, loadImage } from 'canvas';
import fs from 'fs';
import path from 'path';

export default async function handler(req, res) {
  try {
    const { tokenId } = req.query;
    
    // Verificar que el tokenId es válido
    if (!tokenId || isNaN(parseInt(tokenId))) {
      return res.status(400).json({ error: 'Token ID inválido' });
    }
    
    // Comprobar si podemos usar imágenes PNG
    const traitsFolderExists = fs.existsSync(path.join(process.cwd(), 'public', 'traits'));
    
    if (traitsFolderExists) {
      try {
        // Crear un canvas para la imagen
        const canvas = createCanvas(1000, 1000);
        const ctx = canvas.getContext('2d');
        
        // Mapeo simple de tokenId a rasgos para pruebas
        // En el futuro, esto vendría de la blockchain
        const traits = getTraitsForToken(parseInt(tokenId));
        
        // Dibujar cada capa en orden
        if (traits.BACKGROUND) await drawLayer(ctx, 'BACKGROUND', traits.BACKGROUND);
        if (traits.BASE) await drawLayer(ctx, 'BASE', traits.BASE);
        if (traits.EYES) await drawLayer(ctx, 'EYES', traits.EYES);
        if (traits.MOUTH) await drawLayer(ctx, 'MOUTH', traits.MOUTH);
        if (traits.HEAD) await drawLayer(ctx, 'HEAD', traits.HEAD);
        if (traits.CLOTHING) await drawLayer(ctx, 'CLOTHING', traits.CLOTHING);
        if (traits.ACCESSORIES) await drawLayer(ctx, 'ACCESSORIES', traits.ACCESSORIES);
        
        // Aplicar efecto de mutación si existe
        if (traits.MUTATION) await applyMutationEffect(ctx, traits.MUTATION);
        
        // Convertir a buffer PNG
        const buffer = canvas.toBuffer('image/png');
        
        // Enviar la imagen
        res.setHeader('Content-Type', 'image/png');
        return res.status(200).send(buffer);
      } catch (error) {
        console.error('Error rendering PNG:', error);
        // Si falla, volvemos al SVG de respaldo
      }
    }
    
    // Por defecto o como respaldo, devolvemos SVG
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

// Función temporal para asignar rasgos basados en tokenId
function getTraitsForToken(tokenId) {
  // Para pruebas, usamos el tokenId como semilla para generar rasgos
  const traits = {
    BACKGROUND: 'blue',
    BASE: 'normal',
    EYES: 'normal',
    MOUTH: 'smile',
    HEAD: 'normal',
    CLOTHING: 'lab_coat',
    ACCESSORIES: 'glasses',
    MUTATION: tokenId > 5 ? 1 : 0  // Aplicar mutación leve para tokens > 5
  };
  
  return traits;
}