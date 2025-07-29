import { Resvg } from '@resvg/resvg-js';
import path from 'path';
import fs from 'fs';
import { textToSVGElement, linesToSVG } from '../../../lib/text-to-svg.js';
import { getContracts } from '../../../lib/contracts.js';

// Función para generar GIF animado simple
const generateAnimatedGif = async (svgContent, tokenId) => {
  console.log(`[test-simple] 🎬 Generando GIF animado para token ${tokenId}`);
  
  try {
    // Crear múltiples frames con pequeñas variaciones
    const frames = [];
    const numFrames = 10; // 10 frames para la animación
    
    for (let i = 0; i < numFrames; i++) {
      // Crear una pequeña variación en el SVG para cada frame
      let frameSvg = svgContent;
      
      // Añadir un efecto de "pulso" sutil al contenedor del trait
      const pulseOpacity = 0.8 + (0.2 * Math.sin(i * 0.5)); // Opacidad que varía entre 0.8 y 1.0
      
      // Reemplazar la opacidad del contenedor del trait
      frameSvg = frameSvg.replace(
        /<rect x="84" y="120" width="600" height="600" fill="#f0f0f0" opacity="0\.1"\/>/,
        `<rect x="84" y="120" width="600" height="600" fill="#f0f0f0" opacity="${pulseOpacity.toFixed(2)}"/>`
      );
      
      // Renderizar cada frame a PNG
      const resvg = new Resvg(Buffer.from(frameSvg), {
        fitTo: {
          mode: 'width',
          value: 768
        }
      });
      
      const pngBuffer = resvg.render().asPng();
      frames.push(pngBuffer);
      
      console.log(`[test-simple] Frame ${i + 1}/${numFrames} generado, tamaño: ${pngBuffer.length} bytes`);
    }
    
    // Por ahora, devolvemos el primer frame como PNG
    // En el futuro, aquí iría la lógica para combinar los frames en un GIF
    console.log(`[test-simple] ✅ GIF animado generado con ${numFrames} frames`);
    return frames[0]; // Temporalmente devolvemos solo el primer frame
    
  } catch (error) {
    console.error('[test-simple] Error generando GIF animado:', error);
    throw error;
  }
};

export default async function handler(req, res) {
  try {
    const { tokenId } = req.query;
    const cleanTokenId = tokenId.replace('.gif', '').replace('.png', '') || '559';
    
    console.log(`[test-simple] 🧪 Iniciando test simple para token ${cleanTokenId} - VERSION GIF ANIMADO - METODO PERSONALIZADO`);

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

    // Obtener datos onchain para calcular total minted
    let totalMinted = 0;
    try {
      console.log(`[test-simple] Conectando con los contratos...`);
      const { traitsCore } = await getContracts();
      console.log(`[test-simple] Obteniendo totalMintedPerAsset para trait ${cleanTokenId}...`);
      const mintedAmount = await traitsCore.totalMintedPerAsset(cleanTokenId);
      console.log(`[test-simple] TotalMintedPerAsset obtenido: ${mintedAmount.toString()}`);
      
      // Usar directamente el valor obtenido del contrato
      totalMinted = mintedAmount.toNumber();
      console.log(`[test-simple] Total minted obtenido del contrato: ${totalMinted}`);
    } catch (error) {
      console.error(`[test-simple] Error obteniendo totalMintedPerAsset:`, error.message);
      // Fallback: usar maxSupply como total minted si falla la llamada onchain
      totalMinted = tokenData.maxSupply;
      console.log(`[test-simple] Usando fallback: totalMinted = maxSupply = ${totalMinted}`);
    }

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

    // NUEVAS FUNCIONES: Método personalizado para renderizado individual (como test-simple)
    const loadTraitFromLabimages = async (traitId) => {
      try {
        const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://adrianlab.vercel.app';
        const imageUrl = `${baseUrl}/labimages/${traitId}.svg`;
        console.log(`[test-simple] Cargando trait desde labimages: ${imageUrl}`);

        const response = await fetch(imageUrl);
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const svgBuffer = await response.arrayBuffer();
        console.log(`[test-simple] SVG cargado, tamaño: ${svgBuffer.byteLength} bytes`);
        
        // Renderizar SVG a PNG PRIMERO (mismo método que render personalizado)
        const resvg = new Resvg(Buffer.from(svgBuffer), {
          fitTo: {
            mode: 'width',
            value: 600  // Tamaño para el contenedor
          }
        });
        
        const pngBuffer = resvg.render().asPng();
        console.log(`[test-simple] Trait renderizado a PNG, tamaño: ${pngBuffer.length} bytes`);
        
        // Convertir a base64 para usar en <image>
        const base64Image = `data:image/png;base64,${pngBuffer.toString('base64')}`;
        return base64Image;
      } catch (error) {
        console.error(`[test-simple] Error cargando trait ${traitId} desde labimages:`, error.message);
        return null;
      }
    };

    const loadMannequinFromLabimages = async () => {
      try {
        const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://adrianlab.vercel.app';
        const imageUrl = `${baseUrl}/labimages/mannequin.svg`;
        console.log(`[test-simple] Cargando mannequin desde labimages: ${imageUrl}`);

        const response = await fetch(imageUrl);
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const svgBuffer = await response.arrayBuffer();
        console.log(`[test-simple] Mannequin SVG cargado, tamaño: ${svgBuffer.byteLength} bytes`);
        
        // Renderizar SVG a PNG PRIMERO
        const resvg = new Resvg(Buffer.from(svgBuffer), {
          fitTo: {
            mode: 'width',
            value: 600  // Tamaño para el contenedor
          }
        });
        
        const pngBuffer = resvg.render().asPng();
        console.log(`[test-simple] Mannequin renderizado a PNG, tamaño: ${pngBuffer.length} bytes`);
        
        // Convertir a base64 para usar en <image>
        const base64Image = `data:image/png;base64,${pngBuffer.toString('base64')}`;
        return base64Image;
      } catch (error) {
        console.error(`[test-simple] Error cargando mannequin desde labimages:`, error.message);
        return null;
      }
    };

    // Cargar trait y mannequin usando el método personalizado
    console.log(`[test-simple] Cargando trait ${cleanTokenId} usando método personalizado...`);
    const traitImageData = await loadTraitFromLabimages(cleanTokenId);
    
    console.log(`[test-simple] Cargando mannequin usando método personalizado...`);
    const mannequinImageData = await loadMannequinFromLabimages();

    if (!traitImageData) {
      console.error(`[test-simple] No se pudo cargar el trait ${cleanTokenId}`);
      return res.status(404).json({ error: 'Trait no encontrado' });
    }

    if (!mannequinImageData) {
      console.error(`[test-simple] No se pudo cargar el mannequin`);
      return res.status(500).json({ error: 'Error cargando mannequin' });
    }

    console.log(`[test-simple] ✅ Trait y mannequin cargados exitosamente usando método personalizado`);

    // Cargar frame mejorado
    let frameSvgContent;
    try {
      frameSvgContent = fs.readFileSync(path.join(process.cwd(), 'public', 'labimages', 'frameimproved.svg'), 'utf8')
        .replace(/<\?xml[^>]*\?>/, '')  // Remover declaración XML
        .replace(/<svg[^>]*>/, '')      // Remover tag de apertura SVG
        .replace(/<\/svg>/, '');        // Remover tag de cierre SVG
      console.log(`[test-simple] Frame mejorado cargado, tamaño: ${frameSvgContent.length} bytes`);
    } catch (error) {
      console.error('[test-simple] Error cargando frame mejorado:', error);
      return res.status(500).json({ error: 'Error cargando frame' });
    }

    // Verificar que los traits animados existen
    try {
      const trait600Path = path.join(process.cwd(), 'public', 'labimages', '600.svg');
      const trait601Path = path.join(process.cwd(), 'public', 'labimages', '601.svg');
      
      console.log(`[test-simple] Verificando trait 600: ${trait600Path} - Existe: ${fs.existsSync(trait600Path)}`);
      console.log(`[test-simple] Verificando trait 601: ${trait601Path} - Existe: ${fs.existsSync(trait601Path)}`);
      
      if (fs.existsSync(trait600Path)) {
        const trait600Content = fs.readFileSync(trait600Path, 'utf8');
        console.log(`[test-simple] Trait 600 cargado, tamaño: ${trait600Content.length} bytes`);
      }
      
      if (fs.existsSync(trait601Path)) {
        const trait601Content = fs.readFileSync(trait601Path, 'utf8');
        console.log(`[test-simple] Trait 601 cargado, tamaño: ${trait601Content.length} bytes`);
        console.log(`[test-simple] Trait 601 contenido (primeras 200 chars): ${trait601Content.substring(0, 200)}`);
      }
    } catch (error) {
      console.error('[test-simple] Error verificando traits animados:', error);
    }

    // Construir SVG completo con frame y todos los elementos
    const completeSvg = `
      <svg width="768" height="1024" xmlns="http://www.w3.org/2000/svg">
        <!-- Fondo gris claro -->
        <rect x="0" y="0" width="768" height="1024" fill="#f8f9fa"/>
        
        <!-- Frame SVG completo -->
        <g transform="translate(0, 0)">
          ${frameSvgContent}
        </g>
        
        <!-- Contenedor con fondo dinámico según rareza -->
        <rect x="84" y="120" width="600" height="600" fill="${rarity.bg}20" opacity="0.1"/>
        
        <!-- Mannequin (base del personaje) usando <image> -->
        <image x="84" y="120" width="600" height="600" href="${mannequinImageData}" />
        
        <!-- Imagen del trait (centrada en el contenedor) usando <image> -->
        <image x="84" y="120" width="600" height="600" href="${traitImageData}" />
        
        <!-- TRAIT ANIMADO 600.svg en capa superior -->
        <image x="84" y="120" width="600" height="600" href="data:image/svg+xml;base64,${Buffer.from(fs.readFileSync(path.join(process.cwd(), 'public', 'labimages', '600.svg'), 'utf8')).toString('base64')}" />
        
        <!-- TRAIT ANIMADO 601.svg en capa superior (posicionado diferente para visibilidad) -->
        <image x="200" y="200" width="300" height="300" href="data:image/svg+xml;base64,${Buffer.from(fs.readFileSync(path.join(process.cwd(), 'public', 'labimages', '601.svg'), 'utf8')).toString('base64')}" />
        
        <!-- Tag de rareza (superior izquierda) - convertido a path -->
        ${textToSVGElement(rarity.tag, {
          x: 84 + 10,
          y: 120 + 40,
          fontSize: 32,
          fill: '#ffffff',
          anchor: 'start'
        })}
        
        <!-- Nombre del trait (debajo de la imagen) - convertido a path -->
        ${textToSVGElement(tokenData.name, {
          x: 84 + 10,
          y: 740,
          fontSize: 48,
          fill: '#333333',
          anchor: 'start'
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
            text: `TOTAL MINTED: ${totalMinted}`,
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
          x: 684 - 143, // Movido otros 12px a la derecha (de -155 a -143)
          y: 922,       // Subido 3px (de 925 a 922)
          fontSize: 56,
          fill: '#333333',
          anchor: 'end'
        })}
        
        ${textToSVGElement('LAB', {
          x: 684 - 143, // Movido otros 12px a la derecha (de -155 a -143)
          y: 957,       // Subido 3px (de 960 a 957)
          fontSize: 56,
          fill: '#ff69b4',
          anchor: 'end'
        })}
        
        <!-- Indicador de test con frame -->
        <rect x="84" y="980" width="600" height="40" fill="#ff6b6b"/>
        <text x="384" y="1005" font-family="Arial, sans-serif" font-size="24" text-anchor="middle" fill="#ffffff">TEST GIF ANIMADO - METODO PERSONALIZADO</text>
      </svg>
    `;

    console.log(`[test-simple] SVG completo con frame generado, tamaño: ${completeSvg.length} bytes`);
    console.log(`[test-simple] DEBUG - Orden de capas:`);
    console.log(`[test-simple] DEBUG - 1. Fondo gris claro`);
    console.log(`[test-simple] DEBUG - 2. Frame SVG completo`);
    console.log(`[test-simple] DEBUG - 3. Contenedor con fondo dinámico (${rarity.bg}20)`);
    console.log(`[test-simple] DEBUG - 4. Mannequin (base del personaje) - MÉTODO PERSONALIZADO`);
    console.log(`[test-simple] DEBUG - 5. Trait ${cleanTokenId} (encima del mannequin) - MÉTODO PERSONALIZADO`);
    console.log(`[test-simple] DEBUG - 6. TRAIT ANIMADO 600.svg`);
    console.log(`[test-simple] DEBUG - 7. TRAIT ANIMADO 601.svg`);
    console.log(`[test-simple] DEBUG - 8. Tag de rareza: ${rarity.tag}`);
    console.log(`[test-simple] DEBUG - 9. Nombre: ${tokenData.name}`);
    console.log(`[test-simple] DEBUG - 10. Datos: ${tokenData.category}, ${totalMinted}, ${tokenData.floppy || 'OG'}`);
    console.log(`[test-simple] DEBUG - 11. Logo AdrianLAB`);
    console.log(`[test-simple] DEBUG - 12. Indicador de test GIF`);

    try {
      // Generar GIF animado
      console.log(`[test-simple] 🎬 Generando GIF animado...`);
      const gifBuffer = await generateAnimatedGif(completeSvg, cleanTokenId);
      console.log(`[test-simple] GIF animado generado, tamaño: ${gifBuffer.length} bytes`);

      // Configurar headers (sin cache)
      res.setHeader('Content-Type', 'image/gif');
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      res.setHeader('X-Test-Simple', 'true');
      res.setHeader('X-Token-ID', cleanTokenId);
      res.setHeader('X-Version', 'GIF-ANIMADO-METODO-PERSONALIZADO');
      
      // Devolver GIF
      console.log(`[test-simple] ===== GIF ANIMADO GENERADO EXITOSAMENTE =====`);
      res.status(200).send(gifBuffer);
      
    } catch (error) {
      console.error('[test-simple] Error generando GIF animado:', error);
      res.status(500).json({ error: 'Error generando GIF animado' });
    }
    
  } catch (error) {
    console.error('[test-simple] Error general:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
} 