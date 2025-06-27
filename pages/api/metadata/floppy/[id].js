export default async function handler(req, res) {
  try {
    let { id } = req.query;
    console.log(`[floppy-metadata] Iniciando request para floppy ${id}`);
    
    // Manejar formato ERC1155 - convertir hex de 64 caracteres a decimal
    let actualId = id;
    
    // Si el ID termina en .json, removerlo
    if (id && id.endsWith('.json')) {
      id = id.replace('.json', '');
    }
    
    // Si el ID es un hex de 64 caracteres (patrón ERC1155)
    if (id && id.length === 64 && /^[0-9a-f]+$/i.test(id)) {
      // Convertir de hex a decimal
      actualId = parseInt(id, 16).toString();
      console.log(`[floppy-metadata] Convertido hex ${id} a decimal ${actualId}`);
    } else {
      actualId = id;
    }
    
    // Verificar que el actualId es válido
    if (!actualId || isNaN(parseInt(actualId)) || parseInt(actualId) < 10000) {
      console.error(`[floppy-metadata] ID inválido: ${actualId} (original: ${req.query.id})`);
      return res.status(400).json({ error: 'Invalid floppy ID' });
    }

    // Build base URL for images - MODIFICADO para usar labimages
    const baseUrl = 'https://adrianlab.vercel.app';
    const version = Date.now();

    // Metadata base para floppys - MODIFICADO con attributes estándar
    const metadata = {
      name: `Asset #${actualId}`,
      description: "A FLOPPY DISK from the AdrianLAB collection",
      image: `${baseUrl}/labimages/10000.png?v=${version}`,
      attributes: [
        {
          trait_type: "Category",
          value: "FLOPPY"
        },
        {
          trait_type: "Asset Type",
          value: "VISUAL_TRAIT"
        }
      ]
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