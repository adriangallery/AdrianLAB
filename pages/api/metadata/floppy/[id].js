export default async function handler(req, res) {
  try {
    const { id } = req.query;
    console.log(`[floppy-metadata] Iniciando request para floppy ${id}`);
    
    // Verificar que el id es válido
    if (!id || isNaN(parseInt(id)) || parseInt(id) < 100000) {
      console.error(`[floppy-metadata] ID inválido: ${id}`);
      return res.status(400).json({ error: 'Invalid floppy ID' });
    }

    // Build base URL for images
    const baseUrl = 'https://adrianlab.vercel.app/api/metadata';
    const version = Date.now();

    // Metadata base para floppys
    const metadata = {
      name: `FLOPPY #${id}`,
      description: "A FLOPPY DISK from the AdrianLAB collection",
      image: `${baseUrl}/floppy/${id}.gif?v=${version}`,
      external_url: `${baseUrl}/floppy/${id}.gif?v=${version}`,
      attributes: [
        {
          trait_type: "Type",
          value: "FLOPPY DISK"
        },
        {
          trait_type: "Rarity",
          value: "OG"
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