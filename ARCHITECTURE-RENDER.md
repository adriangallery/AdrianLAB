# AdrianLAB — Render & Metadata Architecture

**Fecha**: 2026-05-19  
**Estado del sistema**: HYBRID (post-C2-Fase5). V1 es canónico. V2 render sobrevive obligatoriamente para ZEROmovies S1/S2. V2 metadata existe pero no sirve tráfico de producción.  
**Fuente de verdad de cambios de código**: Este documento.

---

## 1. Mapa de superficie pública

### Rewrites activos en `next.config.js` (hoy)

El archivo `next.config.js` contiene exactamente estas reglas de rewrite (líneas 27-43):

| Rewrite | Source | Destination | Efecto real |
|---------|--------|-------------|-------------|
| Metadata estática | `/metadata/:path*` | `/metadata/:path*.json` | Añade extensión .json a archivos estáticos de `/public/metadata/` |
| Custom-external explícito | `/api/render/custom-external/:path*` | `/api/render/custom-external/:path*` | Identity rewrite (sin efecto funcional; documenta intención) |
| Floppy metadata con .json | `/api/metadata/floppy/:id.json` | `/api/metadata/floppy/:id.json` | Identity |
| Floppy metadata sin .json | `/api/metadata/floppy/:id` | `/api/metadata/floppy/:id` | Identity |
| **NO HAY** catch-all render | — | — | El catch-all `/api/render→/api/v2/render` fue eliminado en commit `e658994a` |
| **NO HAY** redirect metadata | — | — | El rewrite `/api/metadata→/api/v2/metadata` fue eliminado en C2-Fase5 |

### Superficie pública real (lo que sirve cada URL)

| URL pública | Handler real | Canónica/Interna | Colecciones |
|-------------|-------------|-----------------|-------------|
| `GET /api/metadata/:tokenId` | `pages/api/metadata/[tokenId].js` (1191 líneas) | **CANÓNICA** — tokenURI del contrato AdrianZERO, OpenSea, TraitLabV4 | Todas (AdrianZERO, SubZERO, SamuraiZERO, GumballZERO, ZEROmovies S1, ZEROmovies S2, SPECIAL_TOKENS, ActionPacks, duplicados, serum) |
| `GET /api/render/:tokenId` | `pages/api/render/[tokenId].js` (2670 líneas) | **CANÓNICA** — imagen real en OpenSea/TraitLabV4 | Todas excepto ZEROmovies S1/S2 (que redirige 302 a v2) |
| `GET /api/render/custom-external/:tokenId` | `pages/api/render/custom-external/[tokenId].js` (2094 líneas) | Canónica para TraitLab preview | AdrianZERO normal (preview traits antes de equipar) |
| `GET /api/render/custom/:tokenId` | `pages/api/render/custom/[tokenId].js` (1993 líneas) | Accesible pero no llamado en producción (solo index.js demo) | AdrianZERO normal (endpoint legacy, uso interno/test) |
| `GET /api/v2/render/:tokenId` | `pages/api/v2/render/[tokenId].js` (371 líneas) | **OBLIGATORIA para movies** — llamada por redirect 302 del v1 render y directamente por v1 metadata para ZEROmovies | ZEROmovies S1 y S2 exclusivamente en producción |
| `GET /api/v2/metadata/:tokenId` | `pages/api/v2/metadata/[tokenId].js` (129 líneas) | Accesible directamente pero **NO sirve tráfico de producción**. Referenciada solo en `scripts/validate-v2.js` (comparación offline) | — (no hay consumidor en producción) |
| `GET /api/v2/render/custom-external/:tokenId` | `pages/api/v2/render/custom-external/[tokenId].js` (268 líneas) | **NO llamada directamente**. TraitLabV4 llama a `/api/render/custom-external/` (v1). Este endpoint existe pero ningún frontend lo referencia. | — |
| `GET /api/metadata/floppy/:id` | `pages/api/metadata/floppy/[id].js` (931 líneas) | Canónica para floppies | Floppy Discs, pagers, serums (IDs 1-9999 sin AdrianZERO) |
| `GET /api/render/floppy/:tokenId` | `pages/api/render/floppy/[tokenId].js` (734 líneas) | Canónica — imagen en OpenSea para FloppyDiscs | Floppy Discs, pagers, studio T-Shit como trait standalone, achievements |
| `GET /api/render/floppy-v4/:tokenId` | `pages/api/render/floppy-v4/[tokenId].js` (92 líneas) | Secundaria — delega en `lib/renderers/card-v4-renderer.js` | Floppy card layout V4 |
| `GET /api/render/lambo/:tokenId` | `pages/api/render/lambo/[tokenId].js` (74 líneas) | Secundaria | AdrianZERO sobre fondo Lambo |
| `GET /api/render/nanobanana/:tokenId` | `pages/api/render/nanobanana/[tokenId].js` (143 líneas) | Secundaria | Transformación AI banana standalone |
| `GET /api/render/displacement/:tokenId` | `pages/api/render/displacement/[tokenId].js` (606 líneas) | Secundaria | Animaciones de desplazamiento SVG |
| `GET /api/render/gif` | `pages/api/render/gif.js` (133 líneas) | Test/debug | GIF renderer directo |
| `GET /api/rendershadow/:tokenId` | `pages/api/rendershadow/[tokenId].js` (1275 líneas) | **Sin consumidor externo conocido** — 0 referencias en codebase | Réplica de v1 render con lógica serum extendida |

---

## 2. Tabla colección → dónde aplicar un cambio

Para cada tipo de colección, los archivos exactos donde tocar metadata Y render:

### AdrianZERO — Normal (GEN0/GEN1/GEN2, skin Zero/Dark/Alien/Albino)

| Capa | Archivo | Función/sección | Notas |
|------|---------|-----------------|-------|
| **Metadata** | `pages/api/metadata/[tokenId].js` | Handler principal, lógica fallthrough tras todos los early-returns especiales (líneas ~635-1190) | Nombre via `adrianNameRegistry.getTokenNameHistory` + `patientZero.getTokenStatus` |
| **Render** | `pages/api/render/[tokenId].js` | PASO 2 (skin normal, líneas ~1570-1610), PASO 3 (traits, líneas ~1626-1703), PASO 4 (TOP, líneas ~1705-1802) | Asset path: `public/labimages/{traitId}.svg` |
| **Skin assets** | `public/traits/ADRIAN/GEN{0-2}-{Medium|Dark|Alien|Albino}.svg` | — | Solo para skins base; traits normales en labimages |

### AdrianZERO — GEN especiales (Duplicados)

| Capa | Archivo | Función/sección |
|------|---------|-----------------|
| **Metadata** | `pages/api/metadata/[tokenId].js` | `getTokenDupInfo` → atributo `DupGeneration` (líneas ~845-900) |
| **Render** | `pages/api/render/[tokenId].js` | `getEffectiveGeneration(dupInfo, generation)` línea ~930; `getDupSkinPathADRIAN` en `lib/duplicator-logic.js:23`; texto "PARENT #X" PASO PARENT líneas ~2124-2148 |
| **Lib** | `lib/duplicator-logic.js` | `getTokenDupInfo`, `getEffectiveGeneration`, `getDupSkinPathADRIAN`, `getDupSkinPathADRIANGF` |

### AdrianGF (serum AdrianGF + GoldenAdrian)

| Capa | Archivo | Función/sección |
|------|---------|-----------------|
| **Metadata** | `pages/api/metadata/[tokenId].js` | Atributo `UsedSerum` via `serumModule.getTokenSerumHistory` (líneas ~900-1050) |
| **Render** | `pages/api/render/[tokenId].js` | PASO 2 rama `appliedSerum==="AdrianGF"` (líneas ~1449-1504); rama `serumFailed` (líneas ~1521-1560) |
| **Skin assets** | `public/traits/ADRIANGF/GF{gen}-{skinType}.svg`, `GF-Fail.svg`, `GF-Goldfail.svg` | — |

### SubZERO

| Capa | Archivo | Función/sección |
|------|---------|-----------------|
| **Metadata** | `pages/api/metadata/[tokenId].js` | Detección via `tagInfo.tag==='SubZERO'` → tokenName='SubZERO' línea ~390 |
| **Render** | `pages/api/render/[tokenId].js` | `filterEyesForTag` + `forceSkinTraitForTag` líneas ~1055-1073 |
| **Tag config** | `lib/tag-logic.js` | `TAG_CONFIGS.SubZERO`, `filterEyesForTag` (línea 57), `forceSkinTraitForTag` (línea 84) |
| **SKINTRAIT asset** | `public/labimages/1125.svg` | Forzado por `TAG_CONFIGS.SubZERO.forcedSkinTrait=1125` |

### SamuraiZERO (incluye Honor)

| Capa | Archivo | Función/sección |
|------|---------|-----------------|
| **Metadata** | `pages/api/metadata/[tokenId].js` | Bloque `tagInfo.tag==='SamuraiZERO'` líneas ~396-475; `getSamuraiZEROIndex` (de `lib/tag-logic.js`); `getTokenHonor` (de `lib/contracts.js:337`) |
| **Metadata JSON** | `public/labmetadata/samuraimetadata.json` | Entrada por índice ordinal |
| **Render** | `pages/api/render/[tokenId].js` | `getSamuraiZEROIndex` línea ~1080; fuerza `equippedTraits['TOP']=imageIndex` línea ~1087; carga desde `labimages/samuraizero/{id}.svg` PASO 4 líneas ~1749-1785 |
| **TOP assets** | `public/labimages/samuraizero/{500-1099}.svg` | Índice = `500 + samuraiIndex` |

### ZEROmovies S1 (`tag==='ZEROmovies'`)

| Capa | Archivo | Función/sección |
|------|---------|-----------------|
| **Metadata** | `pages/api/metadata/[tokenId].js` | Bloque `tagInfo.tag==='ZEROmovies'` líneas ~584-633; `getTokenMovieId` de `lib/contracts.js:519`; lee `zeromoviesmetadata.json`; `image → /api/v2/render/{id}.png` |
| **Render** | `pages/api/v2/render/[tokenId].js` | Compositor v2; overlay `labimages/zeromovies/{movieId}` en `compositor.js` línea ~176 |
| **Redirect v1→v2** | `pages/api/render/[tokenId].js` | Líneas ~1046-1053: 302 a `/api/v2/render/{id}.png` si `tag==='ZEROmovies'` |
| **Compositor overlay** | `lib/v2/render/compositor.js` | Línea ~174: `loadTraitFromLabimages('zeromovies/${movieId}')` |
| **Metadata JSON** | `public/labmetadata/zeromoviesmetadata.json` | Por movieId |

### ZEROmovies S2 (`tag==='ZEROmovies2'`)

| Capa | Archivo | Función/sección |
|------|---------|-----------------|
| **Metadata** | `pages/api/metadata/[tokenId].js` | Bloque `tagInfo.tag==='ZEROmovies2'` líneas ~518-578; `getMovie2Info` de `lib/contracts.js:536`; reads `zeromovies2metadata.json`; `image → /api/v2/render/{id}.png` |
| **Render** | `pages/api/v2/render/[tokenId].js` | Compositor v2; `buildOverdueState` líneas ~329-342; sello OVERDUE + animación S2 |
| **Redirect v1→v2** | `pages/api/render/[tokenId].js` | Líneas ~1046-1053: 302 si `tag==='ZEROmovies2'` |
| **Compositor overlay** | `lib/v2/render/compositor.js` | Línea ~175: `loadTraitFromLabimages('zeromovies2/${movieId}')` |
| **Metadata JSON** | `public/labmetadata/zeromovies2metadata.json` | Por movieId; campo `hasAnimation` controla `animation_url` |

### GumballZERO

| Capa | Archivo | Función/sección |
|------|---------|-----------------|
| **Metadata** | `pages/api/metadata/[tokenId].js` | Bloque GumballZERO líneas ~477-516; `resolveGumballForToken` de `lib/v2/tags/tag-resolver.js:150`; lee `gums.json` |
| **Render** | `pages/api/render/[tokenId].js` | Bloque GumballZERO líneas ~1095-1144; `resolveGumballForToken`; reconstruye `equippedTraits` desde `gums.json`; fuerza `baseImagePath='ADRIAN/GEN0-Light.svg'` |
| **Datos** | `public/labmetadata/gums.json` | Colección ordenada; índice = posición ordinal on-chain |
| **Detección** | `lib/v2/tags/tag-resolver.js` | `resolveGumballForToken` (línea 150) via `gumballWasMintedHere` on-chain; `getGumballIndex` (línea 89); `getGumballTraits` (línea 58) |

### SPECIAL_TOKENS (1/1s con GIF estático)

| Capa | Archivo | Función/sección |
|------|---------|-----------------|
| **Metadata v1** | `pages/api/metadata/[tokenId].js` | `SPECIAL_TOKENS` const inline líneas ~9-41 (IDs: 302, 441, 442, 445, 454, 459, 740, 815); check líneas ~1099-1116 |
| **Metadata v2** | `lib/v2/metadata/special-tokens.js` | `getSpecialTokenMetadata` (línea 14); `SPECIAL_TOKENS` importado de `lib/v2/shared/constants.js:105` (incluye ID 750 TAXreaper — **ausente en v1**) |
| **Render v2** | `pages/api/v2/render/[tokenId].js` | Líneas ~83-95: sirve GIF estático desde `public/labimages/specials/{id}.gif` |
| **Assets** | `public/labimages/specials/{302|441|442|445|454|459|740|750|815}.gif/.png` | — |
| **DIVERGENCIA** | — | v1 metadata (`pages/api/metadata/[tokenId].js`) no tiene token 750 en su SPECIAL_TOKENS inline. v2 constants sí. Para añadir un nuevo special hay que editar AMBOS. |

### ActionPacks (15008-15010)

| Capa | Archivo | Función/sección |
|------|---------|-----------------|
| **Metadata** | `pages/api/metadata/[tokenId].js` | Bloque `tokenIdNum >= 15008 && tokenIdNum <= 15010` líneas ~249-318 |
| **Datos** | `public/labmetadata/ActionPacks.json` | Array `packs` |
| **Imagen** | `public/labimages/{packId}.png` | Con fallback a nombres legacy (ozzy.png, hulk.png) |

### Duplicados / Replicación

Ver sección AdrianZERO — GEN especiales arriba. La rama de duplicados en render está en `pages/api/render/[tokenId].js` líneas ~898-980 (obtención dupInfo, herencia skin del padre) y líneas ~2124-2148 (texto PARENT).

### Serum / Mutación

| Capa | Archivo | Función/sección |
|------|---------|-----------------|
| **Metadata** | `pages/api/metadata/[tokenId].js` | Atributo `UsedSerum` vía `serumModule.getTokenSerumHistory` |
| **Render** | `pages/api/render/[tokenId].js` | Lógica completa serum líneas ~1162-1233; ramas GoldenAdrian/AdrianGF/failed en PASO 2 líneas ~1431-1560 |
| **Skin assets serum** | `public/traits/ADRIAN/GEN{n}-Goldenfail.svg`, `public/traits/ADRIANGF/GF-Fail.svg`, `GF-Goldfail.svg`, `GEN{n}-Golden.svg` | — |

### Traits animados / GIF (secuenciales multi-frame)

| Capa | Archivo | Función/sección |
|------|---------|-----------------|
| **Detección v1** | `lib/animated-traits-helper.js` | `getAnimatedTraits(traitIds)` línea 67; `isTraitAnimated(traitId)` línea 113; detecta variantes `{id}a.svg`, `{id}b.svg`... en `labimages/` |
| **Detección v2** | `lib/v2/render/gif-pipeline.js` | `detectAnimatedTraits(traitIds)` línea 16; mismo patrón filesystem |
| **Generación GIF** | `lib/gif-generator.js` | `generateGifFromLayers` (línea 171); `createBounceSquashFrameGenerator` (línea 543); usado por v1 render y v2 render |
| **Metadata** | `pages/api/metadata/[tokenId].js` | Detecta animados para cambiar `imageExtension` a `.gif` líneas ~332-380 |
| **Render v1** | `pages/api/render/[tokenId].js` | Bloque GIF líneas ~2393-2670 aproximado |
| **Render v2** | `pages/api/v2/render/[tokenId].js` | Bloque GIF líneas ~248-300 |

### Studio T-Shit (30014-35000)

| Capa | Archivo | Función/sección |
|------|---------|-----------------|
| **Fast-path render v1** | `pages/api/render/[tokenId].js` | Líneas ~267-306: `isTShitV2` → `resolveTShitUri` → sirve PNG directamente |
| **Fast-path render v2** | `pages/api/v2/render/[tokenId].js` | Líneas ~51-80: misma lógica usando `rasteriseStudioSvg` |
| **Como trait equipado** | `pages/api/render/[tokenId].js` | `loadExternalTrait(traitId)` línea ~815; V1 (30000-30013) hardcoded URL, V2 (30014+) on-chain URI |
| **Resolver** | `lib/v2/rpc/tshit-resolver.js` | `isTShitV2(numId)` (rango 30014-35000); `resolveTShitUri(numId)` (llama `tshitGetDesignURI` on-chain) |
| **Metadata** | `public/labmetadata/studio.json` | Entrada por tokenId; el render usa URI on-chain, no este JSON |

### OG Punks (100001-101003)

| Capa | Archivo | Función/sección |
|------|---------|-----------------|
| **Render** | `pages/api/render/[tokenId].js` | `loadOgpunkTrait(traitId)` línea ~860; carga desde `labimages/ogpunks/{id}.svg`; caso especial 101003 CAESAR sirve GIF (líneas ~1725-1737) |
| **Metadata** | `public/labmetadata/ogpunks.json` | Array `traits` |
| **Assets** | `public/labimages/ogpunks/{id}.svg/.gif` | — |

---

## 3. Inventario de archivos

### Endpoints producción (`pages/api/render*`, `pages/api/metadata*`, `pages/api/v2/*`)

| Archivo | Líneas | Propósito | Importado por |
|---------|--------|-----------|---------------|
| `pages/api/render/[tokenId].js` | 2670 | **V1 render canónico**: composición SVG Canvas 4-paso, todos los tipos de token, GIF, efectos, bounce | TraitLabV4 (`api/render/{id}.png`), OpenSea (vía tokenURI) |
| `pages/api/metadata/[tokenId].js` | 1191 | **V1 metadata canónico**: 7 niveles de nombre, todos los early-returns por colección, toggles on-chain | tokenURI del contrato AdrianZERO, OpenSea, TraitLabV4 |
| `pages/api/v2/render/[tokenId].js` | 371 | **V2 render** (obligatorio para movies): Multicall3 + compositor + KV cache + GIF bounce | redirect 302 desde v1 render (movies); v1 metadata `image` para movies |
| `pages/api/v2/metadata/[tokenId].js` | 129 | V2 metadata: KV cache + ETag 304 + builder | Solo `scripts/validate-v2.js` (offline) |
| `pages/api/render/custom-external/[tokenId].js` | 2094 | Preview traits en TraitLab: carga traits customizados + GIF pipeline completo | TraitLabV4 `useTraitSelection.ts:39`, `imageService.ts:29` |
| `pages/api/render/custom/[tokenId].js` | 1993 | Legacy preview sin external service: render custom sin GIF externo | Solo `pages/index.js` (demo) y `scripts/test-gif-simple-v3.js` (test) |
| `pages/api/v2/render/custom-external/[tokenId].js` | 268 | V2 custom-external: usa compositor para PNG, delega a v1 para GIF | Nadie en producción (v1 custom-external es el activo) |
| `pages/api/rendershadow/[tokenId].js` | 1275 | Render con lógica serum extendida (shadow + variantes serum) | 0 referencias externas encontradas |
| `pages/api/metadata/floppy/[id].js` | 931 | Metadata floppies/pagers/serums/packs | `lib/renderers/floppy-renderer.js` (interna); OpenSea para colecciones Floppy |
| `pages/api/render/floppy/[tokenId].js` | 734 | Render floppy card: `FloppyRenderer` + `card-v4-renderer` + GIF animado | OpenSea para FloppyDiscs |
| `pages/api/render/floppy/[tokenId]/svg.js` | — | Sirve SVG raw de la floppy card | — |
| `pages/api/render/floppy-v4/[tokenId].js` | 92 | Floppy card layout V4 (alternativo) | Referencias internas |
| `pages/api/render/lambo/[tokenId].js` | 74 | AdrianZERO sobre fondo Lambo | `pages/index.js` |
| `pages/api/render/nanobanana/[tokenId].js` | 143 | Banana transform standalone | — |
| `pages/api/render/displacement/[tokenId].js` | 606 | SVG displacement animation | — |
| `pages/api/render/gif.js` | 133 | GIF renderer test | — |

### `lib/` raíz — helpers V1

| Archivo | Líneas | Propósito | Importado por |
|---------|--------|-----------|---------------|
| `lib/contracts.js` | 550 | Provider ethers.js v5, `getContracts()`, `getTokenTag`, `getTokenMovieId`, `getMovie2Info`, `getTokenHonor`, `getTokensByTag` | v1 render, v1 metadata, tag-logic.js, v1 custom-external |
| `lib/tag-logic.js` | 159 | `getTokenTagInfo`, `TAG_CONFIGS`, `filterEyesForTag`, `forceSkinTraitForTag`, `getSamuraiZEROIndex` | v1 render (dynamic import), v1 metadata (dynamic import) |
| `lib/cache.js` | 1434 | V1 cache en memoria: `getCachedAdrianZeroRender`, `setCachedAdrianZeroRender`, `getAdrianZeroRenderTTL`, `getCachedAdrianZeroGif`, closeup, etc. | v1 render, v1 custom-external, nanobanana, floppy render, admin endpoints |
| `lib/gif-generator.js` | 1002 | `generateGifFromLayers`, `createBounceSquashFrameGenerator`, `generateFloppyGif`, `generateFloppyGifV4`, `generateStandaloneAnimatedV4` | v1 render, v2 render, v1 custom-external, floppy render, bounce-test |
| `lib/github-storage.js` | 1100 | `loadLabimagesAsset`, `fileExistsInGitHubByHash`, `uploadFileToGitHubByHash`, `fileExistsInGitHubCustom`, `deleteAllRendersForToken` — I/O al repo GitHub como CDN | v1 render, v1 custom-external, floppy render |
| `lib/render-hash.js` | 348 | `generateRenderHash`, `generateCustomRenderHash`, `generateTraitHash`, `generateFloppyGifHash` — content-hash para cache invalidation | v1 render, v1 custom-external, v1 custom |
| `lib/animated-traits-helper.js` | 132 | `getAnimatedTraits`, `isTraitAnimated`, `detectAnimatedVariants` — filesystem probe de `{id}a.svg` variantes | v1 render, v1 custom-external, v1 metadata |
| `lib/duplicator-logic.js` | 118 | `getTokenDupInfo`, `getEffectiveGeneration`, `getDupSkinPathADRIAN`, `getDupSkinPathADRIANGF`, `buildSkinPath` | v1 render, v1 custom-external |
| `lib/toggle-cache.js` | 144 | `updateTogglesIfNeeded`, `hasToggleActive` — toggle on/off en memoria para v1 | v1 render, v1 metadata, admin/toggle-stats |
| `lib/svg-png-cache.js` | 116 | `getCachedSvgPng`, `setCachedSvgPng` — LRU en memoria para conversiones SVG→PNG | v1 render, v1 custom-external, displacement |
| `lib/component-cache.js` | 126 | `getCachedComponent`, `setCachedComponent` — LRU en memoria para imágenes canvas intermedias | v1 render, v1 custom-external |
| `lib/contract-cache.js` | 168 | `createCachedContract` — wrapper con LRU de 24h sobre ethers.js Contract | `lib/contracts.js` |
| `lib/json-cache.js` | 98 | `getCachedJson`, `setCachedJson` — LRU para parsed JSON | v1 custom-external, v1 custom |
| `lib/duplicator-cache.js` | 198 | Cache de resultados de duplicación | `admin/duplicator-cache.js` |
| `lib/nanobanana-transformer.js` | 406 | `transformWithNanoBanana` — transformación via Google Gemini | v1 render, nanobanana endpoint |
| `lib/nanobanana-prompt.js` | 81 | `buildNanobananaPrompt` — prompt template Gemini | v1 render |
| `lib/animation-helpers.js` | 475 | `calculateBounceWithDelay`, `calculateExplodeDisplacement`, `calculateAppleExplodeZ` | v1 custom-external, v1 custom, displacement, test-gif-simple-v3 |
| `lib/displacement-loader.js` | 176 | `loadTraitWithDisplacement` | displacement endpoint |
| `lib/text-to-svg.js` | 210 | `textToSVGElement`, `linesToSVG`, `createSVGWithPaths` | test-image, test-text-to-svg, debug-floppy, debug-svg |
| `lib/floppy.js` | 77 | `getFloppyData` | `pages/api/floppy/` endpoints |
| `lib/blockchain.js` | 240 | `getAssetInfo`, `getPackTraitPools` — datos on-chain para traits y packs | `pages/api/trait/`, `pages/api/traits/preview/` |
| `lib/traits-order.js` | 160 | `processTokenInfo` | `lib/blockchain.js` |
| `lib/external-render-client.js` | 190 | `renderViaExternalService`, `prepareRenderData`, `checkExternalServiceHealth` — cliente HTTP para servicio render externo (Render.com) | v1 custom-external, debug/render-custom, test-railway-health |

### `lib/renderers/` — renderers encapsulados

| Archivo | Líneas | Propósito | Importado por |
|---------|--------|-----------|---------------|
| `lib/renderers/floppy-renderer.js` | 788 | `FloppyRenderer` class — render completo de floppy disk card | `pages/api/render/floppy/[tokenId].js`, `svg.js` |
| `lib/renderers/card-v4-renderer.js` | 299 | `renderV4CardPng`, `buildV4CardSvg`, `renderV4CardFramePng` — layout V4 | floppy endpoint, floppy-v4 endpoint |
| `lib/renderers/adrianzero-renderer.js` | 1690 | `AdrianZeroRenderer` class | `pages/api/render/lambo/[tokenId].js` |
| `lib/renderers/gif-renderer.js` | 238 | `GifRenderer` class | `pages/api/render/gif.js` |

### `lib/v2/` — stack V2

| Archivo | Líneas | Propósito | Importado por |
|---------|--------|-----------|---------------|
| `lib/v2/render/compositor.js` | 383 | `compositeToken` — orquesta render completo v2 (4 pasos: bg, skin, traits, effects) | v2 render `[tokenId].js`, v2 custom-external |
| `lib/v2/render/layer-order.js` | 134 | `normalizeTraits`, `getLayerSequence`, `getTraitLoadPath` | compositor, v2 render, v2 custom-external |
| `lib/v2/render/skin-resolver.js` | 198 | `resolveSkin`, `resolveSkinTraitOverlay` | compositor |
| `lib/v2/render/trait-loader.js` | 240 | `loadTraitImage`, `loadTraitFromLabimages`, `loadTraitFromCategory` | compositor |
| `lib/v2/render/effects.js` | 386 | `applyShadow`, `applyBlackout`, `applyGlow`, `applyCloseup`, `applyBN`, `applyUV`, `applyMessages`, `applyParentText` | compositor |
| `lib/v2/render/gif-pipeline.js` | 55 | `detectAnimatedTraits`, `generateTokenGif` | v2 render `[tokenId].js` |
| `lib/v2/render/banana-pipeline.js` | 26 | `applyBananaTransform` | v2 render `[tokenId].js` |
| `lib/v2/render/studio-rasterizer.js` | 50 | `rasteriseStudioSvg` — rasteriza SVG de T-Shit con splitting de capa PNG | v2 render `[tokenId].js` |
| `lib/v2/metadata/builder.js` | 547 | `buildMetadata` — construye JSON desde `fetchAllTokenData`; contiene `buildSamuraiMetadata`, `buildZEROmoviesMetadata`, `buildZEROmovies2Metadata`, `buildGumballMetadata` | v2 metadata `[tokenId].js` (único consumidor) |
| `lib/v2/metadata/name-resolver.js` | 96 | `resolveTokenName`, `resolveGeneration` | `lib/v2/metadata/builder.js` |
| `lib/v2/metadata/special-tokens.js` | 52 | `getSpecialTokenMetadata`, `isStaticMetadataToken`, `isActionPack`, `getAnimationUrl` | v2 metadata `[tokenId].js` |
| `lib/v2/cache/cache-keys.js` | 53 | `renderKey`, `renderGifKey`, `samuraiListKey`, `TTL`, `traitPngKey`, `togglesKey` | v2 render, v2 metadata, v2 custom-external, tag-resolver, toggle-store |
| `lib/v2/cache/kv-client.js` | 158 | `kvGet`, `kvSet`, `kvGetBuffer`, `kvSetBuffer`, `kvDel`, `kvExists` — Upstash Redis | v2 render, v2 metadata, v2 custom-external, tag-resolver, toggle-store, metadata-cache |
| `lib/v2/cache/metadata-cache.js` | 55 | `getCachedMetadata`, `setCachedMetadata`, `computeETag`, `checkConditional` | v2 metadata `[tokenId].js` |
| `lib/v2/cache/toggle-store.js` | 111 | `getTokenToggleEffects`, `hasToggle`, `refreshToggles` — Upstash KV | v2 render, v2 metadata |
| `lib/v2/cache/trait-png-store.js` | 34 | `storeTraitPng`, `traitPngExists`, `getTraitPng` | `scripts/prerender-traits.js` únicamente |
| `lib/v2/tags/tag-resolver.js` | 250 | `isGumballToken`, `getGumballTraits`, `getGumballIndex`, `resolveGumballForToken`, `getSamuraiIndex`, `applyTagTraits` | v2 render, v2 metadata, v1 render (dynamic import), v1 metadata (dynamic import) |
| `lib/v2/rpc/token-data-fetcher.js` | 526 | `fetchAllTokenData` — Multicall3 para obtener todos los datos on-chain en 1 RPC | v2 render, v2 metadata, v2 custom-external |
| `lib/v2/rpc/contracts.js` | 329 | Encoders ABI: `encodeGetTokensByTag`, `encodeGumballGetAllMintedTokens`, `encodeGumballWasMintedHere`, `encodeGetAllActiveToggles` | multicall, tag-resolver, toggle-store |
| `lib/v2/rpc/multicall.js` | 89 | `multicall` — Multicall3 dispatcher | token-data-fetcher, tag-resolver, toggle-store |
| `lib/v2/rpc/provider.js` | 56 | Provider ethers.js v5 con rotación de RPC | todos los rpc/ |
| `lib/v2/rpc/tshit-resolver.js` | 64 | `isTShitV2`, `resolveTShitUri` — detecta rango 30014-35000 y llama `tshitGetDesignURI` on-chain | v1 render, v1 custom-external, v1 floppy render (dynamic import), v2 render |
| `lib/v2/storage/github-uploader.js` | 102 | `checkGitHub`, `downloadFromGitHub`, `uploadToGitHubAsync`, `uploadToGitHubSync` — I/O GitHub CDN para v2 | v2 render `[tokenId].js` |
| `lib/v2/shared/constants.js` | 188 | `SPECIAL_TOKENS`, `TAG_CONFIGS`, `TOGGLE_MAP`, `TRAIT_ORDER`, `CATEGORY_MAP`, `HEAD_TO_HAIR_TOKENS`, `GEAR_BEFORE_SWAG`, `GEAR_TOP_LAYER`, `getMetadataFile` | toda la stack v2 |
| `lib/v2/shared/cors.js` | 29 | `applyCors` — headers CORS para endpoints v2 | v2 render, v2 metadata, v2 custom-external |
| `lib/v2/shared/render-hash.js` | 14 | `generateRenderHash`, `getRenderFilename` — wrappers delgados sobre `lib/render-hash.js` | v2 render, v2 custom-external |

---

## 4. Índice de funciones clave

| Función | Archivo:línea | Qué hace | Llamado por |
|---------|---------------|----------|-------------|
| `getContracts()` | `lib/contracts.js:98` | Inicializa y devuelve todos los contratos ethers.js con caché | v1 render, v1 metadata, tag-logic |
| `getTokenTag(tokenId)` | `lib/contracts.js:350` | Resuelve tag on-chain desde tres deployers (SubZERODeployer, BatchDeployer, ZeroDiamond) | `lib/tag-logic.js`, `lib/contracts.js` interno |
| `getTokenMovieId(tokenId)` | `lib/contracts.js:519` | Llama `movies1WasMintedHere` + `getTokenMovie` en Diamond | v1 metadata |
| `getMovie2Info(tokenId)` | `lib/contracts.js:536` | Llama `movies2WasMintedHere` + `movies2GetTokenMovie` + rental info en Diamond | v1 metadata |
| `getTokenHonor(tokenId)` | `lib/contracts.js:337` | Lee Honor del SamuraiDojo en Diamond | v1 metadata |
| `getTokensByTag(tag)` | `lib/contracts.js:449` | Consulta tokens con un tag en BatchDeployer + Diamond | `lib/tag-logic.js:getSamuraiZEROIndex` |
| `getTokenTagInfo(tokenId)` | `lib/tag-logic.js:26` | Wrapper sobre `getTokenTag`; devuelve `{tag, isMinted}` | v1 render (dynamic import), v1 metadata (dynamic import) |
| `getSamuraiZEROIndex(tokenId)` | `lib/tag-logic.js:108` | Ordena lista SamuraiZERO y devuelve posición 0-599 | v1 render, v1 metadata |
| `filterEyesForTag(traits, tag)` | `lib/tag-logic.js:57` | Elimina EYES no permitidos para SubZERO | v1 render |
| `forceSkinTraitForTag(traits, tag)` | `lib/tag-logic.js:84` | Forza SKINTRAIT 1125 para SubZERO | v1 render |
| `resolveGumballForToken(tokenId)` | `lib/v2/tags/tag-resolver.js:150` | Llama `gumballWasMintedHere` on-chain → índice → entrada gums.json | v1 render (dynamic import), v1 metadata (dynamic import), v2 render |
| `getSamuraiIndex(tokenId)` | `lib/v2/tags/tag-resolver.js:171` | Multicall dos deployers; ordena y devuelve índice 0-599 | v2 render, v2 metadata |
| `getGumballIndex(tokenId)` | `lib/v2/tags/tag-resolver.js:89` | Multicall `gumballGetAllMintedTokens`; ordena y devuelve índice 0-99 | `resolveGumballForToken` |
| `getAnimatedTraits(traitIds)` | `lib/animated-traits-helper.js:67` | Para cada traitId busca `{id}a.svg`, `{id}b.svg`... en `public/labimages/` | v1 render, v1 custom-external, v1 metadata |
| `generateGifFromLayers(config)` | `lib/gif-generator.js:171` | Genera GIF animado compositing capas PNG; acepta `customFrameGenerator` para bounce | v1 render, v2 render, v1 custom-external |
| `createBounceSquashFrameGenerator(config)` | `lib/gif-generator.js:543` | Factory de frames con squash+stretch para bounce on-demand | v2 render |
| `generateRenderHash(params)` | `lib/render-hash.js:13` | SHA-256 de todos los parámetros que afectan al render (traits, skin, serum, efectos, tag) — key de invalidación | v1 render, v1 custom |
| `generateCustomRenderHash(tokenId, traitIds)` | `lib/render-hash.js:325` | Hash para renders custom | v1 custom, `lib/v2/shared/render-hash.js` |
| `loadLabimagesAsset(assetPath)` | `lib/github-storage.js:863` | Carga asset desde `public/labimages/` local con fallback a GitHub raw | v1 render, v1 custom-external, floppy render |
| `isTShitV2(numId)` | `lib/v2/rpc/tshit-resolver.js` | `numId >= 30014 && numId <= 35000` | v1 render, v1 custom-external, v2 render, floppy |
| `resolveTShitUri(numId)` | `lib/v2/rpc/tshit-resolver.js` | Llama `tshitGetDesignURI(numId)` on-chain | v1 render, v1 custom-external, v2 render |
| `fetchAllTokenData(tokenId)` | `lib/v2/rpc/token-data-fetcher.js` | Un Multicall3 que obtiene `getTokenData`, `getAllEquippedTraits`, skin, serum, dup, toggle, tag, movie, gumball | v2 render, v2 metadata, v2 custom-external |
| `compositeToken(tokenData, options)` | `lib/v2/render/compositor.js:46` | Render completo v2 en 4 pasos usando capas de `loadTraitFromLabimages`; devuelve `{buffer, backgroundBuffer, characterBuffer}` | v2 render, v2 custom-external |
| `normalizeTraits(rawCategories, rawTraitIds)` | `lib/v2/render/layer-order.js:22` | Normaliza categorías (PACKS→SWAG, HEAD→HAIR para ciertos IDs, correcciones EYES) | compositor, v2 render, v2 custom-external |
| `getLayerSequence(traits, animatedTraitIds)` | `lib/v2/render/layer-order.js:52` | Devuelve ordered array de `{category, traitId, phase}` respetando excepciones GEAR/SERUMS | compositor |
| `getTraitLoadPath(category, traitId, tagInfo)` | `lib/v2/render/layer-order.js:109` | Devuelve `{subdir, customPath}` para trait: SamuraiZERO→`samuraizero/`, OGPunks→`ogpunks/`, GEAR_TOP→`traits/GEAR/` | compositor |
| `buildMetadata(tokenData, toggleEffects)` | `lib/v2/metadata/builder.js:39` | Construye JSON metadata v2; branches por tag (Samurai, movies, Gumball, normal) | v2 metadata endpoint (único) |
| `buildOverdueState(movieRental)` | `pages/api/v2/render/[tokenId].js:329` | Discretiza `daysOverdue` en buckets para el render hash de ZEROmovies | v2 render (local) |
| `getTokenToggleEffects(tokenId)` | `lib/v2/cache/toggle-store.js:24` | Lee toggles desde KV; devuelve `{closeup, shadow, glow, ...}` | v2 render, v2 metadata |
| `updateTogglesIfNeeded(zoomInZeros)` | `lib/toggle-cache.js` | V1: refresca toggles en memoria si TTL expirado | v1 render, v1 metadata |
| `hasToggleActive(tokenId, toggleId)` | `lib/toggle-cache.js` | V1: consulta toggle en memoria | v1 render, v1 metadata |
| `kvGetBuffer/kvSetBuffer` | `lib/v2/cache/kv-client.js` | I/O binario a Upstash Redis | v2 render, v2 metadata, v2 custom-external |
| `renderKey(tokenId, hash)` | `lib/v2/cache/cache-keys.js` | `v2:render:{tokenId}:{hash}` | v2 render |
| `renderGifKey(tokenId, hash)` | `lib/v2/cache/cache-keys.js` | `v2:render:gif:{tokenId}:{hash}` | v2 render |
| `getMetadataFile(tokenId)` | `lib/v2/shared/constants.js:172` | Ruta y key del JSON de metadata según rango de tokenId | `lib/v2/metadata/builder.js` |

---

## 5. Duplicados / Código muerto — con evidencia

### CONFIRMED-DEAD

| Elemento | Evidencia | Riesgo si se borra |
|----------|-----------|-------------------|
| `pages/api/v2/metadata/[tokenId].js` | 0 referencias de producción. Solo aparece en `scripts/validate-v2.js` (offline, nunca deployado como cronjob). Ningún frontend lo llama. El rewrite `/api/metadata→/api/v2/metadata` fue eliminado. | Bajo. Herramienta de comparación manual. |
| `lib/v2/metadata/builder.js` | Único consumidor es `pages/api/v2/metadata/[tokenId].js` (confirmed-dead arriba). El comentario en `pages/api/metadata/[tokenId].js:583` dice "Mirrors buildZEROmoviesMetadata" — es documental, no un import. | Bajo. Eliminar junto con v2 metadata endpoint. |
| `lib/v2/metadata/name-resolver.js` | Solo importado por `lib/v2/metadata/builder.js` (confirmed-dead). | Bajo. |
| `lib/v2/metadata/special-tokens.js` | Solo importado por `pages/api/v2/metadata/[tokenId].js` (confirmed-dead). La v1 tiene su propio inline SPECIAL_TOKENS. | Bajo. |
| `lib/v2/cache/metadata-cache.js` | Solo importado por `pages/api/v2/metadata/[tokenId].js` (confirmed-dead). | Bajo. |
| `pages/api/v2/render/custom-external/[tokenId].js` | TraitLabV4 llama a `api/render/custom-external/` (v1), no a esta ruta v2. 0 referencias externas de producción. | Bajo. Verificar que no haya calls directas no indexadas antes de borrar. |
| `pages/api/render/custom/[tokenId].js` | Solo referenciado en `pages/index.js` (demo/landing) y `pages/api/test-gif-simple-v3.js` (test). No hay consumidores de producción externos. | Medio. Landing page lo muestra como ejemplo; borrar requeriría actualizar index.js. |
| `pages/api/rendershadow/[tokenId].js` | 0 referencias en todo el codebase AdrianLAB. Menciona reemplazado por compositor en el comentario de `compositor.js:4`. | Bajo. |
| `lib/v2/cache/trait-png-store.js` | Solo usado por `scripts/prerender-traits.js`. El compositor v2 NO lo usa en runtime (llama a `loadTraitFromLabimages` directo). | Bajo. Solo afecta script de prerenderizado. |
| `lib/v2/render/gif-pipeline.js:generateTokenGif` (función) | `detectAnimatedTraits` sí se usa (v2 render:29). `generateTokenGif` exportada pero sin consumidor encontrado. | Bajo. |
| `lib/cache.js.backup-*` (3 archivos) | Archivos backup con extensión .backup-cache-v1, .backup-cache-v2, .backup-precarga-v1. | N/A. Limpiar. |
| `pages/api/render/[tokenId].js.backup` y `.backup-*` (4 archivos) | Backups del v1 render. | N/A. Limpiar. |
| `pages/api/render/floppy/[tokenId].js.backup*` (2 archivos) | Backups. | N/A. |
| `pages/api/render/custom/[tokenId].js.backup*` (2 archivos) | Backups. | N/A. |
| `pages/api/admin/floppy-cache.js.backup*` (3 archivos) | Backups. | N/A. |
| `scripts/validate-v2.js` | Script de comparación offline v1 vs v2 metadata. Sin valor en producción tras C2. | N/A. |
| `scripts/parity-c2.mjs` | Script de paridad C2 (el mismo que reportó falsos positivos). | N/A. |

### IN-USE

| Elemento | Prueba de uso | Notas |
|----------|---------------|-------|
| `pages/api/v2/render/[tokenId].js` | v1 render hace 302 para movies (líneas 1046-1053); v1 metadata pone `image=/api/v2/render/{id}.png` para movies. Activo en producción. | **NO BORRAR** |
| Todos los `lib/v2/render/*.js` (compositor, layer-order, skin-resolver, trait-loader, effects, gif-pipeline, banana-pipeline, studio-rasterizer) | Importados por v2 render `[tokenId].js` y/o v2 custom-external. | IN-USE |
| `lib/v2/tags/tag-resolver.js` | Importado estáticamente por v2 render y v2 metadata; dynamic import por v1 render y v1 metadata. | IN-USE |
| `lib/v2/rpc/tshit-resolver.js` | Importado por v1 render, v1 custom-external, v1 floppy render, v2 render. | IN-USE — compartido entre v1 y v2 |
| `lib/v2/rpc/token-data-fetcher.js`, `multicall.js`, `contracts.js`, `provider.js` | Stack Multicall3 de v2. Usados por v2 render, v2 metadata, v2 custom-external, tag-resolver. | IN-USE |
| `lib/v2/cache/kv-client.js`, `cache-keys.js`, `toggle-store.js` | Usados por v2 render, v2 metadata, v2 custom-external, tag-resolver. | IN-USE |
| `lib/v2/storage/github-uploader.js` | v2 render `[tokenId].js` líneas 24, 308-312. | IN-USE |
| `lib/v2/shared/constants.js`, `cors.js`, `render-hash.js` | Usados por v2 render, v2 metadata, v2 custom-external, compositor, builder. | IN-USE |
| `pages/api/render/custom-external/[tokenId].js` | TraitLabV4 `useTraitSelection.ts:39` y `imageService.ts:29-30`. Activo en producción. | IN-USE |
| `pages/api/render/floppy/[tokenId].js` | OpenSea para FloppyDiscs. `pages/api/metadata/floppy/[id].js:212` genera URLs a este endpoint. | IN-USE |
| `lib/renderers/floppy-renderer.js`, `card-v4-renderer.js` | floppy render endpoint. | IN-USE |
| `lib/renderers/adrianzero-renderer.js` | lambo endpoint. | IN-USE |
| `lib/renderers/gif-renderer.js` | `pages/api/render/gif.js`. | IN-USE (endpoint accesible, test) |

### NEEDS-RUNTIME-CHECK

| Elemento | Por qué necesita verificación |
|----------|------------------------------|
| `pages/api/rendershadow/[tokenId].js` | 0 referencias estáticas encontradas. Posible que algún cliente externo (OpenSea, frontend antiguo) llame directamente. Verificar en logs de Vercel antes de borrar. |
| `lib/external-render-client.js` | Usado por v1 custom-external y `debug/render-custom.js`. El servicio externo en Render.com puede estar activo o no. Verificar si `EXTERNAL_RENDER_SERVICE_URL` está configurado en Vercel. |
| `pages/api/render/displacement/[tokenId].js` | Sin referencias de producción encontradas. Podría ser llamado por alguna DApp directamente. Verificar logs. |
| `pages/api/render/nanobanana/[tokenId].js` | Sin referencias encontradas. Verificar si está deprecado vs el toggle 13 en v1 render. |

### Divergencia SPECIAL_TOKENS v1 vs v2 (bug latente)

`pages/api/metadata/[tokenId].js` tiene SPECIAL_TOKENS inline (líneas 9-41) con IDs: 302, 441, 442, 445, 454, 459, 740, 815.

`lib/v2/shared/constants.js:105` tiene además el ID 750 (TAXreaper).

`pages/api/v2/render/[tokenId].js:83` sirve el GIF estático para SPECIAL_TOKENS del v2 (incluye 750).

Si alguien llama `/api/metadata/750` → v1 metadata → no tiene token 750 en SPECIAL_TOKENS → procesará como AdrianZERO normal → resultado erróneo. El render `/api/render/750` → v1 render → tampoco tiene rama especial → composita desde on-chain.

**El token 750 solo funciona correctamente si se llama a v2 metadata (`/api/v2/metadata/750`) o v2 render (`/api/v2/render/750`)**, que no son los endpoints canónicos.

---

## 6. Propuesta de renombrado/organización

Solo propuesta. No ejecutar en Fase 1.

### A. Eliminar código muerto confirmado (Fase 2)

Orden seguro:
1. Eliminar `pages/api/v2/metadata/[tokenId].js` + `lib/v2/metadata/builder.js` + `lib/v2/metadata/name-resolver.js` + `lib/v2/metadata/special-tokens.js` + `lib/v2/cache/metadata-cache.js` + `scripts/validate-v2.js`
2. Eliminar `pages/api/v2/render/custom-external/[tokenId].js`
3. Eliminar `pages/api/rendershadow/[tokenId].js` (tras verificar logs)
4. Eliminar `lib/v2/cache/trait-png-store.js` + `scripts/prerender-traits.js` si no se usan

**Riesgo**: Bajo si se verifica 0 tráfico en logs primero. El directorio `lib/v2/metadata/` quedaría vacío — borrar.

### B. Consolidar SPECIAL_TOKENS (Fase 2)

Mover `SPECIAL_TOKENS` inline de `pages/api/metadata/[tokenId].js` a importar desde `lib/v2/shared/constants.js`. Así ambos v1 metadata y v2 render usan la misma fuente.

**Rompe**: nada (solo editar el import en metadata v1).

### C. Renombrar para claridad

| Nombre actual | Nombre propuesto | Riesgo |
|--------------|-----------------|--------|
| `pages/api/render/custom/[tokenId].js` | `pages/api/render/custom-internal/[tokenId].js` | Rompe `pages/index.js` (1 referencia) |
| `lib/tag-logic.js` | `lib/v1/tag-logic.js` o mantener flat | Rompe v1 render + v1 metadata (dynamic imports por string) |
| `lib/v2/rpc/tshit-resolver.js` | `lib/rpc/tshit-resolver.js` (compartido) | Rompe todos los importers (5 archivos) |
| `lib/v2/shared/constants.js` | `lib/shared/constants.js` | Rompe toda la stack v2 |

**Recomendación**: No renombrar en Fase 2. El `lib/v2/rpc/tshit-resolver.js` ya está de facto compartido entre v1 y v2 — moverlo a `lib/` (sin namespace) refleja mejor la realidad, pero el esfuerzo de repath es alto.

### D. Mover `lib/v2/` hacia neutralidad

Todo `lib/v2/rpc/`, `lib/v2/tags/`, `lib/v2/cache/`, `lib/v2/shared/` ya son usados por endpoints v1 (imports dinámicos). La separación `v2/` es un artefacto histórico. Una reorganización limpia sería `lib/rpc/`, `lib/tags/`, `lib/kv/`, `lib/constants.js`. Riesgo: ~30 archivos con imports a actualizar. Diferir a Fase 3 tras eliminar código muerto.

---

## Apéndice: Flujo del cache para un render normal (AdrianZERO)

```
GET /api/render/{tokenId}.png
  │
  ├─ [v1 render] isTShitV2? → fast-path Studio T-Shit
  ├─ banana toggle check (in-memory toggle-cache.js)
  ├─ [CACHE HIT] lib/cache.js → return PNG
  ├─ GitHub hash check (lib/github-storage.js:fileExistsInGitHubByHash)
  │    └─ HIT → download + store in lib/cache.js + return
  │
  └─ MISS → render completo:
       1. getContracts() → skin/traits/serum/dup on-chain
       2. getTokenTagInfo() → rama ZEROmovies→302 redirect
       3. Gumball check (resolveGumballForToken)
       4. generateRenderHash()
       5. Canvas: BG → skin → traits (labimages) → TOP → effects
       6. [GIF] generateGifFromLayers si animados/bounce
       7. [Banana] transformWithNanoBanana (Gemini)
       8. uploadFileToGitHubByHash async
       9. setCachedAdrianZeroRender in-memory
      10. return PNG/GIF
```

---

*Documento generado en read-only pass. Ningún archivo fue modificado.*
