const fs = require('fs');
const path = require('path');
const { createCanvas, loadImage } = require('canvas');

// Imágenes a procesar para el token 1
const imagesToProcess = [
  { category: 'BACKGROUND', id: '1', color: '#0000FF' }, // Fondo azul
  { category: 'BASE', id: '1', transparent: true }, // Cuerpo atlético
  { category: 'MOUTH', id: '1', transparent: true } // Boca sonriente
];

// Función para hacer transparente una imagen
async function makeTransparent(imagePath, options) {
  console.log(`Procesando ${imagePath}...`);

  try {
    // Cargar la imagen original
    const image = await loadImage(imagePath);
    
    // Crear un canvas del mismo tamaño
    const canvas = createCanvas(image.width, image.height);
    const ctx = canvas.getContext('2d');
    
    // Dibujar la imagen original
    ctx.drawImage(image, 0, 0);
    
    // Obtener los datos de la imagen
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;

    // Si es una imagen de fondo (BACKGROUND), hacemos una forma semitransparente
    if (options.color) {
      // Para la imagen de fondo, creamos un efecto más interesante
      // Limpiamos el canvas
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      // Dibujamos un gradiente de fondo
      const gradient = ctx.createRadialGradient(
        canvas.width/2, canvas.height/2, 0,
        canvas.width/2, canvas.height/2, canvas.width/2
      );
      
      // Convertimos color a valores RGB
      let r = 0, g = 0, b = 0;
      if (options.color === '#0000FF') { // Azul
        r = 0; g = 0; b = 255;
      } else if (options.color === '#00FF00') { // Verde
        r = 0; g = 255; b = 0;
      } else if (options.color === '#FF0000') { // Rojo
        r = 255; g = 0; b = 0;
      }
      
      gradient.addColorStop(0, `rgba(${r},${g},${b},0.7)`);
      gradient.addColorStop(1, `rgba(${r},${g},${b},0.1)`);
      
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    } 
    // Para otras imágenes, hacemos transparente el fondo blanco
    else if (options.transparent) {
      // Recorrer todos los píxeles
      for (let i = 0; i < data.length; i += 4) {
        // Si el píxel es blanco o casi blanco, hacerlo transparente
        if (data[i] > 240 && data[i+1] > 240 && data[i+2] > 240) {
          data[i+3] = 0; // Canal alfa a 0 (totalmente transparente)
        }
      }
      
      // Aplicar los cambios
      ctx.putImageData(imageData, 0, 0);
    }
    
    // Guardar la nueva imagen (hacer backup de la original primero)
    const backupPath = imagePath.replace('.png', '.backup.png');
    fs.copyFileSync(imagePath, backupPath);
    
    // Guardar la nueva imagen
    const buffer = canvas.toBuffer('image/png');
    fs.writeFileSync(imagePath, buffer);
    
    console.log(`Imagen guardada: ${imagePath}`);
    return true;
  } catch (error) {
    console.error(`Error procesando ${imagePath}:`, error);
    return false;
  }
}

// Procesar todas las imágenes
async function processAllImages() {
  for (const img of imagesToProcess) {
    const imagePath = path.join(process.cwd(), 'public', 'traits', img.category, `${img.id}.png`);
    
    if (fs.existsSync(imagePath)) {
      await makeTransparent(imagePath, img);
    } else {
      console.log(`Imagen no encontrada: ${imagePath}`);
    }
  }
  console.log('Procesamiento de imágenes completado.');
}

// Ejecutar el script
processAllImages(); 