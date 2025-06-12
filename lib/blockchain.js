import { getContracts } from './contracts.js';
import { ethers } from 'ethers';
import { AdrianLabExtensionsABI } from './contracts';
import { processTokenInfo } from './traits-order';

/**
 * Gets traits for a specific token
 * @param {string|number} tokenId - Token ID
 * @returns {Promise<Object>} - Token traits information
 */
export async function getTokenTraits(tokenId) {
  try {
    console.log(`[getTokenTraits] Iniciando búsqueda para token ${tokenId}...`);
    
    // Obtener contrato inicializado
    const { traitsExtension } = await getContracts();
    console.log('[getTokenTraits] Contrato inicializado:', {
      address: traitsExtension.address
    });

    // Verificar la red
    const provider = traitsExtension.provider;
    const network = await provider.getNetwork();
    console.log('[getTokenTraits] Red actual:', network);

    if (network.chainId !== 8453) {
      console.error('[getTokenTraits] Error: No estamos en la red BASE (chainId: 8453)');
      throw new Error('Wrong network: Please connect to BASE');
    }

    // Obtener traits equipados
    console.log('[getTokenTraits] Llamando a getAllEquippedTraits...');
    const [categories, traitIds] = await traitsExtension.getAllEquippedTraits(tokenId);
    console.log('[getTokenTraits] Traits equipados:', {
      categories: categories,
      traitIds: traitIds.map(id => id.toString())
    });

    // Procesar la información
    const processedInfo = {
      tokenId: tokenId,
      traits: categories.map((category, index) => ({
        category: category,
        traitId: traitIds[index].toString(),
        imagePath: `/traits/${category}/${traitIds[index].toString()}.svg`
      }))
    };

    console.log('[getTokenTraits] Información procesada:', JSON.stringify(processedInfo, null, 2));
    return processedInfo;
    
  } catch (error) {
    console.error('[getTokenTraits] Error:', error);
    throw error;
  }
}

export async function getAssetInfo(assetId) {
  try {
    // For this test version, we generate simulated data based on assetId
    // In production, this would come from the contract
    
    const categories = ["BACKGROUND", "BASE", "EYES", "MOUTH", "HEAD", "CLOTHING", "ACCESSORIES"];
    const categoryIndex = assetId % categories.length;
    
    // Name based on category and ID
    const names = {
      "BACKGROUND": ["Blue Sky", "Green Field", "Red Sunset"],
      "BASE": ["Normal Human", "Rare Cybernetic"],
      "EYES": ["Normal Vision", "Cool Shades", "Laser Sight"],
      "MOUTH": ["Happy Smile", "Serious Face", "Surprised Look"],
      "HEAD": ["No Hat", "Fancy Hat", "Cool Cap"],
      "CLOTHING": ["Lab Coat", "Business Suit", "Casual Wear"],
      "ACCESSORIES": ["Smart Glasses", "Luxury Watch", "None"]
    };
    
    const category = categories[categoryIndex];
    const nameIndex = Math.floor(assetId / categories.length) % names[category].length;
    const name = names[category][nameIndex];
    
    // Vary other attributes based on ID
    const isTemporary = assetId % 5 === 0; // Every 5 traits is temporary
    const maxSupply = assetId % 10 === 0 ? 0 : (assetId % 500) + 1; // Supply variation
    const assetType = assetId % 5; // 0-4: Visual, Inventory, Consumable, Serum, Pack
    
    return {
      id: assetId,
      name,
      category,
      ipfsPath: `ipfs://bafybei${assetId}`,
      isTemporary,
      maxSupply: parseInt(maxSupply),
      assetType: parseInt(assetType),
      metadata: JSON.stringify({
        description: `A ${category.toLowerCase()} trait for AdrianLab characters`,
        rarity: maxSupply <= 10 ? "legendary" : maxSupply <= 50 ? "epic" : maxSupply <= 200 ? "rare" : "common"
      })
    };
    
  } catch (error) {
    console.error('Error fetching asset info:', error);
    return null;
  }
}

/**
 * Gets the rarity percentage of a body type
 * @param {number} bodyTypeId - Body type ID
 * @returns {Promise<string>} - Formatted rarity percentage
 */
export async function getRarityPercentage(bodyTypeId) {
  try {
    // In a real implementation, this would come from the contract
    // const { coreContract } = initializeContracts();
    // const rarityBasisPoints = await coreContract.getBodyTypeRarityPercentage(bodyTypeId);
    
    // We simulate rarity data based on bodyTypeId
    let rarityBasisPoints;
    
    if (bodyTypeId >= 9) {
      // Legendary (body types 9 and 10)
      rarityBasisPoints = 100; // 1%
    } else if (bodyTypeId >= 7) {
      // Rare (body types 7 and 8)
      rarityBasisPoints = 500; // 5%
    } else if (bodyTypeId >= 4) {
      // Uncommon (body types 4, 5 and 6)
      rarityBasisPoints = 1500; // 15%
    } else {
      // Common (body types 1, 2 and 3)
      rarityBasisPoints = 2500; // 25%
    }
    
    return (rarityBasisPoints / 100).toFixed(2); // Convert basis points to percentage
  } catch (error) {
    console.error('Error getting body type rarity:', error);
    return "Unknown";
  }
}

/**
 * Gets the possible trait IDs in a pack
 * @param {string|number} packId - Pack ID
 * @returns {Promise<number[]>} - Array of possible trait IDs
 */
export async function getPackTraitPools(packId) {
  try {
    // In a real implementation, this would come from the pack contract
    // Here we generate example data based on packId
    
    // We generate between 3 and 8 random traits for the pack
    const numTraits = 3 + (packId % 6);
    const traitIds = [];
    
    // We use packId as seed to generate trait IDs
    const baseId = packId * 10;
    
    for (let i = 0; i < numTraits; i++) {
      traitIds.push(baseId + i);
    }
    
    return traitIds;
    
  } catch (error) {
    console.error(`Error getting pack trait pools for pack ${packId}:`, error);
    return [];
  }
}

/**
 * Function to set the rendering base URL
 * @param {string} baseURI - Base URL for rendering
 * @returns {Promise<boolean>} - Operation result
 */
export async function setRenderBaseURI(baseURI) {
  try {
    // The correct URL to use after Vercel deployment would be:
    // https://adrianlab.vercel.app/api/render/
    
    console.log(`Setting rendering base URL to: ${baseURI}`);
    
    // Obtener contratos inicializados
    const { extensions } = await getContracts();
    
    // Example code for when fully implemented:
    // const provider = new ethers.providers.InfuraProvider('base', process.env.INFURA_API_KEY);
    // const signer = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
    // const extensionsContract = new ethers.Contract(extensions.address, AdrianLabExtensionsABI, signer);
    // const tx = await extensionsContract.setRenderBaseURI(baseURI);
    // await tx.wait();
    
    return true;
  } catch (error) {
    console.error(`Error setting base URL:`, error);
    throw error;
  }
}

export async function getRawTokenMetadata(tokenId) {
  try {
    console.log(`[getRawTokenMetadata] Obteniendo metadata para token ${tokenId}...`);
    const { traitsExtension } = await getContracts();
    console.log('[getRawTokenMetadata] Contrato inicializado:', {
      address: traitsExtension.address
    });

    // Obtener traits equipados
    const [categories, traitIds] = await traitsExtension.getAllEquippedTraits(tokenId);
    console.log('[getRawTokenMetadata] Traits equipados:', {
      categories: categories,
      traitIds: traitIds.map(id => id.toString())
    });

    return {
      tokenId: tokenId,
      traits: categories.map((category, index) => ({
        category: category,
        traitId: traitIds[index].toString()
      }))
    };
  } catch (error) {
    console.error('[getRawTokenMetadata] Error:', error);
    throw error;
  }
}