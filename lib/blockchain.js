import { initializeContracts } from './contracts.js';
import { ethers } from 'ethers';
import { getContracts } from './contracts';

/**
 * Obtiene los traits de un token específico
 * @param {string|number} tokenId - ID del token
 * @returns {Promise<Object>} - Información de los traits del token
 */
export async function getTokenTraits(tokenId) {
  try {
    // En una implementación real, conectaríamos con la blockchain (red Base)
    const { extensions } = await getContracts();
    
    // Por ahora, devolvemos datos de ejemplo
    return {
      categories: ["BASE", "BACKGROUND", "EYES", "MOUTH", "HEAD", "CLOTHING", "ACCESSORIES"],
      traitIds: [1, 2, 3, 2, 1, 4, 0], // 0 significa que no tiene ese trait
      generation: 1,
      mutationLevel: 0,
      canReplicate: true,
      hasBeenModified: false
    };
  } catch (error) {
    console.error(`Error obteniendo traits del token ${tokenId}:`, error);
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
    // en la red Base (Chain ID: 8453)
    const { extensions } = await getContracts();
    
    // Ejemplo de código para cuando se implemente completamente:
    // const provider = new ethers.providers.JsonRpcProvider(process.env.RPC_URL || 'https://mainnet.base.org');
    // const signer = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
    // const extensionsContract = new ethers.Contract(extensions.address, AdrianLabExtensionsABI, signer);
    // const tx = await extensionsContract.setRenderBaseURI(baseURI);
    // await tx.wait();
    
    return true;
  } catch (error) {
    console.error(`Error estableciendo URL base:`, error);
    throw error;
  }
}