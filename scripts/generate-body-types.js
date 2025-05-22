const fs = require('fs');
const path = require('path');
const { createCanvas } = require('canvas');

// Lista de body types a generar
const bodyTypes = [
  { id: 0, name: 'basic', color: '#E5D9B6', rarity: 'common' },
  { id: 1, name: 'athletic', color: '#A4BE7B', rarity: 'common' },
  { id: 2, name: 'average', color: '#BDD2B6', rarity: 'common' },
  { id: 3, name: 'lean', color: '#94AF9F', rarity: 'common' },
  { id: 4, name: 'muscular', color: '#DF7861', rarity: 'uncommon' },
  { id: 5, name: 'chubby', color: '#FFB100', rarity: 'uncommon' },
  { id: 6, name: 'tall', color: '#9BABB8', rarity: 'uncommon' },
  { id: 7, name: 'cybernetic', color: '#5FBDFF', rarity: 'rare' },
  { id: 8, name: 'mutant', color: '#897BFF', rarity: 'rare' },
  { id: 9, name: 'perfect', color: '#FFD700', rarity: 'legendary' },
  { id: 10, name: 'alien', color: '#79E0EE', rarity: 'legendary' }
];

// Crear directorio si no existe
const bodyTypesDir = path.join(__dirname, '..', 'public', 'traits', 'BASE');
if (!fs.existsSync(bodyTypesDir)) {
  fs.mkdirSync(bodyTypesDir, { recursive: true });
  console.log(`Directorio creado: ${bodyTypesDir}`);
}

// Generar una imagen para cada body type
bodyTypes.forEach(bodyType => {
  // Crear canvas
  const canvas = createCanvas(1000, 1000);
  const ctx = canvas.getContext('2d');
  
  // Fondo transparente
  ctx.clearRect(0, 0, 1000, 1000);
  
  // Dibujar forma básica de cuerpo según el tipo
  ctx.fillStyle = bodyType.color;
  
  // Diferentes formas según el tipo de cuerpo
  switch (bodyType.name) {
    case 'athletic':
      // Forma más triangular y definida
      ctx.beginPath();
      ctx.moveTo(400, 200);  // Hombro izquierdo
      ctx.lineTo(600, 200);  // Hombro derecho
      ctx.lineTo(650, 600);  // Cadera derecha
      ctx.lineTo(350, 600);  // Cadera izquierda
      ctx.closePath();
      ctx.fill();
      
      // Brazos
      ctx.beginPath();
      ctx.fillRect(300, 220, 80, 250);  // Brazo izquierdo
      ctx.fillRect(620, 220, 80, 250);  // Brazo derecho
      
      // Piernas
      ctx.fillRect(380, 600, 90, 300);  // Pierna izquierda
      ctx.fillRect(530, 600, 90, 300);  // Pierna derecha
      break;
      
    case 'muscular':
      // Torso más ancho y musculoso
      ctx.beginPath();
      ctx.moveTo(350, 200);  // Hombro izquierdo
      ctx.lineTo(650, 200);  // Hombro derecho
      ctx.lineTo(620, 600);  // Cadera derecha
      ctx.lineTo(380, 600);  // Cadera izquierda
      ctx.closePath();
      ctx.fill();
      
      // Brazos grandes
      ctx.beginPath();
      ctx.arc(280, 320, 80, 0, Math.PI * 2);  // Bíceps izquierdo
      ctx.arc(720, 320, 80, 0, Math.PI * 2);  // Bíceps derecho
      ctx.fill();
      
      // Piernas
      ctx.fillRect(380, 600, 100, 300);  // Pierna izquierda
      ctx.fillRect(520, 600, 100, 300);  // Pierna derecha
      break;
      
    case 'chubby':
      // Forma más redonda
      ctx.beginPath();
      ctx.arc(500, 400, 200, 0, Math.PI * 2);  // Torso redondo
      ctx.fill();
      
      // Brazos
      ctx.fillRect(280, 320, 100, 200);  // Brazo izquierdo
      ctx.fillRect(620, 320, 100, 200);  // Brazo derecho
      
      // Piernas
      ctx.fillRect(400, 580, 90, 300);  // Pierna izquierda
      ctx.fillRect(510, 580, 90, 300);  // Pierna derecha
      break;
      
    case 'tall':
      // Forma más alargada
      ctx.beginPath();
      ctx.moveTo(400, 150);  // Hombro izquierdo
      ctx.lineTo(600, 150);  // Hombro derecho
      ctx.lineTo(620, 650);  // Cadera derecha
      ctx.lineTo(380, 650);  // Cadera izquierda
      ctx.closePath();
      ctx.fill();
      
      // Brazos largos
      ctx.fillRect(330, 170, 60, 330);  // Brazo izquierdo
      ctx.fillRect(610, 170, 60, 330);  // Brazo derecho
      
      // Piernas largas
      ctx.fillRect(400, 650, 80, 330);  // Pierna izquierda
      ctx.fillRect(520, 650, 80, 330);  // Pierna derecha
      break;
      
    case 'cybernetic':
      // Base humanoide con elementos cibernéticos
      ctx.beginPath();
      ctx.moveTo(400, 200);
      ctx.lineTo(600, 200);
      ctx.lineTo(580, 600);
      ctx.lineTo(420, 600);
      ctx.closePath();
      ctx.fill();
      
      // Brazos y piernas
      ctx.fillRect(320, 220, 70, 250);
      ctx.fillRect(610, 220, 70, 250);
      ctx.fillRect(420, 600, 70, 300);
      ctx.fillRect(510, 600, 70, 300);
      
      // Elementos cibernéticos
      ctx.strokeStyle = '#00FFFF';
      ctx.lineWidth = 10;
      ctx.beginPath();
      ctx.moveTo(350, 250);
      ctx.lineTo(650, 250);
      ctx.moveTo(400, 350);
      ctx.lineTo(600, 350);
      ctx.moveTo(450, 450);
      ctx.lineTo(550, 450);
      ctx.stroke();
      
      // Puntos de luz
      ctx.fillStyle = '#00FFFF';
      ctx.beginPath();
      ctx.arc(400, 300, 15, 0, Math.PI * 2);
      ctx.arc(600, 300, 15, 0, Math.PI * 2);
      ctx.arc(500, 500, 15, 0, Math.PI * 2);
      ctx.fill();
      break;
      
    case 'mutant':
      // Forma asimétrica y extraña
      ctx.beginPath();
      ctx.moveTo(350, 180);
      ctx.lineTo(630, 220);
      ctx.lineTo(600, 580);
      ctx.lineTo(400, 620);
      ctx.closePath();
      ctx.fill();
      
      // Brazo izquierdo extraño
      ctx.beginPath();
      ctx.moveTo(350, 180);
      ctx.lineTo(250, 300);
      ctx.lineTo(200, 500);
      ctx.lineTo(280, 450);
      ctx.lineTo(350, 400);
      ctx.closePath();
      ctx.fill();
      
      // Brazo derecho
      ctx.fillRect(630, 220, 70, 230);
      
      // Piernas asimétricas
      ctx.fillRect(410, 620, 60, 280);
      ctx.beginPath();
      ctx.moveTo(520, 620);
      ctx.lineTo(600, 620);
      ctx.lineTo(650, 900);
      ctx.lineTo(540, 900);
      ctx.closePath();
      ctx.fill();
      
      // Elementos mutantes
      ctx.fillStyle = '#B931FC';
      ctx.beginPath();
      ctx.arc(450, 350, 30, 0, Math.PI * 2);
      ctx.arc(550, 400, 25, 0, Math.PI * 2);
      ctx.arc(500, 500, 20, 0, Math.PI * 2);
      ctx.fill();
      break;
      
    case 'perfect':
      // Proporciones perfectas (como DaVinci's Vitruvian Man)
      ctx.beginPath();
      ctx.moveTo(380, 200);
      ctx.lineTo(620, 200);
      ctx.lineTo(580, 600);
      ctx.lineTo(420, 600);
      ctx.closePath();
      ctx.fill();
      
      // Brazos perfectamente proporcionados
      ctx.fillRect(320, 220, 60, 240);
      ctx.fillRect(620, 220, 60, 240);
      
      // Piernas
      ctx.fillRect(420, 600, 70, 300);
      ctx.fillRect(510, 600, 70, 300);
      
      // Aura dorada
      ctx.strokeStyle = '#FFD700';
      ctx.lineWidth = 8;
      ctx.beginPath();
      ctx.arc(500, 450, 300, 0, Math.PI * 2);
      ctx.stroke();
      break;
      
    case 'alien':
      // Forma extraterrestre
      ctx.beginPath();
      ctx.arc(500, 300, 100, 0, Math.PI * 2);  // Cabeza grande
      ctx.fill();
      
      // Cuerpo delgado
      ctx.beginPath();
      ctx.moveTo(450, 400);
      ctx.lineTo(550, 400);
      ctx.lineTo(540, 700);
      ctx.lineTo(460, 700);
      ctx.closePath();
      ctx.fill();
      
      // Brazos largos y delgados
      ctx.beginPath();
      ctx.moveTo(450, 420);
      ctx.lineTo(300, 500);
      ctx.lineTo(280, 600);
      ctx.lineTo(320, 610);
      ctx.lineTo(460, 480);
      ctx.closePath();
      ctx.fill();
      
      ctx.beginPath();
      ctx.moveTo(550, 420);
      ctx.lineTo(700, 500);
      ctx.lineTo(720, 600);
      ctx.lineTo(680, 610);
      ctx.lineTo(540, 480);
      ctx.closePath();
      ctx.fill();
      
      // Piernas
      ctx.fillRect(460, 700, 30, 200);
      ctx.fillRect(510, 700, 30, 200);
      
      // Ojos alienígenas
      ctx.fillStyle = 'black';
      ctx.beginPath();
      ctx.ellipse(470, 280, 30, 15, 0, 0, Math.PI * 2);
      ctx.ellipse(530, 280, 30, 15, 0, 0, Math.PI * 2);
      ctx.fill();
      break;
      
    case 'lean':
      // Forma delgada
      ctx.beginPath();
      ctx.moveTo(420, 200);
      ctx.lineTo(580, 200);
      ctx.lineTo(560, 600);
      ctx.lineTo(440, 600);
      ctx.closePath();
      ctx.fill();
      
      // Brazos delgados
      ctx.fillRect(360, 220, 50, 240);
      ctx.fillRect(590, 220, 50, 240);
      
      // Piernas
      ctx.fillRect(440, 600, 50, 300);
      ctx.fillRect(510, 600, 50, 300);
      break;
      
    case 'average':
      // Proporciones promedio
      ctx.beginPath();
      ctx.moveTo(400, 200);
      ctx.lineTo(600, 200);
      ctx.lineTo(580, 600);
      ctx.lineTo(420, 600);
      ctx.closePath();
      ctx.fill();
      
      // Brazos
      ctx.fillRect(340, 220, 60, 250);
      ctx.fillRect(600, 220, 60, 250);
      
      // Piernas
      ctx.fillRect(420, 600, 70, 300);
      ctx.fillRect(510, 600, 70, 300);
      break;
      
    default: // 'basic'
      // Forma humana básica
      ctx.beginPath();
      ctx.moveTo(400, 200);
      ctx.lineTo(600, 200);
      ctx.lineTo(580, 600);
      ctx.lineTo(420, 600);
      ctx.closePath();
      ctx.fill();
      
      // Brazos
      ctx.fillRect(340, 220, 60, 250);
      ctx.fillRect(600, 220, 60, 250);
      
      // Piernas
      ctx.fillRect(420, 600, 70, 300);
      ctx.fillRect(510, 600, 70, 300);
  }
  
  // Cabeza (común para todos)
  ctx.beginPath();
  ctx.arc(500, 150, 80, 0, Math.PI * 2);
  ctx.fill();
  
  // Añadir texto con información
  ctx.fillStyle = 'black';
  ctx.font = 'bold 60px Arial';
  ctx.textAlign = 'center';
  ctx.fillText(`${bodyType.name.toUpperCase()}`, 500, 800);
  
  ctx.font = 'bold 40px Arial';
  ctx.fillText(`Body Type #${bodyType.id} (${bodyType.rarity})`, 500, 870);
  
  // Guardar la imagen
  const buffer = canvas.toBuffer('image/png');
  const outputPath = path.join(bodyTypesDir, `${bodyType.name}.png`);
  fs.writeFileSync(outputPath, buffer);
  
  // También guardar con nombre alternativo para compatibilidad
  const altOutputPath = path.join(bodyTypesDir, `body_${bodyType.id}.png`);
  fs.writeFileSync(altOutputPath, buffer);
  
  console.log(`Body type creado: ${bodyType.name} (ID: ${bodyType.id})`);
});

console.log('Generación de body types completada.'); 