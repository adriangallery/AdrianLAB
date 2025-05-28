import { ethers } from 'ethers';
import fs from 'fs';

const CONTRACT_ADDRESS = '0xda5345f076a3e6a38cb9b57c3ddd3c77da93a72e';
const RPC_URL = 'https://mainnet.base.org';

const run = async () => {
  try {
    console.log('Iniciando prueba de conexión a BASE...');
    
    // Cargar el ABI manualmente
    const abiRaw = fs.readFileSync('./abis/AdrianLabExtensions.json', 'utf8');
    const AdrianLabExtensionsABI = JSON.parse(abiRaw);
    console.log('ABI cargado, longitud:', AdrianLabExtensionsABI.length);
    
    // Conectar a BASE
    const provider = new ethers.providers.JsonRpcProvider(RPC_URL);
    
    // Verificar la red
    const network = await provider.getNetwork();
    console.log('Red conectada:', network);
    
    if (network.chainId !== 8453) {
      throw new Error(`Wrong network: Expected 8453 (BASE), got ${network.chainId}`);
    }
    
    // Inicializar contrato
    console.log('Inicializando contrato en:', CONTRACT_ADDRESS);
    const extensions = new ethers.Contract(CONTRACT_ADDRESS, AdrianLabExtensionsABI, provider);
    
    // Probar token 2
    const tokenId = 2;
    console.log(`\nObteniendo información del token ${tokenId}...`);
    
    const info = await extensions.getCompleteTokenInfo(tokenId);
    console.log('\nInformación del token:');
    console.log(JSON.stringify(info, null, 2));
    
  } catch (error) {
    console.error('\nError:', error);
  }
};

run(); 