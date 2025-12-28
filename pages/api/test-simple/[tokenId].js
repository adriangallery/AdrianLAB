import { Resvg } from '@resvg/resvg-js';
import fs from 'fs';
import path from 'path';
import { textToSVGElement, linesToSVG } from '../../../lib/text-to-svg.js';
import { getContracts } from '../../../lib/contracts.js';
import { GifFrame, BitmapImage, GifCodec } from 'gifwrap';
import { PNG } from 'pngjs';

export default async function handler(req, res) {
  // Configuración CORS
  const allowedOrigins = [
    'https://opensea.io',
    'https://magiceden.io',
    'https://element.market',
    'https://tensor.trade',
    'https://okx.com',
    'https://binance.com',
    'https://coinbase.com',
    'https://adrianzero.com',
    'https://adrianpunks.com',
    'https://adriangallery.com'
  ];

  const origin = req.headers.origin;
  if (origin && allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const { tokenId } = req.query;
    const cleanTokenId = tokenId.replace(/\.(png|jpg|jpeg|gif|svg)$/, '');
    
    console.log(`[test-simple] 🧪 Iniciando test simple para token ${cleanTokenId} - VERSION SIMPLIFICADA CON 662.GIF`);

    // Cargar labmetadata
    const labmetadataPath = path.join(process.cwd(), 'public', 'labmetadata', 'traits.json');
    const labmetadataData = JSON.parse(fs.readFileSync(labmetadataPath, 'utf8'));
    const labmetadata = labmetadataData.traits;
    console.log(`[test-simple] Labmetadata cargado, ${labmetadata.length} traits encontrados`);

    // Buscar el trait
    const trait = labmetadata.find(t => t.tokenId === parseInt(cleanTokenId));
    if (!trait) {
      return res.status(404).json({ error: 'Trait no encontrado' });
    }

    console.log(`[test-simple] Trait encontrado:`, trait);

    // Conectar con contratos
    console.log(`[test-simple] Conectando con los contratos...`);
    const contracts = await getContracts();
    
    // Obtener totalMinted
    console.log(`[test-simple] Obteniendo totalMintedPerAsset para trait ${cleanTokenId}...`);
    let totalMinted = 0;
    try {
      const totalMintedPerAsset = await contracts.traitsCore.totalMintedPerAsset(cleanTokenId);
      totalMinted = parseInt(totalMintedPerAsset.toString());
      console.log(`[test-simple] TotalMintedPerAsset obtenido: ${totalMinted}`);
    } catch (error) {
      console.log(`[test-simple] Error obteniendo totalMintedPerAsset: ${error.message}`);
    }
    
    console.log(`[test-simple] Total minted obtenido del contrato: ${totalMinted}`);

    // Calcular rareza
    const rarity = totalMinted === 0 ? { tag: 'COMMON', bg: '#a9a9a9' } :
                   totalMinted <= 10 ? { tag: 'RARE', bg: '#4169e1' } :
                   totalMinted <= 50 ? { tag: 'EPIC', bg: '#9932cc' } :
                   { tag: 'LEGENDARY', bg: '#ffd700' };
    console.log(`[test-simple] Rarity calculada:`, rarity);

    // Función para cargar SVG desde labimages usando fetch HTTP (método personalizado)
    const loadTraitFromLabimages = async (tokenId) => {
      console.log(`[test-simple] Cargando trait ${tokenId} usando método personalizado...`);
      const url = `https://adrianlab.vercel.app/labimages/${tokenId}.svg`;
      console.log(`[test-simple] Cargando trait desde labimages: ${url}`);
      
      try {
        const response = await fetch(url);
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const svgContent = await response.text();
        console.log(`[test-simple] SVG cargado, tamaño: ${svgContent.length} bytes`);
        
        // Renderizar SVG a PNG usando Resvg
        const resvg = new Resvg(Buffer.from(svgContent), {
          fitTo: {
            mode: 'width',
            value: 600
          }
        });
        const pngBuffer = resvg.render().asPng();
        const base64Data = `data:image/png;base64,${pngBuffer.toString('base64')}`;
        console.log(`[test-simple] Trait renderizado a PNG, tamaño: ${pngBuffer.length} bytes`);
        
        return base64Data;
      } catch (error) {
        console.error(`[test-simple] Error cargando trait ${tokenId}: ${error.message}`);
        throw error;
      }
    };

    const loadMannequinFromLabimages = async () => {
      console.log(`[test-simple] Cargando mannequin usando método personalizado...`);
      const url = `https://adrianlab.vercel.app/labimages/mannequin.svg`;
      console.log(`[test-simple] Cargando mannequin desde labimages: ${url}`);
      
      try {
        const response = await fetch(url);
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const svgContent = await response.text();
        console.log(`[test-simple] Mannequin SVG cargado, tamaño: ${svgContent.length} bytes`);
        
        // Renderizar SVG a PNG usando Resvg
        const resvg = new Resvg(Buffer.from(svgContent), {
          fitTo: {
            mode: 'width',
            value: 600
          }
        });
        const pngBuffer = resvg.render().asPng();
        const base64Data = `data:image/png;base64,${pngBuffer.toString('base64')}`;
        console.log(`[test-simple] Mannequin renderizado a PNG, tamaño: ${pngBuffer.length} bytes`);
        
        return base64Data;
      } catch (error) {
        console.error(`[test-simple] Error cargando mannequin: ${error.message}`);
        throw error;
      }
    };

    // Cargar trait y mannequin usando método personalizado
    const [traitImageData, mannequinImageData] = await Promise.all([
      loadTraitFromLabimages(cleanTokenId),
      loadMannequinFromLabimages()
    ]);
    console.log(`[test-simple] ✅ Trait y mannequin cargados exitosamente usando método personalizado`);

    // Cargar frame mejorado vía HTTP
    let frameSvgContent;
    try {
      const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://adrianlab.vercel.app';
      const frameUrl = `${baseUrl}/labimages/frameimproved.svg`;
      const resp = await fetch(frameUrl);
      frameSvgContent = resp.ok ? (await resp.text()) : '';
      frameSvgContent = frameSvgContent
        .replace(/<\?xml[^>]*\?>/, '')
        .replace(/<svg[^>]*>/, '')
        .replace(/<\/svg>/, '');
      console.log(`[test-simple] Frame mejorado cargado, tamaño: ${frameSvgContent.length} bytes`);
    } catch (error) {
      console.error(`[test-simple] Error cargando frame mejorado: ${error.message}`);
      frameSvgContent = '';
    }

    // Cargar 662.gif vía HTTP
    let gif662Base64 = '';
    try {
      const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://adrianlab.vercel.app';
      const gifUrl = `${baseUrl}/labimages/662.gif`;
      const r = await fetch(gifUrl);
      if (r.ok) {
        const buf = Buffer.from(await r.arrayBuffer());
        gif662Base64 = `data:image/gif;base64,${buf.toString('base64')}`;
        console.log(`[test-simple] 662.gif cargado, tamaño: ${buf.length} bytes`);
      }
    } catch (err) {
      console.log(`[test-simple] ⚠️ 662.gif no disponible: ${err.message}`);
    }

    // Generar textos usando text-to-svg
    const rarityTag = textToSVGElement(rarity.tag, 12, '#ffffff', 'Arial, sans-serif');
    const nameText = textToSVGElement(trait.name, 16, '#ffffff', 'Arial, sans-serif');
    const dataText = textToSVGElement(`${trait.category}, ${totalMinted}, ${trait.floppy}`, 12, '#ffffff', 'Arial, sans-serif');
    const logoText = textToSVGElement('AdrianLAB', 14, '#ffffff', 'Arial, sans-serif');

    // Generar SVG completo simplificado
    const completeSvg = `
      <svg width="768" height="1024" xmlns="http://www.w3.org/2000/svg">
        <!-- Fondo gris claro -->
        <rect x="0" y="0" width="768" height="1024" fill="#f8f9fa"/>
        
        <!-- Frame SVG completo -->
        <g transform="translate(0, 0)">
          ${frameSvgContent}
        </g>
        
        <!-- Contenedor con fondo dinámico -->
        <rect x="84" y="120" width="600" height="600" fill="${rarity.bg}20" opacity="0.1"/>
        
        <!-- Mannequin (base del personaje) usando <image> -->
        <image x="84" y="120" width="600" height="600" href="${mannequinImageData}" />
        
        <!-- Imagen del trait (centrada en el contenedor) usando <image> -->
        <image x="84" y="120" width="600" height="600" href="${traitImageData}" />
        
        <!-- 662.GIF en capa superior -->
        <image x="200" y="200" width="300" height="300" href="${gif662Base64}" />
        
        <!-- Tag de rareza -->
        <g transform="translate(384, 750)">
          ${rarityTag}
        </g>
        
        <!-- Nombre del trait -->
        <g transform="translate(384, 780)">
          ${nameText}
        </g>
        
        <!-- Datos del trait -->
        <g transform="translate(384, 800)">
          ${dataText}
        </g>
        
        <!-- Logo AdrianLAB -->
        <g transform="translate(384, 950)">
          ${logoText}
        </g>
        
        <!-- Indicador de test -->
        <text x="384" y="1005" font-family="Arial, sans-serif" font-size="24" text-anchor="middle" fill="#ffffff">TEST SIMPLIFICADO CON 662.GIF</text>
      </svg>
    `;

    console.log(`[test-simple] SVG completo simplificado generado, tamaño: ${completeSvg.length} bytes`);
    
    console.log(`[test-simple] DEBUG - Orden de capas:`);
    console.log(`[test-simple] DEBUG - 1. Fondo gris claro`);
    console.log(`[test-simple] DEBUG - 2. Frame SVG completo`);
    console.log(`[test-simple] DEBUG - 3. Contenedor con fondo dinámico (${rarity.bg}20)`);
    console.log(`[test-simple] DEBUG - 4. Mannequin (base del personaje) - MÉTODO PERSONALIZADO`);
    console.log(`[test-simple] DEBUG - 5. Trait ${cleanTokenId} (encima del mannequin) - MÉTODO PERSONALIZADO`);
    console.log(`[test-simple] DEBUG - 6. 662.GIF en capa superior`);
    console.log(`[test-simple] DEBUG - 7. Tag de rareza: ${rarity.tag}`);
    console.log(`[test-simple] DEBUG - 8. Nombre: ${trait.name}`);
    console.log(`[test-simple] DEBUG - 9. Datos: ${trait.category}, ${totalMinted}, ${trait.floppy}`);
    console.log(`[test-simple] DEBUG - 10. Logo AdrianLAB`);
    console.log(`[test-simple] DEBUG - 11. Indicador de test`);

    // Generar múltiples frames para crear GIF animado
    console.log(`[test-simple] 🎬 Generando frames para GIF animado...`);
    
    const frames = [];
    const numFrames = 10;
    
    for (let i = 0; i < numFrames; i++) {
      console.log(`[test-simple] 🎬 Generando frame ${i + 1}/${numFrames}...`);
      
      let frameSvg = completeSvg;
      
      const frameTime = (i / numFrames) * 2;
      const pulseOpacity = 0.8 + (0.2 * Math.sin(frameTime * Math.PI));
      const rotationAngle = (i * 36) % 360;
      const scaleFactor = 0.8 + (0.4 * Math.sin(frameTime * Math.PI));
      
      // Aplicar transformaciones al 662.gif
      const originalImageTag = /<image x="200" y="200" width="300" height="300" href="data:image\/gif;base64,([^"]+)"/;
      const newImageTag = `<image x="200" y="200" width="300" height="300" href="data:image/gif;base64,$1" transform="rotate(${rotationAngle} 350 350) scale(${scaleFactor})" opacity="${pulseOpacity.toFixed(2)}"`;
      
      if (frameSvg.match(originalImageTag)) {
        frameSvg = frameSvg.replace(originalImageTag, newImageTag);
        console.log(`[test-simple] 🎬 Frame ${i + 1} - Transformación aplicada: rotate(${rotationAngle}°) scale(${scaleFactor.toFixed(2)}) opacity(${pulseOpacity.toFixed(2)})`);
      }
      
      // Aplicar efecto de pulso al contenedor
      frameSvg = frameSvg.replace(
        /<rect x="84" y="120" width="600" height="600" fill="#f0f0f0" opacity="0\.1"\/>/,
        `<rect x="84" y="120" width="600" height="600" fill="#f0f0f0" opacity="${pulseOpacity.toFixed(2)}"/>`
      );
      
      // Cambiar texto del frame
      frameSvg = frameSvg.replace(
        /<text x="384" y="1005" font-family="Arial, sans-serif" font-size="24" text-anchor="middle" fill="#ffffff">TEST SIMPLIFICADO CON 662\.GIF<\/text>/,
        `<text x="384" y="1005" font-family="Arial, sans-serif" font-size="24" text-anchor="middle" fill="#ffffff">TEST SIMPLIFICADO - FRAME ${i + 1}</text>`
      );
      
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
    
    // Crear GIF usando gifwrap
    console.log(`[test-simple] 🎬 Creando GIF con ${frames.length} frames usando gifwrap...`);
    
    try {
      const gifFrames = [];
      const delay = 100; // 100ms delay entre frames
      const delayCentisecs = Math.round(delay / 10); // Convertir ms a centisegundos
      
      console.log(`[test-simple] Convirtiendo ${frames.length} frames PNG a GifFrame...`);
      
      for (let i = 0; i < frames.length; i++) {
        const pngBuffer = frames[i];
        
        console.log(`[test-simple] Procesando frame ${i + 1}/${frames.length}...`);
        
        try {
          // Parsear PNG usando pngjs
          const pngImage = PNG.sync.read(pngBuffer);
          
          console.log(`[test-simple] PNG parseado: ${pngImage.width}x${pngImage.height}, data: ${pngImage.data.length} bytes`);
          
          // Crear BitmapImage con el objeto bitmap (constructor acepta { width, height, data })
          const bitmapImage = new BitmapImage({
            width: pngImage.width,
            height: pngImage.height,
            data: pngImage.data
          });
          
          console.log(`[test-simple] BitmapImage creado: ${bitmapImage.bitmap.width}x${bitmapImage.bitmap.height}`);
          
          // Crear GifFrame con BitmapImage y delay
          const gifFrame = new GifFrame(bitmapImage, { delayCentisecs });
          gifFrames.push(gifFrame);
          
          console.log(`[test-simple] Frame ${i + 1} convertido exitosamente (${gifFrame.bitmap.width}x${gifFrame.bitmap.height})`);
        } catch (frameError) {
          console.error(`[test-simple] Error procesando frame ${i + 1}:`, frameError.message);
          throw new Error(`Error procesando frame ${i + 1}: ${frameError.message}`);
        }
      }
      
      // Crear GIF con todos los frames usando GifCodec
      console.log(`[test-simple] Ensamblando GIF con ${gifFrames.length} frames...`);
      console.log(`[test-simple] Dimensiones del primer frame: ${gifFrames[0].bitmap.width}x${gifFrames[0].bitmap.height}`);
      
      const codec = new GifCodec();
      const outputGif = await codec.encodeGif(gifFrames, {
        loops: 0 // Loop infinito
      });
      
      const gifBuffer = outputGif.buffer;
      console.log(`[test-simple] ✅ GIF generado exitosamente, tamaño: ${gifBuffer.length} bytes`);
      
      res.setHeader('Content-Type', 'image/gif');
      res.setHeader('X-Version', 'GIF-SIMPLIFICADO-662-GIFWRAP');
      res.setHeader('X-Frame-Count', frames.length.toString());
      res.setHeader('X-Frame-Delay', '100ms');
      res.setHeader('X-Animation-FPS', '10');
      
      return res.status(200).send(gifBuffer);
      
    } catch (gifError) {
      console.error('[test-simple] Error generando GIF:', gifError);
      console.error('[test-simple] Stack:', gifError.stack);
      
      // Fallback: devolver el primer frame como PNG
      console.log('[test-simple] 🚨 Fallback: devolviendo primer frame como PNG');
      res.setHeader('Content-Type', 'image/png');
      res.setHeader('X-Version', 'FALLBACK-PNG-SIMPLIFICADO');
      res.setHeader('X-Frame-Count', '1');
      res.setHeader('X-Animation-FPS', '1');
      
      return res.status(200).send(frames[0]);
    }

  } catch (error) {
    console.error('[test-simple] Error:', error);
    res.status(500).json({ error: error.message });
  }
}