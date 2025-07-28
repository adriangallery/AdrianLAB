import { Resvg } from '@resvg/resvg-js';
import path from 'path';
import fs from 'fs';

export default async function handler(req, res) {
  try {
    const { tokenId } = req.query;
    const cleanTokenId = tokenId.replace('.png', '') || '559';
    
    console.log(`[test-simple] 🧪 Iniciando test simple para token ${cleanTokenId} - VERSION COMPLETA SIN FRAME`);

    // Validar tokenId
    if (!cleanTokenId || isNaN(parseInt(cleanTokenId))) {
      console.error(`[test-simple] Token ID inválido: ${cleanTokenId}`);
      return res.status(400).json({ error: 'Invalid token ID' });
    }

    const tokenIdNum = parseInt(cleanTokenId);
    let traitData;
    
    // Determinar qué archivo cargar según el token ID
    if (tokenIdNum === 262144) {
      // Cargar datos de serums.json para token 262144
      const serumsPath = path.join(process.cwd(), 'public', 'labmetadata', 'serums.json');
      let serumsData;
      
      try {
        const serumsBuffer = fs.readFileSync(serumsPath);
        serumsData = JSON.parse(serumsBuffer.toString());
        console.log(`[test-simple] Serums data cargado, ${serumsData.serums.length} serums encontrados`);
      } catch (error) {
        console.error('[test-simple] Error cargando serums data:', error);
        return res.status(500).json({ error: 'Error cargando datos de serums' });
      }

      // Buscar el serum correspondiente al tokenId
      traitData = serumsData.serums.find(serum => serum.tokenId === tokenIdNum);
    } else {
      // Cargar datos de labmetadata para tokens 1-9999
      const labmetadataPath = path.join(process.cwd(), 'public', 'labmetadata', 'traits.json');
      let labmetadata;
      
      try {
        const labmetadataBuffer = fs.readFileSync(labmetadataPath);
        labmetadata = JSON.parse(labmetadataBuffer.toString());
        console.log(`[test-simple] Labmetadata cargado, ${labmetadata.traits.length} traits encontrados`);
      } catch (error) {
        console.error('[test-simple] Error cargando labmetadata:', error);
        return res.status(500).json({ error: 'Error cargando datos de traits' });
      }

      // Buscar el trait correspondiente al tokenId
      traitData = labmetadata.traits.find(trait => trait.tokenId === tokenIdNum);
    }
    
    if (!traitData) {
      console.log(`[test-simple] Trait no encontrado para tokenId ${cleanTokenId}, usando datos genéricos`);
      // Datos genéricos si no se encuentra el trait
      const tokenData = {
        name: `TRAIT #${cleanTokenId}`,
        category: "UNKNOWN",
        maxSupply: 300
      };
    } else {
      console.log(`[test-simple] Trait encontrado:`, JSON.stringify(traitData, null, 2));
    }

    // Usar los datos del trait encontrado o datos genéricos
    const tokenData = traitData || {
      name: `TRAIT #${cleanTokenId}`,
      category: "UNKNOWN",
      maxSupply: 300
    };

    console.log(`[test-simple] Datos del token:`, JSON.stringify(tokenData, null, 2));

    // Función para obtener tag y color según maxSupply
    function getRarityTagAndColor(maxSupply) {
      if (maxSupply === 1) return { tag: 'UNIQUE', bg: '#ff0000' };        // Rojo
      if (maxSupply <= 6) return { tag: 'LEGENDARY', bg: '#ffd700' };      // Dorado
      if (maxSupply <= 14) return { tag: 'RARE', bg: '#da70d6' };          // Púrpura
      if (maxSupply <= 40) return { tag: 'UNCOMMON', bg: '#5dade2' };      // Azul
      return { tag: 'COMMON', bg: '#a9a9a9' };                             // Gris
    }

    const rarity = getRarityTagAndColor(tokenData.maxSupply);
    console.log(`[test-simple] Rarity calculada:`, rarity);

    // LÓGICA ESPECIAL PARA TOKEN 262144 (SERUM ADRIANGF) - SERVIR GIF DIRECTAMENTE
    if (tokenIdNum === 262144) {
      console.log('[test-simple] 🧬 LÓGICA ESPECIAL: Token 262144 detectado, sirviendo GIF directamente');
      
      const gifPath = path.join(process.cwd(), 'public', 'labimages', `${cleanTokenId}.gif`);
      console.log(`[test-simple] Ruta GIF: ${gifPath}`);
      console.log(`[test-simple] Existe GIF: ${fs.existsSync(gifPath)}`);
      
      if (fs.existsSync(gifPath)) {
        const gifBuffer = fs.readFileSync(gifPath);
        console.log(`[test-simple] GIF leído, tamaño: ${gifBuffer.length} bytes`);
        
        // Configurar headers para GIF
        res.setHeader('Content-Type', 'image/gif');
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        
        // Devolver GIF directamente
        console.log(`[test-simple] ===== GIF SERVIDO DIRECTAMENTE =====`);
        res.status(200).send(gifBuffer);
        return;
      } else {
        console.error(`[test-simple] GIF no encontrado para token 262144`);
        res.status(404).json({ error: 'GIF no encontrado para serum ADRIANGF' });
        return;
      }
    }

    // Leer el SVG original del trait usando fetch HTTP
    let traitSvgContent = '';
    try {
      const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://adrianlab.vercel.app';
      const imageUrl = `${baseUrl}/labimages/${cleanTokenId}.svg`;
      console.log(`[test-simple] Cargando SVG desde URL: ${imageUrl}`);
      
      const response = await fetch(imageUrl);
      if (response.ok) {
        const svgBuffer = await response.arrayBuffer();
        traitSvgContent = Buffer.from(svgBuffer).toString();
        console.log(`[test-simple] SVG cargado, tamaño: ${svgBuffer.byteLength} bytes`);
      } else {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
    } catch (error) {
      console.log(`[test-simple] Error cargando SVG, creando placeholder: ${error.message}`);
      // SVG placeholder simple
      traitSvgContent = `
        <svg width="600" height="600" xmlns="http://www.w3.org/2000/svg">
          <rect width="600" height="600" fill="#f0f0f0"/>
          <text x="300" y="300" font-family="Arial, sans-serif" font-size="48" text-anchor="middle" fill="#999999">TRAIT ${cleanTokenId}</text>
        </svg>
      `;
    }

    // Crear SVG COMPLETO SIN FRAME (todo lo demás igual que floppy)
    const completeSvg = `
      <svg width="768" height="1024" xmlns="http://www.w3.org/2000/svg">
        <!-- Capa base en gris claro (bajo todos los elementos) -->
        <rect width="768" height="1024" fill="#f5f5f5"/>
        
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
        
        <!-- Tag de rareza (superior izquierda) -->
        <rect x="84" y="120" width="160" height="60" fill="${rarity.bg}"/>
        <text x="164" y="155" font-family="Arial, sans-serif" font-size="32" text-anchor="middle" fill="#ffffff">${rarity.tag}</text>
        
        <!-- Nombre del trait (debajo de la imagen) -->
        <rect x="84" y="760" width="600" height="80" fill="#0f4e6d"/>
        <text x="384" y="805" font-family="Arial, sans-serif" font-size="70" text-anchor="middle" fill="#ffffff">${tokenData.name}</text>
        
        <!-- Bloque inferior de datos -->
        <text x="94" y="880" font-family="Arial, sans-serif" font-size="32" fill="#333333">CATEGORY: ${tokenData.category}</text>
        <text x="94" y="915" font-family="Arial, sans-serif" font-size="32" fill="#333333">TOTAL MINTED: ${tokenData.maxSupply}</text>
        <text x="94" y="950" font-family="Arial, sans-serif" font-size="32" fill="#333333">FLOPPY: ${tokenData.floppy || 'OG'}</text>
        
        <!-- Logo AdrianLAB (alineado a la derecha) -->
        <text x="541" y="922" font-family="Arial, sans-serif" font-size="56" text-anchor="end" fill="#333333">Adrian</text>
        <text x="541" y="957" font-family="Arial, sans-serif" font-size="56" text-anchor="end" fill="#ff69b4">LAB</text>
        
        <!-- Indicador de test sin frame -->
        <rect x="84" y="980" width="600" height="40" fill="#ff6b6b"/>
        <text x="384" y="1005" font-family="Arial, sans-serif" font-size="24" text-anchor="middle" fill="#ffffff">TEST SIN FRAME - SIN CACHE</text>
      </svg>
    `;

    console.log(`[test-simple] SVG completo sin frame generado, tamaño: ${completeSvg.length} bytes`);

    try {
      // Renderizar SVG completo a PNG usando Resvg
      console.log(`[test-simple] Renderizando SVG completo a PNG con Resvg...`);
      const resvg = new Resvg(Buffer.from(completeSvg), {
        fitTo: {
          mode: 'width',
          value: 768
        }
      });
      
      const pngBuffer = resvg.render().asPng();
      console.log(`[test-simple] SVG completo renderizado a PNG, tamaño: ${pngBuffer.length} bytes`);

      // Configurar headers (sin cache)
      res.setHeader('Content-Type', 'image/png');
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      res.setHeader('X-Test-Simple', 'true');
      res.setHeader('X-Token-ID', cleanTokenId);
      res.setHeader('X-SVG-Size', traitSvgContent.length.toString());
      res.setHeader('X-PNG-Size', pngBuffer.length.toString());
      res.setHeader('X-Version', 'COMPLETA-SIN-FRAME');
      
      // Devolver imagen
      console.log(`[test-simple] ===== RENDERIZADO SIN FRAME FINALIZADO =====`);
      res.status(200).send(pngBuffer);
      
    } catch (error) {
      console.error('[test-simple] Error renderizando SVG completo:', error);
      res.status(500).json({ error: 'Error renderizando imagen' });
    }
    
  } catch (error) {
    console.error('[test-simple] Error general:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
} 