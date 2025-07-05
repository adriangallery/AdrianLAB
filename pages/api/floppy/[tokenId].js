import path from 'path';
import fs from 'fs';
import { createCanvas, loadImage } from 'canvas';
import { getFloppyData } from '../../../lib/floppy.js';

export default async function handler(req, res) {
  // Configurar CORS
  res.setHeader('Access-Control-Allow-Origin', 'https://adrianpunks.com');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Manejar preflight OPTIONS request
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  try {
    // Extraer tokenId, eliminando la extensión .png si está presente
    let { tokenId } = req.query;
    
    if (tokenId && tokenId.endsWith('.png')) {
      tokenId = tokenId.replace('.png', '');
    }
    
    // Verificar que el tokenId es válido
    if (!tokenId || isNaN(parseInt(tokenId))) {
      return res.status(400).json({ error: 'ID de token inválido' });
    }
    
    // Obtener datos del FLOPPY DISK
    let floppyData;
    try {
      floppyData = await getFloppyData(parseInt(tokenId));
    } catch (error) {
      console.error(`Error al obtener datos del FLOPPY DISK ${tokenId}:`, error);
      return res.status(500).json({ error: 'Error al obtener datos del FLOPPY DISK' });
    }
    
    // Crear un canvas para la imagen
    const canvas = createCanvas(1000, 1000);
    const ctx = canvas.getContext('2d');
    
    // Configurar para renderizado de alta calidad
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    
    // Dibujar fondo blanco por defecto
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, 1000, 1000);
    
    // Cargar y dibujar la imagen del FLOPPY DISK
    try {
      const imagePath = path.join(process.cwd(), 'public', 'traits', 'FLOPPY', `${floppyData.image}.png`);
      const image = await loadImage(imagePath);
      
      // Dibujar la imagen centrada en el canvas
      const scale = Math.min(1000 / image.width, 1000 / image.height);
      const x = (1000 - image.width * scale) / 2;
      const y = (1000 - image.height * scale) / 2;
      
      ctx.drawImage(image, x, y, image.width * scale, image.height * scale);
      
      // Añadir información del FLOPPY DISK como texto
      ctx.fillStyle = '#333333';
      ctx.font = 'bold 40px Arial';
      ctx.textAlign = 'center';
      ctx.fillText(floppyData.name, 500, 950);
      
      ctx.font = '30px Arial';
      ctx.fillText(`Tipo: ${floppyData.floppyType} | Rareza: ${floppyData.rarity}`, 500, 990);
      
      // Devolver la imagen como PNG
      res.setHeader('Content-Type', 'image/png');
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      
      const buffer = canvas.toBuffer('image/png');
      res.send(buffer);
    } catch (error) {
      console.error(`Error al renderizar FLOPPY DISK ${tokenId}:`, error);
      
      // Si hay un error, dibujar un mensaje de error
      ctx.fillStyle = '#ff0000';
      ctx.font = 'bold 50px Arial';
      ctx.textAlign = 'center';
      ctx.fillText('Error al cargar la imagen', 500, 500);
      
      res.setHeader('Content-Type', 'image/png');
      const buffer = canvas.toBuffer('image/png');
      res.send(buffer);
    }
  } catch (error) {
    console.error('Error en el handler de FLOPPY DISK:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
} 