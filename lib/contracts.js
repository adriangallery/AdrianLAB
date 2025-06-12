import { ethers } from 'ethers';
import AdrianTraitsExtensionsABI from './abis/AdrianTraitsExtensions.json';

// Direcciones de contratos en Base
const TRAITS_EXTENSION = '0x756e1a4fC47cbDe7d503b6c1B0353aDa94B41630';

// Función para inicializar los contratos
export async function getContracts() {
  try {
    // Validar ABI
    if (!AdrianTraitsExtensionsABI || !Array.isArray(AdrianTraitsExtensionsABI)) {
      throw new Error('ABI de AdrianTraitsExtensions no válido');
    }

    // Verificar función crítica
    const hasGetAllEquippedTraits = AdrianTraitsExtensionsABI.some(
      func => func.name === 'getAllEquippedTraits' && 
              func.inputs?.length === 1 && 
              func.inputs[0].type === 'uint256' &&
              func.outputs?.length === 2 &&
              func.outputs[0].type === 'string[]' &&
              func.outputs[1].type === 'uint256[]'
    );

    if (!hasGetAllEquippedTraits) {
      throw new Error('ABI de AdrianTraitsExtensions no contiene la función getAllEquippedTraits con la firma correcta');
    }

    // Inicializar provider
    const provider = new ethers.JsonRpcProvider('https://mainnet.base.org');
    
    // Inicializar contrato de traits
    const traitsExtension = new ethers.Contract(
      TRAITS_EXTENSION,
      AdrianTraitsExtensionsABI,
      provider
    );

    // Test de función crítica
    try {
      console.log('[contracts] Probando función getAllEquippedTraits...');
      const testResult = await traitsExtension.getAllEquippedTraits(1);
      console.log('[contracts] Test exitoso:', {
        categories: testResult[0],
        traitIds: testResult[1].map(id => id.toString())
      });
    } catch (error) {
      console.error('[contracts] Error en test de función:', error);
      throw error;
    }

    return { traitsExtension };
  } catch (error) {
    console.error('[contracts] Error inicializando contratos:', error);
    throw error;
  }
}