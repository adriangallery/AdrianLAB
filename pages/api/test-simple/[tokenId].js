import { Resvg } from '@resvg/resvg-js';
import path from 'path';
import fs from 'fs';
import { textToSVGElement, linesToSVG } from '../../../../lib/text-to-svg.js';
import { getContracts } from '../../../../lib/contracts.js';

export default async function handler(req, res) {
  try {
    const { tokenId } = req.query;
    const cleanTokenId = tokenId.replace('.png', '') || '559';
    
    console.log(`[test-simple] 🧪 Iniciando test simple para token ${cleanTokenId} - VERSION COMPLETA CON FRAME - METODO PERSONALIZADO`);

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

    // NUEVA FUNCIÓN: Cargar trait desde labimages y renderizar a PNG (mismo método que render personalizado)
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

    // Cargar el trait usando el nuevo método
    console.log(`[test-simple] Cargando trait ${cleanTokenId} usando método personalizado...`);
    const traitImageData = await loadTraitFromLabimages(cleanTokenId);
    
    if (!traitImageData) {
      console.error(`[test-simple] No se pudo cargar el trait ${cleanTokenId}`);
      res.status(500).json({ error: 'Error cargando trait' });
      return;
    }

    // Cargar mannequin también usando el mismo método
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

    const mannequinImageData = await loadMannequinFromLabimages();
    
    if (!mannequinImageData) {
      console.error(`[test-simple] No se pudo cargar el mannequin`);
      res.status(500).json({ error: 'Error cargando mannequin' });
      return;
    }

    // Crear SVG COMPLETO CON FRAME usando <image> en lugar de SVG raw
    const completeSvg = `
      <svg width="768" height="1024" xmlns="http://www.w3.org/2000/svg">
        <!-- Capa base en gris claro (bajo todos los elementos) -->
        <rect width="768" height="1024" fill="#f5f5f5"/>
        
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
            <path d="M762.95,0v2.9H2.89s0,35.21,0,35.21h760.07v729.89H0V0h762.96ZM28.87,40.99H2.89v25.98h25.98v-25.98ZM58.31,40.99h-26.56v25.98h285.8v-25.98h-23.67v8.66c0,.14-2.89.14-2.89,0v-8.66h-25.98v8.66c0,.14-2.89.14-2.89,0v-8.66h-25.98v8.66c0,.14-2.89.14-2.89,0v-8.66h-26.56v8.66c0,.14-2.89.14-2.89,0v-8.66h-25.98v17.32c0,.14-2.89.14-2.89,0v-17.32h-26.56v8.66c0,.14-2.89.14-2.89,0v-8.66h-25.98v8.66c0,.14-2.89.14-2.89,0v-8.66h-26.56v8.66c0,.14-2.89.14-2.89,0v-8.66h-25.98c.03,1.28-.26,8.66-.26,8.66h-2.63v-8.66ZM346.43,40.99h-25.98v25.98h285.23v-25.98h-23.1v8.66c0,.14-2.89.14-2.89,0v-8.66h-26.56v8.66c0,.14-2.89.14-2.89,0v-8.66h-25.98v8.66c0,.14-2.89.14-2.89,0v-8.66h-25.98v8.66c0,.14-2.89.14-2.89,0v-8.66h-26.56v17.32c0,.14-2.89.14-2.89,0v-17.32h-25.98v8.66c0,.14-2.89.14-2.89,0v-8.66h-26.56v8.66c0,.14-2.89.14-2.89,0v-8.66h-25.98v8.66c0,.14-2.89.14-2.89,0v-8.66h-26.56v8.66c0,.14-2.89.14-2.89,0v-8.66ZM635.12,40.99h-26.56v25.98h151.85v-25.98h-5.77v17.32c0,.17-3.46.17-3.46,0v-17.32h-25.98v8.66c0,.14-2.89.14-2.89,0v-8.66h-26.56v8.66h-2.89v-8.66h-25.98v8.66c0,.14-2.89.14-2.89,0v-8.66h-25.98v8.66c0,.14-2.89.14-2.89,0v-8.66ZM28.87,69.86H2.89v26.56h8.66c.14,0,.14,2.89,0,2.89H2.89v25.98h8.66c.14,0,.14,2.89,0,2.89H2.89v26.56h8.66c.14,0,.14,2.89,0,2.89H2.89v25.98h8.66c.14,0,.14,2.89,0,2.89H2.89v25.69c0,.06-.06.87,0,.87h17.32c.14,0,.14,2.89,0,2.89H2.89v25.98h8.66c.14,0,.14,2.89,0,2.89H2.89v25.98h8.66c.14,0,.14,2.89,0,2.89H2.89v26.56h8.66c.14,0,.14,2.89,0,2.89H2.89v25.98h8.66c.14,0,.14,2.89,0,2.89H2.89v26.56h8.66c.14,0,.14,2.89,0,2.89H2.89v25.98h8.66c.14,0,.14,2.89,0,2.89H2.89v26.56h25.98V69.86ZM760.41,765.69V70.73c0-.06.06-.87,0-.87H31.75c-.06,0,0,.8,0,.87v694.96h728.65ZM28.87,361.44H2.89v23.1h8.66c.14,0,.14,2.89,0,2.89H2.89v25.98h8.66c.14,0,.1,2.79,0,2.89-.41.41-8.66-.81-8.66.86v25.69h8.66c.14,0,.14,2.89,0,2.89H2.89v25.98h8.66c.58,1.17,0,3.13,0,3.13H2.89v26.32h17.32c.14,0,.14,2.89,0,2.89H2.89v25.98h8.66c.14,0,.14,2.89,0,2.89H2.89v26.56h8.66c.14,0,.14,2.89,0,2.89H2.89v25.98h8.66c.14,0,.14,2.89,0,2.89H2.89v26.56h8.66c.14,0,.14,2.89,0,2.89H2.89v25.98h25.98v-285.23ZM28.87,649.55H2.89v23.1h8.66c.14,0,.14,2.89,0,2.89H2.89v26.56h8.66c.14,0,.14,2.89,0,2.89H2.89v25.98h8.66c.14,0,.14,2.89,0,2.89H2.89v31.86h25.98v-116.16Z"/>
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
        
        <!-- Mannequin (base del personaje) usando <image> -->
        <image x="84" y="120" width="600" height="600" href="${mannequinImageData}" />
        
        <!-- Imagen del trait (centrada en el contenedor) usando <image> -->
        <image x="84" y="120" width="600" height="600" href="${traitImageData}" />
        
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
          fontSize: 70,
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
        <text x="384" y="1005" font-family="Arial, sans-serif" font-size="24" text-anchor="middle" fill="#ffffff">TEST CON FRAME - METODO PERSONALIZADO</text>
      </svg>
    `;

    console.log(`[test-simple] SVG completo con frame generado, tamaño: ${completeSvg.length} bytes`);
    console.log(`[test-simple] DEBUG - Orden de capas:`);
    console.log(`[test-simple] DEBUG - 1. Fondo gris claro`);
    console.log(`[test-simple] DEBUG - 2. Frame SVG completo`);
    console.log(`[test-simple] DEBUG - 3. Contenedor con fondo dinámico (${rarity.bg}20)`);
    console.log(`[test-simple] DEBUG - 4. Mannequin (base del personaje) - MÉTODO PERSONALIZADO`);
    console.log(`[test-simple] DEBUG - 5. Trait ${cleanTokenId} (encima del mannequin) - MÉTODO PERSONALIZADO`);
    console.log(`[test-simple] DEBUG - 6. Tag de rareza: ${rarity.tag}`);
    console.log(`[test-simple] DEBUG - 7. Nombre: ${tokenData.name}`);
    console.log(`[test-simple] DEBUG - 8. Datos: ${tokenData.category}, ${totalMinted}, ${tokenData.floppy || 'OG'}`);
    console.log(`[test-simple] DEBUG - 9. Logo AdrianLAB`);
    console.log(`[test-simple] DEBUG - 10. Indicador de test`);

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
      res.setHeader('X-Version', 'COMPLETA-CON-FRAME-METODO-PERSONALIZADO');
      
      // Devolver imagen
      console.log(`[test-simple] ===== RENDERIZADO CON FRAME FINALIZADO =====`);
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