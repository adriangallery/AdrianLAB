import { ethers } from 'ethers';
import AdrianLabCoreABI from '../abis/AdrianLabCore.json';
import AdrianLabExtensionsABI from '../abis/AdrianLabExtensions.json';
import AdrianTraitsCoreABI from '../abis/AdrianTraitsCore.json';

// Direcciones de contratos para la red Base (Chain ID: 8453)
const CONTRACT_ADDRESSES = {
  CORE: process.env.ADRIAN_LAB_CORE_ADDRESS || '0xa98d7f5aa2df722f88579fe2302ef59e98691dbb',
  EXTENSIONS: process.env.ADRIAN_LAB_EXTENSIONS_ADDRESS || '0xd56a5fe6fc7ee3a71cd5140a54df267d82671128',
  TRAITS: process.env.ADRIAN_TRAITS_CORE_ADDRESS || '0x217b49ee01d7150ce87fb68d12b2c242fdd7afcc',
  TRAITS_EXTENSION: process.env.ADRIAN_TRAITS_EXTENSION_ADDRESS || '0xa2f64c5265868a9c90462afdf29ee81165deb303'
};

let contracts = null;

/**
 * Inicializa las conexiones a los contratos
 * @returns {Object} - Objetos de contratos inicializados
 */
export async function initializeContracts() {
  if (contracts) return contracts;
  
  try {
    // Configuración para la red Base
    const chainId = process.env.CHAIN_ID || 8453;
    const rpcUrl = process.env.RPC_URL || 'https://mainnet.base.org';
    
    console.log('Inicializando contratos en Base (Chain ID: 8453)...');
    
    // En una implementación real, nos conectaríamos a un proveedor de Ethereum
    // const provider = new ethers.providers.JsonRpcProvider(rpcUrl);
    
    // Simulamos los objetos de contrato
    contracts = {
      core: { address: CONTRACT_ADDRESSES.CORE },
      extensions: { address: CONTRACT_ADDRESSES.EXTENSIONS },
      traits: { address: CONTRACT_ADDRESSES.TRAITS },
      traitsExtension: { address: CONTRACT_ADDRESSES.TRAITS_EXTENSION }
    };
    
    return contracts;
  } catch (error) {
    console.error('Error inicializando contratos:', error);
    throw error;
  }
}

/**
 * Obtiene los contratos inicializados
 * @returns {Object} - Objetos de contratos
 */
export async function getContracts() {
  if (!contracts) {
    return await initializeContracts();
  }
  return contracts;
}