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
    
    // Datos mockup para el test
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

    const tokenData = mockData[tokenId] || {
      name: `TRAIT #${tokenId}`,
      trait: "UNISEX",
      series: "1",
      category: "MOUTH",
      required: "NONE",
      origin: "UNIVERSAL",
      maxSupply: 300
    };

    console.log(`[floppy-render] ===== DEBUG INICIADO =====`);
    console.log(`[floppy-render] Token ID: ${tokenId}`);
    console.log(`[floppy-render] Datos del token:`, JSON.stringify(tokenData, null, 2));

    // Función para obtener tag y color según maxSupply
    function getRarityTagAndColor(maxSupply) {
      if (maxSupply <= 50) return { tag: 'LEGENDARY', bg: '#ffd700' };
      if (maxSupply <= 150) return { tag: 'RARE', bg: '#da70d6' };
      if (maxSupply <= 300) return { tag: 'UNCOMMON', bg: '#5dade2' };
      return { tag: 'COMMON', bg: '#a9a9a9' };
    }

    const rarity = getRarityTagAndColor(tokenData.maxSupply);
    console.log(`[floppy-render] Rarity calculada:`, rarity);

    // Crear canvas 768x1024 (formato carta 3:4)
    console.log(`[floppy-render] Creando canvas 768x1024...`);
    const canvas = createCanvas(768, 1024);
    const ctx = canvas.getContext('2d');
    console.log(`[floppy-render] Canvas creado, contexto obtenido`);

    // DEBUG: Información del canvas
    console.log(`[floppy-render] Canvas width: ${canvas.width}, height: ${canvas.height}`);
    console.log(`[floppy-render] Context type: ${ctx.constructor.name}`);

    // Fondo principal blanco
    console.log(`[floppy-render] Aplicando fondo blanco...`);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, 768, 1024);
    console.log(`[floppy-render] Fondo blanco aplicado`);

    // DEBUG: Test de fuentes básico
    console.log(`[floppy-render] ===== TEST DE FUENTES =====`);
    
    // Test 1: Fuente básica
    ctx.font = '16px Arial';
    console.log(`[floppy-render] Fuente 1 configurada: "${ctx.font}"`);
    
    // Test 2: Medir texto
    const testText = 'TEST';
    const textMetrics = ctx.measureText(testText);
    console.log(`[floppy-render] Métricas del texto "${testText}":`, {
      width: textMetrics.width,
      actualBoundingBoxAscent: textMetrics.actualBoundingBoxAscent,
      actualBoundingBoxDescent: textMetrics.actualBoundingBoxDescent,
      fontBoundingBoxAscent: textMetrics.fontBoundingBoxAscent,
      fontBoundingBoxDescent: textMetrics.fontBoundingBoxDescent
    });

    // Test 3: Dibujar texto de prueba
    console.log(`[floppy-render] Dibujando texto de prueba...`);
    ctx.fillStyle = '#000000';
    ctx.textAlign = 'left';
    ctx.fillText(testText, 10, 50);
    console.log(`[floppy-render] Texto de prueba dibujado en (10, 50)`);

    // Test 4: Diferentes fuentes
    const fontsToTest = [
      '16px Arial',
      '16px sans-serif',
      '16px monospace',
      '16px serif',
      '16px'
    ];

    fontsToTest.forEach((font, index) => {
      ctx.font = font;
      console.log(`[floppy-render] Test ${index + 1}: "${font}" -> "${ctx.font}"`);
      ctx.fillText(`TEST${index + 1}`, 10, 80 + (index * 20));
    });

    // Cargar y renderizar SVG del trait
    try {
      const svgPath = path.join(process.cwd(), 'public', 'labimages', `${tokenId}.svg`);
      console.log(`[floppy-render] Ruta SVG: ${svgPath}`);
      console.log(`[floppy-render] Existe SVG: ${fs.existsSync(svgPath)}`);
      
      if (fs.existsSync(svgPath)) {
        console.log(`[floppy-render] SVG encontrado, procesando...`);
        const svgBuffer = fs.readFileSync(svgPath);
        console.log(`[floppy-render] SVG leído, tamaño: ${svgBuffer.length} bytes`);
        
        // Renderizar SVG a PNG
        const resvg = new Resvg(Buffer.from(svgBuffer), {
          fitTo: {
            mode: 'width',
            value: 600
          }
        });
        
        const pngBuffer = resvg.render().asPng();
        console.log(`[floppy-render] SVG renderizado a PNG, tamaño: ${pngBuffer.length} bytes`);
        
        const traitImage = await loadImage(pngBuffer);
        console.log(`[floppy-render] Imagen cargada, dimensiones: ${traitImage.width}x${traitImage.height}`);
        
        // Dibujar contenedor de imagen con fondo dinámico
        const imageX = 84;
        const imageY = 120; // Movido abajo para dejar espacio a los tests
        const imageSize = 600;
        
        // Fondo del contenedor con color dinámico
        ctx.fillStyle = rarity.bg + '20';
        ctx.fillRect(imageX, imageY, imageSize, imageSize);
        console.log(`[floppy-render] Fondo del contenedor dibujado con color: ${rarity.bg}20`);
        
        // Dibujar imagen del trait
        ctx.drawImage(traitImage, imageX, imageY, imageSize, imageSize);
        console.log(`[floppy-render] Imagen SVG dibujada en (${imageX}, ${imageY})`);
        
        // Tag de rareza (superior izquierda)
        ctx.fillStyle = rarity.bg;
        ctx.fillRect(imageX, imageY, 160, 60);
        console.log(`[floppy-render] Tag de rareza dibujado con color: ${rarity.bg}`);
        
        ctx.fillStyle = '#ffffff';
        ctx.font = '16px Arial';
        ctx.textAlign = 'center';
        console.log(`[floppy-render] Configurando texto del tag: fuente="${ctx.font}", color=#ffffff`);
        ctx.fillText(rarity.tag, imageX + 80, imageY + 35);
        console.log(`[floppy-render] Tag de rareza "${rarity.tag}" dibujado en (${imageX + 80}, ${imageY + 35})`);
        
      } else {
        console.log(`[floppy-render] SVG no encontrado, usando placeholder`);
        ctx.fillStyle = '#f0f0f0';
        ctx.fillRect(84, 120, 600, 600);
        ctx.fillStyle = '#999999';
        ctx.font = '48px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(`TRAIT ${tokenId}`, 384, 420);
        console.log(`[floppy-render] Placeholder dibujado`);
      }
    } catch (error) {
      console.error('[floppy-render] Error cargando SVG:', error);
      ctx.fillStyle = '#f0f0f0';
      ctx.fillRect(84, 120, 600, 600);
      ctx.fillStyle = '#999999';
      ctx.font = '48px Arial';
      ctx.textAlign = 'center';
      ctx.fillText(`TRAIT ${tokenId}`, 384, 420);
    }

    // Nombre del trait (debajo de la imagen)
    console.log(`[floppy-render] Dibujando nombre del trait: "${tokenData.name}"`);
    ctx.fillStyle = '#0f4e6d';
    ctx.fillRect(84, 760, 600, 80);
    
    ctx.fillStyle = '#ffffff';
    ctx.font = '48px Arial';
    ctx.textAlign = 'center';
    console.log(`[floppy-render] Configurando nombre: fuente="${ctx.font}", color=#ffffff`);
    ctx.fillText(tokenData.name, 384, 810);
    console.log(`[floppy-render] Nombre dibujado en (384, 810)`);

    // Bloque inferior de datos
    console.log(`[floppy-render] Dibujando datos del trait...`);
    ctx.fillStyle = '#333333';
    ctx.font = '24px Arial';
    ctx.textAlign = 'left';
    
    const dataY = 880;
    const lineHeight = 35;
    
    const dataLines = [
      `TRAIT: ${tokenData.trait}`,
      `SERIES: ${tokenData.series}`,
      `CATEGORY: ${tokenData.category}`,
      `REQUIRED: ${tokenData.required}`
    ];
    
    dataLines.forEach((line, index) => {
      ctx.fillText(line, 84, dataY + (lineHeight * index));
      console.log(`[floppy-render] Línea ${index + 1} dibujada: "${line}"`);
    });
    
    // Origin y logo AdrianLAB (alineado a la derecha)
    ctx.textAlign = 'right';
    ctx.fillText(`${tokenData.origin}`, 684, dataY + lineHeight * 4);
    console.log(`[floppy-render] Origin dibujado: "${tokenData.origin}"`);
    
    // Logo AdrianLAB
    ctx.font = '32px Arial';
    ctx.fillStyle = '#333333';
    ctx.fillText('Adrian', 684, dataY + lineHeight * 5);
    ctx.fillStyle = '#ff69b4';
    ctx.fillText('LAB', 684, dataY + lineHeight * 6);
    console.log(`[floppy-render] Logo AdrianLAB dibujado`);

    console.log(`[floppy-render] ===== RENDERIZADO COMPLETADO =====`);

    // Configurar headers
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    
    // Devolver imagen
    const buffer = canvas.toBuffer('image/png');
    console.log(`[floppy-render] Buffer generado, tamaño: ${buffer.length} bytes`);
    console.log(`[floppy-render] ===== DEBUG FINALIZADO =====`);
    
    res.status(200).send(buffer);
    
  } catch (error) {
    console.error('[floppy-render] Error general:', error);
    console.error('[floppy-render] Stack trace:', error.stack);
    res.status(500).json({ error: 'Error rendering floppy image', details: error.message });
  }
} 