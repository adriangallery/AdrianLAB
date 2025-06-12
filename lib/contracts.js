import { ethers } from 'ethers';
import AdrianLabCoreABI from './abis/AdrianLabCore.json';
import AdrianLabExtensionsABI from './abis/AdrianLabExtensions.json';
import AdrianTraitsCoreABI from './abis/AdrianTraitsCore.json';

// Contract addresses for Base network (Chain ID: 8453)
const CONTRACT_ADDRESSES = {
  CORE: process.env.ADRIAN_LAB_CORE_ADDRESS || '0x6e369bf0e4e0c106192d606fb6d85836d684da75',
  EXTENSIONS: process.env.ADRIAN_LAB_EXTENSIONS_ADDRESS || '0x756e1a4fC47cbDe7d503b6c1B0353aDa94B41630',
  TRAITS: process.env.ADRIAN_TRAITS_CORE_ADDRESS || '0xb72be829f06a6c5baf99cdae204ffd99ea4a6c9a',
  TRAITS_EXTENSION: process.env.ADRIAN_TRAITS_EXTENSION_ADDRESS || '0x756e1a4fC47cbDe7d503b6c1B0353aDa94B41630'
};

// Configuración de la red BASE
const BASE_CONFIG = {
  chainId: 8453,
  name: 'Base',
  rpcUrl: process.env.RPC_URL || 'https://mainnet.base.org'
};

let contracts = null;
let provider = null;

/**
 * Initializes contract connections
 * @returns {Object} - Initialized contract objects
 */
export async function initializeContracts() {
  if (contracts) return contracts;
  
  try {
    console.log('[initializeContracts] Iniciando conexión a BASE...');
    
    // Conectar a BASE
    provider = new ethers.providers.JsonRpcProvider(BASE_CONFIG.rpcUrl);
    
    // Verificar la conexión
    const network = await provider.getNetwork();
    console.log('[initializeContracts] Red conectada:', network);
    
    if (network.chainId !== BASE_CONFIG.chainId) {
      throw new Error(`Wrong network: Expected ${BASE_CONFIG.chainId} (BASE), got ${network.chainId}`);
    }
    
    // Inicializar contratos
    console.log('[initializeContracts] Inicializando contratos...');
    
    // Validar ABIs
    const coreABI = validateABI(AdrianLabCoreABI, 'Core');
    const extensionsABI = validateABI(AdrianLabExtensionsABI, 'Extensions');
    const traitsABI = validateABI(AdrianTraitsCoreABI, 'Traits');
    
    // Verificar funciones críticas
    validateCriticalFunctions(coreABI, extensionsABI);
    
    // Inicializar contratos con los ABIs validados
    contracts = {
      core: new ethers.Contract(CONTRACT_ADDRESSES.CORE, coreABI, provider),
      extensions: new ethers.Contract(CONTRACT_ADDRESSES.EXTENSIONS, extensionsABI, provider),
      traits: new ethers.Contract(CONTRACT_ADDRESSES.TRAITS, traitsABI, provider),
      traitsExtension: new ethers.Contract(CONTRACT_ADDRESSES.TRAITS_EXTENSION, traitsABI, provider)
    };
    
    // Test de funciones críticas
    await testCriticalFunctions();
    
    console.log('[initializeContracts] Contratos inicializados correctamente');
    return contracts;
  } catch (error) {
    console.error('[initializeContracts] Error:', error);
    throw error;
  }
}

/**
 * Validates ABI format and structure
 * @param {Object} abi - ABI to validate
 * @param {string} name - Name of the contract for logging
 * @returns {Array} - Validated ABI array
 */
function validateABI(abi, name) {
  try {
    const abiArray = Array.isArray(abi) ? abi : 
                    abi.abi ? abi.abi : 
                    JSON.parse(abi);
    
    if (!Array.isArray(abiArray)) {
      throw new Error(`Invalid ABI format for ${name}`);
    }
    
    console.log(`[validateABI] ${name} ABI validado:`, abiArray.length, 'funciones');
    return abiArray;
  } catch (error) {
    console.error(`[validateABI] Error validando ABI de ${name}:`, error);
    throw new Error(`Invalid ${name} ABI: ${error.message}`);
  }
}

/**
 * Validates critical functions in ABIs
 * @param {Array} coreABI - Core contract ABI
 * @param {Array} extensionsABI - Extensions contract ABI
 */
function validateCriticalFunctions(coreABI, extensionsABI) {
  const requiredFunctions = {
    core: ['getTokenData', 'tokenSkin', 'mutationLevelName'],
    extensions: ['getAllEquippedTraits']
  };
  
  const missingFunctions = [];
  
  // Verificar funciones del Core
  requiredFunctions.core.forEach(func => {
    if (!coreABI.some(item => item.type === 'function' && item.name === func)) {
      missingFunctions.push(`Core:${func}`);
    }
  });
  
  // Verificar funciones de Extensions
  requiredFunctions.extensions.forEach(func => {
    if (!extensionsABI.some(item => item.type === 'function' && item.name === func)) {
      missingFunctions.push(`Extensions:${func}`);
    }
  });
  
  if (missingFunctions.length > 0) {
    throw new Error(`Missing critical functions: ${missingFunctions.join(', ')}`);
  }
}

/**
 * Tests critical contract functions
 */
async function testCriticalFunctions() {
  try {
    console.log('[testCriticalFunctions] Probando funciones críticas...');
    
    // Test getTokenData
    console.log('[testCriticalFunctions] Probando getTokenData...');
    const tokenData = await contracts.core.getTokenData(1);
    console.log('[testCriticalFunctions] ✅ getTokenData working:', tokenData);
    
    // Test getAllEquippedTraits
    console.log('[testCriticalFunctions] Probando getAllEquippedTraits...');
    const traits = await contracts.extensions.getAllEquippedTraits(1);
    console.log('[testCriticalFunctions] ✅ getAllEquippedTraits working:', traits);
    
  } catch (error) {
    console.error('[testCriticalFunctions] Error:', error);
    throw new Error(`Critical function test failed: ${error.message}`);
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