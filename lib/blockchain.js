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
    // Load real trait data from traits.json
    const fs = await import('fs');
    const path = await import('path');
    const traitsPath = path.default.join(process.cwd(), 'public', 'labmetadata', 'traits.json');
    const traitsData = JSON.parse(fs.default.readFileSync(traitsPath, 'utf8'));
    const trait = traitsData.traits.find(t => t.tokenId === parseInt(assetId));

    if (trait) {
      return {
        id: parseInt(assetId),
        name: trait.name,
        category: trait.category,
        fileName: trait.fileName,
        isTemporary: false,
        maxSupply: trait.maxSupply || 0,
        assetType: 0,
        metadata: JSON.stringify({
          description: `A ${trait.category.toLowerCase()} trait for AdrianLab BareAdrians`,
          rarity: (trait.maxSupply || 0) <= 10 ? "legendary" : (trait.maxSupply || 0) <= 50 ? "epic" : (trait.maxSupply || 0) <= 200 ? "rare" : "common"
        })
      };
    }

    // Also check floppy.json
    const floppyPath = path.default.join(process.cwd(), 'public', 'labmetadata', 'floppy.json');
    const floppyData = JSON.parse(fs.default.readFileSync(floppyPath, 'utf8'));
    const floppy = floppyData.floppys.find(f => f.tokenId === parseInt(assetId));

    if (floppy) {
      return {
        id: parseInt(assetId),
        name: floppy.name,
        category: floppy.category || 'FLOPPY DISCS',
        fileName: floppy.fileName,
        isTemporary: false,
        maxSupply: floppy.maxSupply || 0,
        assetType: 4,
        metadata: JSON.stringify({
          description: `A floppy disc for AdrianLab BareAdrians`,
          rarity: "common"
        })
      };
    }

    // Fallback for unknown assets
    console.warn(`[getAssetInfo] Asset ${assetId} not found in traits.json or floppy.json`);
    return {
      id: parseInt(assetId),
      name: `Trait #${assetId}`,
      category: 'UNKNOWN',
      isTemporary: false,
      maxSupply: 0,
      assetType: 0,
      metadata: JSON.stringify({ description: 'Unknown trait' })
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