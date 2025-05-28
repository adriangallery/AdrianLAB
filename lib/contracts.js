import { ethers } from 'ethers';
import AdrianLabCoreABI from '../abis/AdrianLabCore.json';
import AdrianLabExtensionsABI from '../abis/AdrianLabExtensions.json';
import AdrianTraitsCoreABI from '../abis/AdrianTraitsCore.json';

// Contract addresses for Base network (Chain ID: 8453)
const CONTRACT_ADDRESSES = {
  CORE: process.env.ADRIAN_LAB_CORE_ADDRESS || '0xa98d7f5aa2df722f88579fe2302ef59e98691dbb',
  EXTENSIONS: process.env.ADRIAN_LAB_EXTENSIONS_ADDRESS || '0xda5345f076a3e6a38cb9b57c3ddd3c77da93a72e',
  TRAITS: process.env.ADRIAN_TRAITS_CORE_ADDRESS || '0x217b49ee01d7150ce87fb68d12b2c242fdd7afcc',
  TRAITS_EXTENSION: process.env.ADRIAN_TRAITS_EXTENSION_ADDRESS || '0xa2f64c5265868a9c90462afdf29ee81165deb303'
};

// Configuración de la red BASE
const BASE_CONFIG = {
  chainId: 8453,
  name: 'Base',
  rpcUrl: process.env.RPC_URL || 'https://mainnet.base.org'
};

let contracts = null;

/**
 * Initializes contract connections
 * @returns {Object} - Initialized contract objects
 */
export async function initializeContracts() {
  if (contracts) return contracts;
  
  try {
    console.log('[initializeContracts] Iniciando conexión a BASE...');
    console.log('[initializeContracts] Configuración:', BASE_CONFIG);
    
    // Conectar a BASE
    const provider = new ethers.providers.JsonRpcProvider(BASE_CONFIG.rpcUrl);
    
    // Verificar la conexión
    const network = await provider.getNetwork();
    console.log('[initializeContracts] Red conectada:', network);
    
    if (network.chainId !== BASE_CONFIG.chainId) {
      throw new Error(`Wrong network: Expected ${BASE_CONFIG.chainId} (BASE), got ${network.chainId}`);
    }
    
    // Inicializar contratos
    console.log('[initializeContracts] Inicializando contratos...');
    contracts = {
      core: new ethers.Contract(CONTRACT_ADDRESSES.CORE, AdrianLabCoreABI, provider),
      extensions: new ethers.Contract(CONTRACT_ADDRESSES.EXTENSIONS, AdrianLabExtensionsABI, provider),
      traits: new ethers.Contract(CONTRACT_ADDRESSES.TRAITS, AdrianTraitsCoreABI, provider),
      traitsExtension: new ethers.Contract(CONTRACT_ADDRESSES.TRAITS_EXTENSION, AdrianTraitsCoreABI, provider)
    };
    
    console.log('[initializeContracts] Contratos inicializados correctamente');
    return contracts;
  } catch (error) {
    console.error('[initializeContracts] Error:', error);
    throw error;
  }
}

/**
 * Gets initialized contracts
 * @returns {Object} - Contract objects
 */
export async function getContracts() {
  if (!contracts) {
    return await initializeContracts();
  }
  return contracts;
}

// Exportar ABIs para uso en otros archivos
export { AdrianLabCoreABI, AdrianLabExtensionsABI, AdrianTraitsCoreABI };