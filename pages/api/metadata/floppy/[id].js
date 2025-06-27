export default async function handler(req, res) {
  try {
    const { id } = req.query;
    console.log(`[floppy-metadata] Iniciando request para floppy ${id}`);
    
    // Verificar que el id es válido - MODIFICADO para permitir 10000
    if (!id || isNaN(parseInt(id)) || parseInt(id) < 10000) {
      console.error(`[floppy-metadata] ID inválido: ${id}`);
      return res.status(400).json({ error: 'Invalid floppy ID' });
    }

    // Build base URL for images - MODIFICADO para usar labimages
    const baseUrl = 'https://adrianlab.vercel.app';
    const version = Date.now();

    // Mapear ID para el nombre específico del test - MODIFICADO para PNG
    const displayName = id === '10000' ? '10000.png' : id;

    // Metadata base para floppys - MODIFICADO con nueva estructura
    const metadata = {
      name: `Asset #${id}`,
      description: "A FLOPPY DISK from the AdrianLAB collection",
      image: `${baseUrl}/labimages/10000.png?v=${version}`,
      properties: {
        category: "FLOPPY",
        assetType: "VISUAL_TRAIT"
      }
    };

    // Configurar headers para evitar cache
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.setHeader('Surrogate-Control', 'no-store');
    
    return res.status(200).json(metadata);
  } catch (error) {
    console.error('[floppy-metadata] Error:', error);
    console.error('[floppy-metadata] Stack trace:', error.stack);
    
    return res.status(500).json({
      error: 'Error generating floppy metadata',
      details: error.message
    });
  }
} 