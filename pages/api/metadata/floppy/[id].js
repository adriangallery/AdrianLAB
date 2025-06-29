import fs from 'fs';
import path from 'path';

export default async function handler(req, res) {
  try {
    let { id } = req.query;
    console.log(`[floppy-metadata] Iniciando request para floppy ${id}`);
    
    // Manejar formato ERC1155 - convertir hex de 64 caracteres a decimal
    let actualId = id;
    
    // Si el ID termina en .json, removerlo
    if (id && id.endsWith('.json')) {
      id = id.replace('.json', '');
    }
    
    // Si el ID es un hex de 64 caracteres (patrón ERC1155)
    if (id && id.length === 64 && /^[0-9a-f]+$/i.test(id)) {
      // Convertir de hex a decimal
      actualId = parseInt(id, 16).toString();
      console.log(`[floppy-metadata] Convertido hex ${id} a decimal ${actualId}`);
    } else {
      actualId = id;
    }
    
    // Verificar que el actualId es válido
    if (!actualId || isNaN(parseInt(actualId)) || parseInt(actualId) < 1 || parseInt(actualId) > 15000) {
      console.error(`[floppy-metadata] ID inválido: ${actualId} (original: ${req.query.id})`);
      return res.status(400).json({ error: 'Invalid floppy ID (1-15000)' });
    }

    const tokenIdNum = parseInt(actualId);
    const baseUrl = 'https://adrianlab.vercel.app';
    const version = Date.now();

    console.log(`[floppy-metadata] Procesando token ${tokenIdNum}`);

    // DETERMINAR TIPO DE TOKEN
    if (tokenIdNum >= 1 && tokenIdNum <= 9999) {
      console.log(`[floppy-metadata] Token ${tokenIdNum} - Generando metadata para renderizado`);
      
      // Datos mockup para el test
      const mockData = {
        "1": {
          "name": "BLUNT",
          "trait": "UNISEX",
          "series": "1",
          "category": "MOUTH",
          "required": "NONE",
          "origin": "UNIVERSAL",
          "maxSupply": 450
        },
        "2": {
          "name": "CRAZY HAIR GREEN",
          "trait": "FEMALE",
          "series": "1",
          "category": "HAIR",
          "required": "HEAD",
          "origin": "GENESIS",
          "maxSupply": 85
        }
      };

      // Obtener datos del token (usar mockup por ahora)
      const tokenData = mockData[actualId] || {
        name: `TRAIT #${actualId}`,
        trait: "UNISEX",
        series: "1",
        category: "MOUTH",
        required: "NONE",
        origin: "UNIVERSAL",
        maxSupply: 300
      };

      // Función para obtener tag y color según maxSupply
      function getRarityTagAndColor(maxSupply) {
        if (maxSupply <= 50) return { tag: 'LEGENDARY', bg: '#ffd700' };
        if (maxSupply <= 150) return { tag: 'RARE', bg: '#da70d6' };
        if (maxSupply <= 300) return { tag: 'UNCOMMON', bg: '#5dade2' };
        return { tag: 'COMMON', bg: '#a9a9a9' };
      }

      const rarity = getRarityTagAndColor(tokenData.maxSupply);

      // Metadata para tokens del 1 al 9999 (renderizado dinámico)
      const metadata = {
        name: tokenData.name,
        description: `A ${tokenData.category.toLowerCase()} trait from AdrianLAB collection`,
        image: `${baseUrl}/api/render/floppy/${actualId}.png?v=${version}`,
        external_url: `${baseUrl}/api/render/floppy/${actualId}.png?v=${version}`,
        attributes: [
          {
            trait_type: "Trait",
            value: tokenData.trait
          },
          {
            trait_type: "Series",
            value: tokenData.series
          },
          {
            trait_type: "Category",
            value: tokenData.category
          },
          {
            trait_type: "Required",
            value: tokenData.required
          },
          {
            trait_type: "Origin",
            value: tokenData.origin
          },
          {
            trait_type: "Rarity",
            value: rarity.tag
          },
          {
            trait_type: "Max Supply",
            value: tokenData.maxSupply
          }
        ]
      };

      console.log(`[floppy-metadata] Metadata generada para token ${tokenIdNum}:`, metadata);

      // Configurar headers para evitar cache
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      res.setHeader('Surrogate-Control', 'no-store');
      
      return res.status(200).json(metadata);
      
    } else if (tokenIdNum >= 10000 && tokenIdNum <= 15000) {
      console.log(`[floppy-metadata] Token ${tokenIdNum} - Generando metadata para JSON + GIF`);
      
      // Verificar si existe el GIF correspondiente
      const gifPath = path.join(process.cwd(), 'public', 'labimages', `${tokenIdNum}.gif`);
      const gifExists = fs.existsSync(gifPath);
      console.log(`[floppy-metadata] GIF existe: ${gifExists}, ruta: ${gifPath}`);
      
      // Datos mockup para tokens 10000-15000
      const mockData = {
        "10000": {
          "name": "ANIMATED TRAIT #10000",
          "description": "Un trait animado especial de la serie premium",
          "trait": "ANIMATED",
          "series": "2",
          "category": "SPECIAL",
          "required": "NONE",
          "origin": "PREMIUM",
          "maxSupply": 100,
          "rarity": "LEGENDARY"
        },
        "10001": {
          "name": "FLYING FLOPPY #10001",
          "description": "Un floppy que vuela con animación",
          "trait": "FLYING",
          "series": "2",
          "category": "MOVEMENT",
          "required": "BODY",
          "origin": "PREMIUM",
          "maxSupply": 150,
          "rarity": "RARE"
        }
      };

      const tokenData = mockData[tokenIdNum] || {
        name: `ANIMATED TRAIT #${tokenIdNum}`,
        description: `Un trait animado especial del token ${tokenIdNum}`,
        trait: "ANIMATED",
        series: "2",
        category: "SPECIAL",
        required: "NONE",
        origin: "PREMIUM",
        maxSupply: 200,
        rarity: "UNCOMMON"
      };

      // Función para obtener tag y color según maxSupply
      function getRarityTagAndColor(maxSupply) {
        if (maxSupply <= 50) return { tag: 'LEGENDARY', bg: '#ffd700' };
        if (maxSupply <= 150) return { tag: 'RARE', bg: '#da70d6' };
        if (maxSupply <= 300) return { tag: 'UNCOMMON', bg: '#5dade2' };
        return { tag: 'COMMON', bg: '#a9a9a9' };
      }

      const rarity = getRarityTagAndColor(tokenData.maxSupply);
      
      // Construir JSON de metadata
      const metadata = {
        name: tokenData.name,
        description: tokenData.description,
        image: gifExists ? `${baseUrl}/labimages/${tokenIdNum}.gif` : null,
        external_url: `${baseUrl}/api/metadata/floppy/${tokenIdNum}`,
        attributes: [
          {
            trait_type: "Trait",
            value: tokenData.trait
          },
          {
            trait_type: "Series",
            value: tokenData.series
          },
          {
            trait_type: "Category",
            value: tokenData.category
          },
          {
            trait_type: "Required",
            value: tokenData.required
          },
          {
            trait_type: "Origin",
            value: tokenData.origin
          },
          {
            trait_type: "Max Supply",
            value: tokenData.maxSupply
          },
          {
            trait_type: "Rarity",
            value: rarity.tag
          }
        ],
        properties: {
          files: [
            {
              uri: gifExists ? `${baseUrl}/labimages/${tokenIdNum}.gif` : null,
              type: "image/gif"
            }
          ],
          category: "image"
        }
      };

      console.log(`[floppy-metadata] Metadata generada para token ${tokenIdNum}:`, metadata);

      // Configurar headers para JSON
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Cache-Control', 'public, max-age=3600');
      
      return res.status(200).json(metadata);
      
    } else {
      return res.status(400).json({ error: 'Token ID fuera de rango válido (1-15000)' });
    }
    
  } catch (error) {
    console.error('[floppy-metadata] Error:', error);
    console.error('[floppy-metadata] Stack trace:', error.stack);
    
    return res.status(500).json({
      error: 'Error generating floppy metadata',
      details: error.message
    });
  }
} 