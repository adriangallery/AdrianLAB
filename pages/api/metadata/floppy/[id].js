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

    // ===== LÓGICA ESPECIAL: TOKEN 15014 (McORDER DASH) - ANTES DEL CACHÉ =====
    // Este token tiene metadata especial y debe procesarse antes del caché para evitar
    // que se devuelva metadata genérica cacheada
    if (tokenIdNum === 15014) {
      console.log(`[floppy-metadata] Token ${tokenIdNum} - Generando metadata para McORDER DASH (bypassing cache)`);
      
      const version = Date.now();
      const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://adrianlab.vercel.app';
      const imageUrl = `${baseUrl}/labimages/15014.png?v=${version}`;
      
      const specialMetadata = {
        name: "McORDER DASH",
        description: "An interactive minigame NFT from AdrianLAB. Play McORDER DASH and experience the AdrianZero universe through this unique interactive experience. BE REAL | BE ADRIAN | AdrianLAB by HalfxTiger",
        image: imageUrl,
        external_url: imageUrl,
        animation_url: "https://adrianzero.com/mcinteractive/",
        attributes: [
          {
            trait_type: "Type",
            value: "Interactive Minigame"
          },
          {
            trait_type: "Collection",
            value: "AdrianLAB"
          },
          {
            trait_type: "Interactive",
            value: "Yes"
          }
        ],
        properties: {
          files: [
            {
              uri: imageUrl,
              type: "image/png"
            }
          ],
          category: "image",
          creators: ["Adrian | HalfxTiger"]
        }
      };

      // Cache y headers
      setCachedFloppyMetadata(tokenIdNum, specialMetadata);
      const ttlSeconds = Math.floor(getFloppyMetadataTTL(tokenIdNum) / 1000);
      res.setHeader('X-Cache', 'MISS');
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Cache-Control', `public, max-age=${ttlSeconds}`);
      
      console.log(`[floppy-metadata] ===== METADATA MORDER DASH GENERADA EXITOSAMENTE =====`);
      return res.status(200).json(specialMetadata);
    }

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

    // Obtener URL base
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://adrianlab.vercel.app';

    // DETERMINAR TIPO DE TOKEN
    // LÓGICA ESPECIAL: 1123 es un pack, debe tratarse como floppy
    if ((tokenIdNum >= 1 && tokenIdNum <= 9999) && tokenIdNum !== 1123) {
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

      // Detectar si el trait es animado
      const isAnimated = tokenData.Type === 'Animated';
      const imageExtension = isAnimated ? '.gif' : '.png';
      const imageType = isAnimated ? 'image/gif' : 'image/png';
      
      if (isAnimated) {
        console.log(`[floppy-metadata] 🎬 Trait animado detectado: ${tokenIdNum}, usando .gif`);
      }

      // Generar metadata para traits
      const metadata = {
        name: tokenData.name,
        description: tokenData.description || "BE REAL | BE ADRIAN | AdrianLAB by HalfxTiger",
        image: `${baseUrl}/api/render/floppy/${tokenIdNum}${imageExtension}`,
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
        ].concat(isAnimated ? [{
          trait_type: "Type",
          value: "Animated"
        }] : []),
        properties: {
          files: [
            {
              uri: `${baseUrl}/api/render/floppy/${tokenIdNum}${imageExtension}`,
              type: imageType
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
        image: `${baseUrl}/api/render/floppy/${tokenIdNum}.gif`,
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
              uri: `${baseUrl}/api/render/floppy/${tokenIdNum}.gif`,
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

    // ===== NUEVA RAMA: ACTION PACKS (15008-15010) =====
    } else if (tokenIdNum >= 15008 && tokenIdNum <= 15010) {
      console.log(`[floppy-metadata] Token ${tokenIdNum} - Generando metadata para ACTION PACK`);

      try {
        const packsPath = path.join(process.cwd(), 'public', 'labmetadata', 'ActionPacks.json');
        const packsRaw = fs.readFileSync(packsPath, 'utf8');
        const packsData = JSON.parse(packsRaw);
        const pack = (packsData.packs || []).find(p => parseInt(p.packId) === tokenIdNum);

        if (!pack) {
          console.error(`[floppy-metadata] Action Pack ${tokenIdNum} no encontrado en ActionPacks.json`);
          return res.status(404).json({ error: 'Action Pack not found' });
        }

        // Resolver imagen por ID con fallbacks usando HEAD HTTP
        const headOk = async (url) => {
          try {
            const r = await fetch(url, { method: 'HEAD' });
            return r.ok;
          } catch (_) {
            return false;
          }
        };

        let candidates = [`${tokenIdNum}.png`];
        if (tokenIdNum === 15008) {
          candidates = [`${tokenIdNum}.png`, 'ozzy.png'];
        } else if (tokenIdNum === 15009) {
          candidates = ['15009.png', 'hulk.png'];
        } else if (tokenIdNum === 15010) {
          candidates = ['15010.png'];
        }

        let selected = `${tokenIdNum}.png`;
        for (const fname of candidates) {
          const url = `${baseUrl}/labimages/${fname}`;
          // eslint-disable-next-line no-await-in-loop
          if (await headOk(url)) { selected = fname; break; }
        }

        const imageUrl = `${baseUrl}/labimages/${selected}?v=${version}`;

        const metadata = {
          name: `${pack.name}`,
          description: pack.description || 'AdrianLAB Action Pack',
          image: imageUrl,
          external_url: imageUrl,
          attributes: [
            { trait_type: 'Category', value: 'Action Pack' },
            { trait_type: 'PackId', value: tokenIdNum },
            { trait_type: 'TraitsCount', value: (pack.traits ? pack.traits.length : 0) },
            { trait_type: 'Traits', value: (pack.traits && pack.traits.length > 0) ? pack.traits.join(',') : 'None' }
          ],
          properties: {
            files: [
              { uri: imageUrl, type: 'image/png' }
            ],
            category: 'image',
            creators: ['Adrian | HalfxTiger']
          },
          debug: {
            source: 'ActionPacks.json',
            pack
          }
        };

        // Cache y headers
        setCachedFloppyMetadata(tokenIdNum, metadata);
        const ttlSeconds = Math.floor(getFloppyMetadataTTL(tokenIdNum) / 1000);
        res.setHeader('X-Cache', 'MISS');
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Cache-Control', `public, max-age=${ttlSeconds}`);

        console.log(`[floppy-metadata] ===== METADATA ACTION PACK GENERADA EXITOSAMENTE =====`);
        return res.status(200).json(metadata);
      } catch (err) {
        console.error('[floppy-metadata] Error sirviendo Action Pack:', err.message);
        return res.status(500).json({ error: 'Error loading Action Pack metadata' });
      }

    } else if (tokenIdNum >= 15000 && tokenIdNum <= 15013) {
      console.log(`[floppy-metadata] Token ${tokenIdNum} - Generando metadata para PAGERS (15000-15013)`);

      try {
        const pagersPath = path.join(process.cwd(), 'public', 'labmetadata', 'pagers.json');
        const pagersRaw = fs.readFileSync(pagersPath, 'utf8');
        const pagersData = JSON.parse(pagersRaw);
        const pager = (pagersData.pagers || []).find(p => parseInt(p.tokenId) === tokenIdNum);

        if (!pager) {
          console.error(`[floppy-metadata] Pager ${tokenIdNum} no encontrado en pagers.json`);
        }

        // totalMinted desde contrato
        let totalMinted = 0;
        try {
          console.log(`[floppy-metadata] Obteniendo totalMintedPerAsset para pager ${tokenIdNum}...`);
          const { traitsCore } = await getContracts();
          const mintedAmount = await traitsCore.totalMintedPerAsset(tokenIdNum);
          totalMinted = mintedAmount.toNumber();
          console.log(`[floppy-metadata] Total minted obtenido del contrato: ${totalMinted}`);
        } catch (error) {
          console.error(`[floppy-metadata] Error obteniendo totalMintedPerAsset (pagers):`, error.message);
          totalMinted = pager?.maxSupply || 1;
        }

        function getRarityTagAndColor(maxSupply) {
          if (maxSupply === 1) return { tag: 'UNIQUE', bg: '#ff0000' };
          if (maxSupply <= 6) return { tag: 'LEGENDARY', bg: '#ffd700' };
          if (maxSupply <= 14) return { tag: 'RARE', bg: '#da70d6' };
          if (maxSupply <= 40) return { tag: 'UNCOMMON', bg: '#5dade2' };
          return { tag: 'COMMON', bg: '#a9a9a9' };
        }
        const rarity = getRarityTagAndColor(pager?.maxSupply || 1);

        // Resolver imagen por ID priorizando archivo local (fs) y luego HEAD
        const localGifPath = path.join(process.cwd(), 'public', 'labimages', `${tokenIdNum}.gif`);
        const localPngPath = path.join(process.cwd(), 'public', 'labimages', `${tokenIdNum}.png`);

        let selected = null;
        if (fs.existsSync(localGifPath)) {
          selected = `${tokenIdNum}.gif`;
        } else if (fs.existsSync(localPngPath)) {
          selected = `${tokenIdNum}.png`;
        } else {
          const headOk = async (url) => {
            try {
              const r = await fetch(url, { method: 'HEAD' });
              return r.ok;
            } catch (_) {
              return false;
            }
          };
          const candidates = [`${tokenIdNum}.gif`, `${tokenIdNum}.png`];
          for (const fname of candidates) {
            const url = `${baseUrl}/labimages/${fname}`;
            // eslint-disable-next-line no-await-in-loop
            if (await headOk(url)) { selected = fname; break; }
          }
        }

        // Fallback a PNG render si no existe archivo estático
        const imageUrl = selected
          ? `${baseUrl}/labimages/${selected}?v=${version}`
          : `${baseUrl}/api/render/floppy/${tokenIdNum}.png`;

        const metadata = {
          name: pager?.name || `PAGER #${tokenIdNum}`,
          description: pager?.description || 'BE REAL | BE ADRIAN | AdrianLAB by HalfxTiger',
          image: imageUrl,
          external_url: pager?.external_url || 'https://adrianpunks.com/',
          attributes: [
            { trait_type: 'Category', value: pager?.category || 'Pagers' },
            { trait_type: 'Rarity', value: rarity.tag },
            { trait_type: 'Max Supply', value: pager?.maxSupply || 1 },
            { trait_type: 'Total Minted', value: totalMinted },
            { trait_type: 'Traits Inside', value: pager?.traitsInside || 'IDK' }
          ],
          properties: {
            files: [
              { uri: imageUrl, type: selected && selected.endsWith('.gif') ? 'image/gif' : 'image/png' }
            ],
            category: 'image',
            creators: pager?.masterminds || ['Adrian | HalfxTiger']
          }
        };

        setCachedFloppyMetadata(tokenIdNum, metadata);
        const ttlSeconds = Math.floor(getFloppyMetadataTTL(tokenIdNum) / 1000);
        res.setHeader('X-Cache', 'MISS');
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Cache-Control', `public, max-age=${ttlSeconds}`);
        console.log(`[floppy-metadata] ===== METADATA PAGERS GENERADA EXITOSAMENTE =====`);
        return res.status(200).json(metadata);
      } catch (err) {
        console.error('[floppy-metadata] Error sirviendo Pagers:', err.message);
        return res.status(500).json({ error: 'Error loading Pagers metadata' });
      }

    } else if ((tokenIdNum >= 100001 && tokenIdNum <= 101003) || (tokenIdNum >= 101001 && tokenIdNum <= 101003)) {
      console.log(`[floppy-metadata] Token ${tokenIdNum} - Generando metadata para OGPUNKS (100001-101003)`);
      try {
        const ogpunksPath = path.join(process.cwd(), 'public', 'labmetadata', 'ogpunks.json');
        const ogpunksRaw = fs.readFileSync(ogpunksPath, 'utf8');
        const ogpunksData = JSON.parse(ogpunksRaw);
        const trait = (ogpunksData.traits || []).find(t => parseInt(t.tokenId) === tokenIdNum);
        if (!trait) {
          return res.status(404).json({ error: 'OGPUNK trait not found' });
        }

        // totalMinted desde contrato
        let totalMinted = 0;
        try {
          console.log(`[floppy-metadata] Obteniendo totalMintedPerAsset para ogpunk ${tokenIdNum}...`);
          const { traitsCore } = await getContracts();
          const mintedAmount = await traitsCore.totalMintedPerAsset(tokenIdNum);
          totalMinted = mintedAmount.toNumber();
          console.log(`[floppy-metadata] Total minted obtenido del contrato: ${totalMinted}`);
        } catch (error) {
          console.error(`[floppy-metadata] Error obteniendo totalMintedPerAsset (ogpunks):`, error.message);
          totalMinted = trait.maxSupply || 1;
        }

        function getRarityTagAndColor(maxSupply) {
          if (maxSupply === 1) return { tag: 'UNIQUE', bg: '#ff0000' };
          if (maxSupply <= 6) return { tag: 'LEGENDARY', bg: '#ffd700' };
          if (maxSupply <= 14) return { tag: 'RARE', bg: '#da70d6' };
          if (maxSupply <= 40) return { tag: 'UNCOMMON', bg: '#5dade2' };
          return { tag: 'COMMON', bg: '#a9a9a9' };
        }
        const rarity = getRarityTagAndColor(trait.maxSupply || 1);

        const metadata = {
          name: trait.name,
          description: trait.description || 'BE REAL | BE ADRIAN | AdrianLAB by HalfxTiger',
          image: `${baseUrl}/api/render/floppy/${tokenIdNum}.png`,
          external_url: trait.external_url || 'https://adrianpunks.com/',
          attributes: [
            { trait_type: 'Category', value: trait.category || 'TOP' },
            { trait_type: 'Rarity', value: rarity.tag },
            { trait_type: 'Max Supply', value: trait.maxSupply || 1 },
            { trait_type: 'Total Minted', value: totalMinted },
            { trait_type: 'Floppy', value: 'OG' }
          ],
          properties: {
            files: [
              { uri: `${baseUrl}/api/render/floppy/${tokenIdNum}.png`, type: 'image/png' }
            ],
            category: 'image',
            creators: trait.masterminds || ['Adrian | HalfxTiger']
          }
        };

        setCachedFloppyMetadata(tokenIdNum, metadata);
        const ttlSeconds = Math.floor(getFloppyMetadataTTL(tokenIdNum) / 1000);
        res.setHeader('X-Cache', 'MISS');
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Cache-Control', `public, max-age=${ttlSeconds}`);
        console.log(`[floppy-metadata] ===== METADATA OGPUNKS GENERADA EXITOSAMENTE =====`);
        return res.status(200).json(metadata);
      } catch (err) {
        console.error('[floppy-metadata] Error sirviendo OGPUNKS:', err.message);
        return res.status(500).json({ error: 'Error loading OGPUNKS metadata' });
      }

    } else if (tokenIdNum === 1123 || tokenIdNum >= 10000) {
      console.log(`[floppy-metadata] Token ${tokenIdNum} - Generando metadata para FLOPPYS/PACKS (1123 o 10000+)`);
      
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
      // ESTRATEGIA: Buscar .gif primero, si no existe, usar .png como fallback
      console.log(`[floppy-metadata] 🔍 DEBUG: Generando metadata para floppy ${tokenIdNum}`);
      
      // Determinar extensión del archivo con fallback inteligente
      let fileExtension = 'gif';
      let fileType = 'image/gif';
      
      // Para floppys 10000-10100, usar lógica de fallback inteligente
      if (tokenIdNum >= 10000 && tokenIdNum <= 10100) {
        try {
          // PASO 1: Intentar verificar si existe .gif
          const gifUrl = `${baseUrl}/labimages/${tokenIdNum}.gif`;
          console.log(`[floppy-metadata] 🔍 PASO 1: Verificando existencia de GIF: ${gifUrl}`);
          
          const gifResp = await fetch(gifUrl, { method: 'HEAD' }); // Solo verificar headers
          if (gifResp.ok) {
            fileExtension = 'gif';
            fileType = 'image/gif';
            console.log(`[floppy-metadata] ✅ GIF encontrado, usando .gif`);
          } else {
            // PASO 2: Si .gif no existe, verificar .png
            const pngUrl = `${baseUrl}/labimages/${tokenIdNum}.png`;
            console.log(`[floppy-metadata] 🔍 PASO 2: GIF no encontrado, verificando PNG: ${pngUrl}`);
            
            const pngResp = await fetch(pngUrl, { method: 'HEAD' });
            if (pngResp.ok) {
              fileExtension = 'png';
              fileType = 'image/png';
              console.log(`[floppy-metadata] ✅ PNG encontrado como fallback, usando .png`);
            } else {
              // Si ninguno existe, usar .gif por defecto (comportamiento original)
              console.log(`[floppy-metadata] ⚠️ Ni GIF ni PNG encontrados, usando .gif por defecto`);
            }
          }
        } catch (error) {
          console.log(`[floppy-metadata] ⚠️ Error verificando archivos, usando .gif por defecto:`, error.message);
        }
      } else {
        console.log(`[floppy-metadata] 🔍 DEBUG: Floppy ${tokenIdNum} fuera del rango 10000-10100, usando .gif por defecto`);
      }
      
      // Añadir vtimestamp para forzar recacheo en OpenSea
      // Cache reset: 2025-12-31
      const version = Date.now();
      
      const metadata = {
        name: tokenData.name,
        description: tokenData.description || "BE REAL | BE ADRIAN | AdrianLAB by HalfxTiger",
        image: `${baseUrl}/api/render/floppy/${tokenIdNum}.${fileExtension}?v=${version}`,
        external_url: tokenData.external_url || "https://adrianzero.com/",
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
              uri: `${baseUrl}/api/render/floppy/${tokenIdNum}.${fileExtension}?v=${version}`,
              type: fileType
            }
          ],
          category: "image",
          creators: tokenData.masterminds || ["Adrian | HalfxTiger"]
        }
      };

      // Log de debug para verificar la URL generada
      console.log(`[floppy-metadata] 🔍 DEBUG: URL de imagen generada: ${metadata.image}`);
      console.log(`[floppy-metadata] 🔍 DEBUG: URI de archivo generado: ${metadata.properties.files[0].uri}`);
      console.log(`[floppy-metadata] 🔍 DEBUG: Tipo de archivo: ${metadata.properties.files[0].type}`);

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