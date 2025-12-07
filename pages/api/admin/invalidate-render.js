// API endpoint para invalidar renders guardados en GitHub
// Permite eliminar archivos de GitHub para forzar un nuevo renderizado
import { deleteAllRendersForToken, deleteFileFromGitHub } from '../../../lib/github-storage.js';
import { getRenderFilename, getTraitFilename, getFloppySimpleFilename, generateTraitHash, generateFloppySimpleHash } from '../../../lib/render-hash.js';

const ADMIN_API_KEY = process.env.ADMIN_API_KEY || process.env.VERCEL_ADMIN_API_KEY;

export default async function handler(req, res) {
  // Configurar CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Verificar autenticación (opcional, pero recomendado)
    if (ADMIN_API_KEY) {
      const authHeader = req.headers.authorization;
      const apiKey = authHeader?.replace('Bearer ', '') || req.body.apiKey;
      
      if (apiKey !== ADMIN_API_KEY) {
        return res.status(401).json({ 
          error: 'Unauthorized',
          message: 'API key inválida o no proporcionada'
        });
      }
    }

    const { tokenId, renderType, hash, traitId, floppySimple } = req.body;

    if (!tokenId && !traitId) {
      return res.status(400).json({ 
        error: 'Bad Request',
        message: 'Se requiere tokenId o traitId'
      });
    }

    // Invalidar render de trait individual
    if (traitId) {
      const traitHash = hash || generateTraitHash(traitId);
      const fileName = getTraitFilename(traitId, traitHash);
      const filePath = `public/rendered-traits/${fileName}`;
      
      const deleted = await deleteFileFromGitHub(filePath, `Invalidación manual para trait ${traitId}`);
      
      return res.status(200).json({
        success: true,
        message: deleted ? `Trait ${traitId} invalidado exitosamente` : `Trait ${traitId} no encontrado en GitHub`,
        deleted,
        traitId,
        filePath
      });
    }

    // Invalidar render de floppy simple
    if (floppySimple) {
      const floppyHash = hash || generateFloppySimpleHash(tokenId);
      const fileName = getFloppySimpleFilename(tokenId, floppyHash);
      const filePath = `public/rendered-traits/${fileName}`;
      
      const deleted = await deleteFileFromGitHub(filePath, `Invalidación manual para floppy simple ${tokenId}`);
      
      return res.status(200).json({
        success: true,
        message: deleted ? `Floppy simple ${tokenId} invalidado exitosamente` : `Floppy simple ${tokenId} no encontrado en GitHub`,
        deleted,
        tokenId,
        filePath
      });
    }

    // Invalidar render específico por hash
    if (hash && tokenId) {
      const fileName = getRenderFilename(tokenId, hash);
      const filePath = `public/rendered-toggles/${fileName}`;
      
      const deleted = await deleteFileFromGitHub(filePath, `Invalidación manual para token ${tokenId} (hash: ${hash})`);
      
      return res.status(200).json({
        success: true,
        message: deleted ? `Render con hash invalidado exitosamente` : `Render con hash no encontrado en GitHub`,
        deleted,
        tokenId,
        hash,
        filePath
      });
    }

    // Invalidar render específico por tipo (banana, closeup, etc.)
    if (renderType && tokenId) {
      let fileName;
      if (renderType === 'closeup') {
        fileName = `${tokenId}_closeup.png`;
      } else if (renderType === 'shadow') {
        fileName = `${tokenId}_shadow.png`;
      } else if (renderType === 'glow') {
        fileName = `${tokenId}_glow.png`;
      } else if (renderType === 'bn') {
        fileName = `${tokenId}_bn.png`;
      } else if (renderType === 'uv') {
        fileName = `${tokenId}_uv.png`;
      } else if (renderType === 'blackout') {
        fileName = `${tokenId}_blackout.png`;
      } else if (renderType === 'banana') {
        fileName = `${tokenId}_banana.png`;
      } else {
        fileName = `${tokenId}.png`;
      }
      
      const filePath = `public/rendered-toggles/${fileName}`;
      const deleted = await deleteFileFromGitHub(filePath, `Invalidación manual para token ${tokenId} (${renderType})`);
      
      return res.status(200).json({
        success: true,
        message: deleted ? `Render ${renderType} invalidado exitosamente` : `Render ${renderType} no encontrado en GitHub`,
        deleted,
        tokenId,
        renderType,
        filePath
      });
    }

    // Invalidar TODOS los renders de un token (por defecto)
    if (tokenId) {
      const results = await deleteAllRendersForToken(tokenId);
      
      return res.status(200).json({
        success: true,
        message: `Invalidación completada para token ${tokenId}`,
        results: {
          deleted: results.deleted.length,
          notFound: results.notFound.length,
          errors: results.errors.length,
          details: results
        }
      });
    }

    return res.status(400).json({ 
      error: 'Bad Request',
      message: 'Parámetros insuficientes'
    });

  } catch (error) {
    console.error('[admin/invalidate-render] Error:', error);
    return res.status(500).json({ 
      error: 'Internal Server Error',
      message: error.message 
    });
  }
}

