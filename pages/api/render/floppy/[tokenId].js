import { FloppyRenderer } from '../../../../lib/renderers/floppy-renderer.js';
import { 
  getCachedFloppyRender, 
  setCachedFloppyRender, 
  getFloppyRenderTTL 
} from '../../../../lib/cache.js';
import { Resvg } from '@resvg/resvg-js';
import fs from 'fs';
import path from 'path';

export default async function handler(req, res) {
  // 🔄 REBUILD FORZADO: ${new Date().toISOString()} - Forzando rebuild completo de Next.js
  console.log(`[floppy-render] 🔄 REBUILD FORZADO: ${new Date().toISOString()} - Forzando rebuild completo de Next.js`);
  
  // Configurar CORS - Permitir múltiples orígenes
  const allowedOrigins = [
    'https://adrianzero.com',
    'https://adrianpunks.com',
    'https://adriangallery.com',
    'https://opensea.io',
    'https://testnets.opensea.io',
    'https://rarible.com',
    'https://looksrare.org',
    'https://x2y2.io',
    'https://blur.io',
    'https://magiceden.io',
    'https://sudoswap.xyz',
    'https://reservoir.tools',
    'https://nftx.io',
    'https://element.market',
    'https://tensor.trade',
    'https://okx.com',
    'https://binance.com',
    'https://coinbase.com'
  ];
  
  const origin = req.headers.origin;
  if (origin && allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  } else {
    // Para requests sin origin (como imágenes directas) o orígenes no listados
    res.setHeader('Access-Control-Allow-Origin', '*');
  }
  
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  try {
    let { tokenId } = req.query;
    const isSimple = req.query.simple === 'true';
    
    if (tokenId && tokenId.endsWith('.png')) {
      tokenId = tokenId.replace('.png', '');
    }
    
    if (tokenId && tokenId.endsWith('.gif')) {
      tokenId = tokenId.replace('.gif', '');
    }
    
    if (!tokenId || isNaN(parseInt(tokenId))) {
      return res.status(400).json({ error: 'Invalid token ID' });
    }

    const tokenIdNum = parseInt(tokenId);

    // ===== LÓGICA ESPECIAL SIMPLE RENDER =====
    if (isSimple) {
      console.log(`[floppy-render] 🔍 SIMPLE RENDER: Token ${tokenIdNum} - Generando versión simplificada`);
      
      const floppyRenderer = new FloppyRenderer();
      const simpleSvg = await floppyRenderer.generateSimpleSVG(tokenIdNum);
      
      // Convertir SVG a PNG
      const resvg = new Resvg(simpleSvg, {
        fitTo: {
          mode: 'width',
          value: 600
        }
      });
      
      const pngBuffer = resvg.render().asPng();
      
      // Configurar headers
      res.setHeader('Content-Type', 'image/png');
      res.setHeader('X-Version', 'FLOPPY-SIMPLE');
      res.setHeader('X-Render-Type', 'simple');
      res.setHeader('Cache-Control', 'public, max-age=3600'); // 1 hora de cache
      
      console.log(`[floppy-render] 🔍 Simple render completado para token ${tokenIdNum}`);
      return res.status(200).send(pngBuffer);
    }

    // ===== SISTEMA DE CACHÉ PARA FLOPPY RENDER =====
    const cachedImage = getCachedFloppyRender(tokenIdNum);
    
    if (cachedImage) {
      console.log(`[floppy-render] 🎯 CACHE HIT para token ${tokenIdNum}`);
      
      // Determinar si es un serum (GIF), floppy específico (GIF/PNG) o trait (PNG)
      const isSerum = tokenIdNum >= 262144 && tokenIdNum <= 262147;
      const isSpecificFloppy = tokenIdNum >= 10000 && tokenIdNum <= 10100;
      const isPngFloppy = tokenIdNum === 10006;
      const isGif = isSerum || (isSpecificFloppy && !isPngFloppy);
      
      // Configurar headers de caché
      const ttlSeconds = Math.floor(getFloppyRenderTTL(tokenIdNum) / 1000);
      res.setHeader('X-Cache', 'HIT');
      res.setHeader('Cache-Control', `public, max-age=${ttlSeconds}`);
      res.setHeader('Content-Type', isGif ? 'image/gif' : 'image/png');
      res.setHeader('X-Version', isSpecificFloppy ? (isPngFloppy ? 'FLOPPY-PNG-CACHED' : 'FLOPPY-GIF-CACHED') : 'FLOPPY-METODO-PERSONALIZADO');
      
      return res.status(200).send(cachedImage);
    }

    console.log(`[floppy-render] 💾 CACHE MISS para token ${tokenIdNum} - Generando imagen...`);
    console.log(`[floppy-render] ===== RENDERIZADO TRAITS (1-9999) =====`);
    console.log(`[floppy-render] Token ID: ${tokenId}`);

    // Procesar tokens 1-9999 (traits), 262144-262147 (serums), 30000-35000 (T-shirts personalizados) y 10000-10100 (floppys)
    if (
      (tokenIdNum >= 1 && tokenIdNum <= 9999) ||
      (tokenIdNum >= 262144 && tokenIdNum <= 262147) ||
      (tokenIdNum >= 30000 && tokenIdNum <= 35000) ||
      (tokenIdNum >= 10000 && tokenIdNum <= 10100) ||
      ((tokenIdNum >= 100001 && tokenIdNum <= 101003) || (tokenIdNum >= 101001 && tokenIdNum <= 101003))
    ) {
      
      // LÓGICA ESPECIAL: Si es un floppy específico (10000+), buscar archivo con fallback inteligente
      // ESTRATEGIA: Buscar .gif primero, si no existe, buscar .png como fallback
      // 🔄 REBUILD FORZADO: Lógica actualizada para forzar rebuild completo
      if (tokenIdNum >= 10000 && tokenIdNum <= 10100) {
        console.log(`[floppy-render] 🔄 REBUILD FORZADO: Lógica actualizada para forzar rebuild completo`);
        console.log(`[floppy-render] 🎯 LÓGICA ESPECIAL: Floppy específico ${tokenIdNum} detectado, buscando con fallback inteligente`);
        
        try {
          let fileBuffer;
          let fileExtension;
          let contentType;
          const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://adrianlab.vercel.app';
          
          // PASO 1: Intentar buscar .gif primero (estrategia principal)
          try {
            const gifUrl = `${baseUrl}/labimages/${tokenIdNum}.gif`;
            console.log(`[floppy-render] 🔍 PASO 1: Buscando GIF: ${gifUrl}`);
            
            const gifResp = await fetch(gifUrl);
            if (gifResp.ok) {
              const gifArrayBuf = await gifResp.arrayBuffer();
              fileBuffer = Buffer.from(gifArrayBuf);
              fileExtension = 'gif';
              contentType = 'image/gif';
              
              console.log(`[floppy-render] ✅ GIF encontrado, tamaño: ${fileBuffer.length} bytes`);
            } else {
              throw new Error(`GIF no encontrado (${gifResp.status} ${gifResp.statusText})`);
            }
          } catch (gifError) {
            console.log(`[floppy-render] ⚠️ GIF no encontrado, intentando PNG como fallback...`);
            
            // PASO 2: Si .gif falla, buscar .png como fallback
            try {
              const pngUrl = `${baseUrl}/labimages/${tokenIdNum}.png`;
              console.log(`[floppy-render] 🔍 PASO 2: Buscando PNG como fallback: ${pngUrl}`);
              
              const pngResp = await fetch(pngUrl);
              if (pngResp.ok) {
                const pngArrayBuf = await pngResp.arrayBuffer();
                fileBuffer = Buffer.from(pngArrayBuf);
                fileExtension = 'png';
                contentType = 'image/png';
                
                console.log(`[floppy-render] ✅ PNG encontrado como fallback, tamaño: ${fileBuffer.length} bytes`);
              } else {
                throw new Error(`PNG tampoco encontrado (${pngResp.status} ${pngResp.statusText})`);
              }
            } catch (pngError) {
              throw new Error(`Ni GIF ni PNG encontrados para floppy ${tokenIdNum}. GIF: ${gifError.message}, PNG: ${pngError.message}`);
            }
          }
          
          // Guardar en caché
          setCachedFloppyRender(tokenIdNum, fileBuffer);
          
          const ttlSeconds = Math.floor(getFloppyRenderTTL(tokenIdNum) / 1000);
          console.log(`[floppy-render] ✅ ${fileExtension.toUpperCase()} cacheado por ${ttlSeconds}s (${Math.floor(ttlSeconds/3600)}h) para floppy ${tokenIdNum}`);

          // Configurar headers dinámicamente
          res.setHeader('X-Cache', 'MISS');
          res.setHeader('Content-Type', contentType);
          res.setHeader('Cache-Control', `public, max-age=${ttlSeconds}`);
          res.setHeader('X-Version', `FLOPPY-${fileExtension.toUpperCase()}-FALLBACK-INTELIGENTE-REBUILD-${Date.now()}`);
          
          console.log(`[floppy-render] ===== ${fileExtension.toUpperCase()} DE FLOPPY ESPECÍFICO SERVIDO CON FALLBACK INTELIGENTE =====`);
          return res.status(200).send(fileBuffer);
        } catch (error) {
          console.error(`[floppy-render] ❌ Error crítico para floppy ${tokenIdNum}:`, error.message);
          
          // Para floppys 10000+, no hacer fallback al renderizado normal
          return res.status(500).json({ 
            error: `No se pudo encontrar archivo para floppy ${tokenIdNum}`,
            details: error.message,
            tokenId: tokenIdNum,
            strategy: "Búsqueda secuencial: .gif → .png",
            suggestion: "Verificar que exista al menos uno de los archivos en /labimages/"
          });
        }
      }
      
      // Determinar si es un serum (GIF) o trait (PNG)
      const isSerum = tokenIdNum >= 262144 && tokenIdNum <= 262147;
      console.log(`[floppy-render] Procesando ${isSerum ? 'serum' : 'trait'} ${tokenId} (renderizado ${isSerum ? 'GIF' : 'PNG'})`);
      
      // Usar la nueva clase FloppyRenderer
      const renderer = new FloppyRenderer();
      const imageBuffer = await renderer.generatePNG(tokenId);

      // ===== GUARDAR EN CACHÉ Y RETORNAR =====
      setCachedFloppyRender(tokenIdNum, imageBuffer);
      
      const ttlSeconds = Math.floor(getFloppyRenderTTL(tokenIdNum) / 1000);
      console.log(`[floppy-render] ✅ Imagen cacheada por ${ttlSeconds}s (${Math.floor(ttlSeconds/3600)}h) para token ${tokenIdNum}`);

      // Configurar headers según el tipo de imagen
      res.setHeader('X-Cache', 'MISS');
      res.setHeader('Content-Type', isSerum ? 'image/gif' : 'image/png');
      res.setHeader('Cache-Control', `public, max-age=${ttlSeconds}`);
      res.setHeader('X-Version', 'FLOPPY-METODO-PERSONALIZADO');
      
      // Devolver imagen
      console.log(`[floppy-render] ===== RENDERIZADO SVG COMPLETO FINALIZADO =====`);
      res.status(200).send(imageBuffer);
      
    } else {
      res.status(400).json({ error: 'Este endpoint maneja tokens 1-9999 (traits), 10000-10100 (floppys), 262144-262147 (serums), 30000-35000 (T-shirts) y 100001-101003 (OGPUNKS TOP). Para otros tokens usa /api/metadata/floppy/[tokenId]' });
    }
  } catch (error) {
    console.error('[floppy-render] Error:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
} 