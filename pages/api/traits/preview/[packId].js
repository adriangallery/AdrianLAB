import { getAssetInfo, getPackTraitPools } from '../../../../lib/blockchain.js';

export default async function handler(req, res) {
  const { packId } = req.query;
  
  if (!packId || isNaN(packId)) {
    return res.status(400).json({ error: 'Invalid pack ID' });
  }
  
  try {
    // Get pack trait pools from contract
    const traitPools = await getPackTraitPools(packId);
    
    // Build the base URL for images
    const baseUrl = process.env.VERCEL_URL 
      ? `https://${process.env.VERCEL_URL}`
      : 'https://adrianlab.vercel.app';
    
    const previews = await Promise.all(
      traitPools.map(async (traitId) => {
        const assetInfo = await getAssetInfo(traitId);
        return {
          trait_id: traitId,
          name: assetInfo?.name || `Trait #${traitId}`,
          category: assetInfo?.category || "Unknown",
          preview_image: `${baseUrl}/api/trait/${traitId}`,
          rarity: _calculateRarity(assetInfo) // Helper function
        };
      })
    );
    
    res.json({
      pack_id: packId,
      possible_traits: previews
    });
    
  } catch (error) {
    console.error('Error generating pack preview:', error);
    res.status(500).json({ error: 'Failed to generate pack preview' });
  }
}

function _calculateRarity(assetInfo) {
  if (!assetInfo || assetInfo.maxSupply === 0) return "common";
  
  if (assetInfo.maxSupply <= 10) return "legendary";
  if (assetInfo.maxSupply <= 50) return "epic"; 
  if (assetInfo.maxSupply <= 200) return "rare";
  return "common";
} 