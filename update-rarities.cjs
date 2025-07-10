const fs = require('fs');
const path = require('path');

// Archivos a actualizar
const files = [
  'pages/api/render/floppy/[tokenId].js',
  'pages/api/debug-floppy/[tokenId].js',
  'pages/api/metadata/floppy/[id].js'
];

// Nueva función de rareza
const newRarityFunction = `  // Función para obtener tag y color según maxSupply (niveles actualizados)
  function getRarityTagAndColor(maxSupply) {
    if (maxSupply <= 6) return { tag: 'LEGENDARY', bg: '#ffd700' };    // Dorado
    if (maxSupply <= 14) return { tag: 'RARE', bg: '#da70d6' };        // Púrpura
    if (maxSupply <= 40) return { tag: 'UNCOMMON', bg: '#5dade2' };    // Azul
    return { tag: 'COMMON', bg: '#a9a9a9' };                           // Gris
  }`;

console.log('🔄 Actualizando rangos de raridades...');

files.forEach(filePath => {
  if (fs.existsSync(filePath)) {
    console.log(`📁 Procesando: ${filePath}`);
    
    let content = fs.readFileSync(filePath, 'utf8');
    let updated = false;
    
    // Patrón 1: Función con comentario "niveles actualizados"
    const pattern1 = /\/\/ Función para obtener tag y color según maxSupply \(niveles actualizados\)\s+function getRarityTagAndColor\(maxSupply\) \{\s+if \(maxSupply <= 30\) return \{ tag: 'LEGENDARY', bg: '#ffd700' \};\s+if \(maxSupply <= 100\) return \{ tag: 'RARE', bg: '#da70d6' \};\s+if \(maxSupply <= 300\) return \{ tag: 'UNCOMMON', bg: '#5dade2' \};\s+return \{ tag: 'COMMON', bg: '#a9a9a9' \};\s+\}/g;
    
    // Patrón 2: Función sin comentario específico
    const pattern2 = /function getRarityTagAndColor\(maxSupply\) \{\s+if \(maxSupply <= 30\) return \{ tag: 'LEGENDARY', bg: '#ffd700' \};\s+if \(maxSupply <= 100\) return \{ tag: 'RARE', bg: '#da70d6' \};\s+if \(maxSupply <= 300\) return \{ tag: 'UNCOMMON', bg: '#5dade2' \};\s+return \{ tag: 'COMMON', bg: '#a9a9a9' \};\s+\}/g;
    
    // Patrón 3: Función con rangos diferentes (debug-floppy)
    const pattern3 = /function getRarityTagAndColor\(maxSupply\) \{\s+if \(maxSupply <= 50\) return \{ tag: 'LEGENDARY', bg: '#ffd700' \};\s+if \(maxSupply <= 150\) return \{ tag: 'RARE', bg: '#da70d6' \};\s+if \(maxSupply <= 300\) return \{ tag: 'UNCOMMON', bg: '#5dade2' \};\s+return \{ tag: 'COMMON', bg: '#a9a9a9' \};\s+\}/g;
    
    // Intentar cada patrón
    if (pattern1.test(content)) {
      content = content.replace(pattern1, newRarityFunction);
      updated = true;
      console.log(`  ✅ Patrón 1 encontrado y reemplazado`);
    } else if (pattern2.test(content)) {
      content = content.replace(pattern2, newRarityFunction);
      updated = true;
      console.log(`  ✅ Patrón 2 encontrado y reemplazado`);
    } else if (pattern3.test(content)) {
      content = content.replace(pattern3, newRarityFunction);
      updated = true;
      console.log(`  ✅ Patrón 3 encontrado y reemplazado`);
    }
    
    if (updated) {
      fs.writeFileSync(filePath, content, 'utf8');
      console.log(`  💾 Archivo actualizado: ${filePath}`);
    } else {
      console.log(`  ⚠️  No se encontraron patrones para reemplazar en: ${filePath}`);
    }
  } else {
    console.log(`❌ Archivo no encontrado: ${filePath}`);
  }
});

console.log('\n🎉 Actualización de rangos de raridades completada!');
console.log('\n📊 Nuevos rangos:');
console.log('  • LEGENDARY: maxSupply ≤ 6 (Dorado #ffd700)');
console.log('  • RARE: maxSupply ≤ 14 (Púrpura #da70d6)');
console.log('  • UNCOMMON: maxSupply ≤ 40 (Azul #5dade2)');
console.log('  • COMMON: maxSupply > 40 (Gris #a9a9a9)');
