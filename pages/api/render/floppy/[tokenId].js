import { FloppyRenderer } from '../../../../lib/renderers/floppy-renderer.js';
import { renderV4CardPng, V4_HS } from '../../../../lib/renderers/card-v4-renderer.js';
import {
  getCachedFloppyRender,
  setCachedFloppyRender,
  getFloppyRenderTTL,
  getCachedFloppyGif,
  setCachedFloppyGif
} from '../../../../lib/cache.js';
import { isTraitAnimated, getAnimatedTraits } from '../../../../lib/animated-traits-helper.js';
import { generateFloppyGif, generateFloppyGifV4, generateStandaloneAnimatedV4 } from '../../../../lib/gif-generator.js';
import { generateFloppySimpleHash, generateFloppyGifHash } from '../../../../lib/render-hash.js';
import { fileExistsInGitHubFloppySimple, getGitHubFileUrlFloppySimple, uploadFileToGitHubFloppySimple, fileExistsInGitHubFloppyGif, getGitHubFileUrlFloppyGif, uploadFileToGitHubFloppyGif } from '../../../../lib/github-storage.js';
import { Resvg } from '@resvg/resvg-js';
import fs from 'fs';
import path from 'path';

// ===== V4 helpers =====
// Loads token metadata from the right JSON depending on the id range.
// Used by the v4 swap paths (floppy/serum/tshit/ogcover/trait).
function loadTokenDataForV4(tokenIdNum) {
  const ROOT = process.cwd();
  const readJson = (p) => JSON.parse(fs.readFileSync(path.join(ROOT, p), 'utf8'));
  // Floppy / pack / 1123 legacy 1/1
  if ((tokenIdNum >= 10000 && tokenIdNum <= 10100) || tokenIdNum === 1123) {
    const f = readJson('public/labmetadata/floppy.json');
    return f.floppys.find((x) => x.tokenId === tokenIdNum)
      || { tokenId: tokenIdNum, name: `Floppy #${tokenIdNum}`, category: 'Floppy discs', maxSupply: 1, floppy: 'OG' };
  }
  // Serums
  if (tokenIdNum >= 262144 && tokenIdNum <= 262147) {
    const s = readJson('public/labmetadata/serums.json');
    return (s.serums || []).find((x) => x.tokenId === tokenIdNum)
      || { tokenId: tokenIdNum, name: `Serum #${tokenIdNum}`, category: 'Serum', maxSupply: 1, floppy: 'SERUM' };
  }
  // T-Shits (V1 + V2)
  if (tokenIdNum >= 30000 && tokenIdNum <= 35000) {
    const studio = readJson('public/labmetadata/studio.json');
    const entry = studio[String(tokenIdNum)];
    if (entry) return { tokenId: tokenIdNum, ...entry, floppy: 'STUDIO' };
    return { tokenId: tokenIdNum, name: `Studio T-Shit #${tokenIdNum - 30000 + 1}`, category: 'SWAG', maxSupply: 1, floppy: 'STUDIO' };
  }
  // OG covers
  if (tokenIdNum >= 100001 && tokenIdNum <= 101003) {
    const o = readJson('public/labmetadata/ogpunks.json');
    return o.traits.find((x) => x.tokenId === tokenIdNum)
      || { tokenId: tokenIdNum, name: 'OGcover', category: 'TOP', maxSupply: 1, floppy: 'OG' };
  }
  // Traits 1-9999
  const t = readJson('public/labmetadata/traits.json');
  return t.traits.find((x) => x.tokenId === tokenIdNum) || {
    tokenId: tokenIdNum, name: `TRAIT #${tokenIdNum}`, category: 'UNKNOWN', maxSupply: 100, floppy: 'OG',
  };
}

// Fetches the raw floppy/serum asset (.gif preferred, .png fallback).
// IMPORTANT: this is the source artwork — the v4 handler then embeds it
// inside the v4 card frame (instead of returning the raw bytes as before).
async function loadFloppyArtBuffer(tokenIdNum, baseUrl) {
  const tryFetch = async (ext) => {
    const r = await fetch(`${baseUrl}/labimages/${tokenIdNum}.${ext}`);
    if (!r.ok) return null;
    return Buffer.from(await r.arrayBuffer());
  };
  const gif = await tryFetch('gif');
  if (gif) return { buffer: gif, ext: 'gif' };
  const png = await tryFetch('png');
  if (png) return { buffer: png, ext: 'png' };
  throw new Error(`No .gif or .png in /labimages/ for ${tokenIdNum}`);
}

// Resolves the T-Shit design SVG URL (V1 GitHub raw or V2 on-chain URI),
// fetches it, and returns the SVG buffer.
async function loadTshitDesignSvgBuffer(tokenIdNum) {
  const { isTShitV2, resolveTShitUri } = await import('../../../../lib/v2/rpc/tshit-resolver.js');
  let url;
  if (isTShitV2(tokenIdNum)) {
    url = await resolveTShitUri(tokenIdNum);
    if (!url) throw new Error(`No on-chain designURI for T-Shit V2 ${tokenIdNum}`);
  } else {
    url = `https://raw.githubusercontent.com/adriangallery/adrianzero/main/designs/${tokenIdNum}.svg`;
  }
  const r = await fetch(url);
  if (!r.ok) throw new Error(`T-Shit design fetch ${url} → ${r.status}`);
  return Buffer.from(await r.arrayBuffer());
}

async function loadOgCoverSvgBuffer(tokenIdNum) {
  // Try local first, then fall back to GitHub raw via the same loader other
  // renderers use. Vercel's File Tracer doesn't follow process.cwd() reads,
  // so the local file may be absent from the lambda bundle even though it
  // exists in the repo — the GitHub fallback covers that case.
  const local = path.join(process.cwd(), 'public/labimages/ogpunks', `${tokenIdNum}.svg`);
  if (fs.existsSync(local)) return fs.readFileSync(local);
  const { loadLabimagesAsset } = await import('../../../../lib/github-storage.js');
  const buf = await loadLabimagesAsset(`ogpunks/${tokenIdNum}.svg`);
  if (!buf) throw new Error(`OG cover SVG missing locally and on GitHub: ${tokenIdNum}`);
  return buf;
}

function svgBufferToB64Png(buf, width = V4_HS) {
  const png = new Resvg(buf, { fitTo: { mode: 'width', value: width } }).render().asPng();
  return `data:image/png;base64,${png.toString('base64')}`;
}

async function getTotalMintedV4(tokenIdNum, fallback) {
  try {
    const { getContracts } = await import('../../../../lib/contracts.js');
    const { traitsCore } = await Promise.race([
      getContracts(),
      new Promise((_, reject) => setTimeout(() => reject(new Error('getContracts timeout 8000ms')), 8000)),
    ]);
    const minted = await Promise.race([
      traitsCore.totalMintedPerAsset(tokenIdNum),
      new Promise((_, reject) => setTimeout(() => reject(new Error('totalMintedPerAsset timeout 5000ms')), 5000)),
    ]);
    return minted.toNumber();
  } catch (err) {
    console.warn(`[floppy-render/v4] totalMinted fallback for ${tokenIdNum}: ${err.message}`);
    return fallback;
  }
}

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
    const skipCache = req.query.refresh === '1' || req.query.nocache === '1';
    
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
            res.setHeader('Cache-Control', 'public, max-age=3600, s-maxage=3600'); // 1 hora de cache
            
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
      res.setHeader('Cache-Control', 'public, max-age=3600, s-maxage=3600'); // 1 hora de cache
      
      console.log(`[floppy-render] 🔍 Simple render completado para token ${tokenIdNum}`);
      return res.status(200).send(pngBuffer);
    }

    // ===== SISTEMA DE CACHÉ PARA FLOPPY RENDER =====
    // ?refresh=1 / ?nocache=1 skip the in-memory lambda cache so a swapped
    // render (e.g. v4 hash bump) doesn't get masked by a warm-lambda buffer.
    const cachedImage = skipCache ? null : getCachedFloppyRender(tokenIdNum);

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
      res.setHeader('Cache-Control', `public, max-age=${ttlSeconds}, s-maxage=${ttlSeconds}`);
      res.setHeader('Content-Type', isGif ? 'image/gif' : 'image/png');
      res.setHeader('X-Version', isSpecificFloppy ? (isPngFloppy ? 'FLOPPY-PNG-CACHED' : 'FLOPPY-GIF-CACHED') : 'FLOPPY-METODO-PERSONALIZADO');
      
      return res.status(200).send(cachedImage);
    }

    console.log(`[floppy-render] 💾 CACHE MISS para token ${tokenIdNum} - Generando imagen...`);
    console.log(`[floppy-render] ===== RENDERIZADO TRAITS (1-9999) =====`);
    console.log(`[floppy-render] Token ID: ${tokenId}`);

    // Procesar tokens 1-9999 (traits), 262144-262147 (serums), 30000-35000 (T-shirts personalizados) y 10000-10100 (floppys)
    // ===== ACHIEVEMENT BADGES (20000-20099): redirect to GitHub raw =====
    if (tokenIdNum >= 20000 && tokenIdNum <= 20099) {
      try {
        const achPath = path.join(process.cwd(), 'public', 'labmetadata', 'achievements.json');
        const achData = JSON.parse(fs.readFileSync(achPath).toString());
        const badge = achData.achievements.find(a => a.tokenId === tokenIdNum);
        if (!badge) {
          return res.status(404).json({ error: `Achievement ${tokenIdNum} not found` });
        }
        const filename = badge.image.replace('achievements/', '');
        const ghUrl = `https://raw.githubusercontent.com/adriangallery/AdrianAdventure/main/assets/sprites/badges/${filename}`;
        res.setHeader('Cache-Control', 'public, max-age=86400');
        return res.redirect(302, ghUrl);
      } catch (err) {
        return res.status(500).json({ error: 'Error loading achievement data' });
      }
    }

    if (
      (tokenIdNum >= 1 && tokenIdNum <= 9999) ||
      (tokenIdNum >= 262144 && tokenIdNum <= 262147) ||
      (tokenIdNum >= 30000 && tokenIdNum <= 35000) ||
      (tokenIdNum >= 10000 && tokenIdNum <= 10100) ||
      tokenIdNum === 1123 ||
      ((tokenIdNum >= 100001 && tokenIdNum <= 101003) || (tokenIdNum >= 101001 && tokenIdNum <= 101003))
    ) {

      // ============================================================
      // V4 SWAP — special-range items now embed inside the v4 card
      // ============================================================
      // BEHAVIORAL CHANGE: floppies/packs/serums used to return the raw
      // .gif / .png bytes from /public/labimages directly. They now go
      // through the v4 card frame (animated GIF or PNG, depending on the
      // source asset). T-Shits and OG covers also rendered legacy via
      // FloppyRenderer; both now use the v4 card too.
      //
      // To revert any of these to legacy: comment out the matching block
      // and let it fall through to the FloppyRenderer path further below.
      // ============================================================
      const isSpecialFloppyAsset = (tokenIdNum >= 10000 && tokenIdNum <= 10100) || tokenIdNum === 1123;
      const isSerumRange         = tokenIdNum >= 262144 && tokenIdNum <= 262147;
      const isTshitRange         = tokenIdNum >= 30000 && tokenIdNum <= 35000;
      const isOgCoverRange       = tokenIdNum >= 100001 && tokenIdNum <= 101003;

      // ----- Floppies / packs / serums: source asset → v4 card frame -----
      if (isSpecialFloppyAsset || isSerumRange) {
        try {
          const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://adrianlab.vercel.app';
          const tokenData = loadTokenDataForV4(tokenIdNum);
          const totalMinted = tokenData.maxSupply || 1; // floppies/serums have no on-chain totalMintedPerAsset

          const { buffer: srcBuf, ext } = await loadFloppyArtBuffer(tokenIdNum, baseUrl);
          console.log(`[floppy-render/v4] ${tokenIdNum} source: ${ext.toUpperCase()} ${srcBuf.length}b`);

          let outBuffer;
          let contentType;
          let xVersion;
          if (ext === 'gif') {
            outBuffer = await generateStandaloneAnimatedV4({
              sourceGifBuffer: srcBuf,
              tokenIdNum,
              tokenData,
              totalMinted,
            });
            contentType = 'image/gif';
            xVersion = isSerumRange ? 'SERUM-V4-GIF' : 'FLOPPY-V4-GIF';
          } else {
            const traitB64 = `data:image/png;base64,${srcBuf.toString('base64')}`;
            outBuffer = renderV4CardPng({
              tokenIdNum,
              tokenData,
              totalMinted,
              traitB64Override: traitB64,
              skipMannequin: true,
            });
            contentType = 'image/png';
            xVersion = isSerumRange ? 'SERUM-V4-PNG' : 'FLOPPY-V4-PNG-STANDALONE';
          }

          setCachedFloppyRender(tokenIdNum, outBuffer);
          const ttlSeconds = Math.floor(getFloppyRenderTTL(tokenIdNum) / 1000);
          res.setHeader('X-Cache', 'MISS');
          res.setHeader('Content-Type', contentType);
          res.setHeader('Cache-Control', `public, max-age=${ttlSeconds}, s-maxage=${ttlSeconds}`);
          res.setHeader('X-Version', xVersion);
          console.log(`[floppy-render/v4] ${tokenIdNum} ✓ ${xVersion} ${outBuffer.length}b`);
          return res.status(200).send(outBuffer);
        } catch (err) {
          console.error(`[floppy-render/v4] ${tokenIdNum} FAIL:`, err.message);
          return res.status(500).json({
            error: `v4 render failed for ${tokenIdNum}`,
            details: err.message,
            tokenId: tokenIdNum,
          });
        }
      }

      // ----- T-Shits: design SVG (V1 GitHub raw / V2 on-chain) → v4 card with mannequin -----
      if (isTshitRange) {
        try {
          const tokenData = loadTokenDataForV4(tokenIdNum);
          const totalMinted = tokenData.maxSupply || 1;
          const designSvg = await loadTshitDesignSvgBuffer(tokenIdNum);
          const traitB64 = svgBufferToB64Png(designSvg, V4_HS);
          const outBuffer = renderV4CardPng({
            tokenIdNum,
            tokenData,
            totalMinted,
            traitB64Override: traitB64,
            skipMannequin: false, // T-Shit designs overlay on top of the standard mannequin
          });

          setCachedFloppyRender(tokenIdNum, outBuffer);
          const ttlSeconds = Math.floor(getFloppyRenderTTL(tokenIdNum) / 1000);
          res.setHeader('X-Cache', 'MISS');
          res.setHeader('Content-Type', 'image/png');
          res.setHeader('Cache-Control', `public, max-age=${ttlSeconds}, s-maxage=${ttlSeconds}`);
          res.setHeader('X-Version', 'TSHIT-V4-PNG');
          console.log(`[floppy-render/v4] T-Shit ${tokenIdNum} ✓ ${outBuffer.length}b`);
          return res.status(200).send(outBuffer);
        } catch (err) {
          console.error(`[floppy-render/v4] T-Shit ${tokenIdNum} FAIL:`, err.message);
          return res.status(500).json({ error: `T-Shit v4 render failed`, details: err.message, tokenId: tokenIdNum });
        }
      }

      // ----- OG covers: SVG already complete → v4 card standalone -----
      if (isOgCoverRange) {
        try {
          const tokenData = loadTokenDataForV4(tokenIdNum);
          const totalMinted = tokenData.maxSupply || 1;
          const svgBuf = loadOgCoverSvgBuffer(tokenIdNum);
          const traitB64 = svgBufferToB64Png(svgBuf, V4_HS);
          const outBuffer = renderV4CardPng({
            tokenIdNum,
            tokenData,
            totalMinted,
            traitB64Override: traitB64,
            skipMannequin: true, // OG cover SVG already contains the full body — no mannequin underneath
          });

          setCachedFloppyRender(tokenIdNum, outBuffer);
          const ttlSeconds = Math.floor(getFloppyRenderTTL(tokenIdNum) / 1000);
          res.setHeader('X-Cache', 'MISS');
          res.setHeader('Content-Type', 'image/png');
          res.setHeader('Cache-Control', `public, max-age=${ttlSeconds}, s-maxage=${ttlSeconds}`);
          res.setHeader('X-Version', 'OGCOVER-V4-PNG');
          console.log(`[floppy-render/v4] OG cover ${tokenIdNum} ✓ ${outBuffer.length}b`);
          return res.status(200).send(outBuffer);
        } catch (err) {
          console.error(`[floppy-render/v4] OG cover ${tokenIdNum} FAIL:`, err.message);
          return res.status(500).json({ error: `OG cover v4 render failed`, details: err.message, tokenId: tokenIdNum });
        }
      }

      // ============================================================
      // (Legacy block kept for safety — only reachable if a token id
      // somehow falls into the outer `if` but doesn't match any of the
      // v4 paths above. The `if` outer guard below also matches the
      // 1-9999 trait range which we still want to render with v4.)
      // ============================================================
      // LEGACY (DEAD CODE for floppies/packs — kept for reference / quick rollback)
      if (false /* disabled by v4 swap */) {
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
          res.setHeader('Cache-Control', `public, max-age=${ttlSeconds}, s-maxage=${ttlSeconds}`);
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
          
          // Verificar caché de GIF (skip si refresh=1)
          const cachedGif = skipCache ? null : getCachedFloppyGif(tokenIdNum);
          if (cachedGif) {
            console.log(`[floppy-render] 🎬 CACHE HIT para GIF de trait ${tokenIdNum}`);
            const ttlSeconds = Math.floor(getFloppyRenderTTL(tokenIdNum) / 1000);
            res.setHeader('X-Cache', 'HIT');
            res.setHeader('Content-Type', 'image/gif');
            res.setHeader('Cache-Control', `public, max-age=${ttlSeconds}, s-maxage=${ttlSeconds}`);
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
          
          // Cargar metadata del token (usando el mismo método que FloppyRenderer)
          const metadataPath = path.join(process.cwd(), 'public', 'labmetadata', 'traits.json');
          const metadataContent = fs.readFileSync(metadataPath, 'utf8');
          const metadata = JSON.parse(metadataContent);
          const tokenData = metadata.traits.find(t => t.tokenId === tokenIdNum);
          
          if (!tokenData) {
            throw new Error(`No se encontró metadata para token ${tokenIdNum}`);
          }
          
          // Obtener variantes del trait animado
          const animTrait = animatedTraits[0];
          const variants = animTrait.variants || [];
          
          // Parámetros fijos para el GIF
          const width = 768;
          const height = 1024;
          const delay = 500;
          
          // Generar hash único para el GIF
          const gifHash = generateFloppyGifHash(tokenIdNum, tokenData, variants, width, height, delay);
          console.log(`[floppy-render] 🔐 Hash generado para GIF de floppy ${tokenIdNum}: ${gifHash}`);
          
          // Verificar si existe en GitHub
          const existsInGitHub = await fileExistsInGitHubFloppyGif(tokenIdNum, gifHash);
          if (existsInGitHub) {
            console.log(`[floppy-render] ✅ GIF de floppy ${tokenIdNum} existe en GitHub, descargando...`);
            const githubUrl = getGitHubFileUrlFloppyGif(tokenIdNum, gifHash);
            
            try {
              const response = await fetch(githubUrl);
              if (response.ok) {
                const gifBuffer = Buffer.from(await response.arrayBuffer());
                
                // Guardar en caché local
                setCachedFloppyGif(tokenIdNum, gifBuffer);
                
                const ttlSeconds = Math.floor(getFloppyRenderTTL(tokenIdNum) / 1000);
                console.log(`[floppy-render] ✅ GIF de floppy ${tokenIdNum} servido desde GitHub`);
                
                // Configurar headers para GIF
                res.setHeader('X-Cache', 'GITHUB');
                res.setHeader('X-GitHub-Source', 'true');
                res.setHeader('X-Render-Hash', gifHash);
                res.setHeader('Content-Type', 'image/gif');
                res.setHeader('Cache-Control', `public, max-age=${ttlSeconds}, s-maxage=${ttlSeconds}`);
                res.setHeader('X-Version', 'FLOPPY-ANIMATED');
                
                return res.status(200).send(gifBuffer);
              }
            } catch (fetchError) {
              console.error(`[floppy-render] ❌ Error descargando GIF desde GitHub:`, fetchError.message);
              // Continuar con generación normal si falla la descarga
            }
          } else {
            console.log(`[floppy-render] 📤 GIF de floppy ${tokenIdNum} no existe en GitHub - Se generará y subirá`);
          }
          
          // Obtener totalMinted on-chain (v4 path)
          const totalMinted = await getTotalMintedV4(tokenIdNum, tokenData.maxSupply || 0);

          // Generar GIF v4 (Gemini layout, animated frames)
          const gifBuffer = await generateFloppyGifV4({
            traitId: tokenIdNum,
            tokenData: tokenData,
            totalMinted: totalMinted,
          });
          
          // Subir a GitHub
          console.log(`[floppy-render] 🚀 Iniciando subida a GitHub para GIF de floppy ${tokenIdNum} (hash: ${gifHash})`);
          await uploadFileToGitHubFloppyGif(tokenIdNum, gifBuffer, gifHash);
          
          // Guardar en caché local
          setCachedFloppyGif(tokenIdNum, gifBuffer);
          
          const ttlSeconds = Math.floor(getFloppyRenderTTL(tokenIdNum) / 1000);
          console.log(`[floppy-render] 🎬 GIF generado y cacheado por ${ttlSeconds}s`);
          
          // Configurar headers para GIF
          res.setHeader('X-Cache', 'MISS');
          res.setHeader('X-Render-Hash', gifHash);
          res.setHeader('Content-Type', 'image/gif');
          res.setHeader('Cache-Control', `public, max-age=${ttlSeconds}, s-maxage=${ttlSeconds}`);
          res.setHeader('X-Version', 'FLOPPY-ANIMATED');
          
          return res.status(200).send(gifBuffer);
        } catch (error) {
          console.error('[floppy-render] 🎬 Error generando GIF, continuando con PNG:', error.message);
          console.error('[floppy-render] 🎬 Stack:', error.stack);
          // Continuar con PNG si falla la generación de GIF
        }
      }
      
      // V4 swap: para traits 1-9999 (no animados, no serums) usar el renderer Gemini-style.
      // Serums, T-shirts y OGPUNKS TOPs siguen con FloppyRenderer (diseños propios).
      const isV4Trait = !isSerum && tokenIdNum >= 1 && tokenIdNum <= 9999;

      let imageBuffer;
      let xVersion;
      if (isV4Trait) {
        const traitsPath = path.join(process.cwd(), 'public/labmetadata/traits.json');
        const traitsJson = JSON.parse(fs.readFileSync(traitsPath, 'utf8'));
        const v4TokenData = traitsJson.traits.find((t) => t.tokenId === tokenIdNum) || {
          name: `TRAIT #${tokenIdNum}`,
          category: 'UNKNOWN',
          maxSupply: 100,
          floppy: 'OG',
        };
        const totalMinted = await getTotalMintedV4(tokenIdNum, v4TokenData.maxSupply || 0);
        imageBuffer = renderV4CardPng({ tokenIdNum, tokenData: v4TokenData, totalMinted });
        xVersion = 'FLOPPY-V4-PNG';
      } else {
        const renderer = new FloppyRenderer();
        imageBuffer = await renderer.generatePNG(tokenId);
        xVersion = 'FLOPPY-METODO-PERSONALIZADO';
      }

      // ===== GUARDAR EN CACHÉ Y RETORNAR =====
      setCachedFloppyRender(tokenIdNum, imageBuffer);

      const ttlSeconds = Math.floor(getFloppyRenderTTL(tokenIdNum) / 1000);
      console.log(`[floppy-render] ✅ Imagen cacheada por ${ttlSeconds}s (${Math.floor(ttlSeconds/3600)}h) para token ${tokenIdNum}`);

      // Configurar headers según el tipo de imagen
      res.setHeader('X-Cache', 'MISS');
      res.setHeader('Content-Type', isSerum ? 'image/gif' : 'image/png');
      res.setHeader('Cache-Control', `public, max-age=${ttlSeconds}, s-maxage=${ttlSeconds}`);
      res.setHeader('X-Version', xVersion);

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