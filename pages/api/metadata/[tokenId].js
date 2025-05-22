import { getTokenTraits, getRarityPercentage } from '../../../lib/blockchain.js';

export default async function handler(req, res) {
  try {
    const { tokenId } = req.query;
    
    // Verify that tokenId is valid
    if (!tokenId || isNaN(parseInt(tokenId))) {
      return res.status(400).json({ error: 'Invalid token ID' });
    }
    
    try {
      // Get token data from blockchain (simulated)
      const tokenData = await getTokenTraits(parseInt(tokenId));
      
      // Build base URL for images
      const baseUrl = process.env.VERCEL_URL 
        ? `https://${process.env.VERCEL_URL}`
        : 'https://adrianlab.vercel.app';
      
      // Token metadata
      const metadata = {
        name: `BareAdrian #${tokenId}`,
        description: `A ${tokenData.bodyTypeName} BareAdrian from the AdrianLab collection`,
        image: `${baseUrl}/api/render/${tokenId}`,
        external_url: `${baseUrl}/token/${tokenId}`,
        attributes: [
          {
            trait_type: "Body Type",
            value: tokenData.bodyTypeName
          },
          {
            trait_type: "Generation",
            value: tokenData.generation
          },
          {
            trait_type: "Mutation Level", 
            value: ["None", "Mild", "Moderate", "Severe"][tokenData.mutationLevel]
          },
          {
            trait_type: "Can Replicate",
            value: tokenData.canReplicate ? "Yes" : "No"
          },
          {
            trait_type: "Has Been Modified",
            value: tokenData.hasBeenModified ? "Yes" : "No"
          }
        ]
      };
      
      // Add body type rarity if not basic
      if (tokenData.bodyTypeId > 0) {
        // Calculate rarity based on bodyTypeId
        const rarityPercentage = await getRarityPercentage(tokenData.bodyTypeId);
        metadata.attributes.push({
          trait_type: "Body Rarity",
          value: `${rarityPercentage}%`
        });
      }
      
      // Add token traits as attributes
      for (let i = 0; i < tokenData.categories.length; i++) {
        const category = tokenData.categories[i];
        const traitId = tokenData.traitIds[i];
        
        // Only add if it has an assigned trait (traitId > 0)
        if (traitId > 0 && category !== "BASE") { // BASE is already represented as Body Type
          metadata.attributes.push({
            trait_type: category.charAt(0) + category.slice(1).toLowerCase(), // Format: "Background", "Eyes", etc.
            value: `#${traitId}`
          });
        }
      }
      
      // Configure headers to allow cache
      res.setHeader('Cache-Control', 'public, max-age=300, s-maxage=3600');
      return res.status(200).json(metadata);
    } catch (error) {
      console.error(`Error getting token data ${tokenId}:`, error);
      return res.status(404).json({ error: 'Token not found or data unavailable' });
    }
  } catch (error) {
    console.error('Error getting metadata:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}