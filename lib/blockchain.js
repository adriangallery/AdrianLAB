import { initializeContracts } from './contracts.js';
import { ethers } from 'ethers';
import { getContracts } from './contracts';

export async function getTokenTraits(tokenId) {
  try {
    const { extensionsContract, coreContract } = initializeContracts();
    
    // Verificar que el token existe
    const owner = await coreContract.ownerOf(tokenId);
    if (owner === '0x0000000000000000000000000000000000000000') {
      throw new Error('Token does not exist');
    }
    
    // Obtener traits del token
    const [categories, traitIds] = await extensionsContract.getTokenTraits(tokenId);
    
    // Obtener datos básicos del token
    const [generation, mutationLevel, canReplicate, replicationCount, lastReplication, hasBeenModified] = 
      await coreContract.getTokenData(tokenId);
    
    return {
      tokenId: parseInt(tokenId),
      generation: parseInt(generation),
      mutationLevel: parseInt(mutationLevel), // 0=NONE, 1=MILD, 2=MODERATE, 3=SEVERE
      canReplicate,
      replicationCount: parseInt(replicationCount),
      lastReplication: parseInt(lastReplication),
      hasBeenModified,
      categories,
      traitIds: traitIds.map(id => parseInt(id))
    };
    
  } catch (error) {
    console.error('Error fetching token data:', error);
    throw error;
  }
}

export async function getAssetInfo(assetId) {
  try {
    const { traitsContract } = initializeContracts();
    
    const [name, category, ipfsPath, isTemporary, maxSupply, assetType, metadata] = 
      await traitsContract.getAssetInfo(assetId);
    
    return {
      name,
      category,
      ipfsPath,
      isTemporary,
      maxSupply: parseInt(maxSupply),
      assetType: parseInt(assetType),
      metadata
    };
    
  } catch (error) {
    console.error('Error fetching asset info:', error);
    return null;
  }
}

/**
 * Función para establecer la URL base de renderizado
 * @param {string} baseURI - URL base para el renderizado
 * @returns {Promise<boolean>} - Resultado de la operación
 */
export async function setRenderBaseURI(baseURI) {
  try {
    // La URL correcta para usar después del despliegue de Vercel sería:
    // https://adrianlab.vercel.app/api/render/
    
    console.log(`Estableciendo URL base de renderizado a: ${baseURI}`);
    
    // En una implementación real, aquí llamaríamos a la función del contrato
    // const { extensions } = await getContracts();
    // const tx = await extensions.setRenderBaseURI(baseURI);
    // await tx.wait();
    
    return true;
  } catch (error) {
    console.error(`Error estableciendo URL base:`, error);
    throw error;
  }
}