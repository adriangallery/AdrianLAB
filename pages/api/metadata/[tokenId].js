import { getContracts } from '../../../lib/contracts.js';
import { updateTogglesIfNeeded, hasToggleActive } from '../../../lib/toggle-cache.js';
import fs from 'fs';
import path from 'path';

// ===== TOKENS ESPECIALES CON IMAGEN Y/O NOMBRE ESPECÍFICO =====
// Objeto constante en memoria para máximo rendimiento (lookup O(1))
const SPECIAL_TOKENS = {
  302: {
    image: '/labimages/specials/302.gif',
    name: null // null = usar nombre por defecto desde contratos
  },
  441: {
    image: '/labimages/specials/441.gif',
    name: 'DRACULA' // Hello-WEN '25 first prize
  },
  442: {
    image: '/labimages/specials/442.gif',
    name: 'NEO-ZERO' // DropShit #1 first prize
  },
  445: {
    image: '/labimages/specials/445.gif',
    name: 'THE MANAGER'
  },
  454: {
    image: '/labimages/specials/454.gif',
    name: 'Adrian McOrder Dash'
  }
};

export default async function handler(req, res) {
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
    const { tokenId } = req.query;
    console.log(`[metadata] Iniciando request para token ${tokenId}`);
    
    // ===== LÓGICA ESPECIAL CLOSEUP, SHADOW, GLOW, BN Y UV (SISTEMA DE TOGGLES) =====
    // Los toggles se determinan por el estado del contrato
    // IDs de toggles:
    // "1" = closeup solo
    // "2" = shadow solo
    // "3" = glow solo
    // "4" = bn solo
    // "5" = bn+shadow
    // "6" = bn+shadow+closeup
    // "7" = shadow+closeup
    // "8" = glow+closeup
    // "9" = glow+bn
    // "10" = glow+bn+closeup
    // "11" = uv solo
    let isCloseupToken = false;
    let isShadowToken = false;
    let isGlowToken = false;
    let isBnToken = false;
    let isUvToken = false;
    let isBlackoutToken = false;
    
    try {
      // Actualizar toggles si es necesario (automático cada 24h)
      const { zoomInZeros } = await getContracts();
      await updateTogglesIfNeeded(zoomInZeros);
      
      // Verificar toggles combinados primero (tienen prioridad)
      const hasToggle5 = hasToggleActive(tokenId, "5"); // bn+shadow
      const hasToggle6 = hasToggleActive(tokenId, "6"); // bn+shadow+closeup
      const hasToggle7 = hasToggleActive(tokenId, "7"); // shadow+closeup
      const hasToggle8 = hasToggleActive(tokenId, "8"); // glow+closeup
      const hasToggle9 = hasToggleActive(tokenId, "9"); // glow+bn
      const hasToggle10 = hasToggleActive(tokenId, "10"); // glow+bn+closeup
      
      // Si hay toggle combinado activo, aplicar esa combinación
      if (hasToggle10) {
        // ID 10: glow+bn+closeup
        isCloseupToken = true;
        isGlowToken = true;
        isBnToken = true;
        isShadowToken = false;
        console.log(`[metadata] 🎨 TOGGLE 10: Token ${tokenId} tiene glow+bn+closeup activo`);
      } else if (hasToggle9) {
        // ID 9: glow+bn
        isCloseupToken = false;
        isGlowToken = true;
        isBnToken = true;
        isShadowToken = false;
        console.log(`[metadata] 🎨 TOGGLE 9: Token ${tokenId} tiene glow+bn activo`);
      } else if (hasToggle8) {
        // ID 8: glow+closeup
        isCloseupToken = true;
        isGlowToken = true;
        isBnToken = false;
        isShadowToken = false;
        console.log(`[metadata] 🎨 TOGGLE 8: Token ${tokenId} tiene glow+closeup activo`);
      } else if (hasToggle7) {
        // ID 7: shadow+closeup
        isCloseupToken = true;
        isShadowToken = true;
        isGlowToken = false;
        isBnToken = false;
        console.log(`[metadata] 🎨 TOGGLE 7: Token ${tokenId} tiene shadow+closeup activo`);
      } else if (hasToggle6) {
        // ID 6: bn+shadow+closeup
        isCloseupToken = true;
        isShadowToken = true;
        isBnToken = true;
        isGlowToken = false;
        console.log(`[metadata] 🎨 TOGGLE 6: Token ${tokenId} tiene bn+shadow+closeup activo`);
      } else if (hasToggle5) {
        // ID 5: bn+shadow
        isCloseupToken = false;
        isShadowToken = true;
        isBnToken = true;
        isGlowToken = false;
        console.log(`[metadata] 🎨 TOGGLE 5: Token ${tokenId} tiene bn+shadow activo`);
      } else {
        // Verificar toggles individuales (solo si no hay toggle combinado)
        isCloseupToken = hasToggleActive(tokenId, "1"); // toggleId "1" = closeup
        isShadowToken = hasToggleActive(tokenId, "2"); // toggleId "2" = shadow
        isGlowToken = hasToggleActive(tokenId, "3"); // toggleId "3" = glow
        isBnToken = hasToggleActive(tokenId, "4"); // toggleId "4" = blanco y negro
        isUvToken = hasToggleActive(tokenId, "11"); // toggleId "11" = uv
        isBlackoutToken = hasToggleActive(tokenId, "12"); // toggleId "12" = blackout
        
        if (isCloseupToken) {
          console.log(`[metadata] 🔍 TOGGLE: Token ${tokenId} tiene closeup activo`);
        }
        
        if (isShadowToken) {
          console.log(`[metadata] 🌑 TOGGLE: Token ${tokenId} tiene shadow activo`);
        }
        
        if (isGlowToken) {
          console.log(`[metadata] ✨ TOGGLE: Token ${tokenId} tiene glow activo`);
        }
        
        if (isBnToken) {
          console.log(`[metadata] ⚫ TOGGLE: Token ${tokenId} tiene BN (blanco y negro) activo`);
        }
        
        if (isUvToken) {
          console.log(`[metadata] 💜 TOGGLE: Token ${tokenId} tiene UV activo`);
        }
        
        if (isBlackoutToken) {
          console.log(`[metadata] ⬛ TOGGLE: Token ${tokenId} tiene BLACKOUT activo`);
        }
      }
    } catch (error) {
      console.error(`[metadata] ⚠️ Error verificando toggles para token ${tokenId}:`, error.message);
      // En caso de error, no aplicar toggles (fallback seguro)
      isCloseupToken = false;
      isShadowToken = false;
      isGlowToken = false;
      isBnToken = false;
      isUvToken = false;
      isBlackoutToken = false;
    }
    
    // Caso especial para el token 100000
    if (tokenId === '100000' || tokenId === '100000.json') {
      const metadataPath = path.join(process.cwd(), 'public', 'metadata', '100000.json');
      const metadataData = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
      
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      res.setHeader('Surrogate-Control', 'no-store');
      
      return res.status(200).json(metadataData);
    }
    
    // Verify that tokenId is valid
    if (!tokenId || isNaN(parseInt(tokenId))) {
      console.error(`[metadata] Token ID inválido: ${tokenId}`);
      return res.status(400).json({ error: 'Invalid token ID' });
    }

    // Build base URL for images
    const baseUrl = 'https://adrianlab.vercel.app';
    const version = Date.now();

    // ===== LÓGICA ESPECIAL: SAMURAIZERO (500-1099) =====
    const tokenIdNum = parseInt(tokenId);
    if (tokenIdNum >= 500 && tokenIdNum <= 1099) {
      console.log(`[metadata] 🥷 SAMURAIZERO: Token ${tokenId} detectado - Usando metadata hardcodeado`);
      
      try {
        // Cargar metadata desde samuraimetadata.json
        const samuraiMetadataPath = path.join(process.cwd(), 'public', 'labmetadata', 'samuraimetadata.json');
        const samuraiMetadataRaw = fs.readFileSync(samuraiMetadataPath, 'utf8');
        const samuraiMetadata = JSON.parse(samuraiMetadataRaw);
        
        // Buscar token específico en la colección
        const tokenData = samuraiMetadata.collection.find(item => 
          item.name.includes(`#${tokenId}`)
        );
        
        if (!tokenData) {
          console.error(`[metadata] 🥷 SamuraiZERO token ${tokenId} no encontrado en samuraimetadata.json`);
          return res.status(404).json({ 
            error: 'SamuraiZERO token not found', 
            tokenId: tokenId 
          });
        }
        
        // Actualizar URLs para compatibilidad con OpenSea
        // Construir URL con parámetros según toggles activos
        const urlParams = [];
        if (isCloseupToken) urlParams.push('closeup=true');
        if (isShadowToken) urlParams.push('shadow=true');
        if (isGlowToken) urlParams.push('glow=true');
        if (isBnToken) urlParams.push('bn=true');
        if (isBlackoutToken) urlParams.push('blackout=true');
        const paramsString = urlParams.length > 0 ? `?${urlParams.join('&')}&v=${version}` : `?v=${version}`;
        const imageUrl = `${baseUrl}/api/render/${tokenId}.png${paramsString}`;
          
        const updatedTokenData = {
          ...tokenData,
          image: imageUrl,
          external_url: imageUrl
        };
        
        console.log(`[metadata] 🥷 SamuraiZERO ${tokenId} metadata cargado exitosamente`);
        
        // Configurar headers
        res.setHeader('Cache-Control', 'public, max-age=3600'); // 1 hora para metadata estático
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('X-Version', 'SAMURAIZERO');
        
        return res.status(200).json(updatedTokenData);
        
      } catch (error) {
        console.error(`[metadata] 🥷 Error cargando SamuraiZERO ${tokenId}:`, error.message);
        return res.status(500).json({ 
          error: 'Error loading SamuraiZERO metadata', 
          tokenId: tokenId,
          details: error.message 
        });
      }
    }

    // ===== LÓGICA ESPECIAL: ACTION PACKS (15008-15010) =====
    if (tokenIdNum >= 15008 && tokenIdNum <= 15010) {
      try {
        const packsPath = path.join(process.cwd(), 'public', 'labmetadata', 'ActionPacks.json');
        const packsRaw = fs.readFileSync(packsPath, 'utf8');
        const packsData = JSON.parse(packsRaw);
        const pack = (packsData.packs || []).find(p => parseInt(p.packId) === tokenIdNum);

        if (!pack) {
          console.error(`[metadata] Action Pack ${tokenIdNum} no encontrado en ActionPacks.json`);
          return res.status(404).json({ error: 'Action Pack not found' });
        }

        // Resolver imagen por ID con fallbacks si no existe el archivo
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

        const packMetadata = {
          name: `${pack.name}`,
          description: pack.description || 'AdrianLAB Action Pack',
          image: imageUrl,
          external_url: imageUrl,
          metadata_version: '2',
          attributes: [
            { trait_type: 'Type', value: 'Action Pack' },
            { trait_type: 'PackId', value: tokenIdNum.toString() },
            { trait_type: 'TraitsCount', value: (pack.traits ? pack.traits.length : 0).toString() },
            { trait_type: 'Traits', value: (pack.traits && pack.traits.length > 0) ? pack.traits.join(',') : 'None' }
          ],
          debug: {
            source: 'ActionPacks.json',
            pack
          }
        };

        // No cache agresivo para permitir iteración rápida
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
        res.setHeader('Surrogate-Control', 'no-store');

        return res.status(200).json(packMetadata);
      } catch (err) {
        console.error('[metadata] Error sirviendo Action Pack:', err.message);
        return res.status(500).json({ error: 'Error loading Action Pack metadata' });
      }
    }

    // Metadata base que siempre se mostrará
    // Construir URL de imagen con parámetros según toggles activos
    const urlParams = [];
    if (isCloseupToken) urlParams.push('closeup=true');
    if (isShadowToken) urlParams.push('shadow=true');
    if (isGlowToken) urlParams.push('glow=true');
    if (isBnToken) urlParams.push('bn=true');
    if (isUvToken) urlParams.push('uv=true');
    if (isBlackoutToken) urlParams.push('blackout=true');
    const paramsString = urlParams.length > 0 ? `?${urlParams.join('&')}&v=${version}` : `?v=${version}`;
    const imageUrl = `${baseUrl}/api/render/${tokenId}.png${paramsString}`;
    
    // Verificar tag del token ANTES de crear baseMetadata para poder sobreescribir el nombre
    const { getTokenTagInfo } = await import('../../../lib/tag-logic.js');
    const tagInfo = await getTokenTagInfo(tokenId);
    
    // Determinar el nombre base según el tag
    let tokenName = `AdrianZero #${tokenId}`;
    if (tagInfo.tag === 'SubZERO') {
      tokenName = 'SubZERO';
      console.log(`[metadata] Token ${tokenId} tiene tag SubZERO, sobreescribiendo nombre a "SubZERO"`);
    }
    
    const baseMetadata = {
      name: tokenName,
      description: `An AdrianZero from the AdrianLAB collection`,
      image: imageUrl,
      external_url: imageUrl,
      metadata_version: "2",
      attributes: []
    };
    
    try {
      // Test de conexión a contratos
      console.log('[metadata] Intentando conectar con los contratos...');
      const { core, traitsExtension, patientZero, serumModule, adrianNameRegistry } = await getContracts();
      console.log('[metadata] Contratos conectados:', {
        core: {
          address: core.address,
          functions: Object.keys(core.functions)
        },
        traitsExtension: {
          address: traitsExtension.address,
          functions: Object.keys(traitsExtension.functions)
        },
        patientZero: {
          address: patientZero.address,
          functions: Object.keys(patientZero.functions)
        },
        serumModule: {
          address: serumModule.address,
          functions: Object.keys(serumModule.functions)
        }
      });

      // Obtener historial de nombres desde AdrianNameRegistry (prioridad baja)
      let customName = null;
      try {
        console.log('[metadata] Llamando a getTokenNameHistory desde AdrianNameRegistry...');
        const nameHistory = await adrianNameRegistry.getTokenNameHistory(tokenId);
        console.log('[metadata] Respuesta de getTokenNameHistory:', {
          history: nameHistory.map(change => ({
            name: change[0],
            changer: change[1],
            timestamp: change[2].toString(),
            paidChange: change[3]
          }))
        });
        
        // Si hay cambios de nombre en el historial, guardar el último nombre
        if (nameHistory && nameHistory.length > 0) {
          const lastNameChange = nameHistory[nameHistory.length - 1]; // Último cambio de nombre
          customName = lastNameChange[0]; // El nombre personalizado
          console.log(`[metadata] Nombre personalizado encontrado: ${customName}`);
        }
        
      } catch (error) {
        console.log('[metadata] Error obteniendo historial de nombres:', error.message);
      }

      // Obtener status y profileName desde PatientZERO (prioridad alta)
      let profileName = null;
      try {
        console.log('[metadata] Llamando a getTokenStatus desde PatientZERO...');
        const tokenStatus = await patientZero.getTokenStatus(tokenId);
        const status = tokenStatus[0];
        const profileId = tokenStatus[1];
        
        console.log('[metadata] TokenStatus obtenido:', {
          status: status,
          profileId: profileId.toString()
        });
        
        if (status) baseMetadata.status = status;
        
        // Solo intentar obtener profile si profileId es válido y mayor que 0
        if (profileId && parseInt(profileId.toString()) > 0) {
          try {
            console.log('[metadata] Llamando a getProfile desde PatientZERO con profileId: ' + profileId.toString());
            const profileData = await patientZero.getProfile(profileId);
            console.log('[metadata] Respuesta de getProfile:', {
              profileName: profileData[0],
              traitIds: profileData[1].map(id => id.toString()),
              reward: profileData[2].toString(),
              active: profileData[3],
              recovered: profileData[4].toString()
            });
            
            profileName = profileData[0];
            if (profileName && profileName.trim() !== '') {
              baseMetadata.profileName = profileName;
              console.log('[metadata] ProfileName válido encontrado: "' + profileName + '"');
            } else {
              console.log('[metadata] ProfileName vacío o inválido, ignorando');
            }
          } catch (profileError) {
            console.error('[metadata] Error obteniendo profile para profileId ' + profileId.toString() + ':', profileError.message);
            console.log('[metadata] Continuando sin profileName...');
          }
        } else {
          console.log('[metadata] No hay profileId válido, saltando llamada a profiles');
        }
      } catch (error) {
        console.log('[metadata] Token no ha pasado por PatientZERO o error en read:', error.message);
      }

      // LÓGICA DE PRIORIDAD PARA EL NOMBRE:
      // 0. SubZERO tag tiene prioridad ABSOLUTA (ya establecido arriba)
      // 1. profileName (PatientZERO) tiene prioridad alta
      // 2. customName (AdrianNameRegistry) tiene prioridad media
      // 3. "AdrianZero" es el fallback por defecto
      // Si el token tiene tag SubZERO, el nombre ya fue establecido arriba, no sobrescribir
      if (tagInfo.tag === 'SubZERO') {
        // El nombre ya fue establecido como "SubZERO" arriba, mantenerlo
        console.log(`[metadata] Nombre SubZERO mantenido (prioridad máxima): ${baseMetadata.name}`);
      } else if (profileName) {
        baseMetadata.name = `${profileName} #${tokenId}`;
        console.log(`[metadata] Nombre de perfil aplicado (prioridad alta): ${baseMetadata.name}`);
      } else if (customName) {
        baseMetadata.name = `${customName} #${tokenId}`;
        console.log(`[metadata] Nombre personalizado aplicado (prioridad media): ${baseMetadata.name}`);
      } else {
        baseMetadata.name = `AdrianZero #${tokenId}`;
        console.log(`[metadata] Nombre por defecto aplicado: ${baseMetadata.name}`);
      }
 

      // Obtener datos del token
      console.log('[metadata] Llamando a getTokenData...');
      const tokenData = await core.getTokenData(tokenId);
      console.log('[metadata] Respuesta de getTokenData:', {
        result: tokenData.map(v => v.toString())
      });

      // Obtener skin del token
      console.log('[metadata] Llamando a getTokenSkin...');
      const tokenSkinData = await core.getTokenSkin(tokenId);
      const skinId = tokenSkinData[0]; // Extraer skinId del array
      const skinName = tokenSkinData[1]; // Extraer skinName del array
      console.log('[metadata] Respuesta de getTokenSkin:', {
        skinId: skinId.toString(),
        skinName: skinName
      });

      // Obtener traits equipados
      console.log('[metadata] Llamando a getAllEquippedTraits...');
      const [categories, traitIds] = await traitsExtension.getAllEquippedTraits(tokenId);
      console.log('[metadata] Respuesta de getAllEquippedTraits:', {
        categories,
        traitIds: traitIds.map(id => id.toString())
      });

      // LÓGICA ESPECIAL: Si el TOP trait activo es un OGPUNK en rango 100001-101000 → renombrar a AdrianPunk #<tokenId>
      try {
        if (Array.isArray(categories) && Array.isArray(traitIds)) {
          const topIndex = categories.findIndex(c => c === 'TOP');
          if (topIndex !== -1) {
            const topTraitIdNum = parseInt(traitIds[topIndex].toString());
            if (!isNaN(topTraitIdNum) && topTraitIdNum >= 100001 && topTraitIdNum <= 101000) {
              baseMetadata.name = `AdrianPunk #${tokenIdNum}`;
              console.log(`[metadata] Override de nombre por TOP OGPUNK (${topTraitIdNum}) → ${baseMetadata.name}`);
            }
          }
        }
      } catch (e) {
        console.log('[metadata] Aviso: no se pudo evaluar override de AdrianPunk:', e.message);
      }

      // Función para determinar qué archivo de metadata cargar según el token ID
      const getMetadataFileForToken = (tokenId) => {
        const numTokenId = parseInt(tokenId);
        
        if (numTokenId >= 10000 && numTokenId <= 10002) {
          return 'floppy.json';
        } else if (numTokenId >= 15000 && numTokenId <= 15006) {
          return 'pagers.json';
        } else if (numTokenId === 262144) {
          return 'serums.json';
        } else {
          return 'traits.json';
        }
      };

      // Función para cargar metadata del archivo correcto
      const loadMetadataForToken = (tokenId) => {
        try {
          const metadataFile = getMetadataFileForToken(tokenId);
          const metadataPath = path.join(process.cwd(), 'public', 'labmetadata', metadataFile);
          
          console.log(`[metadata] Cargando metadata desde: ${metadataFile} para token ${tokenId}`);
          
          const metadataBuffer = fs.readFileSync(metadataPath);
          const metadata = JSON.parse(metadataBuffer.toString());
          
          // Determinar qué array usar según el archivo
          let traitsArray;
          switch (metadataFile) {
            case 'floppy.json':
              traitsArray = metadata.floppys;
              break;
            case 'pagers.json':
              traitsArray = metadata.pagers;
              break;
            case 'serums.json':
              traitsArray = metadata.serums;
              break;
            default:
              traitsArray = metadata.traits;
          }
          
          return traitsArray;
        } catch (error) {
          console.error(`[metadata] Error cargando metadata para token ${tokenId}:`, error.message);
          return [];
        }
      };

      // Cargar datos de metadata según el token
      console.log('[metadata] Cargando datos de metadata...');
      let traitsData;
      try {
        const traitsArray = loadMetadataForToken(tokenId);
        traitsData = { traits: traitsArray };
        console.log(`[metadata] Metadata cargado: ${traitsArray.length} items encontrados`);
      } catch (error) {
        console.error('[metadata] Error cargando metadata:', error);
        traitsData = { traits: [] };
      }

      // Función para obtener nombre del trait por ID
      const getTraitName = (traitId) => {
        const trait = traitsData.traits.find(t => t.tokenId === parseInt(traitId));
        return trait ? trait.name : `#${traitId}`;
      };

      // Obtener historial de serums desde SerumModule
      try {
        console.log('[metadata] Llamando a getTokenSerumHistory desde SerumModule...');
        const serumHistory = await serumModule.getTokenSerumHistory(tokenId);
        console.log('[metadata] Respuesta de getTokenSerumHistory:', {
          history: serumHistory.map(serum => ({
            serumId: serum[0].toString(),
            success: serum[1],
            timestamp: serum[2].toString(),
            mutation: serum[3]
          }))
        });
        
        // Si hay serums en el historial, agregar el último como atributo
        if (serumHistory && serumHistory.length > 0) {
          const lastSerum = serumHistory[serumHistory.length - 1]; // Último serum aplicado
          const serumSuccess = lastSerum[1];
          const serumMutation = lastSerum[3];
          
          let usedSerumValue;
          if (serumSuccess) {
            usedSerumValue = serumMutation; // "AdrianGF"
          } else {
            usedSerumValue = "FAILED";
          }
          
          baseMetadata.attributes.push({
            trait_type: "UsedSerum",
            value: usedSerumValue
          });
        }
        
      } catch (error) {
        console.log('[metadata] Error obteniendo historial de serums:', error.message);
      }

      // Añadir atributos base
      let generationValue = tokenData[0].toString();
      
      // Si el token tiene tag SubZERO, sobreescribir Generation
      if (tagInfo.tag === 'SubZERO') {
        const config = (await import('../../../lib/tag-logic.js')).TAG_CONFIGS.SubZERO;
        if (config && config.metadataGenOverride) {
          generationValue = config.metadataGenOverride;
          console.log(`[metadata] Token ${tokenId} tiene tag SubZERO, sobreescribiendo Generation a "${generationValue}"`);
        }
      }
      
      baseMetadata.attributes.push(
        {
          trait_type: "Generation",
          value: generationValue
        }
      );

      // Lógica del skin: 
      // - skinId = 0: No hay skin asignado (debería mostrar "NOT_ASSIGNED")
      // - skinId = 1: Skin "Zero" (debería mostrar "Zero")
      // - skinId > 1: Otros skins (debería mostrar el nombre del skin)
      if (skinId.toString() === "0") {
        baseMetadata.attributes.push({
          trait_type: "Skin",
          value: "NOT_ASSIGNED"
        });
      } else {
        baseMetadata.attributes.push({
          trait_type: "Skin",
          value: skinName
        });
      }

      // Añadir atributos de mutación si está mutado
      if (tokenData[2]) { // isMutated
        baseMetadata.attributes.push(
          {
            trait_type: "Mutation Level",
            value: tokenData[1].toString()
          },
          {
            trait_type: "Mutation Type",
            value: tokenData[3].toString()
          },
          {
            trait_type: "Mutation Stage",
            value: tokenData[4].toString()
          }
        );
      }

      // Añadir traits como atributos con nombres
      if (categories && categories.length > 0) {
        categories.forEach((category, index) => {
          const traitId = traitIds[index].toString();
          const traitName = getTraitName(traitId);
          baseMetadata.attributes.push({
            trait_type: category,
            value: traitName
          });
        });
      }

      // Añadir información de debug
      baseMetadata.debug = {
        contracts: {
          core: {
            address: core.address,
            functions: {
              getTokenData: {
                called: true,
                result: tokenData.map(v => v.toString())
              },
              getTokenSkin: {
                called: true,
                result: {
                  skinId: skinId.toString(),
                  skinName: skinName
                }
              }
            }
          },
          traitsExtension: {
            address: traitsExtension.address,
            functionCalled: 'getAllEquippedTraits',
            result: {
              categories,
              traitIds: traitIds.map(id => id.toString()),
              traitNames: categories.map((category, index) => ({
                category,
                traitId: traitIds[index].toString(),
                traitName: getTraitName(traitIds[index].toString())
              }))
            }
          },
          patientZero: {
            address: patientZero.address,
            functions: {
              getTokenStatus: {
                called: true,
                result: {
                  status: baseMetadata.status,
                  profileName: baseMetadata.profileName
                }
              }
            }
          },
          serumModule: {
            address: serumModule.address,
            functions: {
              getTokenSerumHistory: {
                called: true,
                result: baseMetadata.attributes.find(attr => attr.trait_type === "UsedSerum") ? 
                  baseMetadata.attributes.find(attr => attr.trait_type === "UsedSerum").value : "No serums found"
              }
            }
          }
        },
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      console.error('[metadata] Error:', error);
      console.error('[metadata] Stack trace:', error.stack);
      
      baseMetadata.debug = {
        error: error.message,
        stack: error.stack,
        timestamp: new Date().toISOString()
      };
    }

    // Configurar headers para evitar cache
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.setHeader('Surrogate-Control', 'no-store');

    // ===== TOKENS ESPECIALES CON IMAGEN Y/O NOMBRE ESPECÍFICO =====
    if (SPECIAL_TOKENS[tokenIdNum]) {
      const special = SPECIAL_TOKENS[tokenIdNum];
      
      // Aplicar imagen especial si existe
      if (special.image) {
        const specialImageUrl = `${baseUrl}${special.image}?v=${version}`;
        baseMetadata.image = specialImageUrl;
        baseMetadata.external_url = specialImageUrl;
        console.log(`[metadata] 🎨 Token especial ${tokenIdNum}: imagen aplicada → ${specialImageUrl}`);
      }
      
      // Aplicar nombre especial si existe (sobrescribe nombres de contratos)
      if (special.name) {
        baseMetadata.name = `${special.name} #${tokenIdNum}`;
        console.log(`[metadata] 🎨 Token especial ${tokenIdNum}: nombre aplicado → ${baseMetadata.name}`);
      }
    }
    
    // OVERRIDE ESPECIAL: Token 202 usa closeup para pruebas (TEMPORAL - ELIMINAR CUANDO TOGGLES ESTÉN ACTIVOS)
    // Nota: Este override se aplica después de SPECIAL_TOKENS, solo si no hay toggle activo
    if (tokenIdNum === 202 && !isCloseupToken && !isShadowToken && !isGlowToken && !isBnToken && !SPECIAL_TOKENS[tokenIdNum]) {
      const closeupUrl = `${baseUrl}/api/render/202.png?closeup=true&v=${version}`;
      baseMetadata.image = closeupUrl;
      baseMetadata.external_url = closeupUrl;
      console.log('[metadata] Override temporal aplicado para token 202 (closeup) →', closeupUrl);
    }
    
    // Configurar headers
    res.setHeader('X-Version', 'ADRIANZERO-METADATA');
    
    // Construir header X-Render-Type con información de toggles
    const renderTypeParts = [];
    if (isCloseupToken) renderTypeParts.push('closeup');
    if (isShadowToken) renderTypeParts.push('shadow');
    if (isGlowToken) renderTypeParts.push('glow');
    if (isBnToken) renderTypeParts.push('bn');
    if (isUvToken) renderTypeParts.push('uv');
    const renderType = renderTypeParts.length > 0 ? renderTypeParts.join('+') : 'full';
    res.setHeader('X-Render-Type', renderType);
    
    if (isShadowToken) {
      res.setHeader('X-Shadow', 'enabled');
    }
    
    if (isGlowToken) {
      res.setHeader('X-Glow', 'enabled');
    }
    
    if (isBnToken) {
      res.setHeader('X-BN', 'enabled');
    }
    
    if (isUvToken) {
      res.setHeader('X-UV', 'enabled');
    }
    
    if (isBlackoutToken) {
      res.setHeader('X-Blackout', 'enabled');
    }
    
    return res.status(200).json(baseMetadata);
  } catch (error) {
    console.error('[metadata] Error general:', error);
    console.error('[metadata] Stack trace:', error.stack);
    
    return res.status(200).json({
      name: `AdrianZero #${req.query.tokenId || 'Unknown'}`,
      description: `An AdrianZero from the AdrianLAB collection (Error Mode)`,
      image: `https://adrianlab.vercel.app/api/render/${req.query.tokenId || 1}.png?v=${Date.now()}`,
      external_url: `https://adrianlab.vercel.app/token/${req.query.tokenId || 1}`,
      metadata_version: "2-error",
      attributes: [
        { trait_type: "Status", value: "Error Mode" },
        { trait_type: "Error", value: error.message }
      ],
      debug: {
        error: error.message,
        stack: error.stack,
        timestamp: new Date().toISOString()
      }
    });
  }
}