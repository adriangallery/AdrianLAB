import { getContracts } from '../../../lib/contracts.js';
import { updateTogglesIfNeeded, hasToggleActive } from '../../../lib/toggle-cache.js';
import { getTokenDupInfo, getDupGenerationAttribute } from '../../../lib/duplicator-logic.js';
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
  },
  459: {
    image: '/labimages/specials/459.gif',
    name: 'AdrianSensai'
  },
  740: {
    image: '/labimages/specials/740.gif',
    name: 'ChuckZERO'
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
    // Extraer tokenId de la ruta, eliminando .png o .gif si existe
    const { tokenId } = req.query;
    const cleanTokenId = tokenId.toString().replace(/\.(png|gif)$/, '');
    console.log(`[metadata] Iniciando request para token ${cleanTokenId}`);
    
    // ===== LÓGICA ESPECIAL CLOSEUP, SHADOW, GLOW, BN, UV, BLACKOUT Y BANANA (SISTEMA DE TOGGLES) =====
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
    // "12" = blackout solo
    // "13" = banana solo
    let isCloseupToken = false;
    let isShadowToken = false;
    let isGlowToken = false;
    let isBnToken = false;
    let isUvToken = false;
    let isBlackoutToken = false;
    let isBananaToken = false;
    
    try {
      // Actualizar toggles si es necesario (automático cada 24h)
      const { zoomInZeros } = await getContracts();
      await updateTogglesIfNeeded(zoomInZeros);
      
      // Verificar toggles combinados primero (tienen prioridad)
      const hasToggle5 = hasToggleActive(cleanTokenId, "5"); // bn+shadow
      const hasToggle6 = hasToggleActive(cleanTokenId, "6"); // bn+shadow+closeup
      const hasToggle7 = hasToggleActive(cleanTokenId, "7"); // shadow+closeup
      const hasToggle8 = hasToggleActive(cleanTokenId, "8"); // glow+closeup
      const hasToggle9 = hasToggleActive(cleanTokenId, "9"); // glow+bn
      const hasToggle10 = hasToggleActive(cleanTokenId, "10"); // glow+bn+closeup
      
      // Si hay toggle combinado activo, aplicar esa combinación
      if (hasToggle10) {
        // ID 10: glow+bn+closeup
        isCloseupToken = true;
        isGlowToken = true;
        isBnToken = true;
        isShadowToken = false;
        console.log(`[metadata] 🎨 TOGGLE 10: Token ${cleanTokenId} tiene glow+bn+closeup activo`);
      } else if (hasToggle9) {
        // ID 9: glow+bn
        isCloseupToken = false;
        isGlowToken = true;
        isBnToken = true;
        isShadowToken = false;
        console.log(`[metadata] 🎨 TOGGLE 9: Token ${cleanTokenId} tiene glow+bn activo`);
      } else if (hasToggle8) {
        // ID 8: glow+closeup
        isCloseupToken = true;
        isGlowToken = true;
        isBnToken = false;
        isShadowToken = false;
        console.log(`[metadata] 🎨 TOGGLE 8: Token ${cleanTokenId} tiene glow+closeup activo`);
      } else if (hasToggle7) {
        // ID 7: shadow+closeup
        isCloseupToken = true;
        isShadowToken = true;
        isGlowToken = false;
        isBnToken = false;
        console.log(`[metadata] 🎨 TOGGLE 7: Token ${cleanTokenId} tiene shadow+closeup activo`);
      } else if (hasToggle6) {
        // ID 6: bn+shadow+closeup
        isCloseupToken = true;
        isShadowToken = true;
        isBnToken = true;
        isGlowToken = false;
        console.log(`[metadata] 🎨 TOGGLE 6: Token ${cleanTokenId} tiene bn+shadow+closeup activo`);
      } else if (hasToggle5) {
        // ID 5: bn+shadow
        isCloseupToken = false;
        isShadowToken = true;
        isBnToken = true;
        isGlowToken = false;
        console.log(`[metadata] 🎨 TOGGLE 5: Token ${cleanTokenId} tiene bn+shadow activo`);
      } else {
        // Verificar toggles individuales (solo si no hay toggle combinado)
        isCloseupToken = hasToggleActive(cleanTokenId, "1"); // toggleId "1" = closeup
        isShadowToken = hasToggleActive(cleanTokenId, "2"); // toggleId "2" = shadow
        isGlowToken = hasToggleActive(cleanTokenId, "3"); // toggleId "3" = glow
        isBnToken = hasToggleActive(cleanTokenId, "4"); // toggleId "4" = blanco y negro
        isUvToken = hasToggleActive(cleanTokenId, "11"); // toggleId "11" = uv
        isBlackoutToken = hasToggleActive(cleanTokenId, "12"); // toggleId "12" = blackout
        isBananaToken = hasToggleActive(cleanTokenId, "13"); // toggleId "13" = banana
        
        if (isCloseupToken) {
          console.log(`[metadata] 🔍 TOGGLE: Token ${cleanTokenId} tiene closeup activo`);
        }
        
        if (isShadowToken) {
          console.log(`[metadata] 🌑 TOGGLE: Token ${cleanTokenId} tiene shadow activo`);
        }
        
        if (isGlowToken) {
          console.log(`[metadata] ✨ TOGGLE: Token ${cleanTokenId} tiene glow activo`);
        }
        
        if (isBnToken) {
          console.log(`[metadata] ⚫ TOGGLE: Token ${cleanTokenId} tiene BN (blanco y negro) activo`);
        }
        
        if (isUvToken) {
          console.log(`[metadata] 💜 TOGGLE: Token ${cleanTokenId} tiene UV activo`);
        }
        
        if (isBlackoutToken) {
          console.log(`[metadata] ⬛ TOGGLE: Token ${cleanTokenId} tiene BLACKOUT activo`);
        }
        
        if (isBananaToken) {
          console.log(`[metadata] 🍌 TOGGLE: Token ${cleanTokenId} tiene BANANA activo`);
        }
      }
    } catch (error) {
      console.error(`[metadata] ⚠️ Error verificando toggles para token ${cleanTokenId}:`, error.message);
      // En caso de error, no aplicar toggles (fallback seguro)
      isCloseupToken = false;
      isShadowToken = false;
      isGlowToken = false;
      isBnToken = false;
      isUvToken = false;
      isBlackoutToken = false;
      isBananaToken = false;
    }
    
    // Caso especial para el token 100000
    if (cleanTokenId === '100000' || req.query.tokenId === '100000.json') {
      const metadataPath = path.join(process.cwd(), 'public', 'metadata', '100000.json');
      const metadataData = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
      
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      res.setHeader('Surrogate-Control', 'no-store');
      
      return res.status(200).json(metadataData);
    }
    
    // Verify that cleanTokenId is valid
    if (!cleanTokenId || isNaN(parseInt(cleanTokenId))) {
      console.error(`[metadata] Token ID inválido: ${cleanTokenId}`);
      return res.status(400).json({ error: 'Invalid token ID' });
    }

    // Convert cleanTokenId to number for comparisons
    const tokenIdNum = parseInt(cleanTokenId);

    // Build base URL for images
    const baseUrl = 'https://adrianlab.vercel.app';
    const version = Date.now();

    // ===== LÓGICA ESPECIAL: SAMURAIZERO (500-1099) - REEMPLAZADA POR LÓGICA BASADA EN TAGS =====
    // El código antiguo basado en rango ha sido reemplazado por lógica basada en tags del contrato
    // Ver lógica de SamuraiZERO más abajo (después de obtener tagInfo)

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
    if (isBananaToken) urlParams.push('banana=true');
    const paramsString = urlParams.length > 0 ? `?${urlParams.join('&')}&v=${version}` : `?v=${version}`;
    
    // Detectar traits animados para determinar extensión de imagen (.gif o .png)
    let imageExtension = '.png';
    try {
      const { getAnimatedTraits, isTraitAnimated } = await import('../../../lib/animated-traits-helper.js');
      
      // Si el tokenId está en el rango de traits (1-9999), verificar si es un trait animado directamente
      if (tokenIdNum >= 1 && tokenIdNum <= 9999) {
        const isAnimated = await isTraitAnimated(tokenIdNum);
        if (isAnimated) {
          imageExtension = '.gif';
          console.log(`[metadata] 🎬 Token ${cleanTokenId} es un trait animado, usando .gif`);
        }
      }
      
      // También verificar si el token existe como AdrianZERO y tiene traits animados equipados
      const { core, traitsExtension } = await getContracts();
      let tokenExists = false;
      
      try {
        await core.getTokenData(cleanTokenId);
        tokenExists = true;
      } catch (tokenError) {
        // Token no existe en el contrato como AdrianZERO, pero ya verificamos si es trait animado arriba
        tokenExists = false;
      }
      
      // Si el token existe como AdrianZERO, verificar traits equipados
      if (tokenExists) {
        try {
          const [categories, traitIds] = await traitsExtension.getAllEquippedTraits(cleanTokenId);
          const allTraitIds = traitIds.map(id => id.toString()).filter(id => id && id !== 'None' && id !== '');
          
          if (allTraitIds.length > 0) {
            const animatedTraits = await getAnimatedTraits(allTraitIds);
            
            if (animatedTraits.length > 0) {
              imageExtension = '.gif';
              console.log(`[metadata] 🎬 Traits animados detectados en AdrianZERO ${cleanTokenId}, usando .gif`);
            }
          }
        } catch (contractError) {
          // Si hay error obteniendo traits, ya tenemos el resultado del check de trait animado
          console.warn(`[metadata] Error obteniendo traits del contrato para token ${cleanTokenId}:`, contractError.message);
        }
      }
    } catch (error) {
      console.warn(`[metadata] Error detectando traits animados, usando .png por defecto:`, error.message);
    }
    
    const imageUrl = `${baseUrl}/api/render/${cleanTokenId}${imageExtension}${paramsString}`;
    
    // Verificar tag del token ANTES de crear baseMetadata para poder sobreescribir el nombre
    const { getTokenTagInfo } = await import('../../../lib/tag-logic.js');
    const tagInfo = await getTokenTagInfo(cleanTokenId);
    
    // Determinar el nombre base según el tag
    let tokenName = `ZERO #${cleanTokenId}`;
    if (tagInfo.tag === 'SubZERO') {
      tokenName = 'SubZERO';
      console.log(`[metadata] Token ${cleanTokenId} tiene tag SubZERO, sobreescribiendo nombre a "SubZERO"`);
    }
    
    // ===== LÓGICA ESPECIAL SAMURAIZERO =====
    if (tagInfo.tag === 'SamuraiZERO') {
      try {
        const { getSamuraiZEROIndex, TAG_CONFIGS } = await import('../../../lib/tag-logic.js');
        const samuraiIndex = await getSamuraiZEROIndex(cleanTokenId);
        
        if (samuraiIndex !== null && samuraiIndex >= 0 && samuraiIndex < 600) {
          console.log(`[metadata] 🥷 Token ${cleanTokenId} es SamuraiZERO con índice ${samuraiIndex}`);
          
          // Cargar samuraimetadata.json
          const samuraiMetadataPath = path.join(process.cwd(), 'public', 'labmetadata', 'samuraimetadata.json');
          const samuraiMetadataContent = fs.readFileSync(samuraiMetadataPath, 'utf8');
          const samuraiMetadata = JSON.parse(samuraiMetadataContent);
          
          // Obtener la entrada correspondiente
          const samuraiEntry = samuraiMetadata.collection[samuraiIndex];
          
          if (samuraiEntry) {
            // Extraer nombre base y reemplazar número con tokenId real
            const nameMatch = samuraiEntry.name.match(/^(.+?)\s*#\d+$/);
            const baseName = nameMatch ? nameMatch[1] : samuraiEntry.name.split('#')[0].trim();
            const finalName = `${baseName} #${cleanTokenId}`;
            
            // Construir URL de imagen (usar endpoint de renderizado normal)
            const urlParams = [];
            if (isCloseupToken) urlParams.push('closeup=true');
            if (isShadowToken) urlParams.push('shadow=true');
            if (isGlowToken) urlParams.push('glow=true');
            if (isBnToken) urlParams.push('bn=true');
            if (isUvToken) urlParams.push('uv=true');
            if (isBlackoutToken) urlParams.push('blackout=true');
            if (isBananaToken) urlParams.push('banana=true');
            const paramsString = urlParams.length > 0 ? `?${urlParams.join('&')}&v=${version}` : `?v=${version}`;
            const samuraiImageUrl = `${baseUrl}/api/render/${cleanTokenId}.png${paramsString}`;
            
            // Construir metadata completo
            const samuraiMetadataResult = {
              name: finalName,
              description: samuraiEntry.description || `SamuraiZERO by HalfxTiger`,
              image: samuraiImageUrl,
              external_url: samuraiEntry.external_url || samuraiImageUrl,
              metadata_version: "2",
              attributes: [
                {
                  trait_type: "Generation",
                  value: TAG_CONFIGS.SamuraiZERO.metadataGenOverride
                },
                ...(samuraiEntry.attributes || [])
              ]
            };
            
            // Añadir masterminds si existen
            if (samuraiEntry.masterminds) {
              samuraiMetadataResult.masterminds = samuraiEntry.masterminds;
            }
            
            console.log(`[metadata] 🥷 SamuraiZERO metadata generado: ${finalName}`);
            
            res.setHeader('Content-Type', 'application/json');
            res.setHeader('X-Version', 'SAMURAIZERO');
            return res.status(200).json(samuraiMetadataResult);
          } else {
            console.error(`[metadata] 🥷 SamuraiZERO índice ${samuraiIndex} no encontrado en JSON`);
          }
        } else {
          console.error(`[metadata] 🥷 SamuraiZERO token ${cleanTokenId} tiene índice inválido: ${samuraiIndex}`);
        }
      } catch (error) {
        console.error(`[metadata] 🥷 Error procesando SamuraiZERO ${cleanTokenId}:`, error.message);
        console.error(`[metadata] 🥷 Stack trace:`, error.stack);
        // Continuar con lógica normal si hay error
      }
    }
    
    const baseMetadata = {
      name: tokenName,
      description: `A ZERO from the AdrianLAB collection`,
      image: imageUrl,
      external_url: imageUrl,
      metadata_version: "2",
      attributes: []
    };
    
    try {
      // Test de conexión a contratos
      console.log('[metadata] Intentando conectar con los contratos...');
      const { core, traitsExtension, patientZero, serumModule, adrianNameRegistry, duplicatorModule } = await getContracts();
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
        const nameHistory = await adrianNameRegistry.getTokenNameHistory(cleanTokenId);
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
        const tokenStatus = await patientZero.getTokenStatus(cleanTokenId);
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
      // 3. "ZERO" es el fallback por defecto
      // Si el token tiene tag SubZERO, el nombre ya fue establecido arriba, no sobrescribir
      if (tagInfo.tag === 'SubZERO') {
        // El nombre ya fue establecido como "SubZERO" arriba, mantenerlo
        console.log(`[metadata] Nombre SubZERO mantenido (prioridad máxima): ${baseMetadata.name}`);
      } else if (profileName) {
        baseMetadata.name = `${profileName} #${cleanTokenId}`;
        console.log(`[metadata] Nombre de perfil aplicado (prioridad alta): ${baseMetadata.name}`);
      } else if (customName) {
        baseMetadata.name = `${customName} #${cleanTokenId}`;
        console.log(`[metadata] Nombre personalizado aplicado (prioridad media): ${baseMetadata.name}`);
      } else {
        baseMetadata.name = `ZERO #${cleanTokenId}`;
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
        const traitsArray = loadMetadataForToken(cleanTokenId);
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

      // ===== OBTENER INFORMACIÓN DE DUPLICACIÓN (antes de serums) =====
      let dupInfo = null;
      try {
        dupInfo = await getTokenDupInfo(duplicatorModule, cleanTokenId);
        if (dupInfo && dupInfo.duplicated) {
          console.log(`[metadata] 🔄 DUPLICATOR: Token ${cleanTokenId} está duplicado (sourceId=${dupInfo.sourceId}, dupNumber=${dupInfo.dupNumber})`);
        }
      } catch (error) {
        console.error(`[metadata] ⚠️ Error obteniendo dupInfo para token ${cleanTokenId}:`, error.message);
      }

      // ===== OVERRIDE DE NOMBRE PARA TOKENS DUPLICADOS (GenZERO) =====
      if (dupInfo && dupInfo.duplicated) {
        baseMetadata.name = `GenZERO #${cleanTokenId}`;
        console.log(`[metadata] 🔄 DUPLICATOR: Nombre sobrescrito a "${baseMetadata.name}" (token duplicado)`);
      }

      // Obtener historial de serums desde SerumModule
      // Si es duplicado, obtener serum del token padre (sourceId)
      try {
        const serumSourceTokenId = (dupInfo && dupInfo.duplicated && dupInfo.sourceId) ? dupInfo.sourceId : cleanTokenId;

        if (dupInfo && dupInfo.duplicated && dupInfo.sourceId) {
          console.log(`[metadata] 🔄 DUPLICATOR: Obteniendo serum del padre (sourceId=${dupInfo.sourceId})`);
        }

        console.log('[metadata] Llamando a getTokenSerumHistory desde SerumModule...');
        const serumHistory = await serumModule.getTokenSerumHistory(serumSourceTokenId);
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
          console.log(`[metadata] Token ${cleanTokenId} tiene tag SubZERO, sobreescribiendo Generation a "${generationValue}"`);
        }
      }

      baseMetadata.attributes.push(
        {
          trait_type: "Generation",
          value: generationValue
        }
      );

      // ===== LÓGICA DUPLICATOR: Añadir atributo DupGeneration si el token está duplicado =====
      // (dupInfo ya fue obtenido antes de la lógica de serums)
      if (dupInfo && dupInfo.duplicated && dupInfo.dupNumber > 0) {
        const dupGeneration = getDupGenerationAttribute(dupInfo.dupNumber);
        baseMetadata.attributes.push({
          trait_type: "DupGeneration",
          value: dupGeneration
        });
        console.log(`[metadata] 🔄 DUPLICATOR: Añadiendo DupGeneration=${dupGeneration}`);
      }

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

      // Añadir campo Toggle con nombres de toggles activos
      const activeToggles = [];
      
      // Usar las variables booleanas que ya están disponibles en el scope
      if (isCloseupToken) activeToggles.push('CLOSEUP');
      if (isShadowToken) activeToggles.push('SHADOW');
      if (isGlowToken) activeToggles.push('GLOW');
      if (isBnToken) activeToggles.push('BN');
      if (isUvToken) activeToggles.push('UV');
      if (isBlackoutToken) activeToggles.push('BLACKOUT');
      if (isBananaToken) activeToggles.push('BANANA');
      
      // Añadir campo Toggle solo si hay toggles activos
      if (activeToggles.length > 0) {
        baseMetadata.attributes.push({
          trait_type: "Toggle",
          value: activeToggles.join(', ')
        });
        console.log(`[metadata] Toggle añadido: ${activeToggles.join(', ')}`);
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
    
    // ===== PRUEBA PUNTUAL: Token 682 - animation_url =====
    // TODO: ELIMINAR ESTA SECCIÓN DESPUÉS DE LA PRUEBA
    // Este es un test temporal para añadir animation_url al token 682
    // Para revertir: simplemente eliminar este bloque if completo
    if (tokenIdNum === 682) {
      baseMetadata.animation_url = 'https://adrianzero.com/mcinteractive/';
      console.log(`[metadata] 🧪 TEST: animation_url añadido para token 682 → ${baseMetadata.animation_url}`);
    }
    // ===== FIN PRUEBA PUNTUAL =====
    
    return res.status(200).json(baseMetadata);
  } catch (error) {
    console.error('[metadata] Error general:', error);
    console.error('[metadata] Stack trace:', error.stack);
    
    return res.status(200).json({
      name: `ZERO #${req.query.tokenId || 'Unknown'}`,
      description: `A ZERO from the AdrianLAB collection (Error Mode)`,
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