const fs = require('fs');
const path = require('path');

// Mapeo de nombres de archivos SVG a números
const svgMappings = [
  { dir: 'BASE', from: 'Gen0.svg', to: '11.svg' },
  { dir: 'EYES', from: 'Classic_Glasses.svg', to: '4.svg' },
  { dir: 'EYES', from: '3D_Glasses.svg', to: '5.svg' },
  { dir: 'HEAD', from: 'pirate_hat.svg', to: '3.svg' },
  { dir: 'CLOTHING', from: 'Goonies_Shirt.svg', to: '4.svg' },
];

// Renombrar archivos
for (const mapping of svgMappings) {
  const sourcePath = path.join(process.cwd(), 'public', 'traits', mapping.dir, mapping.from);
  const targetPath = path.join(process.cwd(), 'public', 'traits', mapping.dir, mapping.to);
  
  if (fs.existsSync(sourcePath)) {
    try {
      // Crear copia con nuevo nombre (no renombrar para mantener el original)
      fs.copyFileSync(sourcePath, targetPath);
      console.log(`Copiado: ${mapping.from} -> ${mapping.to} en ${mapping.dir}`);
    } catch (error) {
      console.error(`Error copiando ${mapping.from}:`, error);
    }
  } else {
    console.warn(`No se encontró el archivo: ${sourcePath}`);
  }
}

console.log('Proceso de renombrado completado.'); 