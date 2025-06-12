import { ethers } from 'ethers';
import AdrianLabCoreABI from '../abis/AdrianLabCore.json';
import AdrianLabExtensionsABI from '../abis/AdrianLabExtensions.json';
import AdrianTraitsCoreABI from '../abis/AdrianTraitsCore.json';

// Contract addresses for Base network (Chain ID: 8453)
const CONTRACT_ADDRESSES = {
  CORE: process.env.ADRIAN_LAB_CORE_ADDRESS || '0x6e369bf0e4e0c106192d606fb6d85836d684da75',
  EXTENSIONS: process.env.ADRIAN_LAB_EXTENSIONS_ADDRESS || '0x756e1a4fC47cbDe7d503b6c1B0353aDa94B41630',
  TRAITS: process.env.ADRIAN_TRAITS_CORE_ADDRESS || '0x217b49ee01d7150ce87fb68d12b2c242fdd7afcc',
  TRAITS_EXTENSION: process.env.ADRIAN_TRAITS_EXTENSION_ADDRESS || '0xa2f64c5265868a9c90462afdf29ee81165deb303'
};

// Configuración de la red BASE
const BASE_CONFIG = {
  chainId: 8453,
  name: 'Base',
  rpcUrl: process.env.RPC_URL || 'https://mainnet.base.org'
};

const BASE_RPC = "https://mainnet.base.org";

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
    
    // Asegurarnos de que los ABIs son arrays
    const coreABI = Array.isArray(AdrianLabCoreABI) ? AdrianLabCoreABI : AdrianLabCoreABI.abi || [];
    const extensionsABI = Array.isArray(AdrianLabExtensionsABI) ? AdrianLabExtensionsABI : AdrianLabExtensionsABI.abi || [];
    const traitsABI = Array.isArray(AdrianTraitsCoreABI) ? AdrianTraitsCoreABI : AdrianTraitsCoreABI.abi || [];
    
    console.log('[initializeContracts] ABI Core:', JSON.stringify(coreABI.slice(0, 2), null, 2));
    console.log('[initializeContracts] ABI Extensions:', JSON.stringify(extensionsABI.slice(0, 2), null, 2));
    
    contracts = {
      core: new ethers.Contract(CONTRACT_ADDRESSES.CORE, coreABI, provider),
      extensions: new ethers.Contract(CONTRACT_ADDRESSES.EXTENSIONS, extensionsABI, provider),
      traits: new ethers.Contract(CONTRACT_ADDRESSES.TRAITS, traitsABI, provider),
      traitsExtension: new ethers.Contract(CONTRACT_ADDRESSES.TRAITS_EXTENSION, traitsABI, provider)
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