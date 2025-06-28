import { createCanvas, loadImage } from 'canvas';
import { Resvg } from '@resvg/resvg-js';
import path from 'path';
import fs from 'fs';

export default async function handler(req, res) {
  try {
    let { tokenId } = req.query;
    
    // Remover extensión si existe
    if (tokenId && tokenId.endsWith('.png')) {
      tokenId = tokenId.replace('.png', '');
    }
    
    if (!tokenId || isNaN(parseInt(tokenId)) || parseInt(tokenId) < 1 || parseInt(tokenId) > 9999) {
      return res.status(400).json({ error: 'Invalid floppy token ID (1-9999)' });
    }

    const tokenIdNum = parseInt(tokenId);
    
    // Datos mockup para el test - MOVIDO AQUÍ para evitar duplicación
    const mockData = {
      "1": {
        "name": "BLUNT",
        "trait": "UNISEX",
        "series": "1",
        "category": "MOUTH",
        "required": "NONE",
        "origin": "UNIVERSAL",
        "maxSupply": 450
      },
      "2": {
        "name": "CRAZY HAIR GREEN",
        "trait": "FEMALE",
        "series": "1",
        "category": "HAIR",
        "required": "HEAD",
        "origin": "GENESIS",
        "maxSupply": 85
      }
    };

    // Obtener datos del token (usar mockup por ahora)
    const tokenData = mockData[tokenId] || {
      name: `TRAIT #${tokenId}`,
      trait: "UNISEX",
      series: "1",
      category: "MOUTH",
      required: "NONE",
      origin: "UNIVERSAL",
      maxSupply: 300
    };

    console.log(`[floppy-render] Renderizando token ${tokenId} con datos:`, tokenData);

    // Función para obtener tag y color según maxSupply
    function getRarityTagAndColor(maxSupply) {
      if (maxSupply <= 50) return { tag: 'LEGENDARY', bg: '#ffd700' };
      if (maxSupply <= 150) return { tag: 'RARE', bg: '#da70d6' };
      if (maxSupply <= 300) return { tag: 'UNCOMMON', bg: '#5dade2' };
      return { tag: 'COMMON', bg: '#a9a9a9' };
    }

    const rarity = getRarityTagAndColor(tokenData.maxSupply);

    // Crear canvas 768x1024 (formato carta 3:4)
    const canvas = createCanvas(768, 1024);
    const ctx = canvas.getContext('2d');

    // Fondo principal blanco
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, 768, 1024);

    // Cargar y renderizar SVG del trait
    try {
      const svgPath = path.join(process.cwd(), 'public', 'labimages', `${tokenId}.svg`);
      console.log(`[floppy-render] Intentando cargar SVG: ${svgPath}`);
      
      if (fs.existsSync(svgPath)) {
        console.log(`[floppy-render] SVG encontrado, procesando...`);
        const svgBuffer = fs.readFileSync(svgPath);
        
        // Renderizar SVG a PNG
        const resvg = new Resvg(Buffer.from(svgBuffer), {
          fitTo: {
            mode: 'width',
            value: 600
          }
        });
        
        const pngBuffer = resvg.render().asPng();
        const traitImage = await loadImage(pngBuffer);
        
        // Dibujar contenedor de imagen con fondo dinámico
        const imageX = 84; // (768 - 600) / 2
        const imageY = 80;
        const imageSize = 600;
        
        // Fondo del contenedor con color dinámico
        ctx.fillStyle = rarity.bg + '20'; // Color con transparencia
        ctx.fillRect(imageX, imageY, imageSize, imageSize);
        
        // Dibujar imagen del trait
        ctx.drawImage(traitImage, imageX, imageY, imageSize, imageSize);
        console.log(`[floppy-render] Imagen SVG renderizada correctamente`);
        
        // Tag de rareza (superior izquierda)
        ctx.fillStyle = rarity.bg;
        ctx.fillRect(imageX, imageY, 160, 60);
        
        ctx.fillStyle = '#ffffff';
        // Usar fuente básica sin especificar familia
        ctx.font = '16px';
        ctx.textAlign = 'center';
        ctx.fillText(rarity.tag, imageX + 80, imageY + 35);
        
      } else {
        console.log(`[floppy-render] SVG no encontrado, usando placeholder`);
        // Placeholder si no existe el SVG
        ctx.fillStyle = '#f0f0f0';
        ctx.fillRect(84, 80, 600, 600);
        ctx.fillStyle = '#999999';
        ctx.font = '48px';
        ctx.textAlign = 'center';
        ctx.fillText(`TRAIT ${tokenId}`, 384, 380);
      }
    } catch (error) {
      console.error('[floppy-render] Error cargando SVG:', error);
      // Placeholder en caso de error
      ctx.fillStyle = '#f0f0f0';
      ctx.fillRect(84, 80, 600, 600);
      ctx.fillStyle = '#999999';
      ctx.font = '48px';
      ctx.textAlign = 'center';
      ctx.fillText(`TRAIT ${tokenId}`, 384, 380);
    }

    // Nombre del trait (debajo de la imagen)
    ctx.fillStyle = '#0f4e6d';
    ctx.fillRect(84, 720, 600, 80);
    
    ctx.fillStyle = '#ffffff';
    // Usar fuente básica sin especificar familia
    ctx.font = '48px';
    ctx.textAlign = 'center';
    ctx.fillText(tokenData.name, 384, 770);

    // Bloque inferior de datos
    ctx.fillStyle = '#333333';
    // Usar fuente básica sin especificar familia
    ctx.font = '24px';
    ctx.textAlign = 'left';
    
    const dataY = 840;
    const lineHeight = 35;
    
    ctx.fillText(`TRAIT: ${tokenData.trait}`, 84, dataY);
    ctx.fillText(`SERIES: ${tokenData.series}`, 84, dataY + lineHeight);
    ctx.fillText(`CATEGORY: ${tokenData.category}`, 84, dataY + lineHeight * 2);
    ctx.fillText(`REQUIRED: ${tokenData.required}`, 84, dataY + lineHeight * 3);
    
    // Origin y logo AdrianLAB (alineado a la derecha)
    ctx.textAlign = 'right';
    ctx.fillText(`${tokenData.origin}`, 684, dataY + lineHeight * 4);
    
    // Logo AdrianLAB
    ctx.font = '32px';
    ctx.fillStyle = '#333333';
    ctx.fillText('Adrian', 684, dataY + lineHeight * 5);
    ctx.fillStyle = '#ff69b4';
    ctx.fillText('LAB', 684, dataY + lineHeight * 6);

    console.log(`[floppy-render] Renderizado completado para token ${tokenId}`);

    // Configurar headers
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Cache-Control', 'public, max-age=3600'); // 1 hora de cache
    
    // Devolver imagen
    const buffer = canvas.toBuffer('image/png');
    res.status(200).send(buffer);
    
  } catch (error) {
    console.error('[floppy-render] Error:', error);
    res.status(500).json({ error: 'Error rendering floppy image', details: error.message });
  }
} 