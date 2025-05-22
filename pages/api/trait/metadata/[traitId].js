import { getAssetInfo } from '../../../../lib/blockchain.js';

export default async function handler(req, res) {
  const { traitId } = req.query;
  
  if (!traitId || isNaN(traitId)) {
    return res.status(400).json({ error: 'Invalid trait ID' });
  }
  
  try {
    const assetInfo = await getAssetInfo(traitId);
    if (!assetInfo) {
      return res.status(404).json({ error: 'Trait not found' });
    }
    
    // Construcción de la URL base para imágenes
    const baseUrl = process.env.VERCEL_URL 
      ? `https://${process.env.VERCEL_URL}`
      : 'https://adrianlab.vercel.app';
    
    const metadata = {
      name: assetInfo.name,
      description: `A ${assetInfo.category.toLowerCase()} trait for AdrianLab BareAdrians`,
      image: `${baseUrl}/api/trait/${traitId}`,
      external_url: `${baseUrl}/traits/${traitId}`,
      attributes: [
        {
          trait_type: "Category",
          value: assetInfo.category
        },
        {
          trait_type: "Type", 
          value: assetInfo.isTemporary ? "Temporary" : "Permanent"
        },
        {
          trait_type: "Asset Type",
          value: ["Visual Trait", "Inventory Item", "Consumable", "Serum", "Pack"][assetInfo.assetType]
        }
      ]
    };
    
    // Add supply info if limited
    if (assetInfo.maxSupply > 0) {
      metadata.attributes.push({
        trait_type: "Max Supply",
        value: assetInfo.maxSupply
      });
    }
    
    res.setHeader('Cache-Control', 'public, max-age=1800'); // 30 minutes
    res.json(metadata);
    
  } catch (error) {
    console.error('Error generating trait metadata:', error);
    res.status(500).json({ error: 'Failed to generate metadata' });
  }
} 