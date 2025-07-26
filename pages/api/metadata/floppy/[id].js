import path from 'path';
import fs from 'fs';
import { getContracts } from '../../../../lib/contracts.js';
import { 
  getCachedFloppyMetadata, 
  setCachedFloppyMetadata, 
  getFloppyMetadataTTL 
} from '../../../../lib/cache.js';

export default async function handler(req, res) {
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

      // Metadata para tokens del 1 al 9999 (traits con renderizado dinámico)
    const metadata = {
        name: tokenData.name,
        description: tokenData.description || `A ${tokenData.category.toLowerCase()} trait from AdrianLAB collection`,
        image: `${baseUrl}/api/render/floppy/${actualId}.png?v=${version}`,
        external_url: tokenData.external_url || `${baseUrl}/api/render/floppy/${actualId}.png?v=${version}`,
      attributes: [
        {
            trait_type: "Category",
            value: tokenData.category
          },
          {
            trait_type: "TOTAL MINTED",
            value: totalMinted
          },
          {
            trait_type: "Floppy",
            value: tokenData.floppy || "OG"
        },
        {
          trait_type: "Rarity",
            value: rarity.tag
        }
      ]
    };

      console.log(`[floppy-metadata] Metadata generada para trait ${tokenIdNum}:`, metadata);

      // ===== GUARDAR EN CACHÉ Y RETORNAR =====
      setCachedFloppyMetadata(tokenIdNum, metadata);
      
      const ttlSeconds = Math.floor(getFloppyMetadataTTL(tokenIdNum) / 1000);
      console.log(`[floppy-metadata] ✅ Metadata cacheada por ${ttlSeconds}s (${Math.floor(ttlSeconds/3600)}h) para token ${tokenIdNum}`);
      
      // Configurar headers
      res.setHeader('X-Cache', 'MISS');
      res.setHeader('Cache-Control', `public, max-age=${ttlSeconds}`);
      res.setHeader('Content-Type', 'application/json');
      
      return res.status(200).json(metadata);
      
    } else if (tokenIdNum >= 10000 && tokenIdNum <= 15500) {
      console.log(`[floppy-metadata] Token ${tokenIdNum} - Generando metadata para FLOPPY DISCS/PAGERS (10000+)`);
      
      // Determinar qué archivo cargar según el rango del token
      let metadataPath;
      let dataKey;
      
      if (tokenIdNum >= 10000 && tokenIdNum <= 10004) {
        // Floppy discs (10000-10004) - Incluir 10004
        metadataPath = path.join(process.cwd(), 'public', 'labmetadata', 'floppy.json');
        dataKey = 'floppys';
        console.log(`[floppy-metadata] Cargando desde floppy.json para token ${tokenIdNum}`);
      } else if (tokenIdNum >= 15000 && tokenIdNum <= 15007) {
        // Pagers (15000-15007)
        metadataPath = path.join(process.cwd(), 'public', 'labmetadata', 'pagers.json');
        dataKey = 'pagers';
        console.log(`[floppy-metadata] Cargando desde pagers.json para token ${tokenIdNum}`);
      } else {
        // Fallback a traits.json para otros rangos
        metadataPath = path.join(process.cwd(), 'public', 'labmetadata', 'traits.json');
        dataKey = 'traits';
        console.log(`[floppy-metadata] Cargando desde traits.json para token ${tokenIdNum}`);
      }
      
      let metadataFile;
      
      try {
        const metadataBuffer = fs.readFileSync(metadataPath);
        metadataFile = JSON.parse(metadataBuffer.toString());
        console.log(`[floppy-metadata] Metadata cargado para token ${tokenIdNum}, ${metadataFile[dataKey].length} items encontrados`);
      } catch (error) {
        console.error('[floppy-metadata] Error cargando metadata:', error);
        return res.status(500).json({ error: 'Error cargando datos de metadata' });
      }

      // Buscar el item correspondiente al tokenId
      const itemData = metadataFile[dataKey].find(item => item.tokenId === tokenIdNum);
      
      if (!itemData) {
        console.log(`[floppy-metadata] Item no encontrado para tokenId ${tokenIdNum}, usando datos genéricos`);
        // Datos genéricos si no se encuentra el item
        const tokenData = {
          name: `ANIMATED TRAIT #${tokenIdNum}`,
          description: `Un trait animado especial del token ${tokenIdNum}`,
          category: "SPECIAL",
          maxSupply: 200,
          floppy: "OG",
          external_url: "https://adrianpunks.com/"
        };
      } else {
        console.log(`[floppy-metadata] Item encontrado:`, JSON.stringify(itemData, null, 2));
      }

      // Usar los datos del item encontrado o datos genéricos
      const tokenData = itemData || {
        name: `ANIMATED TRAIT #${tokenIdNum}`,
        description: `Un trait animado especial del token ${tokenIdNum}`,
        category: "SPECIAL",
        maxSupply: 200,
        floppy: "OG",
        external_url: "https://adrianpunks.com/"
      };

      // Verificar si existe el GIF correspondiente
      const gifPath = path.join(process.cwd(), 'public', 'labimages', `${tokenIdNum}.gif`);
      const gifExists = fs.existsSync(gifPath);
      console.log(`[floppy-metadata] GIF existe: ${gifExists}, ruta: ${gifPath}`);

      // Verificar si existe el PNG correspondiente (para Action Packs)
      const pngPath = path.join(process.cwd(), 'public', 'labimages', `${tokenIdNum}.png`);
      const pngExists = fs.existsSync(pngPath);
      console.log(`[floppy-metadata] PNG existe: ${pngExists}, ruta: ${pngPath}`);

      // Determinar el tipo de imagen según la categoría
      let imageUrl = null;
      let imageType = null;
      
      if (tokenData.category === "Action Packs" && pngExists) {
        imageUrl = `${baseUrl}/labimages/${tokenIdNum}.png?v=${version}`;
        imageType = "image/png";
        console.log(`[floppy-metadata] Usando PNG para Action Pack ${tokenIdNum}`);
      } else if (gifExists) {
        imageUrl = `${baseUrl}/labimages/${tokenIdNum}.gif?v=${version}`;
        imageType = "image/gif";
        console.log(`[floppy-metadata] Usando GIF para ${tokenData.category} ${tokenIdNum}`);
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
      
      // Construir JSON de metadata usando solo datos del traits.json
      const metadata = {
        name: tokenData.name,
        description: tokenData.description,
        image: imageUrl,
        external_url: tokenData.external_url,
        attributes: [
          {
            trait_type: "Category",
            value: tokenData.category
          },
          {
            trait_type: "Max Supply",
            value: tokenData.maxSupply
          },
          {
            trait_type: "Floppy",
            value: tokenData.floppy
          },
          {
            trait_type: "Traits Inside",
            value: tokenData.traitsInside || 0
          },
          {
            trait_type: "Rarity",
            value: rarity.tag
          }
        ],
        properties: {
          files: [
            {
              uri: imageUrl,
              type: imageType
            }
          ],
          category: "image"
        }
      };

      console.log(`[floppy-metadata] Metadata generada para floppy disc ${tokenIdNum}:`, metadata);

      // ===== GUARDAR EN CACHÉ Y RETORNAR =====
      setCachedFloppyMetadata(tokenIdNum, metadata);
      
      const ttlSeconds = Math.floor(getFloppyMetadataTTL(tokenIdNum) / 1000);
      console.log(`[floppy-metadata] ✅ Metadata cacheada por ${ttlSeconds}s (${Math.floor(ttlSeconds/3600)}h) para token ${tokenIdNum}`);
      
      // Configurar headers
      res.setHeader('X-Cache', 'MISS');
      res.setHeader('Cache-Control', `public, max-age=${ttlSeconds}`);
      res.setHeader('Content-Type', 'application/json');
      
      return res.status(200).json(metadata);
      
    } else if (tokenIdNum === 262144) {
      console.log(`[floppy-metadata] Token ${tokenIdNum} - Generando metadata para SERUM ADRIANGF`);
      
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
        console.log(`[floppy-metadata] Serum no encontrado para tokenId ${tokenIdNum}`);
        return res.status(404).json({ error: 'Serum no encontrado' });
      }

      console.log(`[floppy-metadata] Serum encontrado:`, JSON.stringify(serumData, null, 2));

      // Función para obtener tag y color según maxSupply
      function getRarityTagAndColor(maxSupply) {
        if (maxSupply === 1) return { tag: 'UNIQUE', bg: '#ff0000' };        // Rojo
        if (maxSupply <= 6) return { tag: 'LEGENDARY', bg: '#ffd700' };      // Dorado
        if (maxSupply <= 14) return { tag: 'RARE', bg: '#da70d6' };          // Púrpura
        if (maxSupply <= 40) return { tag: 'UNCOMMON', bg: '#5dade2' };      // Azul
        return { tag: 'COMMON', bg: '#a9a9a9' };                             // Gris
      }

      const rarity = getRarityTagAndColor(serumData.maxSupply);

      // Metadata para serum ADRIANGF
      const metadata = {
        name: serumData.name,
        description: serumData.description,
        image: `${baseUrl}/labimages/${actualId}.gif?v=${version}`,
        external_url: serumData.external_url,
        attributes: [
          {
            trait_type: "Category",
            value: serumData.category
          },
          {
            trait_type: "Max Supply",
            value: serumData.maxSupply
          },
          {
            trait_type: "Floppy",
            value: serumData.floppy
          },
          {
            trait_type: "Rarity",
            value: rarity.tag
          }
        ]
      };

      console.log(`[floppy-metadata] Metadata generada para serum ${tokenIdNum}:`, metadata);

      // ===== GUARDAR EN CACHÉ Y RETORNAR =====
      setCachedFloppyMetadata(tokenIdNum, metadata);
      
      const ttlSeconds = Math.floor(getFloppyMetadataTTL(tokenIdNum) / 1000);
      console.log(`[floppy-metadata] ✅ Metadata cacheada por ${ttlSeconds}s (${Math.floor(ttlSeconds/3600)}h) para token ${tokenIdNum}`);
      
      // Configurar headers
      res.setHeader('X-Cache', 'MISS');
      res.setHeader('Cache-Control', `public, max-age=${ttlSeconds}`);
      res.setHeader('Content-Type', 'application/json');
      
      return res.status(200).json(metadata);
      
    } else {
      return res.status(400).json({ error: 'Token ID fuera de rango válido (1-9999 para traits, 10000-15500 para floppy discs, 262144 para serums)' });
    }
    
  } catch (error) {
    console.error('[floppy-metadata] Error:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
} 