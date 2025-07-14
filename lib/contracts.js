import { ethers } from 'ethers';
import AdrianLabCoreABI from './abis/AdrianLabCore.json';
import AdrianTraitsExtensionsABI from './abis/AdrianTraitsExtensions.json';
import PatientZEROABI from './abis/PatientZERO.json';
import SerumModuleABI from './abis/SerumModule.json';
import AdrianNameRegistryABI from './abis/AdrianNameRegistry.json';

// Direcciones de contratos en Base
const CORE = '0x6E369BF0E4e0c106192D606FB6d85836d684DA75';
const TRAITS_EXTENSION = '0x0995c0da1ca071b792e852b6ec531b7cd7d1f8d6';
const PATIENT_ZERO = '0x41bd1d621f9a8de8f175dd9814d9c27fabb9172f';
const SERUM_MODULE = '0xEb84a51F8d59d1C55cACFd15074AeB104D82B2ec';
const ADRIAN_NAME_REGISTRY = '0xaeC5ED33c88c1943BB7452aC4B571ad0b4c4068C';

// Configuration
const ALCHEMY_API_KEY = "5qIXA1UZxOAzi8b9l0nrYmsQBO9-W7Ot";
const ALCHEMY_RPC_URL = `https://base-mainnet.g.alchemy.com/v2/${ALCHEMY_API_KEY}`;

// Infura (Alternativa)
const INFURA_PROJECT_ID = "cc0c8013b1e044dcba79d4f7ec3b2ba1";
const INFURA_RPC_URL = `https://base-mainnet.infura.io/v3/${INFURA_PROJECT_ID}`;

// Network configuration
const BASE_NETWORK = {
    chainId: "0x2105", // 8453 in hex
    chainName: "Base Mainnet",
    nativeCurrency: {
        name: "ETH",
        symbol: "ETH",
        decimals: 18,
    },
    rpcUrls: [ALCHEMY_RPC_URL],
    blockExplorerUrls: ["https://basescan.org/"],
};

// Sistema de fallback entre providers
async function getProvider() {
  try {
    console.log('[contracts] Intentando conectar con Alchemy...');
    // Intentar primero con Alchemy
    const provider = new ethers.providers.JsonRpcProvider(ALCHEMY_RPC_URL, {
      name: "Base Mainnet",
      chainId: 8453
    });
    await provider.getNetwork(); // Verificar conexión
    console.log('[contracts] Conexión exitosa con Alchemy');
    return provider;
  } catch (error) {
    console.warn('[contracts] Alchemy failed, trying Infura...', error.message);
    try {
      // Fallback a Infura
      const provider = new ethers.providers.JsonRpcProvider(INFURA_RPC_URL, {
        name: "Base Mainnet",
        chainId: 8453
      });
      await provider.getNetwork();
      console.log('[contracts] Conexión exitosa con Infura (fallback)');
      return provider;
    } catch (fallbackError) {
      console.error('[contracts] Infura también falló, usando Base RPC público...', fallbackError.message);
      // Último fallback al RPC público de Base
      return new ethers.providers.JsonRpcProvider('https://mainnet.base.org');
    }
  }
}

// Función para inicializar los contratos
export async function getContracts() {
  try {
    // Validar ABIs
    if (!AdrianLabCoreABI || !Array.isArray(AdrianLabCoreABI)) {
      throw new Error('ABI de AdrianLabCore no válido');
    }
    if (!AdrianTraitsExtensionsABI || !Array.isArray(AdrianTraitsExtensionsABI)) {
      throw new Error('ABI de AdrianTraitsExtensions no válido');
    }

    // Verificar función crítica getTokenData
    const hasGetTokenData = AdrianLabCoreABI.some(
      func => func.name === 'getTokenData' && 
              func.inputs?.length === 1 && 
              func.inputs[0].type === 'uint256' &&
              func.outputs?.length === 6 &&
              func.outputs[0].type === 'uint256' &&
              func.outputs[1].type === 'uint256' &&
              func.outputs[2].type === 'bool' &&
              func.outputs[3].type === 'uint256' &&
              func.outputs[4].type === 'uint256' &&
              func.outputs[5].type === 'bool'
    );

    // Verificar función crítica getAllEquippedTraits
    const hasGetAllEquippedTraits = AdrianTraitsExtensionsABI.some(
      func => func.name === 'getAllEquippedTraits' && 
              func.inputs?.length === 1 && 
              func.inputs[0].type === 'uint256' &&
              func.outputs?.length === 2 &&
              func.outputs[0].type === 'string[]' &&
              func.outputs[1].type === 'uint256[]'
    );

    if (!hasGetTokenData) {
      throw new Error('ABI de AdrianLabCore no contiene la función getTokenData con la firma correcta');
    }
    if (!hasGetAllEquippedTraits) {
      throw new Error('ABI de AdrianTraitsExtensions no contiene la función getAllEquippedTraits con la firma correcta');
    }

    // Obtener provider con fallback
    const provider = await getProvider();
    
    // Inicializar contratos
    const core = new ethers.Contract(
      CORE,
      AdrianLabCoreABI,
      provider
    );

    const traitsExtension = new ethers.Contract(
      TRAITS_EXTENSION,
      AdrianTraitsExtensionsABI,
      provider
    );

    const patientZero = new ethers.Contract(
      PATIENT_ZERO,
      PatientZEROABI,
      provider
    );

    const serumModule = new ethers.Contract(
      SERUM_MODULE,
      SerumModuleABI,
      provider
    );

    const adrianNameRegistry = new ethers.Contract(
      ADRIAN_NAME_REGISTRY,
      AdrianNameRegistryABI,
      provider
    );

    // Test de funciones críticas
    try {
      console.log('[contracts] Probando función getTokenData...');
      const testTokenData = await core.getTokenData(1);
      console.log('[contracts] Test getTokenData exitoso:', {
        result: testTokenData.map(v => v.toString())
      });

      console.log('[contracts] Probando función getAllEquippedTraits...');
      const testTraits = await traitsExtension.getAllEquippedTraits(1);
      console.log('[contracts] Test getAllEquippedTraits exitoso:', {
        categories: testTraits[0],
        traitIds: testTraits[1].map(id => id.toString())
      });
    } catch (error) {
      console.error('[contracts] Error en test de funciones:', error);
      // No lanzar error aquí para permitir que el contrato se inicialice
      // aunque el test falle
    }

    return { core, traitsExtension, patientZero, serumModule, adrianNameRegistry };
  } catch (error) {
    console.error('[contracts] Error inicializando contratos:', error);
    throw error;
  }
}