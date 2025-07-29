import { Resvg } from '@resvg/resvg-js';
import fs from 'fs';
import path from 'path';
import { textToSVGElement, linesToSVG } from '../../../lib/text-to-svg.js';
import { getContracts } from '../../../lib/contracts.js';

// Importar gifencoder como alternativa
let GifEncoder;
try {
  GifEncoder = require('gifencoder');
} catch (error) {
  console.log('[test-simple] gifencoder no disponible, usando JSON fallback');
}

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
    
    // Detectar formato solicitado
    const format = req.query.format || 'gif'; // Por defecto GIF, pero acepta ?format=json
    const wantJson = format === 'json';
    
    console.log(`[test-simple] 🧪 Iniciando test simple para token ${cleanTokenId} - VERSION GIF ANIMADO - METODO PERSONALIZADO - FORMATO: ${format.toUpperCase()}`);

    // Cargar labmetadata
    const labmetadataPath = path.join(process.cwd(), 'public', 'labmetadata', 'traits.json');
    const labmetadata = JSON.parse(fs.readFileSync(labmetadataPath, 'utf8'));
    console.log(`[test-simple] Labmetadata cargado, ${labmetadata.length} traits encontrados`);

    // Buscar el trait
    const trait = labmetadata.find(t => t.tokenId === parseInt(cleanTokenId));
    if (!trait) {
      return res.status(404).json({ error: 'Trait no encontrado' });
    }

    console.log(`[test-simple] Trait encontrado:`, trait);
    console.log(`[test-simple] Datos del token:`, trait);

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
    console.log(`[test-simple] Rarity calculada: ${rarity}`);

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

    // Cargar frame mejorado
    let frameSvgContent;
    try {
      frameSvgContent = fs.readFileSync(path.join(process.cwd(), 'public', 'labimages', 'frameimproved.svg'), 'utf8')
        .replace(/<\?xml[^>]*\?>/, '')
        .replace(/<svg[^>]*>/, '')
        .replace(/<\/svg>/, '');
      console.log(`[test-simple] Frame mejorado cargado, tamaño: ${frameSvgContent.length} bytes`);
    } catch (error) {
      console.error(`[test-simple] Error cargando frame mejorado: ${error.message}`);
      frameSvgContent = '';
    }

    // Verificar traits animados
    const trait600Path = path.join(process.cwd(), 'public', 'labimages', '600.svg');
    const testAnimationPath = path.join(process.cwd(), 'public', 'labimages', 'test-animation.svg');
    
    console.log(`[test-simple] Verificando trait 600: ${trait600Path} - Existe: ${fs.existsSync(trait600Path)}`);
    console.log(`[test-simple] Verificando test-animation: ${testAnimationPath} - Existe: ${fs.existsSync(testAnimationPath)}`);
    
    let trait600Content = '';
    let testAnimationContent = '';
    
    if (fs.existsSync(trait600Path)) {
      trait600Content = fs.readFileSync(trait600Path, 'utf8');
      console.log(`[test-simple] Trait 600 cargado, tamaño: ${trait600Content.length} bytes`);
    }
    
    if (fs.existsSync(testAnimationPath)) {
      testAnimationContent = fs.readFileSync(testAnimationPath, 'utf8');
      console.log(`[test-simple] Test-animation cargado, tamaño: ${testAnimationContent.length} bytes`);
      console.log(`[test-simple] Test-animation contenido (primeras 200 chars): ${testAnimationContent.substring(0, 200)}`);
      console.log(`[test-simple] Test-animation contenido (últimas 200 chars): ${testAnimationContent.substring(testAnimationContent.length - 200)}`);
      console.log(`[test-simple] Test-animation contiene 'animate': ${testAnimationContent.includes('animate')}`);
      console.log(`[test-simple] Test-animation contiene 'circle': ${testAnimationContent.includes('circle')}`);
      console.log(`[test-simple] Test-animation contiene 'rect': ${testAnimationContent.includes('rect')}`);
    }

    // Generar textos usando text-to-svg
    const rarityTag = textToSVGElement(rarity.tag, 12, '#ffffff', 'Arial, sans-serif');
    const nameText = textToSVGElement(trait.name, 16, '#ffffff', 'Arial, sans-serif');
    const dataText = textToSVGElement(`${trait.category}, ${totalMinted}, ${trait.floppy}`, 12, '#ffffff', 'Arial, sans-serif');
    const logoText = textToSVGElement('AdrianLAB', 14, '#ffffff', 'Arial, sans-serif');

    // Generar SVG completo
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
        
        <!-- TRAIT ANIMADO 600.svg -->
        <image x="84" y="120" width="600" height="600" href="data:image/svg+xml;base64,${Buffer.from(trait600Content).toString('base64')}" />
        
        <!-- TRAIT ANIMADO DE PRUEBA (test-animation.svg) en capa superior -->
        <image x="200" y="200" width="300" height="300" href="data:image/svg+xml;base64,${Buffer.from(testAnimationContent).toString('base64')}" />
        
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
        
        <!-- Indicador de test GIF -->
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
    console.log(`[test-simple] DEBUG - 7. TRAIT ANIMADO DE PRUEBA (test-animation.svg)`);
    console.log(`[test-simple] DEBUG - 8. Tag de rareza: ${rarity.tag}`);
    console.log(`[test-simple] DEBUG - 9. Nombre: ${trait.name}`);
    console.log(`[test-simple] DEBUG - 10. Datos: ${trait.category}, ${totalMinted}, ${trait.floppy}`);
    console.log(`[test-simple] DEBUG - 11. Logo AdrianLAB`);
    console.log(`[test-simple] DEBUG - 12. Indicador de test GIF`);

    // Función para generar GIF animado simple
    const generateAnimatedGif = async (svgContent, tokenId, res) => {
      console.log(`[test-simple] 🎬 Generando GIF animado para token ${tokenId} - FORMATO: ${wantJson ? 'JSON' : 'GIF'}`);
      console.log(`[test-simple] 🎬 SVG original tamaño: ${svgContent.length} bytes`);
      
      try {
        const frames = [];
        const numFrames = 10;
        
        for (let i = 0; i < numFrames; i++) {
          console.log(`[test-simple] 🎬 Generando frame ${i + 1}/${numFrames}...`);
          
          let frameSvg = svgContent;
          
          const frameTime = (i / numFrames) * 2;
          const pulseOpacity = 0.8 + (0.2 * Math.sin(frameTime * Math.PI));
          const rotationAngle = (i * 36) % 360;
          const scaleFactor = 0.8 + (0.4 * Math.sin(frameTime * Math.PI));
          
          const originalImageTag = /<image x="200" y="200" width="300" height="300" href="data:image\/svg\+xml;base64,([^"]+)"/;
          const newImageTag = `<image x="200" y="200" width="300" height="300" href="data:image/svg+xml;base64,$1" transform="rotate(${rotationAngle} 350 350) scale(${scaleFactor})" opacity="${pulseOpacity.toFixed(2)}"`;
          
          if (frameSvg.match(originalImageTag)) {
            frameSvg = frameSvg.replace(originalImageTag, newImageTag);
            console.log(`[test-simple] 🎬 Frame ${i + 1} - Transformación aplicada: rotate(${rotationAngle}°) scale(${scaleFactor.toFixed(2)}) opacity(${pulseOpacity.toFixed(2)})`);
          } else {
            console.log(`[test-simple] ⚠️ Frame ${i + 1} - No se encontró el tag de imagen para transformar`);
          }
          
          frameSvg = frameSvg.replace(
            /<rect x="84" y="120" width="600" height="600" fill="#f0f0f0" opacity="0\.1"\/>/,
            `<rect x="84" y="120" width="600" height="600" fill="#f0f0f0" opacity="${pulseOpacity.toFixed(2)}"/>`
          );
          
          frameSvg = frameSvg.replace(
            /<text x="384" y="1005" font-family="Arial, sans-serif" font-size="24" text-anchor="middle" fill="#ffffff">TEST GIF ANIMADO - METODO PERSONALIZADO<\/text>/,
            `<text x="384" y="1005" font-family="Arial, sans-serif" font-size="24" text-anchor="middle" fill="#ffffff">TEST GIF ANIMADO - FRAME ${i + 1}</text>`
          );
          
          console.log(`[test-simple] 🎬 Frame ${i + 1} modificado - Rotación: ${rotationAngle}°, Escala: ${scaleFactor.toFixed(2)}, Opacidad: ${pulseOpacity.toFixed(2)}`);
          
          if (i === 0) {
            console.log(`[test-simple] 🎬 Frame 1 contenido modificado (primeras 500 chars): ${frameSvg.substring(0, 500)}`);
            console.log(`[test-simple] 🎬 Frame 1 contiene 'transform=': ${frameSvg.includes('transform=')}`);
            console.log(`[test-simple] 🎬 Frame 1 contiene 'rotate(': ${frameSvg.includes('rotate(')}`);
            console.log(`[test-simple] 🎬 Frame 1 contiene 'scale(': ${frameSvg.includes('scale(')}`);
          }
          
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
        
        if (wantJson) {
          // Devolver JSON para debug
          console.log(`[test-simple] 🎬 Generando respuesta JSON con ${frames.length} frames...`);
          
          const responseData = {
            type: 'animated_frames',
            tokenId: tokenId,
            frameCount: frames.length,
            frameDelay: 100, // ms
            fps: 10,
            dimensions: {
              width: 768,
              height: 1024
            },
            frames: frames.map((frame, index) => ({
              frameNumber: index + 1,
              size: frame.length,
              transformations: {
                rotation: (index * 36) % 360,
                scale: 0.8 + (0.4 * Math.sin((index / frames.length) * 2 * Math.PI)),
                opacity: 0.8 + (0.2 * Math.sin((index / frames.length) * 2 * Math.PI))
              }
            })),
            message: 'Frames generados exitosamente. JSON para debugging.',
            timestamp: new Date().toISOString()
          };
          
          console.log(`[test-simple] ✅ Respuesta JSON con ${frames.length} frames generada`);
          console.log(`[test-simple] 🎬 Tamaños de frames PNG: ${frames.map(f => f.length).join(', ')} bytes`);
          console.log(`[test-simple] 🎬 Transformaciones aplicadas correctamente`);
          
          res.setHeader('Content-Type', 'application/json');
          res.setHeader('X-Version', 'JSON-DEBUG-METODO-PERSONALIZADO');
          res.setHeader('X-Frame-Count', frames.length.toString());
          res.setHeader('X-Frame-Delay', '100ms');
          res.setHeader('X-Animation-FPS', '10');
          
          return res.status(200).json(responseData);
          
        } else {
          // Generar GIF real usando gifencoder
          if (!GifEncoder) {
            console.log(`[test-simple] 🚨 gifencoder no disponible, fallback a JSON`);
            res.setHeader('Content-Type', 'application/json');
            res.setHeader('X-Version', 'FALLBACK-JSON-METODO-PERSONALIZADO');
            return res.status(200).json({
              error: 'gifencoder no disponible',
              message: 'Usar ?format=json para ver frames',
              frames: frames.length
            });
          }
          
          console.log(`[test-simple] 🎬 Generando GIF real con gifencoder...`);
          
          const encoder = new GifEncoder(768, 1024);
          encoder.setRepeat(0); // 0 = loop forever
          encoder.setDelay(100); // 100ms delay
          encoder.setQuality(10); // Lower is better quality
          encoder.setTransparent('#00000000'); // Transparent background
          
          encoder.start();
          
          for (let i = 0; i < frames.length; i++) {
            console.log(`[test-simple] 🎬 Añadiendo frame ${i + 1} al GIF...`);
            encoder.addFrame(frames[i]);
          }
          
          encoder.finish();
          
          const gifBuffer = encoder.out.getData();
          console.log(`[test-simple] ✅ GIF real generado, tamaño: ${gifBuffer.length} bytes`);
          
          res.setHeader('Content-Type', 'image/gif');
          res.setHeader('X-Version', 'GIF-REAL-METODO-PERSONALIZADO');
          res.setHeader('X-Frame-Count', frames.length.toString());
          res.setHeader('X-Frame-Delay', '100ms');
          res.setHeader('X-Animation-FPS', '10');
          
          return res.status(200).send(gifBuffer);
        }
        
      } catch (encodeError) {
        console.error('[test-simple] Error generando respuesta:', encodeError);
        
        // Fallback: devolver el primer frame como PNG
        console.log('[test-simple] 🚨 Fallback: devolviendo primer frame como PNG');
        res.setHeader('Content-Type', 'image/png');
        res.setHeader('X-Version', 'FALLBACK-PNG-METODO-PERSONALIZADO');
        return res.status(200).send(frames[0]);
      }
    };

    // Generar GIF animado
    console.log(`[test-simple] 🎬 Generando GIF animado...`);
    const gifBuffer = await generateAnimatedGif(completeSvg, cleanTokenId, res);
    console.log(`[test-simple] GIF animado generado, tamaño: ${gifBuffer.length} bytes`);

    console.log(`[test-simple] ===== GIF ANIMADO GENERADO EXITOSAMENTE =====`);

  } catch (error) {
    console.error('[test-simple] Error:', error);
    res.status(500).json({ error: error.message });
  }
}