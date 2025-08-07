import path from 'path';
import fs from 'fs';
import { getContracts } from '../../../../lib/contracts.js';
import { 
  getCachedFloppyMetadata, 
  setCachedFloppyMetadata, 
  getFloppyMetadataTTL 
} from '../../../../lib/cache.js';

export default async function handler(req, res) {
  // ===== CONFIGURACIÓN CORS =====
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
    let { id } = req.query;
    
    if (id && id.endsWith('.json')) {
      id = id.replace('.json', '');
    }
    
    if (!id || isNaN(parseInt(id))) {
      return res.status(400).json({ error: 'Invalid token ID' });
    }

    const tokenIdNum = parseInt(id);
    const actualId = id;

    // ===== SISTEMA DE CACHÉ PARA FLOPPY METADATA =====
    const cachedMetadata = getCachedFloppyMetadata(tokenIdNum);
    
    if (cachedMetadata) {
      console.log(`[floppy-metadata] 🎯 CACHE HIT para token ${tokenIdNum}`);
      
      // Configurar headers de caché
      const ttlSeconds = Math.floor(getFloppyMetadataTTL(tokenIdNum) / 1000);
      res.setHeader('X-Cache', 'HIT');
      res.setHeader('Cache-Control', `public, max-age=${ttlSeconds}`);
      res.setHeader('Content-Type', 'application/json');
      
      return res.status(200).json(cachedMetadata);
    }

    console.log(`[floppy-metadata] 💾 CACHE MISS para token ${tokenIdNum} - Generando metadata...`);
    console.log(`[floppy-metadata] ===== METADATA REQUEST =====`);
    console.log(`[floppy-metadata] Token ID: ${tokenIdNum}`);

    const version = Date.now();

    // Configurar URL base
    const baseUrl = process.env.VERCEL_URL 
      ? `https://${process.env.VERCEL_URL}` 
      : 'https://adrianlab.vercel.app';

    // DETERMINAR TIPO DE TOKEN
    if (tokenIdNum >= 1 && tokenIdNum <= 9999) {
      console.log(`[floppy-metadata] Token ${tokenIdNum} - Generando metadata para TRAITS (1-9999)`);
      
      // Cargar datos de labmetadata
      const labmetadataPath = path.join(process.cwd(), 'public', 'labmetadata', 'traits.json');
      let labmetadata;
      
      try {
        const labmetadataBuffer = fs.readFileSync(labmetadataPath);
        labmetadata = JSON.parse(labmetadataBuffer.toString());
        console.log(`[floppy-metadata] Labmetadata cargado, ${labmetadata.traits.length} traits encontrados`);
      } catch (error) {
        console.error('[floppy-metadata] Error cargando labmetadata:', error);
        return res.status(500).json({ error: 'Error cargando datos de traits' });
      }

      // Buscar el trait correspondiente al tokenId
      const traitData = labmetadata.traits.find(trait => trait.tokenId === tokenIdNum);
      
      if (!traitData) {
        console.log(`[floppy-metadata] Trait no encontrado para tokenId ${tokenIdNum}, usando datos genéricos`);
        // Datos genéricos si no se encuentra el trait
        const tokenData = {
          name: `TRAIT #${tokenIdNum}`,
          category: "UNKNOWN",
          maxSupply: 300
        };
      } else {
        console.log(`[floppy-metadata] Trait encontrado:`, JSON.stringify(traitData, null, 2));
      }

      // Usar los datos del trait encontrado o datos genéricos
      const tokenData = traitData || {
        name: `TRAIT #${tokenIdNum}`,
        category: "UNKNOWN",
        maxSupply: 300
      };

      // Obtener total minted del contrato
      let totalMinted = 0;
      try {
        console.log(`[floppy-metadata] Obteniendo totalMintedPerAsset para trait ${tokenIdNum}...`);
        const { traitsCore } = await getContracts();
        const mintedAmount = await traitsCore.totalMintedPerAsset(tokenIdNum);
        totalMinted = mintedAmount.toNumber();
        console.log(`[floppy-metadata] Total minted obtenido del contrato: ${totalMinted}`);
      } catch (error) {
        console.error(`[floppy-metadata] Error obteniendo totalMintedPerAsset:`, error.message);
        // Fallback: usar maxSupply como total minted si falla la llamada onchain
        totalMinted = tokenData.maxSupply;
        console.log(`[floppy-metadata] Usando fallback: totalMinted = maxSupply = ${totalMinted}`);
      }

      // Función para obtener tag y color según maxSupply (niveles actualizados)
      function getRarityTagAndColor(maxSupply) {
        if (maxSupply === 1) return { tag: 'UNIQUE', bg: '#ff0000' };        // Rojo
        if (maxSupply <= 6) return { tag: 'LEGENDARY', bg: '#ffd700' };      // Dorado
        if (maxSupply <= 14) return { tag: 'RARE', bg: '#da70d6' };          // Púrpura
        if (maxSupply <= 40) return { tag: 'UNCOMMON', bg: '#5dade2' };      // Azul
        return { tag: 'COMMON', bg: '#a9a9a9' };                             // Gris
      }

      const rarity = getRarityTagAndColor(tokenData.maxSupply);
      console.log(`[floppy-metadata] Rarity calculada:`, rarity);

      // Generar metadata para traits
      const metadata = {
        name: tokenData.name,
        description: tokenData.description || "BE REAL | BE ADRIAN | AdrianLAB by HalfxTiger",
        image: `${baseUrl}/api/render/floppy/${tokenIdNum}.png`,
        external_url: tokenData.external_url || "https://adrianpunks.com/",
        attributes: [
          {
            trait_type: "Category",
            value: tokenData.category
          },
          {
            trait_type: "Rarity",
            value: rarity.tag
          },
          {
            trait_type: "Max Supply",
            value: tokenData.maxSupply
          },
          {
            trait_type: "Total Minted",
            value: totalMinted
          },
          {
            trait_type: "Floppy",
            value: tokenData.floppy || "OG"
          }
        ],
        properties: {
          files: [
            {
              uri: `${baseUrl}/api/render/floppy/${tokenIdNum}.png`,
              type: "image/png"
            }
          ],
          category: "image",
          creators: tokenData.masterminds || ["Adrian | HalfxTiger"]
        }
      };

      // ===== GUARDAR EN CACHÉ Y RETORNAR =====
      setCachedFloppyMetadata(tokenIdNum, metadata);
      
      const ttlSeconds = Math.floor(getFloppyMetadataTTL(tokenIdNum) / 1000);
      console.log(`[floppy-metadata] ✅ Metadata cacheada por ${ttlSeconds}s (${Math.floor(ttlSeconds/3600)}h) para token ${tokenIdNum}`);

      // Configurar headers
      res.setHeader('X-Cache', 'MISS');
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Cache-Control', `public, max-age=${ttlSeconds}`);
      
      // Devolver metadata
      console.log(`[floppy-metadata] ===== METADATA TRAIT GENERADA EXITOSAMENTE =====`);
      res.status(200).json(metadata);

    } else if (tokenIdNum >= 262144 && tokenIdNum <= 262147) {
      console.log(`[floppy-metadata] Token ${tokenIdNum} - Generando metadata para SERUM (262144-262147)`);
      
      // Cargar datos de serums.json
      const serumsPath = path.join(process.cwd(), 'public', 'labmetadata', 'serums.json');
      let serumsData;
      
      try {
        const serumsBuffer = fs.readFileSync(serumsPath);
        serumsData = JSON.parse(serumsBuffer.toString());
        console.log(`[floppy-metadata] Serums data cargado, ${serumsData.serums.length} serums encontrados`);
      } catch (error) {
        console.error('[floppy-metadata] Error cargando serums data:', error);
        return res.status(500).json({ error: 'Error cargando datos de serums' });
      }

      // Buscar el serum correspondiente al tokenId
      const serumData = serumsData.serums.find(serum => serum.tokenId === tokenIdNum);
      
      if (!serumData) {
        console.log(`[floppy-metadata] Serum no encontrado para tokenId ${tokenIdNum}, usando datos genéricos`);
        const tokenData = {
          name: `SERUM #${tokenIdNum}`,
          category: "SERUMS",
          maxSupply: 1
        };
      } else {
        console.log(`[floppy-metadata] Serum encontrado:`, JSON.stringify(serumData, null, 2));
      }

      // Usar los datos del serum encontrado o datos genéricos
      const tokenData = serumData || {
        name: `SERUM #${tokenIdNum}`,
        category: "SERUMS",
        maxSupply: 1
      };

      // Obtener total minted del contrato
      let totalMinted = 0;
      try {
        console.log(`[floppy-metadata] Obteniendo totalMintedPerAsset para serum ${tokenIdNum}...`);
        const { traitsCore } = await getContracts();
        const mintedAmount = await traitsCore.totalMintedPerAsset(tokenIdNum);
        totalMinted = mintedAmount.toNumber();
        console.log(`[floppy-metadata] Total minted obtenido del contrato: ${totalMinted}`);
      } catch (error) {
        console.error(`[floppy-metadata] Error obteniendo totalMintedPerAsset:`, error.message);
        // Fallback: usar maxSupply como total minted si falla la llamada onchain
        totalMinted = tokenData.maxSupply;
        console.log(`[floppy-metadata] Usando fallback: totalMinted = maxSupply = ${totalMinted}`);
      }

      // Función para obtener tag y color según maxSupply (niveles actualizados)
      function getRarityTagAndColor(maxSupply) {
        if (maxSupply === 1) return { tag: 'UNIQUE', bg: '#ff0000' };        // Rojo
        if (maxSupply <= 6) return { tag: 'LEGENDARY', bg: '#ffd700' };      // Dorado
        if (maxSupply <= 14) return { tag: 'RARE', bg: '#da70d6' };          // Púrpura
        if (maxSupply <= 40) return { tag: 'UNCOMMON', bg: '#5dade2' };      // Azul
        return { tag: 'COMMON', bg: '#a9a9a9' };                             // Gris
      }

      const rarity = getRarityTagAndColor(tokenData.maxSupply);
      console.log(`[floppy-metadata] Rarity calculada:`, rarity);

      // Generar metadata para serum
      const metadata = {
        name: tokenData.name,
        description: tokenData.description || "BE REAL | BE ADRIAN | AdrianLAB by HalfxTiger",
        image: `${baseUrl}/api/render/floppy/${tokenIdNum}.png`,
        external_url: tokenData.external_url || "https://adrianpunks.com/",
        attributes: [
          {
            trait_type: "Category",
            value: tokenData.category
          },
          {
            trait_type: "Rarity",
            value: rarity.tag
          },
          {
            trait_type: "Max Supply",
            value: tokenData.maxSupply
          },
          {
            trait_type: "Total Minted",
            value: totalMinted
          },
          {
            trait_type: "Floppy",
            value: tokenData.floppy || "Serum"
          }
        ].concat(tokenData.successRatio ? [{
          trait_type: "Success Ratio",
          value: `${tokenData.successRatio}%`
        }] : []),
        properties: {
          files: [
            {
              uri: `${baseUrl}/api/render/floppy/${tokenIdNum}.png`,
              type: "image/gif"
            }
          ],
          category: "image",
          creators: tokenData.masterminds || ["Adrian | HalfxTiger"]
        }
      };

      // ===== GUARDAR EN CACHÉ Y RETORNAR =====
      setCachedFloppyMetadata(tokenIdNum, metadata);
      
      const ttlSeconds = Math.floor(getFloppyMetadataTTL(tokenIdNum) / 1000);
      console.log(`[floppy-metadata] ✅ Metadata cacheada por ${ttlSeconds}s (${Math.floor(ttlSeconds/3600)}h) para token ${tokenIdNum}`);

      // Configurar headers
      res.setHeader('X-Cache', 'MISS');
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Cache-Control', `public, max-age=${ttlSeconds}`);
      
      // Devolver metadata
      console.log(`[floppy-metadata] ===== METADATA SERUM GENERADA EXITOSAMENTE =====`);
      res.status(200).json(metadata);

    } else {
      console.log(`[floppy-metadata] Token ${tokenIdNum} - Generando metadata para FLOPPYS (10000+)`);
      
      // Cargar datos de floppy.json
      const floppyPath = path.join(process.cwd(), 'public', 'labmetadata', 'floppy.json');
      let floppyData;
      
      try {
        const floppyBuffer = fs.readFileSync(floppyPath);
        floppyData = JSON.parse(floppyBuffer.toString());
        console.log(`[floppy-metadata] Floppy data cargado, ${floppyData.floppys.length} floppys encontrados`);
      } catch (error) {
        console.error('[floppy-metadata] Error cargando floppy data:', error);
        return res.status(500).json({ error: 'Error cargando datos de floppys' });
      }

      // Buscar el floppy correspondiente al tokenId
      const floppyItem = floppyData.floppys.find(floppy => floppy.tokenId === tokenIdNum);
      
      if (!floppyItem) {
        console.log(`[floppy-metadata] Floppy no encontrado para tokenId ${tokenIdNum}, usando datos genéricos`);
        const tokenData = {
          name: `FLOPPY #${tokenIdNum}`,
          category: "Floppy discs",
          maxSupply: 100
        };
      } else {
        console.log(`[floppy-metadata] Floppy encontrado:`, JSON.stringify(floppyItem, null, 2));
      }

      // Usar los datos del floppy encontrado o datos genéricos
      const tokenData = floppyItem || {
        name: `FLOPPY #${tokenIdNum}`,
        category: "Floppy discs",
        maxSupply: 100
      };

      // Obtener total minted del contrato
      let totalMinted = 0;
      try {
        console.log(`[floppy-metadata] Obteniendo totalMintedPerAsset para floppy ${tokenIdNum}...`);
        const { traitsCore } = await getContracts();
        const mintedAmount = await traitsCore.totalMintedPerAsset(tokenIdNum);
        totalMinted = mintedAmount.toNumber();
        console.log(`[floppy-metadata] Total minted obtenido del contrato: ${totalMinted}`);
      } catch (error) {
        console.error(`[floppy-metadata] Error obteniendo totalMintedPerAsset:`, error.message);
        // Fallback: usar maxSupply como total minted si falla la llamada onchain
        totalMinted = tokenData.maxSupply;
        console.log(`[floppy-metadata] Usando fallback: totalMinted = maxSupply = ${totalMinted}`);
      }

      // Función para obtener tag y color según maxSupply (niveles actualizados)
      function getRarityTagAndColor(maxSupply) {
        if (maxSupply === 1) return { tag: 'UNIQUE', bg: '#ff0000' };        // Rojo
        if (maxSupply <= 6) return { tag: 'LEGENDARY', bg: '#ffd700' };      // Dorado
        if (maxSupply <= 14) return { tag: 'RARE', bg: '#da70d6' };          // Púrpura
        if (maxSupply <= 40) return { tag: 'UNCOMMON', bg: '#5dade2' };      // Azul
        return { tag: 'COMMON', bg: '#a9a9a9' };                             // Gris
      }

      const rarity = getRarityTagAndColor(tokenData.maxSupply);
      console.log(`[floppy-metadata] Rarity calculada:`, rarity);

      // Generar metadata para floppys
      const metadata = {
        name: tokenData.name,
        description: tokenData.description || "BE REAL | BE ADRIAN | AdrianLAB by HalfxTiger",
        image: `${baseUrl}/api/render/floppy/${tokenIdNum}.png`,
        external_url: tokenData.external_url || "https://adrianpunks.com/",
        attributes: [
          {
            trait_type: "Category",
            value: tokenData.category
          },
          {
            trait_type: "Rarity",
            value: rarity.tag
          },
          {
            trait_type: "Max Supply",
            value: tokenData.maxSupply
          },
          {
            trait_type: "Total Minted",
            value: totalMinted
          },
          {
            trait_type: "Floppy",
            value: tokenData.floppy || "OG"
          },
          {
            trait_type: "Traits Inside",
            value: tokenData.traitsInside || "Random"
          }
        ],
        properties: {
          files: [
            {
              uri: `${baseUrl}/api/render/floppy/${tokenIdNum}.png`,
              type: "image/png"
            }
          ],
          category: "image",
          creators: tokenData.masterminds || ["Adrian | HalfxTiger"]
        }
      };

      // ===== GUARDAR EN CACHÉ Y RETORNAR =====
      setCachedFloppyMetadata(tokenIdNum, metadata);
      
      const ttlSeconds = Math.floor(getFloppyMetadataTTL(tokenIdNum) / 1000);
      console.log(`[floppy-metadata] ✅ Metadata cacheada por ${ttlSeconds}s (${Math.floor(ttlSeconds/3600)}h) para token ${tokenIdNum}`);

      // Configurar headers
      res.setHeader('X-Cache', 'MISS');
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Cache-Control', `public, max-age=${ttlSeconds}`);
      
      // Devolver metadata
      console.log(`[floppy-metadata] ===== METADATA FLOPPY GENERADA EXITOSAMENTE =====`);
      res.status(200).json(metadata);
    }

  } catch (error) {
    console.error('[floppy-metadata] Error:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
} 