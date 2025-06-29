import { Resvg } from '@resvg/resvg-js';
import path from 'path';
import fs from 'fs';
import { textToSVGElement, linesToSVG } from '../../../../lib/text-to-svg.js';

export default async function handler(req, res) {
  try {
    let { tokenId } = req.query;
    
    if (tokenId && tokenId.endsWith('.png')) {
      tokenId = tokenId.replace('.png', '');
    }
    
    if (!tokenId || isNaN(parseInt(tokenId))) {
      return res.status(400).json({ error: 'Invalid token ID' });
    }

    const tokenIdNum = parseInt(tokenId);
    console.log(`[floppy-render] ===== DEBUG INICIADO =====`);
    console.log(`[floppy-render] Token ID: ${tokenId}`);
    console.log(`[floppy-render] Token ID numérico: ${tokenIdNum}`);

    // Determinar el rango del token
    if (tokenIdNum >= 1 && tokenIdNum <= 9999) {
      console.log(`[floppy-render] Procesando token ${tokenId} como RENDERIZADO (1-9999)`);
      await handleRenderToken(req, res, tokenId);
    } else if (tokenIdNum >= 10000 && tokenIdNum <= 15000) {
      console.log(`[floppy-render] Procesando token ${tokenId} como JSON (10000-15000)`);
      await handleJsonToken(req, res, tokenId);
    } else {
      res.status(400).json({ error: 'Token ID fuera de rango válido' });
    }
  } catch (error) {
    console.error('[floppy-render] Error:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

// FUNCIÓN PARA TOKENS 1-9999 (SVG COMPLETO CON TEXTO CONVERTIDO A PATHS)
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

  // ===== SOLUCIÓN DEFINITIVA: SVG COMPLETO CON TEXTO CONVERTIDO A PATHS =====
  console.log(`[floppy-render] ===== CREANDO SVG COMPLETO CON TEXTO A PATHS =====`);
  
  // Leer el SVG original del trait
  let traitSvgContent = '';
  const svgPath = path.join(process.cwd(), 'public', 'labimages', `${tokenId}.svg`);
  console.log(`[floppy-render] Ruta SVG: ${svgPath}`);
  console.log(`[floppy-render] Existe SVG: ${fs.existsSync(svgPath)}`);
  
  if (fs.existsSync(svgPath)) {
    const svgBuffer = fs.readFileSync(svgPath);
    traitSvgContent = svgBuffer.toString();
    console.log(`[floppy-render] SVG leído, tamaño: ${svgBuffer.length} bytes`);
  } else {
    console.log(`[floppy-render] SVG no encontrado, creando placeholder`);
    // SVG placeholder simple
    traitSvgContent = `
      <svg width="600" height="600" xmlns="http://www.w3.org/2000/svg">
        <rect width="600" height="600" fill="#f0f0f0"/>
        <text x="300" y="300" font-family="Arial, sans-serif" font-size="48" text-anchor="middle" fill="#999999">TRAIT ${tokenId}</text>
      </svg>
    `;
  }

  // Crear SVG completo con texto convertido a paths
  const completeSvg = `
    <svg width="768" height="1024" xmlns="http://www.w3.org/2000/svg">
      <!-- Fondo principal -->
      <rect width="768" height="1024" fill="#ffffff"/>
      
      <!-- Contenedor de imagen con fondo dinámico -->
      <rect x="84" y="120" width="600" height="600" fill="${rarity.bg}20"/>
      
      <!-- Imagen del trait (centrada en el contenedor) -->
      <g transform="translate(84, 120) scale(16.22)">
        ${traitSvgContent.replace(/<svg[^>]*>/, '').replace(/<\/svg>/, '')}
      </g>
      
      <!-- Tag de rareza (superior izquierda) - convertido a path -->
      <rect x="84" y="120" width="160" height="60" fill="${rarity.bg}"/>
      ${textToSVGElement(rarity.tag, {
        x: 84 + 160 / 2,  // Centro horizontal del rectángulo
        y: 120 + 60 / 2,  // Centro vertical del rectángulo
        fontSize: 16,
        fill: '#ffffff',
        anchor: 'center middle'
      })}
      
      <!-- Nombre del trait (debajo de la imagen) - convertido a path -->
      <rect x="84" y="760" width="600" height="80" fill="#0f4e6d"/>
      ${textToSVGElement(tokenData.name, {
        x: 84 + 600 / 2,  // Centro horizontal del rectángulo
        y: 760 + 80 / 2,  // Centro vertical del rectángulo
        fontSize: 48,
        fill: '#ffffff',
        anchor: 'center middle'
      })}
      
      <!-- Bloque inferior de datos - convertido a paths -->
      ${linesToSVG([
        {
          text: `TRAIT: ${tokenData.trait}`,
          x: 84,
          y: 880,
          fontSize: 24,
          fill: '#333333',
          anchor: 'left middle'
        },
        {
          text: `SERIES: ${tokenData.series}`,
          x: 84,
          y: 915,
          fontSize: 24,
          fill: '#333333',
          anchor: 'left middle'
        },
        {
          text: `CATEGORY: ${tokenData.category}`,
          x: 84,
          y: 950,
          fontSize: 24,
          fill: '#333333',
          anchor: 'left middle'
        },
        {
          text: `REQUIRED: ${tokenData.required}`,
          x: 84,
          y: 985,
          fontSize: 24,
          fill: '#333333',
          anchor: 'left middle'
        }
      ])}
      
      <!-- Origin (alineado a la derecha) - convertido a path -->
      ${textToSVGElement(tokenData.origin, {
        x: 684,
        y: 985,
        fontSize: 24,
        fill: '#333333',
        anchor: 'right middle'
      })}
      
      <!-- Logo AdrianLAB (alineado a la derecha) - convertido a paths -->
      ${textToSVGElement('Adrian', {
        x: 684,
        y: 1020,
        fontSize: 32,
        fill: '#333333',
        anchor: 'right middle'
      })}
      ${textToSVGElement('LAB', {
        x: 684,
        y: 1055,
        fontSize: 32,
        fill: '#ff69b4',
        anchor: 'right middle'
      })}
    </svg>
  `;

  console.log(`[floppy-render] SVG completo generado con texto convertido a paths`);

  try {
    // Renderizar SVG completo a PNG usando Resvg
    console.log(`[floppy-render] Renderizando SVG completo a PNG con Resvg...`);
    const resvg = new Resvg(Buffer.from(completeSvg), {
      fitTo: {
        mode: 'width',
        value: 768
      }
    });
    
    const pngBuffer = resvg.render().asPng();
    console.log(`[floppy-render] SVG completo renderizado a PNG, tamaño: ${pngBuffer.length} bytes`);

    // Configurar headers
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    
    // Devolver imagen
    console.log(`[floppy-render] ===== RENDERIZADO SVG COMPLETO FINALIZADO =====`);
    res.status(200).send(pngBuffer);
    
  } catch (error) {
    console.error('[floppy-render] Error renderizando SVG completo:', error);
    res.status(500).json({ error: 'Error renderizando imagen' });
  }
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
        trait_type: "Rarity",
        value: rarity.tag
      }
    ]
  };

  console.log(`[floppy-render] JSON generado para token ${tokenId}`);
  
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'public, max-age=3600');
  res.status(200).json(metadata);
} 