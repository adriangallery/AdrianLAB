const fs = require('fs');
const path = require('path');
const { createCanvas, loadImage } = require('canvas');

// Función para combinar capas y guardar la imagen resultante
async function combineAndSave() {
  try {
    // Crear un canvas
    const canvas = createCanvas(1000, 1000);
    const ctx = canvas.getContext('2d');
    
    // Poner un fondo para mostrar la transparencia
    ctx.fillStyle = '#dddddd';
    ctx.fillRect(0, 0, 1000, 1000);
    
    // Dibujar cuadrícula para mostrar la transparencia
    ctx.strokeStyle = '#cccccc';
    for (let i = 0; i < 1000; i += 50) {
      ctx.beginPath();
      ctx.moveTo(0, i);
      ctx.lineTo(1000, i);
      ctx.stroke();
      
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i, 1000);
      ctx.stroke();
    }
    
    // Cargar y dibujar cada capa
    const layers = [
      { category: 'BACKGROUND', id: '1' },
      { category: 'BASE', id: '1' },
      { category: 'MOUTH', id: '1' }
    ];
    
    for (const layer of layers) {
      const imagePath = path.join(process.cwd(), 'public', 'traits', layer.category, `${layer.id}.png`);
      if (fs.existsSync(imagePath)) {
        const image = await loadImage(imagePath);
        ctx.drawImage(image, 0, 0, 1000, 1000);
        console.log(`Capa añadida: ${layer.category}/${layer.id}`);
      } else {
        console.log(`Imagen no encontrada: ${imagePath}`);
      }
    }
    
    // Guardar la imagen combinada
    const outputPath = path.join(process.cwd(), 'token1_test_transparent.png');
    const buffer = canvas.toBuffer('image/png');
    fs.writeFileSync(outputPath, buffer);
    
    console.log(`Imagen guardada en: ${outputPath}`);
  } catch (error) {
    console.error('Error combinando imágenes:', error);
  }
}

// Ejecutar
combineAndSave(); 