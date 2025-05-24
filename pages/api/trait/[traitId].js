import { createCanvas, loadImage } from 'canvas';
import { getAssetInfo } from '../../../lib/blockchain.js';
import { getCachedResult, setCachedResult } from '../../../lib/cache.js';
import path from 'path';
import fs from 'fs';

export default async function handler(req, res) {
  try {
    // Extraer traitId de la consulta
    let { traitId } = req.query;
    
    // Verificar que el traitId es válido
    if (!traitId || isNaN(parseInt(traitId))) {
      return res.status(400).json({ error: 'ID de trait inválido' });
    }
    
    // Convertir a entero
    traitId = parseInt(traitId);
    
    // Obtener información del trait
    const assetInfo = await getAssetInfo(traitId);
    
    if (!assetInfo) {
      return res.status(404).json({ error: 'Trait no encontrado' });
    }
    
    // Por ahora, redirigir a una imagen de placeholder
    // En el futuro, esto se conectará con el sistema de traits reales
    res.redirect(307, `/api/trait/placeholder/${assetInfo.category}`);
  } catch (error) {
    console.error(`Error al obtener información del trait ${req.query.traitId}:`, error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
} 