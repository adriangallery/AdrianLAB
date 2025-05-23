import { initializeContracts } from './contracts.js';
import { ethers } from 'ethers';
import { getContracts } from './contracts';

/**
 * Gets traits for a specific token
 * @param {string|number} tokenId - Token ID
 * @returns {Promise<Object>} - Token traits information
 */
export async function getTokenTraits(tokenId) {
  try {
    // In a real implementation, we would connect to the blockchain (Base network)
    // const { extensionsContract, coreContract } = initializeContracts();
    
    // We simulate data that would come from the blockchain
    // In a real implementation, this would come from contracts
    
    // Generate deterministic data based on tokenId
    const seed = parseInt(tokenId);
    
    // Special case for token ID 1
    if (tokenId == 1) {
      // Determine body type based on tokenId - for token 1 we'll use the new SVG body type (ID 11)
      const bodyTypeId = 11;
      const bodyTypes = [
        { name: "Basic", description: "Basic human body without modifications" },
        { name: "Athletic", description: "Athletic body in good physical shape" },
        { name: "Average", description: "Body with average proportions" },
        { name: "Lean", description: "Slim and agile body" },
        { name: "Muscular", description: "Body with notable muscular development" },
        { name: "Chubby", description: "Body with slight overweight" },
        { name: "Tall", description: "Body taller than average" },
        { name: "Cybernetic", description: "Body with cybernetic implants and enhancements" },
        { name: "Mutant", description: "Body with genetic mutations" },
        { name: "Perfect", description: "Body with perfect proportions (legendary)" },
        { name: "Alien", description: "Body of extraterrestrial origin (legendary)" },
        { name: "SVG Gen0", description: "Special SVG generation 0 body" }
      ];
      
      // Other attributes for token 1
      const generation = 0; // Special SVG generation
      const mutationLevel = 0; // No mutation
      const canReplicate = true;
      const replicationCount = 0;
      const lastReplication = Date.now();
      const hasBeenModified = false;
      
      // Categories y traitIds para el Token 1
      // Usado BACKGROUND/3.png (red.png) como capa inferior
      const categories = ["BACKGROUND", "BASE", "SKIN", "EYES", "HEAD", "CLOTHING"];
      const traitIds = [
        3,   // BACKGROUND: red (PNG) - ID 3 corresponde al fondo rojo
        11,  // BASE: SVG Gen0 body
        1,   // SKIN: nueva capa de piel (SVG)
        8,   // EYES: 8.svg (actualizado de 7.svg)
        3,   // HEAD: pirate hat (SVG)
        4    // CLOTHING: Goonies shirt (SVG)
      ];
      
      return {
        tokenId: parseInt(tokenId),
        generation: generation,
        mutationLevel: mutationLevel,
        canReplicate: canReplicate,
        replicationCount: replicationCount,
        lastReplication: lastReplication,
        hasBeenModified: hasBeenModified,
        categories: categories,
        traitIds: traitIds,
        bodyTypeId: bodyTypeId,
        bodyTypeName: bodyTypes[bodyTypeId].name,
        bodyTypeDescription: bodyTypes[bodyTypeId].description,
        version: 8 // Versión actualizada del token para forzar actualización en OpenSea
      };
    }
    
    // For other tokens, use the original logic
    // Determine body type based on tokenId
    const bodyTypeId = seed % 11; // 0-10 body types
    const bodyTypes = [
      { name: "Basic", description: "Basic human body without modifications" },
      { name: "Athletic", description: "Athletic body in good physical shape" },
      { name: "Average", description: "Body with average proportions" },
      { name: "Lean", description: "Slim and agile body" },
      { name: "Muscular", description: "Body with notable muscular development" },
      { name: "Chubby", description: "Body with slight overweight" },
      { name: "Tall", description: "Body taller than average" },
      { name: "Cybernetic", description: "Body with cybernetic implants and enhancements" },
      { name: "Mutant", description: "Body with genetic mutations" },
      { name: "Perfect", description: "Body with perfect proportions (legendary)" },
      { name: "Alien", description: "Body of extraterrestrial origin (legendary)" }
    ];
    
    // Determine other attributes
    const generation = 1 + (seed % 3); // 1-3
    const mutationLevel = seed % 4; // 0-3
    const canReplicate = seed % 5 !== 0; // 80% probability
    const replicationCount = seed % 3;
    const lastReplication = Date.now() - (seed * 86400000); // Random date in the past
    const hasBeenModified = seed % 7 === 0; // ~14% probability
    
    // Categories and traitIds
    const categories = ["BASE", "BACKGROUND", "EYES", "MOUTH", "HEAD", "CLOTHING", "ACCESSORIES"];
    const traitIds = [
      1 + (seed % 3),  // BASE: 1-3
      1 + (seed % 3),  // BACKGROUND: 1-3
      1 + (seed % 3),  // EYES: 1-3
      1 + (seed % 3),  // MOUTH: 1-3
      seed % 4,        // HEAD: 0-3 (0 = no hat)
      1 + (seed % 3),  // CLOTHING: 1-3
      seed % 4         // ACCESSORIES: 0-3 (0 = no accessories)
    ];
    
    return {
      tokenId: parseInt(tokenId),
      generation: generation,
      mutationLevel: mutationLevel,
      canReplicate: canReplicate,
      replicationCount: replicationCount,
      lastReplication: lastReplication,
      hasBeenModified: hasBeenModified,
      categories: categories,
      traitIds: traitIds,
      bodyTypeId: bodyTypeId,
      bodyTypeName: bodyTypes[bodyTypeId].name,
      bodyTypeDescription: bodyTypes[bodyTypeId].description,
      version: 1 // Versión base para tokens regulares
    };
    
  } catch (error) {
    console.error('Error fetching token data:', error);
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
    
    // In a real implementation, we would call the contract function
    // on the Base network (Chain ID: 8453)
    const { extensions } = await getContracts();
    
    // Example code for when fully implemented:
    // const provider = new ethers.providers.JsonRpcProvider(process.env.RPC_URL || 'https://mainnet.base.org');
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