import { Resvg } from '@resvg/resvg-js';
import path from 'path';
import fs from 'fs';
import { textToSVGElement, linesToSVG } from '../../../../lib/text-to-svg.js';

export default async function handler(req, res) {
  // Configurar CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  try {
    let { tokenId } = req.query;
    
    if (tokenId && tokenId.endsWith('.png')) {
      tokenId = tokenId.replace('.png', '');
    }
    
    if (!tokenId || isNaN(parseInt(tokenId))) {
      return res.status(400).json({ error: 'Invalid token ID' });
    }

    const tokenIdNum = parseInt(tokenId);
    console.log(`[floppy-render] ===== RENDERIZADO TRAITS (1-9999) =====`);
    console.log(`[floppy-render] Token ID: ${tokenId}`);

    // Solo procesar tokens 1-9999 (traits)
    if (tokenIdNum >= 1 && tokenIdNum <= 9999) {
      console.log(`[floppy-render] Procesando trait ${tokenId} (renderizado PNG)`);
      await handleRenderToken(req, res, tokenId);
    } else {
      res.status(400).json({ error: 'Este endpoint solo maneja tokens 1-9999 (traits). Para tokens 10000+ usa /api/metadata/floppy/[tokenId]' });
    }
  } catch (error) {
    console.error('[floppy-render] Error:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

// FUNCIÓN PARA TOKENS 1-9999 (SVG COMPLETO CON TEXTO CONVERTIDO A PATHS)
async function handleRenderToken(req, res, tokenId) {
  // Cargar datos de labmetadata
  const labmetadataPath = path.join(process.cwd(), 'public', 'labmetadata', 'traits.json');
  let labmetadata;
  
  try {
    const labmetadataBuffer = fs.readFileSync(labmetadataPath);
    labmetadata = JSON.parse(labmetadataBuffer.toString());
    console.log(`[floppy-render] Labmetadata cargado, ${labmetadata.traits.length} traits encontrados`);
  } catch (error) {
    console.error('[floppy-render] Error cargando labmetadata:', error);
    return res.status(500).json({ error: 'Error cargando datos de traits' });
  }

  // Buscar el trait correspondiente al tokenId
  const traitData = labmetadata.traits.find(trait => trait.tokenId === parseInt(tokenId));
  
  if (!traitData) {
    console.log(`[floppy-render] Trait no encontrado para tokenId ${tokenId}, usando datos genéricos`);
    // Datos genéricos si no se encuentra el trait
    const tokenData = {
      name: `TRAIT #${tokenId}`,
      category: "UNKNOWN",
      maxSupply: 300
    };
  } else {
    console.log(`[floppy-render] Trait encontrado:`, JSON.stringify(traitData, null, 2));
  }

  // Usar los datos del trait encontrado o datos genéricos
  const tokenData = traitData || {
    name: `TRAIT #${tokenId}`,
    category: "UNKNOWN",
    maxSupply: 300
  };

  console.log(`[floppy-render] Datos del token:`, JSON.stringify(tokenData, null, 2));

  // Función para obtener tag y color según maxSupply (niveles actualizados)
  function getRarityTagAndColor(maxSupply) {
    if (maxSupply <= 30) return { tag: 'LEGENDARY', bg: '#ffd700' };    // Dorado
    if (maxSupply <= 100) return { tag: 'RARE', bg: '#da70d6' };       // Púrpura
    if (maxSupply <= 300) return { tag: 'UNCOMMON', bg: '#5dade2' };   // Azul
    return { tag: 'COMMON', bg: '#a9a9a9' };                          // Gris
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
      <!-- Frame SVG (fondo de todas las capas) -->
      <defs>
        <style>
          .cls-1 { fill: #fff; }
        </style>
      </defs>
      
      <!-- Frame original adaptado a 768x1024 -->
      <g transform="translate(0, 0) scale(1, 1.333)">
        <polygon class="cls-1" points="30.33 .49 .83 .49 .83 766.31 30.33 766.31 30.29 68.38 761.63 68.97 761.66 767.99 767.91 767.99 767.92 0 30.33 .49"/>
        <g>
          <path d="M762.95,0v2.9H2.89s0,35.21,0,35.21h760.07v729.89H0V0h762.96ZM28.87,40.99H2.89v25.98h25.98v-25.98ZM58.31,40.99h-26.56v25.98h285.8v-25.98h-23.67v8.66c0,.14-2.89.14-2.89,0v-8.66h-25.98v8.66c0,.14-2.89.14-2.89,0v-8.66h-25.98v8.66c0,.14-2.89.14-2.89,0v-8.66h-26.56v8.66c0,.14-2.89.14-2.89,0v-8.66h-25.98v17.32c0,.14-2.89.14-2.89,0v-17.32h-26.56v8.66c0,.14-2.89.14-2.89,0v-8.66h-25.98v8.66c0,.14-2.89.14-2.89,0v-8.66h-26.56v8.66c0,.14-2.89.14-2.89,0v-8.66h-25.98c.03,1.28-.26,8.66-.26,8.66h-2.63v-8.66ZM346.43,40.99h-25.98v25.98h285.23v-25.98h-23.1v8.66c0,.14-2.89.14-2.89,0v-8.66h-26.56v8.66c0,.14-2.89.14-2.89,0v-8.66h-25.98v8.66c0,.14-2.89.14-2.89,0v-8.66h-25.98v8.66c0,.14-2.89.14-2.89,0v-8.66h-26.56v17.32c0,.14-2.89.14-2.89,0v-17.32h-25.98v8.66c0,.14-2.89.14-2.89,0v-8.66h-26.56v8.66c0,.14-2.89.14-2.89,0v-8.66h-25.98v8.66c0,.14-2.89.14-2.89,0v-8.66h-26.56v8.66c0,.14-2.89.14-2.89,0v-8.66ZM635.12,40.99h-26.56v25.98h151.85v-25.98h-5.77v17.32c0,.17-3.46.17-3.46,0v-17.32h-25.98v8.66c0,.14-2.89.14-2.89,0v-8.66h-26.56v8.66h-2.89v-8.66h-25.98v8.66c0,.14-2.89.14-2.89,0v-8.66h-25.98v8.66c0,.14-2.89.14-2.89,0v-8.66ZM28.87,69.86H2.89v26.56h8.66c.14,0,.14,2.89,0,2.89H2.89v25.98h8.66c.14,0,.14,2.89,0,2.89H2.89v26.56h8.66c.14,0,.14,2.89,0,2.89H2.89v25.98h8.66c.14,0,.14,2.89,0,2.89H2.89v25.69c0,.06-.06.87,0,.87h17.32c.14,0,.14,2.89,0,2.89H2.89v25.98h8.66c.14,0,.14,2.89,0,2.89H2.89v25.98h8.66c.14,0,.14,2.89,0,2.89H2.89v26.56h8.66c.14,0,.14,2.89,0,2.89H2.89v25.98h8.66c.14,0,.14,2.89,0,2.89H2.89v26.56h25.98V69.86ZM760.41,765.69V70.73c0-.06.06-.87,0-.87H31.75c-.06,0,0,.8,0,.87v694.96h728.65ZM28.87,361.44H2.89v23.1h8.66c.14,0,.14,2.89,0,2.89H2.89v25.98h8.66c.14,0,.1,2.79,0,2.89-.41.41-8.66-.81-8.66.86v25.69h8.66c.14,0,.14,2.89,0,2.89H2.89v25.98h8.66c.58,1.17,0,3.13,0,3.13H2.89v26.32h17.32c.14,0,.14,2.89,0,2.89H2.89v25.98h8.66c.14,0,.14,2.89,0,2.89H2.89v26.56h8.66c.14,0,.14,2.89,0,2.89H2.89v25.98h8.66c.14,0,.14,2.89,0,2.89H2.89v26.56h8.66c.14,0,.14,2.89,0,2.89H2.89v25.98h25.98v-285.23ZM28.87,649.55H2.89v23.1h8.66c.14,0,.14,2.89,0,2.89H2.89v26.56h8.66c.14,0,.14,2.89,0,2.89H2.89v25.98h8.66c.14,0,.14,2.89,0,2.89H2.89v31.86h25.98v-116.16Z"/>
          <rect x="46.77" y="5.77" width="716.19" height="2.89"/>
          <path d="M762.95,11.54v2.89H46.77c-.14,0,0-2.89,0-2.89h716.19Z"/>
          <rect x="46.77" y="17.32" width="716.19" height="2.89"/>
          <rect x="46.77" y="23.67" width="716.19" height="2.89"/>
          <rect x="46.77" y="29.44" width="716.19" height="2.89"/>
          <path d="M14.43,8.53c.08.12.14,20.83,0,20.92-.62-.08-2.89,0-2.89,0V8.53s2.13.09,2.89,0Z"/>
          <path d="M14.43,8.53v-2.77h20.21s-.08,2.15,0,2.77c-.07.06-20.21,0-20.21,0Z"/>
          <path d="M34.64,29.45c-.04.67,0,2.89,0,2.89H14.43v-2.89s20.26.08,20.21,0Z"/>
          <path d="M34.64,29.45c-.07.02-.07-20.86,0-20.92-.13-.06,2.88,0,2.88,0v20.92h-2.88Z"/>
          <rect class="cls-1" x="2.89" y="40.99" width="25.98" height="25.98"/>
        </g>
      </g>
      
      <!-- Contenedor de imagen con fondo dinámico -->
      <rect x="84" y="120" width="600" height="600" fill="${rarity.bg}20"/>
      
      <!-- Mannequin (base del personaje) -->
      <g transform="translate(84, 120) scale(16.22)">
        ${fs.readFileSync(path.join(process.cwd(), 'public', 'labimages', 'mannequin.svg'), 'utf8').replace(/<svg[^>]*>/, '').replace(/<\/svg>/, '')}
      </g>
      
      <!-- Imagen del trait (centrada en el contenedor) -->
      <g transform="translate(84, 120) scale(16.22)">
        ${traitSvgContent.replace(/<svg[^>]*>/, '').replace(/<\/svg>/, '')}
      </g>
      
      <!-- Tag de rareza (superior izquierda) - convertido a path -->
      <rect x="84" y="120" width="160" height="60" fill="${rarity.bg}"/>
      ${textToSVGElement(rarity.tag, {
        x: 84 + 160 / 2,  // Centro horizontal del rectángulo
        y: 120 + 60 / 2,  // Centro vertical del rectángulo
        fontSize: 32,     // Tamaño equilibrado
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
          text: `CATEGORY: ${tokenData.category}`,
          x: 84 + 10,  // Margen izquierdo de 10px
          y: 880,
          fontSize: 32,  // Aumentado de 24 a 32
          fill: '#333333',
          anchor: 'start middle'
        },
        {
          text: `MAX SUPPLY: ${tokenData.maxSupply}`,
          x: 84 + 10,  // Margen izquierdo de 10px
          y: 915,
          fontSize: 32,  // Aumentado de 24 a 32
          fill: '#333333',
          anchor: 'start middle'
        },
        {
          text: `FLOPPY: ${tokenData.floppy || 'OG'}`,
          x: 84 + 10,  // Margen izquierdo de 10px
          y: 950,
          fontSize: 32,  // Aumentado de 24 a 32
          fill: '#333333',
          anchor: 'start middle'
        }
      ])}
      
      <!-- Logo AdrianLAB (alineado a la derecha) - convertido a paths -->
      ${textToSVGElement('Adrian', {
        x: 684 - 155, // Movido otros 25px a la derecha (de -180 a -155)
        y: 922,       // Subido 3px (de 925 a 922)
        fontSize: 56,
        fill: '#333333',
        anchor: 'end'
      })}
      
      ${textToSVGElement('LAB', {
        x: 684 - 155, // Movido otros 25px a la derecha (de -180 a -155)
        y: 957,       // Subido 3px (de 960 a 957)
        fontSize: 56,
        fill: '#ff69b4',
        anchor: 'end'
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