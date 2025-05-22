const fs = require('fs');
const path = require('path');
const { createCanvas } = require('canvas');

// Categorías y rasgos
const traits = {
  BACKGROUND: ['blue', 'green', 'red'],
  BASE: ['normal', 'rare'],
  EYES: ['normal', 'cool', 'laser'],
  MOUTH: ['smile', 'serious', 'surprised'],
  HEAD: ['normal', 'hat', 'cap'],
  CLOTHING: ['lab_coat', 'suit', 'casual'],
  ACCESSORIES: ['glasses', 'watch', 'none'],
  MUTATION: ['mild', 'moderate', 'severe']
};

// Colores para cada rasgo
const colors = {
  BACKGROUND: {
    blue: '#3498db',
    green: '#2ecc71',
    red: '#e74c3c'
  },
  BASE: {
    normal: '#f5deb3',
    rare: '#c0c0c0'
  },
  EYES: {
    normal: '#2c3e50',
    cool: '#8e44ad',
    laser: '#e74c3c'
  },
  MOUTH: {
    smile: '#e67e22',
    serious: '#7f8c8d',
    surprised: '#9b59b6'
  },
  HEAD: {
    normal: '#ecf0f1',
    hat: '#34495e',
    cap: '#e67e22'
  },
  CLOTHING: {
    lab_coat: '#ecf0f1',
    suit: '#2c3e50',
    casual: '#3498db'
  },
  ACCESSORIES: {
    glasses: '#34495e',
    watch: '#f1c40f',
    none: 'transparent'
  },
  MUTATION: {
    mild: 'rgba(155, 89, 182, 0.3)',
    moderate: 'rgba(155, 89, 182, 0.6)',
    severe: 'rgba(155, 89, 182, 0.9)'
  }
};

// Crear directorios si no existen
Object.keys(traits).forEach(category => {
  const dir = path.join(__dirname, '..', 'public', 'traits', category);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    console.log(`Directorio creado: ${dir}`);
  }
});

// Generar imágenes para cada rasgo
Object.keys(traits).forEach(category => {
  traits[category].forEach(trait => {
    // Crear canvas
    const canvas = createCanvas(1000, 1000);
    const ctx = canvas.getContext('2d');
    
    // Llenar con un color de fondo
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, 1000, 1000);
    
    // Dibujar el rasgo
    if (category === 'BACKGROUND') {
      // Fondo completo
      ctx.fillStyle = colors.BACKGROUND[trait];
      ctx.fillRect(0, 0, 1000, 1000);
    } else if (category === 'BASE') {
      // Forma básica de cara
      ctx.fillStyle = colors.BASE[trait];
      ctx.beginPath();
      ctx.arc(500, 500, 300, 0, Math.PI * 2);
      ctx.fill();
    } else if (category === 'EYES') {
      // Ojos
      ctx.fillStyle = colors.EYES[trait];
      ctx.beginPath();
      ctx.arc(350, 400, 50, 0, Math.PI * 2);
      ctx.arc(650, 400, 50, 0, Math.PI * 2);
      ctx.fill();
    } else if (category === 'MOUTH') {
      // Boca
      ctx.fillStyle = colors.MOUTH[trait];
      if (trait === 'smile') {
        ctx.beginPath();
        ctx.arc(500, 600, 100, 0, Math.PI);
        ctx.fill();
      } else if (trait === 'serious') {
        ctx.fillRect(400, 600, 200, 20);
      } else {
        ctx.beginPath();
        ctx.arc(500, 600, 50, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (category === 'HEAD') {
      // Cabeza/sombrero
      ctx.fillStyle = colors.HEAD[trait];
      if (trait === 'normal') {
        ctx.fillRect(350, 200, 300, 100);
      } else if (trait === 'hat') {
        ctx.beginPath();
        ctx.moveTo(300, 300);
        ctx.lineTo(700, 300);
        ctx.lineTo(500, 100);
        ctx.fill();
      } else {
        ctx.fillRect(350, 250, 300, 50);
      }
    } else if (category === 'CLOTHING') {
      // Ropa
      ctx.fillStyle = colors.CLOTHING[trait];
      ctx.fillRect(300, 700, 400, 300);
    } else if (category === 'ACCESSORIES') {
      // Accesorios
      if (trait !== 'none') {
        ctx.fillStyle = colors.ACCESSORIES[trait];
        if (trait === 'glasses') {
          ctx.strokeStyle = colors.ACCESSORIES[trait];
          ctx.lineWidth = 10;
          ctx.beginPath();
          ctx.arc(350, 400, 70, 0, Math.PI * 2);
          ctx.stroke();
          ctx.beginPath();
          ctx.arc(650, 400, 70, 0, Math.PI * 2);
          ctx.stroke();
          ctx.beginPath();
          ctx.moveTo(420, 400);
          ctx.lineTo(580, 400);
          ctx.stroke();
        } else {
          ctx.fillRect(450, 700, 100, 50);
        }
      }
    } else if (category === 'MUTATION') {
      // Efecto de mutación
      ctx.fillStyle = colors.MUTATION[trait];
      ctx.fillRect(0, 0, 1000, 1000);
    }
    
    // Agregar texto para identificar
    ctx.fillStyle = '#000000';
    ctx.font = '60px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(`${category}: ${trait}`, 500, 950);
    
    // Guardar la imagen
    const buffer = canvas.toBuffer('image/png');
    const fileName = trait === 'mild' || trait === 'moderate' || trait === 'severe' 
      ? trait + '.png'  // Para mutaciones, usar el nombre directamente
      : trait + '.png'; // Para otros rasgos
    
    const outputPath = path.join(__dirname, '..', 'public', 'traits', category, fileName);
    fs.writeFileSync(outputPath, buffer);
    console.log(`Imagen creada: ${outputPath}`);
  });
});

console.log('Generación de imágenes completada.'); 