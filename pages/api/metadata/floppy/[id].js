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
    if (!actualId || isNaN(parseInt(actualId)) || parseInt(actualId) < 1) {
      console.error(`[floppy-metadata] ID inválido: ${actualId} (original: ${req.query.id})`);
      return res.status(400).json({ error: 'Invalid floppy ID' });
    }

    const tokenIdNum = parseInt(actualId);
    const baseUrl = 'https://adrianlab.vercel.app';
    const version = Date.now();

    // Caso especial para el token 10000 - usar JSON estático
    if (tokenIdNum === 10000) {
      try {
        const metadataPath = path.join(process.cwd(), 'public', '10000.json');
        const metadataData = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
        
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
        res.setHeader('Surrogate-Control', 'no-store');
        
        return res.status(200).json(metadataData);
      } catch (error) {
        console.error(`[floppy-metadata] Error leyendo 10000.json:`, error);
        // Continuar con metadata generado si falla la lectura del archivo
      }
    }

    // Para tokens del 1 al 9999 - usar nuevo sistema de renderizado
    if (tokenIdNum >= 1 && tokenIdNum <= 9999) {
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

      // Metadata para tokens del 1 al 9999
      const metadata = {
        name: tokenData.name,
        description: `A ${tokenData.category.toLowerCase()} trait from AdrianLAB collection`,
        image: `${baseUrl}/api/render/floppy/${actualId}.png?v=${version}`,
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

      // Configurar headers para evitar cache
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      res.setHeader('Surrogate-Control', 'no-store');
      
      return res.status(200).json(metadata);
    }

    // Para otros tokens - metadata base (mantener lógica existente)
    const metadata = {
      name: `Asset #${actualId}`,
      description: "A FLOPPY DISK from the AdrianLAB collection",
      image: `${baseUrl}/labimages/10000.png?v=${version}`,
      attributes: [
        {
          trait_type: "Category",
          value: "FLOPPY"
        },
        {
          trait_type: "Asset Type",
          value: "VISUAL_TRAIT"
        }
      ]
    };

    // Configurar headers para evitar cache
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.setHeader('Surrogate-Control', 'no-store');
    
    return res.status(200).json(metadata);
  } catch (error) {
    console.error('[floppy-metadata] Error:', error);
    console.error('[floppy-metadata] Stack trace:', error.stack);
    
    return res.status(500).json({
      error: 'Error generating floppy metadata',
      details: error.message
    });
  }
} 