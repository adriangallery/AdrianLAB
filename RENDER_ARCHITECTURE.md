# AdrianLAB — Render Architecture & API Reference

> Documentación completa de los 47 API endpoints, 23 librerías y sistema de caché.
> Base URL: `https://adrianlab.vercel.app`
> Última auditoría: 2026-03-20

---

## Índice
1. [Endpoints principales (producción)](#1-endpoints-principales)
2. [Endpoints secundarios](#2-endpoints-secundarios)
3. [Endpoints test/debug (candidatos a eliminar)](#3-endpoints-testdebug)
4. [Admin endpoints](#4-admin-endpoints)
5. [Sistema de render principal — /api/render/[tokenId]](#5-render-principal)
6. [Sistema de metadata — /api/metadata/[tokenId]](#6-metadata-principal)
7. [Metadata JSONs y routing](#7-metadata-jsons)
8. [Sistema de caché (6 capas)](#8-sistema-de-cache)
9. [Librerías (lib/)](#9-librerias)
10. [Contratos y RPC](#10-contratos-y-rpc)
11. [Lógica especial y overrides](#11-logica-especial)
12. [Bottlenecks para optimización](#12-bottlenecks)

---

## 1. Endpoints principales

Los que realmente se usan en producción:

| Endpoint | Líneas | Output | Qué hace |
|----------|--------|--------|----------|
| **`/api/render/[tokenId]`** | 2547 | PNG/GIF | **Render principal** — compone SVGs por capas, efectos, toggles, banana AI |
| **`/api/metadata/[tokenId]`** | 1017 | JSON | **Metadata principal** — nombre, atributos, imagen URL, serum history |
| **`/api/metadata/floppy/[id]`** | 812 | JSON | Metadata con rarity tags, total minted, caché propio |
| **`/api/trait/[traitId]`** | 178 | PNG | Imagen individual de un trait |
| **`/api/trait/metadata/[traitId]`** | 61 | JSON | Metadata del trait (assetType, category, supply) |
| **`/api/render/floppy/[tokenId]`** | 447 | PNG/GIF | Render de items floppy, GitHub caching |
| **`/api/rendershadow/[tokenId]`** | 1276 | PNG | **Segundo render principal** — serum state machine completa |

**DESCUBRIMIENTO**: `rendershadow/[tokenId]` es un render completo independiente (1276 líneas) con su propio serum state machine de 7 fases. No es solo "shadow" — es un render alternativo de producción.

---

## 2. Endpoints secundarios (activos)

| Endpoint | Líneas | Output | Qué hace |
|----------|--------|--------|----------|
| `/api/render/displacement/[tokenId]` | 607 | GIF | Efecto explosión 3D estilo Apple (5 fases) |
| `/api/render/lambo/[tokenId]` | 75 | PNG | AdrianZERO sobre Lambo (1500x500) |
| `/api/render/nanobanana/[tokenId]` | 144 | PNG | Transformación AI via Gemini 2.5 Flash |
| `/api/render/gif` | 134 | GIF | Animador de frames genérico |
| `/api/render/floppy/[tokenId]/svg` | 111 | SVG | Versión SVG de floppy |
| `/api/traits/preview/[packId]` | 89 | JSON | Preview de traits en un pack |
| `/api/floppy/metadata/[tokenId]` | 64 | JSON | Metadata de floppy (legacy) |
| `/api/floppy/render/[tokenId]` | 50 | PNG | Imagen de floppy desde /public/ |
| `/api/bedrooms` | 293 | PNG | AdrianZERO en escena bedroom |

---

## 3. Endpoints test/debug (candidatos a eliminar)

**16 endpoints de test/debug** que probablemente pueden eliminarse:

| Endpoint | Líneas | Notas |
|----------|--------|-------|
| `/api/render/[tokenId]/svg` | 308 | Placeholder, no funcional completo |
| `/api/render/custom/[tokenId]` | 28900+ | Render con traits custom via query — muy grande |
| `/api/render/custom-external/[tokenId]` | 29633+ | Test de traits externos |
| `/api/render/test-external/[tokenId]` | 653 | Test render |
| `/api/debug-floppy/[tokenId]` | — | Debug |
| `/api/debug-paths/[tokenId]` | — | Debug paths |
| `/api/debug-svg/[tokenId]` | — | Debug SVG |
| `/api/debug-svg-text/[tokenId]` | — | Debug SVG text |
| `/api/debug-svg-fonts/[tokenId]` | — | Debug fonts |
| `/api/debug/render-custom` | — | Debug custom |
| `/api/test-gif-simple` (v1-v4) | — | 4 versiones de test GIF |
| `/api/test-gif-funcional` | — | Test GIF |
| `/api/test-image/[tokenId]` | — | Test imagen |
| `/api/test-text/[tokenId]` | — | Test texto |
| `/api/test-text-to-svg/[tokenId]` | — | Test text→SVG |
| `/api/test-simple/[tokenId]` | — | Test simple |
| `/api/test-renderers/[tokenId]` | — | Test renderers |
| `/api/test-retro-fonts/[tokenId]` | — | Test fuentes |
| `/api/test-animation/[tokenId]` | — | Test animación |
| `/api/test-deployment/[tokenId]` | — | Test deploy |
| `/api/test-railway-health` | — | Health check Railway |
| `/api/bounce-test` | — | Test bounce |
| `/api/adrianmoves/[tokenId]` | 206 | Experimental — overlay GIF |

**Total: ~22 endpoints de test/debug vs ~13 de producción**

---

## 4. Admin endpoints

| Endpoint | Qué hace | Auth |
|----------|----------|------|
| `/api/admin/toggle-stats` | Stats del toggle cache | Solo CORS |
| `/api/admin/floppy-cache` | Control caché floppy | Solo CORS |
| `/api/admin/duplicator-cache` | Control caché duplicator | Solo CORS |
| `/api/admin/invalidate-render` | Invalidar render cache | Solo CORS |
| `/api/admin/grid-generator` | Generar grid de tokens | Solo CORS |

**NOTA**: Sin autenticación real — solo CORS origin check.

---

## 5. Render principal — `/api/render/[tokenId]`

### Pipeline completo (2547 líneas)

```
Request → CORS → Extract tokenId → Check banana toggle
  → Check caches (local → GitHub by hash → GitHub by name)
  → If cache hit → return cached PNG/GIF
  → If miss:
    → Contract calls (4-7 calls secuenciales)
    → Load metadata JSON
    → Compute render hash
    → Compose 4-step SVG pipeline:
      1. BACKGROUND
      2. SKIN (serum logic, generation, duplicator)
      3. TRAITS (12+ categories in order)
      4. TOP layer
    → Apply effects (shadow/glow/BN/UV/blackout)
    → If animated → generate GIF
    → If banana → AI transform
    → Cache result → Upload to GitHub (async)
    → Return PNG/GIF
```

### Query params

| Param | Efecto | Combinaciones |
|-------|--------|---------------|
| `closeup=true` | Crop 640x640 (cropX=200, cropY=85) | Compatible con todo |
| `shadow=true` | Sombra offset (−40px, +15px, 30% opacidad) | Glow tiene prioridad |
| `glow=true` | Rainbow glow 5 capas (1.05-1.25 scale) | Prioridad sobre shadow |
| `bn=true` / `bw=true` | Escala de grises (0.299R+0.587G+0.114B) | Compatible con shadow/glow |
| `uv=true` | Blacklight (magenta→cyan→green) | Se aplica después de BN |
| `blackout=true` | Silueta negra (transparencia fondo) | Deshabilitado si shadow o glow |
| `banana=true` | AI transform via Gemini (solo toggle 13) | No compatible con messages |
| `messages=text` | Texto overlay, canvas 3000x1000 | No compatible con banana |
| `bounceDir/Dist/Count/Frames/Delay` | Config de animación bounce | Solo con GIF |

### Orden de composición de capas

```
1. BACKGROUND (o #FF3388 si duplicado)
2. SKIN / SKINTRAIT / ADRIAN body (con lógica de serum + generación)
3. BEARD
4. EAR
5. RANDOMSHIT
6. SWAG (GEAR 721/726 antes de SWAG)
7. GEAR
8. HAIR (incluye HEAD→HAIR remapeados)
9. HAT
10. HEAD
11. SKIN (trait)
12. SERUMS (skip si EYES equipado)
13. EYES
14. MOUTH
15. NECK
16. NOSE
17. FLOPPY_DISCS
18. PAGERS
19. TOP (SamuraiZERO, OGPUNKS, etc.)
20. GEAR 48 (segunda pasada en TOP)
```

### Llamadas a contrato (por request sin caché)

| # | Contrato | Función | Dato |
|---|----------|---------|------|
| 1 | ZoomInZEROS | toggle check | ¿banana activo? |
| 2 | AdrianLabCore | `getTokenData(id)` | generation, mutation, etc. |
| 3 | AdrianLabCore | `getTokenSkin(id)` | skinId, skinName |
| 4 | TraitsExtensions | `getAllEquippedTraits(id)` | categories[], traitIds[] |
| 5 | DuplicatorModule | `getTokenDupInfo(id)` | duplicated, sourceId, dupNumber |
| 6 | AdrianLabCore | `getTokenSkin(sourceId)` | (solo si duplicado) |
| 7 | SerumModule | `getTokenSerumHistory(id)` | array de aplicaciones |
| 8 | tag-logic | `getTokenTagInfo(id)` | SubZERO/SamuraiZERO |

**Total: 5-8 llamadas RPC secuenciales** + 12-15 conversiones SVG→PNG via Resvg.

---

## 6. Metadata principal — `/api/metadata/[tokenId]`

### Prioridad de nombre

1. **SubZERO** (tag) → `"SubZERO"`
2. **SamuraiZERO** (tag) → nombre de `samuraimetadata.json`
3. **GenZERO** (dupInfo.duplicated) → `"GenZERO #{id}"`
4. **AdrianPunk** (TOP trait 100001-101000) → `"AdrianPunk #{id}"`
5. **Profile name** (PatientZERO) → `"{profileName} #{id}"`
6. **Custom name** (NameRegistry) → `"{customName} #{id}"`
7. **Default** → `"AdrianZero #{id}"`

### Tokens especiales hardcodeados

| Token | Override |
|-------|---------|
| 100000 | Metadata estática de `public/metadata/100000.json` |
| 15008-15010 | Action Packs de `ActionPacks.json` |
| 302 | Imagen: `/labimages/specials/302.gif` |
| 441 | Nombre: DRACULA, imagen: `/labimages/specials/441.gif` |
| 442 | Nombre: NEO-ZERO, imagen: `/labimages/specials/442.gif` |
| 445 | Nombre: THE MANAGER |
| 454 | Nombre: Adrian McOrder Dash |
| 459 | Nombre: AdrianSensai |
| 682 | Añade `animation_url` a McInteractive |
| 202 | Fuerza closeup (temporal, marcado para borrar) |

### Toggle system (1-13) → atributos

| Toggle | Efecto | Atributo |
|--------|--------|----------|
| 1 | closeup | CLOSEUP |
| 2 | shadow | SHADOW |
| 3 | glow | GLOW |
| 4 | B&W | BN |
| 5 | bn+shadow | BN, SHADOW |
| 6 | bn+shadow+closeup | BN, SHADOW, CLOSEUP |
| 7 | shadow+closeup | SHADOW, CLOSEUP |
| 8 | glow+closeup | GLOW, CLOSEUP |
| 9 | glow+bn | GLOW, BN |
| 10 | glow+bn+closeup | GLOW, BN, CLOSEUP |
| 11 | UV | UV |
| 12 | blackout | BLACKOUT |
| 13 | banana | BANANA |

**NOTA**: Metadata usa todos los toggles (1-13). Render solo implementa toggle 13 (banana). Los toggles 1-12 se pasan como query params en la image URL construida por metadata.

---

## 7. Metadata JSONs y routing

### getMetadataFileForToken() — AMBOS endpoints

```
10000-10002   → floppy.json    (solo 3 IDs!)
15000-15006   → pagers.json
262144        → serums.json    (solo 1 ID!)
30000-35000   → studio.json
100001-101003 → ogpunks.json
todo lo demás → traits.json
```

**BUG CONOCIDO**: Floppies 10003-10019 caen en `traits.json` como fallback. El endpoint `/api/metadata/floppy/[id]` tiene routing más amplio y SÍ funciona para todos los IDs.

### Archivos y estructura

| Archivo | Array key | Rango IDs | Entries | Peso |
|---------|-----------|-----------|---------|------|
| traits.json | `traits` | 1-9999 | ~1281 | 413KB |
| floppy.json | `floppys` | 10000-10019 | 20 | 8KB |
| pagers.json | `pagers` | 15000-15013 | 9 | 3KB |
| ActionPacks.json | `packs` | 15008-15010 | 3 | 443B |
| serums.json | `serums` | 262144-262147 | 4 | 1.6KB |
| ogpunks.json | `traits` | 100001-101003 | 1003 | 290KB |
| samuraimetadata.json | — | 500-1099 | 600 | 813KB |
| studio.json | (object) | 30000-35000 | variable | 85KB |
| gums.json | — | — | — | — |

### Rarity tags (solo en `/api/metadata/floppy/[id]`)

```
maxSupply = 1    → UNIQUE    (rojo)
maxSupply ≤ 6    → LEGENDARY (dorado)
maxSupply ≤ 14   → RARE      (púrpura)
maxSupply ≤ 40   → UNCOMMON  (azul)
else             → COMMON    (gris)
```

---

## 8. Sistema de caché (6 capas)

| Capa | Archivo | TTL | Qué cachea | Key |
|------|---------|-----|------------|-----|
| **Render** | cache.js | 1h default, variable | PNG/GIF renders completos | tokenId+effectFlags |
| **Contract calls** | contract-cache.js | 24h | Respuestas de contratos | contract:function:args |
| **Components** | component-cache.js | 24-48h | SVGs renderizados a PNG por componente | type_id |
| **SVG→PNG** | svg-png-cache.js | 24-48h | Conversiones Resvg | MD5(svgContent) |
| **JSON** | json-cache.js | 7 días | Archivos JSON metadata | filePath |
| **Toggle** | toggle-cache.js | 24h | Estados de toggles on-chain | tokenId→Set(toggleIds) |
| **Duplicator** | duplicator-cache.js | 1-24h | Info de duplicación | tokenId |
| **Floppy metadata** | cache.js | 24-48h | Metadata de floppies | tokenId |
| **Nanobanana** | cache.js | 24h | Renders AI transformados | tokenId |
| **GitHub** | github-storage.js | Permanente | PNGs/GIFs en repo GitHub | tokenId_renderType.png |

**GitHub como CDN**: Se suben renders a `adriangallery/AdrianLAB` repo, branch main, en `public/rendered-toggles/` y `public/rendered-traits/`. Render hash determina si hay que re-subir.

---

## 9. Librerías (lib/)

| Archivo | Peso | Función |
|---------|------|---------|
| **cache.js** | 45KB | Caché principal multi-tipo con TTL |
| **github-storage.js** | 40KB | Upload/download renders a GitHub via Octokit |
| **gif-generator.js** | 23KB | Generación de GIFs desde capas SVG |
| **nanobanana-transformer.js** | 20KB | AI transform via Google Gemini 2.5 Flash |
| **contracts.js** | 16KB | Addresses, RPC fallback (5 providers), instancias |
| **animation-helpers.js** | 15KB | Cálculos de frames (bounce, orbit, shake, zoom) |
| **render-hash.js** | 10KB | SHA-256 determinístico para cache keys (20+ variables) |
| **blockchain.js** | 8KB | Wrapper de contratos, getAssetInfo |
| **displacement-loader.js** | 7KB | Carga de traits con efecto 3D extrude |
| **text-to-svg.js** | 6KB | Texto → SVG paths (fuente VT323) |
| **external-render-client.js** | 6KB | Delegación a servicio de render externo |
| **tag-logic.js** | 6KB | Lógica SubZERO/SamuraiZERO (traits forzados, filtros) |
| **duplicator-logic.js** | 5KB | Lógica de duplicación (GEN paths, skin inheritance) |
| **contract-cache.js** | 5KB | Caché de llamadas a contratos (24h) |
| **toggle-cache.js** | 5KB | Caché de estados de toggles |
| **traits-order.js** | 5KB | Orden de capas para composición |
| **nanobanana-prompt.js** | 5KB | Prompt de AI (Pixar-style 3D) |
| **duplicator-cache.js** | 7KB | Caché de info de duplicación |
| **component-cache.js** | 4KB | Caché de componentes renderizados |
| **svg-png-cache.js** | 4KB | Caché de conversiones SVG→PNG |
| **animated-traits-helper.js** | 4KB | Detección de traits animados (variantes a-j) |
| **json-cache.js** | 3KB | Caché de archivos JSON (7 días TTL) |
| **floppy.js** | 3KB | Utilidades de floppy/pack |

---

## 10. Contratos y RPC

### Addresses en lib/contracts.js

```
AdrianLabCore          0x6E369BF0E4e0c106192D606FB6d85836d684DA75
TraitsExtensions       0x0995c0da1ca071b792e852b6ec531b7cd7d1f8d6
TraitsCore             0x90546848474FB3c9fda3fdAd887969bB244E7e58
PatientZERO            0x41bd1d621f9a8de8f175dd9814d9c27fabb9172f
SerumModule            0xEb84a51F8d59d1C55cACFd15074AeB104D82B2ec
NameRegistry           0xaeC5ED33c88c1943BB7452aC4B571ad0b4c4068C
ZoomInZEROS            0x568933634be4027339c80F126C91742d41A515A0
SubZEROdeployer        0x20700BE61f2b94E08B16ebD82eE0BA46189B7305
BatchDeployer          0xA988F323023F12812c0BaD74d6C55CE07325d218
DuplicatorModule       0x70006742EC526d627a21fb3A8c458Eb5b46c3f54
```

### RPC fallback chain (5 niveles)

1. Alchemy PRIMARY (env var)
2. Alchemy MAIN (env var, hardcoded fallback)
3. Alchemy FALLBACK (env var, hardcoded fallback)
4. Infura (env var, hardcoded fallback)
5. Base public RPC (`https://mainnet.base.org`)

---

## 11. Lógica especial y overrides

### Category corrections (hardcoded)
- Tokens 7, 8, 9: SERUMS → EYES
- 42 tokens HEAD → HAIR: [14, 17-19, 21, 162-190, 198-204, 207, 218-219, 226, 236]

### Skin trait exceptions
- Trait 37 (Normal): carga desde `SKIN/OG_GEN{0-2}.svg`
- Trait 38 (3D): carga desde `SKIN/OG_GEN{0-2}_3D.svg`

### GEAR rendering exceptions
- GEAR 721, 726: se renderizan ANTES de SWAG (no después)
- GEAR 48: se renderiza DOS VECES (en GEAR y en TOP)

### Duplicated tokens (GenZERO)
- Background forzado a `#FF3388` (rosa)
- Skin heredada del parent (sourceId)
- Serum history heredada del parent
- Texto "PARENT #sourceId" en esquina

### SubZERO tag
- Solo EYES trait 1124 permitido
- SKINTRAIT forzado a 1125
- Nombre override: "SubZERO"

### SamuraiZERO tag (tokens 500-1099)
- Imágenes desde `samuraizero/{id}.svg`
- Metadata desde `samuraimetadata.json`
- Nombre desde metadata samurai

### Token 15014 (McORDER DASH)
- Tiene `animation_url` apuntando a `https://adrianzero.com/mcinteractive/`
- Bypasses caché en floppy metadata

---

## 12. Bottlenecks para optimización

### Render principal (`/api/render/[tokenId]`)

| Bottleneck | Impacto | Posible solución |
|-----------|---------|-----------------|
| **5-8 llamadas RPC secuenciales** | ~1-3s por request sin caché | Paralelizar con Promise.all() |
| **12-15 conversiones SVG→PNG (Resvg)** | ~0.5-2s total | Pre-renderizar traits populares; pool de Resvg instances |
| **Nanobanana AI transform** | ~3-10s (API externa) | Ya se cachea + GitHub. Considerar pre-gen batch |
| **GIF generation** | ~2-5s | Ya se cachea. Considerar WebP |
| **External trait fetch** (30000-35000) | Variable, sin caché | Añadir caché |
| **Efectos pixel-by-pixel** (BN, UV) | ~200-500ms por efecto | Canvas filters nativos en vez de manual |
| **Message rendering** (canvas 3000x1000) | 3x memoria | Solo cuando se usa (raro) |
| **GitHub upload async** | No bloquea pero consume recursos | OK, ya es async |

### Metadata principal (`/api/metadata/[tokenId]`)

| Bottleneck | Impacto | Posible solución |
|-----------|---------|-----------------|
| **5-7 llamadas RPC** | ~1-2s | Paralelizar, contract-cache ya ayuda (24h TTL) |
| **Detección animated** | 1-2 llamadas extra | Cachear lista de traits animados |
| **Sin response caching** | Cada request recalcula | Añadir caché con TTL corto (5-15 min) |

### General

| Issue | Detalle |
|-------|---------|
| **getMetadataFileForToken() limitado** | Solo 10000-10002 → floppy.json. Debería cubrir 10000-10019+ |
| **22 endpoints test/debug en producción** | Ocupan espacio, posible confusión, superficie de ataque |
| **Admin endpoints sin auth** | Solo CORS — vulnerable si se conoce el endpoint |
| **RPC keys hardcodeadas** | Alchemy/Infura keys como fallback en código |
| **rendershadow como segundo render** | 1276 líneas de lógica duplicada respecto al render principal |
| **render/custom 28K+ líneas** | Probablemente copia del render principal con modificaciones |

---

## 13. T-Shit Studio (Studio V1 vs V2) — gotchas

> **¡LEE ESTO ANTES DE TOCAR ALGO RELACIONADO CON Studio T-Shits!**
>
> Hemos perdido tiempo varias veces porque el flujo de render para Studio
> tiene **4 endpoints distintos** y un **rewrite invisible**. Si añades un
> fix solo en uno de ellos, los otros tres siguen rotos.

### Rangos

| Rango | Versión | Cómo se resuelve la imagen | Listado en `studio.json`? |
|-------|---------|----------------------------|---------------------------|
| **30000–30013** | V1 legacy | URL hardcoded `https://adrianzero.com/designs/<id>.svg` | Sí |
| **30014–30300** | V2 (rango pre-registrado SWAG) | **On-chain** vía `tshitGetDesignURI(id)` → Vercel Blob | Sí |
| **30301–35000** | V2 (todavía en studio.json) | Igual que V2 — **on-chain** | Sí (alias generado) |

`lib/v2/rpc/tshit-resolver.js` decide V1 vs V2: `isTShitV2(id)` es `true` para id ≥ `TSHIT_FIRST_ID = 30014`. Ese boundary se cambió 2026-04-29 (commit `d404fb11`) — antes era 30301. Si lo vuelves a tocar, asegúrate de que las 4 rutas de render lo respeten.

### El rewrite invisible (`next.config.js`)

```js
// Catch-all: everything else goes to V2
{ source: '/api/render/:path*', destination: '/api/v2/render/:path*' },
```

Pegar al endpoint V1 directo desde el navegador **NO** lo ejecuta. La URL pública `https://adrianlab.vercel.app/api/render/30014.png` se sirve desde `pages/api/v2/render/[tokenId].js`. El header de respuesta `x-matched-path: /api/v2/render/[tokenId]` lo confirma.

Excepciones que sí se quedan en V1: `custom-external/`, `custom/`, `floppy/`, `displacement/`, `lambo/`, `nanobanana/`, `test-external/`, `gif`.

### Endpoints que tocan Studio (los 4)

| Endpoint | Archivo | Quién renderiza |
|---|---|---|
| `/api/render/<id>.png` (standalone) | `pages/api/v2/render/[tokenId].js` (vía rewrite) | Vercel — fast-path Studio resuelve `tshitGetDesignURI` y rasteriza con Resvg |
| `/api/render/<id>.png` (compuesto AdrianZero con Studio aplicado) | `pages/api/v2/render/[tokenId].js` → `lib/v2/render/trait-loader.js` `loadFromHTTP` | Vercel — `loadFromHTTP` antepone la URI on-chain a la lista de candidatos para V2 |
| `/api/render/custom-external/<id>?trait=...&trait=...` (preview con traits del query) | `pages/api/render/custom-external/[tokenId].js` | **Railway** (servicio externo) — ver siguiente sección |
| `/api/render/[tokenId].js` (V1, sin rewrite) | `pages/api/render/[tokenId].js` | Vercel V1 — `loadExternalTrait` también tiene la rama V2 → `resolveTShitUri` por consistencia, aunque solo se invoca desde `custom-external` y similares |

**Regla:** si tocas Studio, mira si tu cambio se debe replicar en los 4 archivos. Específicamente, cualquier cambio en cómo se obtiene la URL del SVG debe pasar por `resolveTShitUri` para V2 y por `adrianzero.com/designs/<id>.svg` para V1.

### El servicio externo de Railway (custom-external)

`pages/api/render/custom-external/[tokenId].js` no compone localmente: por defecto manda los datos a `process.env.EXTERNAL_RENDER_URL` (Railway) vía `lib/external-render-client.js`. Railway recibe `traitsMapping` serializado y resuelve las imágenes de cada trait usando los `external_url` que le pasamos. **Railway no llama al RPC ni conoce `tshitGetDesignURI`** — para Railway, todo Studio luce como `adrianzero.com/designs/<id>.svg` (que 404 para V2).

Hay tres escape hatches que **fuerzan render local Vercel** y saltan Railway:
1. `hasAnimatedTraits` — Railway no soporta GIFs
2. `dupInfo.duplicated` — render local necesita el background `#FF3388` y el texto "PARENT"
3. `hasStudioV2Trait` — añadido 2026-05-01 (commit `da6bac03`); detecta cualquier id V2 en `finalTraits` con `isTShitV2()` y fuerza local para que `loadExternalTrait` use el resolver on-chain

Si en el futuro Railway aprende a resolver `tshitGetDesignURI`, ese tercer escape hatch se puede quitar — hasta entonces, **no lo borres**.

### studio.json desincronizado

`public/labmetadata/studio.json` lista 30000..30300 (301 entradas). Si se mintea `id ≥ 30301`, custom-external lo descarta porque `traitsMapping[id]` es `undefined` (línea ~537: `if (!isNaN(traitId) && traitsMapping[traitId])`). Soluciones:
- Extender studio.json hasta el cap actual (script `scripts/sync-tshit-studio.mjs`), o
- Inyectar metadata sintética para todo el rango V2 dentro de `loadCombinedTraitsMapping` cuando `isTShitV2(id)`

El frontend de TraitLAB (`traitlabv4`) ya hace lo segundo en `walletDataStore.loadAllTraits` — lee `tshitStats()` y crea entradas para `[30014, nextId-1]`. AdrianLAB todavía no lo hace; corregir cuando empiecen mints > 30300.

### Síntomas conocidos y dónde apretar

| Síntoma | Causa típica | Fix |
|---|---|---|
| Thumbnail standalone muestra tshirt vacío | Fast-path de Studio no se aplicó en `pages/api/v2/render/[tokenId].js` | Verificar import y orden — el fast-path va **antes** del KV cache check |
| Render del AdrianZero compuesto no incluye el Studio overlay | Railway está renderizando y no resuelve V2 | Confirmar `hasStudioV2Trait` salta Railway en `custom-external` |
| Studio aplicado pero pixel-art al revés / ancho extraño | El SVG mintado (PNG embebida en `<image>`) usa viewBox 148×148; Resvg lo escala a 1000×1000. No tocar `fitTo` sin probar |
| `x-cache: HIT` con render viejo después de un fix | KV/in-memory cache del propio app (no Vercel Edge) — vuelve después de unos minutos cuando el container se recicla, o invalida con `/api/admin/invalidate-render` |
| `x-version: ADRIANZERO-V2` (no `-STUDIO`) en un id Studio | El fast-path falló silenciosamente (resolver retornó null o el fetch del Blob falló) — revisa logs de Vercel functions |

### Frontend que consume estos endpoints

- `traitlabv4` `walletDataStore.loadAllTraits` → usa `https://adrianlab.vercel.app/api/render/<id>.png` para thumbnails
- `traitlabv4` `mynfts/traits` preview → llama `/api/render/custom-external/<tokenId>?trait=...&trait=...`
- Cualquier marketplace que lea `tokenURI(id)` también acaba pegando a `/api/render/<id>` (vía metadata)

Si rompes alguno de los 4 endpoints, los tres consumidores rompen visualmente — y como el render falla *silently* (no 500, devuelve un PNG vacío), no se nota hasta que alguien mira un Studio T-Shit. Por eso esto entra en `RENDER_ARCHITECTURE.md` y no solo en un commit message.
