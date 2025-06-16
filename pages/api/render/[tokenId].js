// API endpoint for rendering tokens by tokenId
import path from 'path';
import fs from 'fs';
import { createCanvas, loadImage, Image } from 'canvas';
import { getRawTokenMetadata } from '../../../lib/blockchain.js';
import { Resvg } from '@resvg/resvg-js';
import { getContracts } from '../../../lib/contracts.js';
import { getTokenTraits } from '../../../lib/blockchain.js';
import { renderSvgBuffer } from '@resvg/resvg-js';

export default async function handler(req, res) {
  try {
    const { tokenId } = req.query;
    console.log(`[render] Iniciando renderizado para token ${tokenId}`);

    // Verify that tokenId is valid
    if (!tokenId || isNaN(parseInt(tokenId))) {
      console.error(`[render] Token ID inválido: ${tokenId}`);
      return res.status(400).json({ error: 'Invalid token ID' });
    }

    // Test de conexión a contratos
    console.log('[render] Intentando conectar con los contratos...');
    const { core, traitsExtension } = await getContracts();
    console.log('[render] Contratos conectados:', {
      core: {
        address: core.address,
        functions: Object.keys(core.functions)
      },
      traitsExtension: {
        address: traitsExtension.address,
        functions: Object.keys(traitsExtension.functions)
      }
    });

    // Obtener datos del token
    console.log('[render] Llamando a getTokenData...');
    const tokenData = await core.getTokenData(tokenId);
    console.log('[render] Respuesta de getTokenData:', {
      result: tokenData.map(v => v.toString())
    });

    // Obtener skin del token
    console.log('[render] Llamando a getTokenSkin...');
    const skinId = await core.getTokenSkin(tokenId);
    console.log('[render] Respuesta de getTokenSkin:', {
      skinId: skinId.toString()
    });

    // Extraer solo el número del skin ID (en caso de que venga como "0,Zero")
    const skinIdStr = skinId.toString();
    console.log('[render] Skin ID procesado:', skinIdStr);

    // Obtener traits equipados
    console.log('[render] Llamando a getAllEquippedTraits...');
    const [categories, traitIds] = await traitsExtension.getAllEquippedTraits(tokenId);
    console.log('[render] Respuesta de getAllEquippedTraits:', {
      categories,
      traitIds: traitIds.map(id => id.toString())
    });

    // Crear canvas
    const canvas = createCanvas(1000, 1000);
    const ctx = canvas.getContext('2d');

    // Función para cargar y renderizar SVG
    const loadAndRenderSvg = async (path) => {
      try {
        // Construir la URL correcta para las imágenes
        const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://adrianlab.vercel.app';
        const imageUrl = `${baseUrl}/traits/${path}`;
        console.log(`[render] Intentando cargar imagen desde: ${imageUrl}`);

        const svgBuffer = await fetch(imageUrl)
          .then(res => {
            if (!res.ok) {
              throw new Error(`HTTP error! status: ${res.status}`);
            }
            return res.arrayBuffer();
          });
        
        // Usar Resvg directamente en lugar de renderSvgBuffer
        const resvg = new Resvg(Buffer.from(svgBuffer), {
          fitTo: {
            mode: 'width',
            value: 1000
          }
        });
        const pngBuffer = resvg.render().asPng();
        return loadImage(pngBuffer);
      } catch (error) {
        console.error(`[render] Error cargando SVG ${path}:`, error);
        return null;
      }
    };

    // Determinar la imagen base según generación y skin
    const generation = tokenData[0].toString();
    let baseImagePath;

    console.log('[render] Datos para selección de skin:', {
      generation,
      skinIdStr,
      isMutated: tokenData[2],
      mutationLevel: tokenData[1].toString(),
      mutationType: tokenData[3].toString(),
      mutationStage: tokenData[4].toString()
    });

    if (skinIdStr === "0,Zero") {
      // Para skin 0,Zero usar GEN0-Medium
      baseImagePath = `ADRIAN/GEN${generation}-Medium.svg`;
      console.log('[render] Usando skin 0,Zero -> Medium');
    } else if (skinIdStr === "0") {
      // Sin skin, usar base según generación
      baseImagePath = `SKIN/${generation}.svg`;
      console.log('[render] Usando skin base según generación');
    } else {
      // Con skin, usar combinación de generación y skin
      const skinType = skinIdStr === "1" ? "Dark" : 
                      skinIdStr === "2" ? "Alien" : 
                      skinIdStr === "3" ? "Light" :
                      skinIdStr === "4" ? "Albino" :
                      skinIdStr === "5" ? "Medium" : "Medium";
      baseImagePath = `ADRIAN/GEN${generation}-${skinType}.svg`;
      console.log('[render] Usando skin personalizado:', { skinIdStr, skinType });
    }

    console.log('[render] Cargando imagen base:', baseImagePath);
    const baseImage = await loadAndRenderSvg(baseImagePath);
    if (baseImage) {
      ctx.drawImage(baseImage, 0, 0, 1000, 1000);
    }

    // Renderizar traits en orden
    if (categories && categories.length > 0) {
      for (let i = 0; i < categories.length; i++) {
        const category = categories[i];
        const traitId = traitIds[i].toString();
        const traitPath = `${category}/${traitId}.svg`;
        
        console.log(`[render] Cargando trait: ${traitPath}`);
        const traitImage = await loadAndRenderSvg(traitPath);
        if (traitImage) {
          ctx.drawImage(traitImage, 0, 0, 1000, 1000);
        }
      }
    }

    // Configurar headers para evitar cache
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.setHeader('Surrogate-Control', 'no-store');
    
    // Enviar imagen
    const buffer = canvas.toBuffer('image/png');
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Content-Length', buffer.length);
    res.send(buffer);

  } catch (error) {
    console.error('[render] Error:', error);
    console.error('[render] Stack trace:', error.stack);
    
    // En caso de error, devolver una imagen de error
    const canvas = createCanvas(1000, 1000);
    const ctx = canvas.getContext('2d');
    
    // Fondo rojo
    ctx.fillStyle = '#ff0000';
    ctx.fillRect(0, 0, 1000, 1000);
    
    // Texto de error
    ctx.fillStyle = '#ffffff';
    ctx.font = '48px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('Error Rendering Token', 500, 450);
    ctx.font = '24px Arial';
    ctx.fillText(error.message, 500, 500);
    
    const buffer = canvas.toBuffer('image/png');
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Content-Length', buffer.length);
    res.send(buffer);
  }
}

function renderFallbackSVG(res, tokenId) {
  // Default or fallback, return SVG
  const svg = `
  <svg width="500" height="500" xmlns="http://www.w3.org/2000/svg">
    <rect width="100%" height="100%" fill="#f0f0f0"/>
    <text x="50%" y="50%" font-family="Arial" font-size="24" fill="black" text-anchor="middle">
      BareAdrian #${tokenId}
    </text>
    <text x="50%" y="60%" font-family="Arial" font-size="16" fill="black" text-anchor="middle">
      API in development
    </text>
  </svg>
  `;
  
  res.setHeader('Content-Type', 'image/svg+xml');
  return res.status(200).send(svg);
}