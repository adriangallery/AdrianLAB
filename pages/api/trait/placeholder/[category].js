import { createCanvas } from 'canvas';

export default async function handler(req, res) {
  try {
    // Extraer categoría de la consulta
    const { category } = req.query;
    
    // Crear un canvas para la imagen placeholder
    const canvas = createCanvas(500, 500);
    const ctx = canvas.getContext('2d');
    
    // Asignar color según la categoría
    let bgColor = '#3182CE'; // Azul por defecto
    
    switch (category?.toUpperCase()) {
      case 'BACKGROUND':
        bgColor = '#3182CE'; // Azul
        break;
      case 'BASE':
        bgColor = '#38A169'; // Verde
        break;
      case 'EYES':
        bgColor = '#DD6B20'; // Naranja
        break;
      case 'MOUTH':
        bgColor = '#E53E3E'; // Rojo
        break;
      case 'HEAD':
        bgColor = '#805AD5'; // Púrpura
        break;
      case 'CLOTHING':
        bgColor = '#D69E2E'; // Amarillo
        break;
      case 'ACCESSORIES':
        bgColor = '#319795'; // Turquesa
        break;
      case 'SKIN':
        bgColor = '#ED64A6'; // Rosa
        break;
      default:
        bgColor = '#718096'; // Gris
    }
    
    // Dibujar fondo
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, 500, 500);
    
    // Dibujar texto
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 36px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(category?.toUpperCase() || 'TRAIT', 250, 230);
    
    ctx.font = '24px Arial';
    ctx.fillText('Placeholder Image', 250, 280);
    
    // Devolver la imagen
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Cache-Control', 'public, max-age=86400'); // 1 día
    
    const buffer = canvas.toBuffer('image/png');
    res.send(buffer);
  } catch (error) {
    console.error('Error al generar imagen placeholder:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
} 