const fs = require('fs');
const path = require('path');
const { createCanvas } = require('canvas');

// Configuración de tokens críticos
const CRITICAL_TOKENS = [1, 2, 3, 208, 262144, 30000, 30001, 30002, 30003, 30004];

// Función para generar imagen placeholder
function generatePlaceholderImage(tokenId) {
  const canvas = createCanvas(1000, 1000);
  const ctx = canvas.getContext('2d');
  
  // Fondo
  ctx.fillStyle = '#f0f0f0';
  ctx.fillRect(0, 0, 1000, 1000);
  
  // Borde
  ctx.strokeStyle = '#333';
  ctx.lineWidth = 4;
  ctx.strokeRect(2, 2, 996, 996);
  
  // Texto principal
  ctx.fillStyle = '#333';
  ctx.font = 'bold 48px Arial';
  ctx.textAlign = 'center';
  ctx.fillText(`Token ${tokenId}`, 500, 450);
  
  // Texto secundario
  ctx.font = '24px Arial';
  ctx.fillText('Pregenerated Skin', 500, 500);
  
  // Fecha
  ctx.font = '16px Arial';
  ctx.fillText(`Generated: ${new Date().toLocaleString()}`, 500, 550);
  
  return canvas.toBuffer('image/png');
}

// Función para guardar archivo
function savePregeneratedFile(tokenId, type = 'normal', traits = [], imageBuffer) {
  const basePath = 'public/pregenerated/adrianzero';
  
  let filePath;
  switch (type) {
    case 'normal':
      filePath = `${basePath}/skins/${tokenId}.png`;
      break;
    case 'custom':
      if (traits.length === 0) return false;
      const traitsKey = traits.sort((a, b) => parseInt(a) - parseInt(b)).join('-');
      filePath = `${basePath}/custom/popular/${tokenId}_${traitsKey}.png`;
      break;
    default:
      return false;
  }
  
  try {
    // Crear directorio si no existe
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    // Guardar archivo
    fs.writeFileSync(filePath, imageBuffer);
    console.log(`✅ Saved: ${filePath}`);
    return true;
  } catch (error) {
    console.error(`❌ Error saving: ${filePath}`, error);
    return false;
  }
}

// Función principal
async function generatePregeneratedFiles() {
  console.log('🚀 Iniciando generación de archivos pregenerados...');
  console.log('================================================');
  
  let successCount = 0;
  let totalCount = 0;
  
  // Generar skins base para tokens críticos
  for (const tokenId of CRITICAL_TOKENS) {
    totalCount++;
    console.log(`\n🎨 Generando skin base para token ${tokenId}...`);
    
    const imageBuffer = generatePlaceholderImage(tokenId);
    const saved = savePregeneratedFile(tokenId, 'normal', [], imageBuffer);
    
    if (saved) {
      successCount++;
    }
  }
  
  // Generar algunas combinaciones custom populares
  const customCombinations = [
    { tokenId: 208, traits: [133, 245, 2] },
    { tokenId: 1, traits: [7, 22] },
    { tokenId: 30000, traits: [30001, 30002] }
  ];
  
  for (const combo of customCombinations) {
    totalCount++;
    console.log(`\n🎨 Generando custom render para token ${combo.tokenId} con traits [${combo.traits.join(', ')}]...`);
    
    const imageBuffer = generatePlaceholderImage(combo.tokenId);
    const saved = savePregeneratedFile(combo.tokenId, 'custom', combo.traits, imageBuffer);
    
    if (saved) {
      successCount++;
    }
  }
  
  console.log('\n================================================');
  console.log(`✅ Generación completada: ${successCount}/${totalCount} archivos creados`);
  
  // Mostrar estadísticas
  const stats = getPregenerationStats();
  console.log('\n📊 Estadísticas finales:');
  console.log(`- Total archivos: ${stats.total}`);
  console.log(`- Skins base: ${stats.skins}`);
  console.log(`- Custom renders: ${stats.custom}`);
  console.log(`- Tamaño total: ${Math.round(stats.totalSize / 1024)} KB`);
}

// Función para obtener estadísticas
function getPregenerationStats() {
  const basePath = 'public/pregenerated/adrianzero';
  const stats = {
    total: 0,
    skins: 0,
    custom: 0,
    tshirts: 0,
    lambo: 0,
    totalSize: 0
  };
  
  try {
    const countFiles = (dirPath) => {
      if (!fs.existsSync(dirPath)) return 0;
      const files = fs.readdirSync(dirPath);
      return files.filter(file => file.endsWith('.png')).length;
    };
    
    const getDirSize = (dirPath) => {
      if (!fs.existsSync(dirPath)) return 0;
      let totalSize = 0;
      const files = fs.readdirSync(dirPath);
      files.forEach(file => {
        if (file.endsWith('.png')) {
          const filePath = path.join(dirPath, file);
          const stat = fs.statSync(filePath);
          totalSize += stat.size;
        }
      });
      return totalSize;
    };
    
    stats.skins = countFiles(`${basePath}/skins`);
    stats.custom = countFiles(`${basePath}/custom/popular`) + countFiles(`${basePath}/custom/trending`);
    stats.tshirts = countFiles(`${basePath}/tshirts`);
    stats.lambo = countFiles(`${basePath}/lambo`);
    stats.total = stats.skins + stats.custom + stats.tshirts + stats.lambo;
    
    stats.totalSize = getDirSize(`${basePath}/skins`) + 
                     getDirSize(`${basePath}/custom/popular`) + 
                     getDirSize(`${basePath}/custom/trending`) + 
                     getDirSize(`${basePath}/tshirts`) + 
                     getDirSize(`${basePath}/lambo`);
    
  } catch (error) {
    console.error('Error getting pregeneration stats:', error);
  }
  
  return stats;
}

// Ejecutar si es el archivo principal
if (require.main === module) {
  generatePregeneratedFiles().catch(console.error);
} 