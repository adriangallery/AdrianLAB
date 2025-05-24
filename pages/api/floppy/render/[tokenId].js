import path from 'path';
import fs from 'fs';
import { getFloppyData } from '../../../../lib/floppy.js';

export default async function handler(req, res) {
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
    
    // Ruta a la imagen del FLOPPY DISK
    const imagePath = path.join(process.cwd(), 'public', 'traits', 'FLOPPY', `${floppyData.image}.png`);
    
    // Verificar que la imagen existe
    if (!fs.existsSync(imagePath)) {
      console.error(`Imagen no encontrada: ${imagePath}`);
      return res.status(404).json({ error: 'Imagen no encontrada' });
    }
    
    // Leer la imagen y devolverla directamente
    const imageBuffer = fs.readFileSync(imagePath);
    
    // Configurar headers
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    
    // Devolver la imagen
    res.status(200).send(imageBuffer);
  } catch (error) {
    console.error('Error en el handler de renderizado de FLOPPY DISK:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
} 