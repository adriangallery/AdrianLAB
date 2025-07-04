import path from 'path';
import fs from 'fs';

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
    const version = Date.now();

    console.log(`[floppy-metadata] ===== METADATA REQUEST =====`);
    console.log(`[floppy-metadata] Token ID: ${tokenIdNum}`);

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

      // Función para obtener tag y color según maxSupply (niveles actualizados)
      function getRarityTagAndColor(maxSupply) {
        if (maxSupply <= 30) return { tag: 'LEGENDARY', bg: '#ffd700' };
        if (maxSupply <= 100) return { tag: 'RARE', bg: '#da70d6' };
        if (maxSupply <= 300) return { tag: 'UNCOMMON', bg: '#5dade2' };
        return { tag: 'COMMON', bg: '#a9a9a9' };
      }

      const rarity = getRarityTagAndColor(tokenData.maxSupply);

      // Metadata para tokens del 1 al 9999 (traits con renderizado dinámico)
    const metadata = {
        name: tokenData.name,
        description: `A ${tokenData.category.toLowerCase()} trait from AdrianLAB collection`,
        image: `${baseUrl}/api/render/floppy/${actualId}.png?v=${version}`,
        external_url: `${baseUrl}/api/render/floppy/${actualId}.png?v=${version}`,
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
            value: tokenData.floppy || "OG"
        },
        {
          trait_type: "Rarity",
            value: rarity.tag
        }
      ]
    };

      console.log(`[floppy-metadata] Metadata generada para trait ${tokenIdNum}:`, metadata);

    // Configurar headers para evitar cache
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.setHeader('Surrogate-Control', 'no-store');
    
    return res.status(200).json(metadata);
      
    } else if (tokenIdNum >= 10000 && tokenIdNum <= 15000) {
      console.log(`[floppy-metadata] Token ${tokenIdNum} - Generando metadata para FLOPPY DISCS (10000+)`);
      
      // Cargar datos de labmetadata
      const labmetadataPath = path.join(process.cwd(), 'public', 'labmetadata', 'traits.json');
      let labmetadata;
      
      try {
        const labmetadataBuffer = fs.readFileSync(labmetadataPath);
        labmetadata = JSON.parse(labmetadataBuffer.toString());
        console.log(`[floppy-metadata] Labmetadata cargado para token ${tokenIdNum}, ${labmetadata.traits.length} traits encontrados`);
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
          name: `ANIMATED TRAIT #${tokenIdNum}`,
          description: `Un trait animado especial del token ${tokenIdNum}`,
          category: "SPECIAL",
          maxSupply: 200,
          floppy: "OG",
          external_url: "https://adrianpunks.com/"
        };
      } else {
        console.log(`[floppy-metadata] Trait encontrado:`, JSON.stringify(traitData, null, 2));
      }

      // Usar los datos del trait encontrado o datos genéricos
      const tokenData = traitData || {
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

      // Función para obtener tag y color según maxSupply (niveles actualizados)
      function getRarityTagAndColor(maxSupply) {
        if (maxSupply <= 30) return { tag: 'LEGENDARY', bg: '#ffd700' };
        if (maxSupply <= 100) return { tag: 'RARE', bg: '#da70d6' };
        if (maxSupply <= 300) return { tag: 'UNCOMMON', bg: '#5dade2' };
        return { tag: 'COMMON', bg: '#a9a9a9' };
      }

      const rarity = getRarityTagAndColor(tokenData.maxSupply);
      
      // Construir JSON de metadata usando solo datos del traits.json
      const metadata = {
        name: tokenData.name,
        description: tokenData.description,
        image: gifExists ? `${baseUrl}/labimages/${tokenIdNum}.gif?v=${version}` : null,
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
            trait_type: "Rarity",
            value: rarity.tag
          }
        ],
        properties: {
          files: [
            {
              uri: gifExists ? `${baseUrl}/labimages/${tokenIdNum}.gif?v=${version}` : null,
              type: "image/gif"
            }
          ],
          category: "image"
        }
      };

      console.log(`[floppy-metadata] Metadata generada para floppy disc ${tokenIdNum}:`, metadata);

      // Configurar headers para JSON
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Cache-Control', 'public, max-age=3600');
      
      return res.status(200).json(metadata);
      
    } else {
      return res.status(400).json({ error: 'Token ID fuera de rango válido (1-9999 para traits, 10000-15000 para floppy discs)' });
    }
    
  } catch (error) {
    console.error('[floppy-metadata] Error:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
} 