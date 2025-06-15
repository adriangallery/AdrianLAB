import { ethers } from 'ethers';
import AdrianLabCoreABI from './abis/AdrianLabCore.json';
import AdrianTraitsExtensionsABI from './abis/AdrianTraitsExtensions.json';

// Direcciones de contratos en Base
const CORE = '0x6E369BF0E4e0c106192D606FB6d85836d684DA75';
const TRAITS_EXTENSION = '0x756e1a4fC47cbDe7d503b6c1B0353aDa94B41630';

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

    // Inicializar provider
    const provider = new ethers.JsonRpcProvider('https://mainnet.base.org');
    
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
      throw error;
    }

    return { core, traitsExtension };
  } catch (error) {
    console.error('[contracts] Error inicializando contratos:', error);
    throw error;
  }
}