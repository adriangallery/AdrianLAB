const fs = require('fs');
const path = require('path');
const { createCanvas, loadImage } = require('canvas');

// Imágenes a procesar para el token 1
const imagesToProcess = [
  { category: 'BACKGROUND', id: '1', color: '#0000FF' }, // Fondo azul
  { category: 'BASE', id: '1', transparent: true }, // Cuerpo atlético
  { category: 'MOUTH', id: '1', transparent: true } // Boca sonriente
];

// Función para hacer transparente una imagen de forma más agresiva
async function makeTransparentForced(imagePath, options) {
  console.log(`Procesando ${imagePath}...`);

  try {
    // Cargar la imagen original
    const image = await loadImage(imagePath);
    
    // Crear un canvas del mismo tamaño
    const canvas = createCanvas(image.width, image.height);
    const ctx = canvas.getContext('2d');
    
    // Si es una imagen de fondo (BACKGROUND), hacemos un gradiente con transparencia muy notoria
    if (options.color) {
      // Limpiamos el canvas
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      // Dibujamos un gradiente de fondo con mucha transparencia
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
      
      gradient.addColorStop(0, `rgba(${r},${g},${b},0.5)`); // Más transparente
      gradient.addColorStop(1, `rgba(${r},${g},${b},0.1)`);
      
      // Dibujar un patrón para hacer la transparencia más evidente
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      
      // Añadir un patrón de líneas para hacer evidente la transparencia
      ctx.strokeStyle = `rgba(${r},${g},${b},0.8)`;
      ctx.lineWidth = 2;
      for (let i = 0; i < canvas.width; i += 50) {
        ctx.beginPath();
        ctx.moveTo(i, 0);
        ctx.lineTo(i, canvas.height);
        ctx.stroke();
      }
    } 
    // Para otras imágenes (MOUTH, BASE), hacemos una versión muy transparente
    else if (options.transparent) {
      // Primero dibujamos la imagen original
      ctx.drawImage(image, 0, 0);
      
      // Obtenemos los datos de la imagen
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;
      
      // Hacer transparente cualquier pixel que no sea completamente negro o de color
      for (let i = 0; i < data.length; i += 4) {
        // Si no es negro puro o un color saturado (es gris o blanco)
        if ((data[i] > 50 && data[i+1] > 50 && data[i+2] > 50) && 
            // Y si es un color con poca saturación
            Math.max(data[i], data[i+1], data[i+2]) - Math.min(data[i], data[i+1], data[i+2]) < 30) {
          data[i+3] = 0; // Canal alfa a 0 (totalmente transparente)
        }
        // Aplicamos un tinte de color para verificar que es la nueva versión
        else if (data[i+3] > 0) {
          // Añadir un tinte azul para la boca
          if (options.category === 'MOUTH') {
            data[i] = Math.min(255, data[i] * 0.8);
            data[i+1] = Math.min(255, data[i+1] * 0.8);
            data[i+2] = Math.min(255, data[i+2] * 1.2); // Tinte azul
          }
          // Añadir un tinte verde para el cuerpo
          else if (options.category === 'BASE') {
            data[i] = Math.min(255, data[i] * 0.8);
            data[i+1] = Math.min(255, data[i+1] * 1.2); // Tinte verde
            data[i+2] = Math.min(255, data[i+2] * 0.8);
          }
        }
      }
      
      // Aplicar los cambios
      ctx.putImageData(imageData, 0, 0);
    }
    
    // Guardar la nueva imagen (sin backup esta vez)
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
      await makeTransparentForced(imagePath, {...img, category: img.category});
    } else {
      console.log(`Imagen no encontrada: ${imagePath}`);
    }
  }
  console.log('Procesamiento de imágenes completado.');
}

// Ejecutar el script
processAllImages(); 