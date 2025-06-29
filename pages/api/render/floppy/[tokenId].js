import { createCanvas, loadImage, registerFont } from 'canvas';
import { Resvg } from '@resvg/resvg-js';
import path from 'path';
import fs from 'fs';

// Configurar runtime Node.js (necesario para canvas)
export const config = { runtime: 'nodejs' };

// Ruta absoluta dentro de la propia lambda
const fontDir = path.join(__dirname, 'fonts');

// REGISTRAR TIPOGRAFÍAS ROBOTO (solo para tokens 1-9999)
try {
  console.log('[floppy-render] Registrando fuentes Roboto...');
  console.log('[floppy-render] Font directory:', fontDir);
  
  // Verificar que las fuentes existen
  const robotoRegular = path.join(fontDir, 'Roboto-Regular.ttf');
  const robotoBold = path.join(fontDir, 'Roboto-Bold.ttf');
  const robotoMedium = path.join(fontDir, 'Roboto-Medium.ttf');
  
  console.log('[floppy-render] Roboto-Regular existe:', fs.existsSync(robotoRegular));
  console.log('[floppy-render] Roboto-Bold existe:', fs.existsSync(robotoBold));
  console.log('[floppy-render] Roboto-Medium existe:', fs.existsSync(robotoMedium));
  
  // Registrar fuentes principales de Roboto
  if (fs.existsSync(robotoRegular)) {
    registerFont(robotoRegular, {
      family: 'Roboto'
    });
    console.log('[floppy-render] Roboto Regular registrada');
  }
  
  if (fs.existsSync(robotoBold)) {
    registerFont(robotoBold, {
      family: 'Roboto',
      weight: 'bold'
    });
    console.log('[floppy-render] Roboto Bold registrada');
  }
  
  if (fs.existsSync(robotoMedium)) {
    registerFont(robotoMedium, {
      family: 'Roboto',
      weight: '500'
    });
    console.log('[floppy-render] Roboto Medium registrada');
  }
  
  console.log('[floppy-render] Fuentes Roboto registradas exitosamente');
} catch (error) {
  console.error('[floppy-render] Error registrando fuentes Roboto:', error);
}

export default async function handler(req, res) {
  try {
    let { tokenId } = req.query;
    
    // Remover extensión si existe
    if (tokenId && tokenId.endsWith('.png')) {
      tokenId = tokenId.replace('.png', '');
    }
    
    if (!tokenId || isNaN(parseInt(tokenId)) || parseInt(tokenId) < 1 || parseInt(tokenId) > 15000) {
      return res.status(400).json({ error: 'Invalid floppy token ID (1-15000)' });
    }

    const tokenIdNum = parseInt(tokenId);
    console.log(`[floppy-render] ===== DEBUG INICIADO =====`);
    console.log(`[floppy-render] Token ID: ${tokenId}`);
    console.log(`[floppy-render] Token ID numérico: ${tokenIdNum}`);

    // DETERMINAR TIPO DE TOKEN
    if (tokenIdNum >= 1 && tokenIdNum <= 9999) {
      console.log(`[floppy-render] Procesando token ${tokenIdNum} como RENDERIZADO (1-9999)`);
      return await handleRenderToken(req, res, tokenIdNum);
    } else if (tokenIdNum >= 10000 && tokenIdNum <= 15000) {
      console.log(`[floppy-render] Procesando token ${tokenIdNum} como JSON (10000-15000)`);
      return await handleJsonToken(req, res, tokenIdNum);
    } else {
      return res.status(400).json({ error: 'Token ID fuera de rango válido' });
    }
    
  } catch (error) {
    console.error('[floppy-render] Error general:', error);
    console.error('[floppy-render] Stack trace:', error.stack);
    res.status(500).json({ error: 'Error processing floppy token', details: error.message });
  }
}

// FUNCIÓN PARA TOKENS 1-9999 (RENDERIZADO)
async function handleRenderToken(req, res, tokenId) {
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
      const imageY = 120;
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
      ctx.font = 'bold 16px "Roboto"'; // USAR ROBOTO
      ctx.textAlign = 'center';
      console.log(`[floppy-render] Configurando texto del tag: fuente="${ctx.font}", color=#ffffff`);
      ctx.fillText(rarity.tag, imageX + 80, imageY + 35);
      console.log(`[floppy-render] Tag de rareza "${rarity.tag}" dibujado en (${imageX + 80}, ${imageY + 35})`);
      
    } else {
      console.log(`[floppy-render] SVG no encontrado, usando placeholder`);
      ctx.fillStyle = '#f0f0f0';
      ctx.fillRect(84, 120, 600, 600);
      ctx.fillStyle = '#999999';
      ctx.font = '48px "Roboto"'; // USAR ROBOTO
      ctx.textAlign = 'center';
      ctx.fillText(`TRAIT ${tokenId}`, 384, 420);
      console.log(`[floppy-render] Placeholder dibujado`);
    }
  } catch (error) {
    console.error('[floppy-render] Error cargando SVG:', error);
    ctx.fillStyle = '#f0f0f0';
    ctx.fillRect(84, 120, 600, 600);
    ctx.fillStyle = '#999999';
    ctx.font = '48px "Roboto"'; // USAR ROBOTO
    ctx.textAlign = 'center';
    ctx.fillText(`TRAIT ${tokenId}`, 384, 420);
  }

  // Nombre del trait (debajo de la imagen)
  console.log(`[floppy-render] Dibujando nombre del trait: "${tokenData.name}"`);
  ctx.fillStyle = '#0f4e6d';
  ctx.fillRect(84, 760, 600, 80);
  
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 48px "Roboto"'; // USAR ROBOTO
  ctx.textAlign = 'center';
  console.log(`[floppy-render] Configurando nombre: fuente="${ctx.font}", color=#ffffff`);
  ctx.fillText(tokenData.name, 384, 810);
  console.log(`[floppy-render] Nombre dibujado en (384, 810)`);

  // Bloque inferior de datos
  console.log(`[floppy-render] Dibujando datos del trait...`);
  ctx.fillStyle = '#333333';
  ctx.font = '24px "Roboto"'; // USAR ROBOTO
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
  ctx.font = 'bold 32px "Roboto"'; // USAR ROBOTO
  ctx.fillStyle = '#333333';
  ctx.fillText('Adrian', 684, dataY + lineHeight * 5);
  ctx.fillStyle = '#ff69b4';
  ctx.fillText('LAB', 684, dataY + lineHeight * 6);
  console.log(`[floppy-render] Logo AdrianLAB dibujado`);

  // ===== TEXTO DE PRUEBA AL FINAL (DESPUÉS DE TODO) =====
  console.log(`[floppy-render] ===== TEST DE FUENTES ROBOTO AL FINAL =====`);
  
  // Test 1: Roboto Regular
  ctx.font = '16px "Roboto"';
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

  // Test 3: Dibujar texto de prueba en la esquina superior derecha
  console.log(`[floppy-render] Dibujando texto de prueba...`);
  ctx.fillStyle = '#ff0000'; // ROJO para que sea muy visible
  ctx.textAlign = 'left';
  ctx.fillText(testText, 650, 50);
  console.log(`[floppy-render] Texto de prueba dibujado en (650, 50)`);

  // Test 4: Diferentes variantes de Roboto en diferentes colores
  const fontsToTest = [
    { font: '16px "Roboto"', color: '#ff0000', y: 80, label: 'ROBOTO REG' },
    { font: 'bold 16px "Roboto"', color: '#00ff00', y: 100, label: 'ROBOTO BOLD' },
    { font: '500 24px "Roboto"', color: '#0000ff', y: 130, label: 'ROBOTO MEDIUM' },
    { font: 'bold 24px "Roboto"', color: '#ff00ff', y: 160, label: 'ROBOTO BOLD 24' },
    { font: '500 32px "Roboto"', color: '#ff6600', y: 190, label: 'ROBOTO MED 32' },
    { font: '48px "Roboto"', color: '#800080', y: 240, label: 'ROBOTO LARGE' }
  ];

  fontsToTest.forEach((test, index) => {
    ctx.font = test.font;
    ctx.fillStyle = test.color;
    console.log(`[floppy-render] Test ${index + 1}: "${test.font}" -> "${ctx.font}"`);
    ctx.fillText(test.label, 650, test.y);
  });

  // Test 5: Texto grande y visible en el centro con Roboto
  ctx.font = 'bold 32px "Roboto"';
  ctx.fillStyle = '#000000';
  ctx.textAlign = 'center';
  ctx.fillText('AdrianLAB ROBOTO TEST', 384, 50);
  console.log(`[floppy-render] Texto grande con Roboto dibujado en el centro`);

  // Test 6: Texto con Roboto Medium
  ctx.font = '500 32px "Roboto"';
  ctx.fillStyle = '#800080';
  ctx.fillText('ROBOTO MEDIUM', 384, 300);
  console.log(`[floppy-render] Texto con Roboto Medium dibujado`);

  // Test 7: Texto con Roboto Bold grande
  ctx.font = 'bold 48px "Roboto"';
  ctx.fillStyle = '#ff6600';
  ctx.fillText('ROBOTO BOLD LARGE', 384, 380);
  console.log(`[floppy-render] Texto Roboto Bold grande dibujado`);

  // Test 8: Texto con Roboto Regular pequeño
  ctx.font = '12px "Roboto"';
  ctx.fillStyle = '#000000';
  ctx.fillText('ROBOTO SMALL', 384, 450);
  console.log(`[floppy-render] Texto Roboto pequeño dibujado`);

  // Test 9: Texto con stroke usando Roboto
  ctx.font = '24px "Roboto"';
  ctx.strokeStyle = '#00ff00';
  ctx.lineWidth = 2;
  ctx.strokeText('ROBOTO STROKE', 384, 500);
  console.log(`[floppy-render] Texto Roboto con stroke dibujado`);

  // Test 10: Texto con fill y stroke usando Roboto
  ctx.fillStyle = '#000000';
  ctx.fillText('ROBOTO FILL+STROKE', 384, 550);
  console.log(`[floppy-render] Texto Roboto fill+stroke dibujado`);

  // Test 11: Fallback a fuentes genéricas si Roboto falla
  ctx.font = '24px sans-serif';
  ctx.fillStyle = '#ff0000';
  ctx.fillText('FALLBACK SANS-SERIF', 384, 600);
  console.log(`[floppy-render] Texto fallback dibujado`);

  console.log(`[floppy-render] ===== RENDERIZADO COMPLETADO =====`);

  // Configurar headers
  res.setHeader('Content-Type', 'image/png');
  res.setHeader('Cache-Control', 'public, max-age=3600');
  
  // Devolver imagen
  const buffer = canvas.toBuffer('image/png');
  console.log(`[floppy-render] Buffer generado, tamaño: ${buffer.length} bytes`);
  console.log(`[floppy-render] ===== DEBUG FINALIZADO =====`);
  
  res.status(200).send(buffer);
}

// FUNCIÓN PARA TOKENS 10000-15000 (JSON + GIF)
async function handleJsonToken(req, res, tokenId) {
  console.log(`[floppy-render] Generando JSON para token ${tokenId}`);
  
  // Verificar si existe el GIF correspondiente
  const gifPath = path.join(process.cwd(), 'public', 'labimages', `${tokenId}.gif`);
  const gifExists = fs.existsSync(gifPath);
  console.log(`[floppy-render] GIF existe: ${gifExists}, ruta: ${gifPath}`);
  
  // Datos mockup para tokens 10000-15000
  const mockData = {
    "10000": {
      "name": "ANIMATED TRAIT #10000",
      "description": "Un trait animado especial de la serie premium",
      "trait": "ANIMATED",
      "series": "2",
      "category": "SPECIAL",
      "required": "NONE",
      "origin": "PREMIUM",
      "maxSupply": 100,
      "rarity": "LEGENDARY"
    },
    "10001": {
      "name": "FLYING FLOPPY #10001",
      "description": "Un floppy que vuela con animación",
      "trait": "FLYING",
      "series": "2",
      "category": "MOVEMENT",
      "required": "BODY",
      "origin": "PREMIUM",
      "maxSupply": 150,
      "rarity": "RARE"
    }
  };

  const tokenData = mockData[tokenId] || {
    name: `ANIMATED TRAIT #${tokenId}`,
    description: `Un trait animado especial del token ${tokenId}`,
    trait: "ANIMATED",
    series: "2",
    category: "SPECIAL",
    required: "NONE",
    origin: "PREMIUM",
    maxSupply: 200,
    rarity: "UNCOMMON"
  };

  // Función para obtener tag y color según maxSupply
  function getRarityTagAndColor(maxSupply) {
    if (maxSupply <= 50) return { tag: 'LEGENDARY', bg: '#ffd700' };
    if (maxSupply <= 150) return { tag: 'RARE', bg: '#da70d6' };
    if (maxSupply <= 300) return { tag: 'UNCOMMON', bg: '#5dade2' };
    return { tag: 'COMMON', bg: '#a9a9a9' };
  }

  const rarity = getRarityTagAndColor(tokenData.maxSupply);
  
  // Construir JSON de metadata
  const metadata = {
    name: tokenData.name,
    description: tokenData.description,
    image: gifExists ? `/labimages/${tokenId}.gif` : null,
    external_url: `https://adrianlab.com/token/${tokenId}`,
    attributes: [
      {
        trait_type: "Trait",
        value: tokenData.trait
      },
      {
        trait_type: "Series",
        value: tokenData.series
      },
      {
        trait_type: "Category",
        value: tokenData.category
      },
      {
        trait_type: "Required",
        value: tokenData.required
      },
      {
        trait_type: "Origin",
        value: tokenData.origin
      },
      {
        trait_type: "Max Supply",
        value: tokenData.maxSupply
      },
      {
        trait_type: "Rarity",
        value: rarity.tag
      }
    ],
    properties: {
      files: [
        {
          uri: gifExists ? `/labimages/${tokenId}.gif` : null,
          type: "image/gif"
        }
      ],
      category: "image"
    }
  };

  console.log(`[floppy-render] Metadata generada:`, JSON.stringify(metadata, null, 2));
  console.log(`[floppy-render] ===== JSON COMPLETADO =====`);

  // Configurar headers para JSON
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'public, max-age=3600');
  
  res.status(200).json(metadata);
} 