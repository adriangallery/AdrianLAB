import { FloppyRenderer } from '../../../../lib/renderers/floppy-renderer.js';
import { 
  getCachedFloppyRender, 
  setCachedFloppyRender, 
  getFloppyRenderTTL,
  getCachedFloppyGif,
  setCachedFloppyGif
} from '../../../../lib/cache.js';
import { isTraitAnimated, getAnimatedTraits } from '../../../../lib/animated-traits-helper.js';
import { generateFloppyGif } from '../../../../lib/gif-generator.js';
import { generateFloppySimpleHash } from '../../../../lib/render-hash.js';
import { fileExistsInGitHubFloppySimple, getGitHubFileUrlFloppySimple, uploadFileToGitHubFloppySimple } from '../../../../lib/github-storage.js';
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
      
      // Generar hash único para el floppy simple
      const floppyHash = generateFloppySimpleHash(tokenIdNum);
      console.log(`[floppy-render] 🔐 Hash generado para floppy simple ${tokenIdNum}: ${floppyHash}`);
      
      // Verificar si existe en GitHub
      const existsInGitHub = await fileExistsInGitHubFloppySimple(tokenIdNum, floppyHash);
      if (existsInGitHub) {
        console.log(`[floppy-render] ✅ Floppy simple ${tokenIdNum} existe en GitHub, descargando...`);
        const githubUrl = getGitHubFileUrlFloppySimple(tokenIdNum, floppyHash);
        
        try {
          const response = await fetch(githubUrl);
          if (response.ok) {
            const imageBuffer = Buffer.from(await response.arrayBuffer());
            
            res.setHeader('Content-Type', 'image/png');
            res.setHeader('X-Version', 'FLOPPY-SIMPLE');
            res.setHeader('X-Render-Type', 'simple');
            res.setHeader('X-Cache', 'GITHUB');
            res.setHeader('X-Source', 'github');
            res.setHeader('Cache-Control', 'public, max-age=3600'); // 1 hora de cache
            
            console.log(`[floppy-render] ✅ Floppy simple ${tokenIdNum} servido desde GitHub`);
            return res.status(200).send(imageBuffer);
          }
        } catch (fetchError) {
          console.error(`[floppy-render] ❌ Error descargando desde GitHub:`, fetchError.message);
          // Continuar con renderizado normal si falla la descarga
        }
      } else {
        console.log(`[floppy-render] 📤 Floppy simple ${tokenIdNum} no existe en GitHub - Se renderizará y subirá`);
      }
      
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
      
      // Subir a GitHub
      console.log(`[floppy-render] 🚀 Iniciando subida a GitHub para floppy simple ${tokenIdNum} (hash: ${floppyHash})`);
      await uploadFileToGitHubFloppySimple(tokenIdNum, pngBuffer, floppyHash);
      
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
      tokenIdNum === 1123 ||
      ((tokenIdNum >= 100001 && tokenIdNum <= 101003) || (tokenIdNum >= 101001 && tokenIdNum <= 101003))
    ) {
      
      // LÓGICA ESPECIAL: Si es un floppy específico (10000+ o 1123), buscar archivo con fallback inteligente
      // ESTRATEGIA: Buscar .gif primero, si no existe, buscar .png como fallback
      // 🔄 REBUILD FORZADO: Lógica actualizada para forzar rebuild completo
      if ((tokenIdNum >= 10000 && tokenIdNum <= 10100) || tokenIdNum === 1123) {
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
      
      // Detectar si el trait es animado (solo para traits, no serums)
      let isAnimatedTrait = false;
      let animatedTraits = [];
      if (!isSerum && tokenIdNum >= 1 && tokenIdNum <= 9999) {
        isAnimatedTrait = await isTraitAnimated(tokenIdNum);
        if (isAnimatedTrait) {
          animatedTraits = await getAnimatedTraits([tokenIdNum]);
          console.log(`[floppy-render] 🎬 Trait animado detectado: ${tokenIdNum} (${animatedTraits[0]?.variants.length || 0} variantes)`);
          
          // Verificar caché de GIF
          const cachedGif = getCachedFloppyGif(tokenIdNum);
          if (cachedGif) {
            console.log(`[floppy-render] 🎬 CACHE HIT para GIF de trait ${tokenIdNum}`);
            const ttlSeconds = Math.floor(getFloppyRenderTTL(tokenIdNum) / 1000);
            res.setHeader('X-Cache', 'HIT');
            res.setHeader('Content-Type', 'image/gif');
            res.setHeader('Cache-Control', `public, max-age=${ttlSeconds}`);
            res.setHeader('X-Version', 'FLOPPY-ANIMATED');
            return res.status(200).send(cachedGif);
          }
          
          console.log(`[floppy-render] 🎬 CACHE MISS para GIF - Generando GIF animado...`);
        }
      }
      
      console.log(`[floppy-render] Procesando ${isSerum ? 'serum' : isAnimatedTrait ? 'trait animado' : 'trait'} ${tokenId} (renderizado ${isSerum ? 'GIF' : isAnimatedTrait ? 'GIF' : 'PNG'})`);
      
      // Si es trait animado, generar GIF
      if (isAnimatedTrait && animatedTraits.length > 0) {
        try {
          // Usar FloppyRenderer para obtener los datos necesarios
          const renderer = new FloppyRenderer();
          
          // Cargar metadata del token
          const tokenData = await renderer.generateSVG(tokenId).catch(async () => {
            // Si falla, cargar metadata directamente
            const metadataPath = path.join(process.cwd(), 'public', 'labmetadata', 'traits.json');
            const metadataContent = fs.readFileSync(metadataPath, 'utf8');
            const metadata = JSON.parse(metadataContent);
            const trait = metadata.traits.find(t => t.tokenId === tokenIdNum);
            if (!trait) {
              throw new Error(`No se encontró metadata para token ${tokenIdNum}`);
            }
            return null; // Retornamos null para usar el trait directamente
          });
          
          // Obtener metadata directamente si generateSVG falló
          let tokenDataFinal;
          if (!tokenData) {
            const metadataPath = path.join(process.cwd(), 'public', 'labmetadata', 'traits.json');
            const metadataContent = fs.readFileSync(metadataPath, 'utf8');
            const metadata = JSON.parse(metadataContent);
            tokenDataFinal = metadata.traits.find(t => t.tokenId === tokenIdNum);
            if (!tokenDataFinal) {
              throw new Error(`No se encontró metadata para token ${tokenIdNum}`);
            }
          } else {
            // Si generateSVG funcionó, necesitamos extraer los datos del renderer
            // Por ahora, cargamos directamente desde traits.json
            const metadataPath = path.join(process.cwd(), 'public', 'labmetadata', 'traits.json');
            const metadataContent = fs.readFileSync(metadataPath, 'utf8');
            const metadata = JSON.parse(metadataContent);
            tokenDataFinal = metadata.traits.find(t => t.tokenId === tokenIdNum);
          }
          
          // Obtener total minted
          const totalMinted = await renderer.generatePNG(tokenId).catch(async () => {
            // Si falla, intentar obtener desde el contrato
            try {
              const { getContracts } = await import('../../../../lib/contracts.js');
              const contracts = getContracts();
              const floppyContract = contracts.floppy;
              if (floppyContract) {
                const totalSupply = await floppyContract.totalSupply(tokenIdNum);
                return totalSupply.toNumber();
              }
            } catch (e) {
              console.warn(`[floppy-render] No se pudo obtener totalMinted: ${e.message}`);
            }
            return 0;
          });
          
          // Obtener rarity
          const rarity = renderer.generatePNG ? await (async () => {
            // Usar método privado del renderer si está disponible
            const maxSupply = tokenDataFinal.maxSupply || 100;
            const rarityMap = {
              1: { tag: 'LEGENDARY', bg: '#ff6b00' },
              5: { tag: 'EPIC', bg: '#9b59b6' },
              10: { tag: 'RARE', bg: '#3498db' },
              50: { tag: 'UNCOMMON', bg: '#2ecc71' },
              100: { tag: 'COMMON', bg: '#95a5a6' }
            };
            
            for (const [supply, r] of Object.entries(rarityMap)) {
              if (maxSupply <= parseInt(supply)) {
                return r;
              }
            }
            return rarityMap[100];
          })() : { tag: 'COMMON', bg: '#95a5a6' };
          
          // Obtener totalMinted desde el contrato
          let totalMintedFinal = 0;
          try {
            const { getContracts } = await import('../../../../lib/contracts.js');
            const contracts = getContracts();
            const floppyContract = contracts.floppy;
            if (floppyContract) {
              const totalSupply = await floppyContract.totalSupply(tokenIdNum);
              totalMintedFinal = totalSupply.toNumber();
            }
          } catch (e) {
            console.warn(`[floppy-render] No se pudo obtener totalMinted: ${e.message}`);
          }
          
          // Generar GIF con todos los elementos
          const gifBuffer = await generateFloppyGif({
            traitId: tokenIdNum,
            tokenData: tokenDataFinal,
            totalMinted: totalMintedFinal,
            rarity: rarity,
            width: 768,
            height: 1024,
            delay: 500
          });
          
          // Guardar en caché
          setCachedFloppyGif(tokenIdNum, gifBuffer);
          
          const ttlSeconds = Math.floor(getFloppyRenderTTL(tokenIdNum) / 1000);
          console.log(`[floppy-render] 🎬 GIF generado y cacheado por ${ttlSeconds}s`);
          
          // Configurar headers para GIF
          res.setHeader('X-Cache', 'MISS');
          res.setHeader('Content-Type', 'image/gif');
          res.setHeader('Cache-Control', `public, max-age=${ttlSeconds}`);
          res.setHeader('X-Version', 'FLOPPY-ANIMATED');
          
          return res.status(200).send(gifBuffer);
        } catch (error) {
          console.error('[floppy-render] 🎬 Error generando GIF, continuando con PNG:', error.message);
          console.error('[floppy-render] 🎬 Stack:', error.stack);
          // Continuar con PNG si falla la generación de GIF
        }
      }
      
      // Usar la nueva clase FloppyRenderer para PNG normal
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