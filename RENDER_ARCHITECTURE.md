# AdrianLAB — Render Architecture & API Reference

> Documentación completa de los 47 API endpoints, 23 librerías y sistema de caché.
> Base URL: `https://adrianlab.vercel.app`
> Última auditoría: 2026-09-14 (Parte I actualizada: consumidores, rutas eliminadas, admin con clave). Parte II = antiguo `ARCHITECTURE-RENDER.md`.

---

## Índice
0. [Quién consume qué](#0-quién-consume-qué)
1. [Endpoints principales (producción)](#1-endpoints-principales)
2. [Endpoints secundarios](#2-endpoints-secundarios)
3. [Rutas eliminadas y `render/custom` vs `render/custom-external`](#3-rutas-eliminadas-y-custom)
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

## 0. Quién consume qué

Verificado el 14-sep-2026 (on-chain y búsqueda en los repos). **No se depreca nada**: v1 y v2 conviven
a propósito (decisión D4: v1 = stills, v2 = GIF/movies; ya se intentó consolidar y falló).

| Consumidor | Entra por | Imagen que acaba pidiendo |
|---|---|---|
| OpenSea / marketplaces — AdrianZERO (ERC-721 `0x6e36…da75`) | `tokenURI` → `/api/metadata/<id>` | `/api/render/<id>.png` (v1); tokens ZEROmovies → `/api/v2/render/<id>.png` |
| OpenSea / marketplaces — traits, packs, serums (ERC-1155 `0x9054…7e58`) | `uri()` → `/api/metadata/floppy/<id>.json` | `/api/render/floppy/<id>.png|gif` o `/labimages/<id>.*` (pagers, action packs) |
| adrianzero.com — TraitLab (previews de combinaciones) | `/api/render/custom-external/<tokenId>?trait=…` | PNG directo |
| adrianzero.com — Shop y Packs | `raw.githubusercontent.com/…/AdrianLAB/main/rendered-images/<id>.png` | Fichero versionado (por eso `rendered-images/` no se puede dejar de trackear, H7) |
| adrianzero.com — `traits.json` | copia propia en `traitlabv4/public/data/traits.json` | — |
| Página PatientZERO y TraitLab antiguo (repo adrianzero) | `/api/render/custom/<tokenId>` | PNG/SVG |
| `/api/v2/*` | Solo internamente: metadata de ZEROmovies y un proxy desde `render/[tokenId]` | — |

## 1. Endpoints principales

Los que realmente se usan en producción:

| Endpoint | Líneas | Output | Qué hace |
|----------|--------|--------|----------|
| **`/api/render/[tokenId]`** | 2547 | PNG/GIF | **Render principal** — compone SVGs por capas, efectos, toggles, banana AI |
| **`/api/metadata/[tokenId]`** | 1017 | JSON | **Metadata principal** — nombre, atributos, imagen URL, serum history |
| **`/api/metadata/floppy/[id]`** | 812 | JSON | Metadata con rarity tags, total minted, caché propio |
| **`/api/trait/[traitId]`** | 178 | PNG | Imagen individual de un trait |
| ~~`/api/trait/metadata/[traitId]`~~ | — | 308 | Desde L2 (14-sep) redirige a `/api/metadata/floppy/<id>.json` |
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
| ~~`/api/floppy/metadata/[tokenId]`~~ | — | 308 | Desde L2 (14-sep) redirige a `/api/metadata/floppy/<id>.json` |
| `/api/floppy/render/[tokenId]` | 50 | PNG | Imagen de floppy desde /public/ |
| `/api/bedrooms` | 293 | PNG | AdrianZERO en escena bedroom |

---

## 3. Rutas eliminadas y `custom` vs `custom-external`

**Eliminadas el 13–14 sep** (AdrianLAB PR #1): debug-metrics, debug-positioning, debug-quick, test-anchors,
debug-floppy, debug-paths, debug-svg (+text/fonts), debug/render-custom, test-animation, test-deployment,
test-gif-funcional, test-image, test-railway-health, test-renderers, test-retro-fonts, test-text-to-svg,
test-text. Se quedan `bounce-test`, `test-gif-simple` v1–v4 (los usa `/admin/gif-builder`), `test-simple` y
`render/test-external`.

**`render/custom` y `render/custom-external` NO son de test**: ~2 000 líneas casi iguales (difieren ~415).

| | `render/custom/[tokenId]` | `render/custom-external/[tokenId]` |
|---|---|---|
| Quién lo usa | PatientZERO y TraitLab antiguo | TraitLab actual (adrianzero.com) |
| Cómo renderiza | Local en la función de Vercel | Primero el servicio externo `EXTERNAL_RENDER_URL` (**Railway**, `adrianlab-production`, vivo el 14-sep), si falla render local |
| T-Shits 30000+ | Solo diseños V1 (`adrianzero.com/designs/<id>.svg`) | V1 y V2 (URI on-chain de `TShitMintFacet`, capas separadas para que salga nítido) |

⚠️ Railway es legacy en el resto del ecosistema: si ese servicio se apaga, `custom-external` sigue
funcionando por el render local, pero más lento. `EXTERNAL_RENDER_ENABLED=false` lo desactiva.

---

## 4. Admin endpoints

Desde L5 (14-sep) **todos exigen `ADMIN_API_KEY`** (`lib/admin-auth.js`: `Authorization: Bearer …` o
`x-admin-key`). Sin la variable configurada responden 503; con clave mala, 401. La clave está en Vercel
(production y preview).

| Endpoint | Qué hace |
|----------|----------|
| `/api/admin/invalidate` | **Invalidación de punta a punta** de un token o trait: KV + renders guardados en GitHub |
| `/api/admin/invalidate-render` | Borra un render concreto guardado en GitHub |
| `/api/admin/floppy-cache` | Estado y limpieza de la caché de floppies |
| `/api/admin/duplicator-cache` | Caché de duplicados |
| `/api/admin/toggle-stats` | Estadísticas y limpieza de toggles |
| `/api/admin/grid-generator` | Grid de tokens |

Uso normal: `node scripts/invalidate.mjs <token|trait> <id> [--category HAT] [--key-from-vercel]`
(servidor → re-calentar con `?refresh=1` → refresh de OpenSea). La CDN de Vercel no purga por URL:
`vercel cache purge --type cdn` purga todo el proyecto.

Pruebas automáticas: `npm test` y `scripts/smoke.mjs` (workflow `smoke` tras cada deploy).

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

### Routing de `/api/metadata/floppy/[id]` y `/api/render/floppy/[id]` (L4, 14-sep)

`lib/floppy-metadata-routing.js` → `classifyFloppyMetadataToken(id)`, mismo orden que el antiguo if/else:

```
15014                 → McORDER DASH (metadata fija en el endpoint)
1-9999 (salvo 1123)   → traits.json
262144-262147 o id en serums.json       → serum
15008-15010   o id en ActionPacks.json  → action pack
15000-15013   o id en pagers.json       → pager
100001-101003         → ogpunks.json
20000-20099           → achievements.json
30000-35000           → studio (V2 se sintetiza desde el contrato)
1123 o ≥ 10000        → floppy.json (genérico «FLOPPY #id» si no está)
```

Antes serums, action packs y pagers tenían rangos fijos: un serum 262148 salía como «FLOPPY #262148».
Ahora basta con añadir la entrada al JSON. Tests en `lib/__tests__/floppy-metadata-routing.test.js`.

⚠️ El rango 15000–15999 es compartido: pagers 15000–15004, 15007 y 15011–15013; action packs
15008–15010; 15014 McORDER DASH. Elegir un id nuevo mirando los ficheros, no el rango.

`getMetadataFileForToken()` del render de AdrianZERO (`render/[tokenId]`, `metadata/[tokenId]`) sigue con
rangos fijos, pero solo decide de dónde leer los traits **equipados**; floppies y pagers no son equipables y
los T-Shits V2 van por el contrato, así que no afecta a nada vivo.

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

---

# Parte II — Mapa por colección y superficie pública

> Antes vivía en `ARCHITECTURE-RENDER.md` (último cambio 19-may-2026). Unificado aquí el 14-sep-2026 (plan AdrianZERO C6/L8). Contenido original sin reescribir; puede estar desfasado donde choque con la Parte I.

## AdrianLAB — Render & Metadata Architecture

**Fecha**: 2026-05-19  
**Estado del sistema**: HYBRID (post-C2-Fase5). V1 es canónico. V2 render sobrevive obligatoriamente para ZEROmovies S1/S2. V2 metadata existe pero no sirve tráfico de producción.  
**Fuente de verdad de cambios de código**: Este documento.

---

### 1. Mapa de superficie pública

#### Rewrites activos en `next.config.js` (hoy)

El archivo `next.config.js` contiene exactamente estas reglas de rewrite (líneas 27-43):

| Rewrite | Source | Destination | Efecto real |
|---------|--------|-------------|-------------|
| Metadata estática | `/metadata/:path*` | `/metadata/:path*.json` | Añade extensión .json a archivos estáticos de `/public/metadata/` |
| Custom-external explícito | `/api/render/custom-external/:path*` | `/api/render/custom-external/:path*` | Identity rewrite (sin efecto funcional; documenta intención) |
| Floppy metadata con .json | `/api/metadata/floppy/:id.json` | `/api/metadata/floppy/:id.json` | Identity |
| Floppy metadata sin .json | `/api/metadata/floppy/:id` | `/api/metadata/floppy/:id` | Identity |
| **NO HAY** catch-all render | — | — | El catch-all `/api/render→/api/v2/render` fue eliminado en commit `e658994a` |
| **NO HAY** redirect metadata | — | — | El rewrite `/api/metadata→/api/v2/metadata` fue eliminado en C2-Fase5 |

#### Superficie pública real (lo que sirve cada URL)

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

### 2. Tabla colección → dónde aplicar un cambio

Para cada tipo de colección, los archivos exactos donde tocar metadata Y render:

#### AdrianZERO — Normal (GEN0/GEN1/GEN2, skin Zero/Dark/Alien/Albino)

| Capa | Archivo | Función/sección | Notas |
|------|---------|-----------------|-------|
| **Metadata** | `pages/api/metadata/[tokenId].js` | Handler principal, lógica fallthrough tras todos los early-returns especiales (líneas ~635-1190) | Nombre via `adrianNameRegistry.getTokenNameHistory` + `patientZero.getTokenStatus` |
| **Render** | `pages/api/render/[tokenId].js` | PASO 2 (skin normal, líneas ~1570-1610), PASO 3 (traits, líneas ~1626-1703), PASO 4 (TOP, líneas ~1705-1802) | Asset path: `public/labimages/{traitId}.svg` |
| **Skin assets** | `public/traits/ADRIAN/GEN{0-2}-{Medium|Dark|Alien|Albino}.svg` | — | Solo para skins base; traits normales en labimages |

#### AdrianZERO — GEN especiales (Duplicados)

| Capa | Archivo | Función/sección |
|------|---------|-----------------|
| **Metadata** | `pages/api/metadata/[tokenId].js` | `getTokenDupInfo` → atributo `DupGeneration` (líneas ~845-900) |
| **Render** | `pages/api/render/[tokenId].js` | `getEffectiveGeneration(dupInfo, generation)` línea ~930; `getDupSkinPathADRIAN` en `lib/duplicator-logic.js:23`; texto "PARENT #X" PASO PARENT líneas ~2124-2148 |
| **Lib** | `lib/duplicator-logic.js` | `getTokenDupInfo`, `getEffectiveGeneration`, `getDupSkinPathADRIAN`, `getDupSkinPathADRIANGF` |

#### AdrianGF (serum AdrianGF + GoldenAdrian)

| Capa | Archivo | Función/sección |
|------|---------|-----------------|
| **Metadata** | `pages/api/metadata/[tokenId].js` | Atributo `UsedSerum` via `serumModule.getTokenSerumHistory` (líneas ~900-1050) |
| **Render** | `pages/api/render/[tokenId].js` | PASO 2 rama `appliedSerum==="AdrianGF"` (líneas ~1449-1504); rama `serumFailed` (líneas ~1521-1560) |
| **Skin assets** | `public/traits/ADRIANGF/GF{gen}-{skinType}.svg`, `GF-Fail.svg`, `GF-Goldfail.svg` | — |

#### SubZERO

| Capa | Archivo | Función/sección |
|------|---------|-----------------|
| **Metadata** | `pages/api/metadata/[tokenId].js` | Detección via `tagInfo.tag==='SubZERO'` → tokenName='SubZERO' línea ~390 |
| **Render** | `pages/api/render/[tokenId].js` | `filterEyesForTag` + `forceSkinTraitForTag` líneas ~1055-1073 |
| **Tag config** | `lib/tag-logic.js` | `TAG_CONFIGS.SubZERO`, `filterEyesForTag` (línea 57), `forceSkinTraitForTag` (línea 84) |
| **SKINTRAIT asset** | `public/labimages/1125.svg` | Forzado por `TAG_CONFIGS.SubZERO.forcedSkinTrait=1125` |

#### SamuraiZERO (incluye Honor)

| Capa | Archivo | Función/sección |
|------|---------|-----------------|
| **Metadata** | `pages/api/metadata/[tokenId].js` | Bloque `tagInfo.tag==='SamuraiZERO'` líneas ~396-475; `getSamuraiZEROIndex` (de `lib/tag-logic.js`); `getTokenHonor` (de `lib/contracts.js:337`) |
| **Metadata JSON** | `public/labmetadata/samuraimetadata.json` | Entrada por índice ordinal |
| **Render** | `pages/api/render/[tokenId].js` | `getSamuraiZEROIndex` línea ~1080; fuerza `equippedTraits['TOP']=imageIndex` línea ~1087; carga desde `labimages/samuraizero/{id}.svg` PASO 4 líneas ~1749-1785 |
| **TOP assets** | `public/labimages/samuraizero/{500-1099}.svg` | Índice = `500 + samuraiIndex` |

#### ZEROmovies S1 (`tag==='ZEROmovies'`)

| Capa | Archivo | Función/sección |
|------|---------|-----------------|
| **Metadata** | `pages/api/metadata/[tokenId].js` | Bloque `tagInfo.tag==='ZEROmovies'` líneas ~584-633; `getTokenMovieId` de `lib/contracts.js:519`; lee `zeromoviesmetadata.json`; `image → /api/v2/render/{id}.png` |
| **Render** | `pages/api/v2/render/[tokenId].js` | Compositor v2; overlay `labimages/zeromovies/{movieId}` en `compositor.js` línea ~176 |
| **Redirect v1→v2** | `pages/api/render/[tokenId].js` | Líneas ~1046-1053: 302 a `/api/v2/render/{id}.png` si `tag==='ZEROmovies'` |
| **Compositor overlay** | `lib/v2/render/compositor.js` | Línea ~174: `loadTraitFromLabimages('zeromovies/${movieId}')` |
| **Metadata JSON** | `public/labmetadata/zeromoviesmetadata.json` | Por movieId |

#### ZEROmovies S2 (`tag==='ZEROmovies2'`)

| Capa | Archivo | Función/sección |
|------|---------|-----------------|
| **Metadata** | `pages/api/metadata/[tokenId].js` | Bloque `tagInfo.tag==='ZEROmovies2'` líneas ~518-578; `getMovie2Info` de `lib/contracts.js:536`; reads `zeromovies2metadata.json`; `image → /api/v2/render/{id}.png` |
| **Render** | `pages/api/v2/render/[tokenId].js` | Compositor v2; `buildOverdueState` líneas ~329-342; sello OVERDUE + animación S2 |
| **Redirect v1→v2** | `pages/api/render/[tokenId].js` | Líneas ~1046-1053: 302 si `tag==='ZEROmovies2'` |
| **Compositor overlay** | `lib/v2/render/compositor.js` | Línea ~175: `loadTraitFromLabimages('zeromovies2/${movieId}')` |
| **Metadata JSON** | `public/labmetadata/zeromovies2metadata.json` | Por movieId; campo `hasAnimation` controla `animation_url` |

#### GumballZERO

| Capa | Archivo | Función/sección |
|------|---------|-----------------|
| **Metadata** | `pages/api/metadata/[tokenId].js` | Bloque GumballZERO líneas ~477-516; `resolveGumballForToken` de `lib/v2/tags/tag-resolver.js:150`; lee `gums.json` |
| **Render** | `pages/api/render/[tokenId].js` | Bloque GumballZERO líneas ~1095-1144; `resolveGumballForToken`; reconstruye `equippedTraits` desde `gums.json`; fuerza `baseImagePath='ADRIAN/GEN0-Light.svg'` |
| **Datos** | `public/labmetadata/gums.json` | Colección ordenada; índice = posición ordinal on-chain |
| **Detección** | `lib/v2/tags/tag-resolver.js` | `resolveGumballForToken` (línea 150) via `gumballWasMintedHere` on-chain; `getGumballIndex` (línea 89); `getGumballTraits` (línea 58) |

#### SPECIAL_TOKENS (1/1s con GIF estático)

| Capa | Archivo | Función/sección |
|------|---------|-----------------|
| **Metadata v1** | `pages/api/metadata/[tokenId].js` | `SPECIAL_TOKENS` **importado de `lib/v2/shared/constants.js`** (commit c33b0a33 — ya no inline); check líneas ~1099-1116 |
| **Metadata v2** | `lib/v2/metadata/special-tokens.js` | `getSpecialTokenMetadata` (línea 14); `SPECIAL_TOKENS` importado de `lib/v2/shared/constants.js:105` |
| **FUENTE ÚNICA** | `lib/v2/shared/constants.js` | `SPECIAL_TOKENS` (IDs: 302, 441, 442, 445, 454, 459, 740, **750 TAXreaper**, 815). Para añadir un nuevo special editar SOLO aquí. |
| **Render v2** | `pages/api/v2/render/[tokenId].js` | Líneas ~83-95: sirve GIF estático desde `public/labimages/specials/{id}.gif` |
| **Assets** | `public/labimages/specials/{302|441|442|445|454|459|740|750|815}.gif/.png` | — |
| **DIVERGENCIA** | — | ✅ RESUELTO (commit c33b0a33). v1 metadata ahora importa de `constants.js`. Token 750 verificado en vivo: `/api/metadata/750` → `TAXreaper #750`. |

#### ActionPacks (15008-15010)

| Capa | Archivo | Función/sección |
|------|---------|-----------------|
| **Metadata** | `pages/api/metadata/[tokenId].js` | Bloque `tokenIdNum >= 15008 && tokenIdNum <= 15010` líneas ~249-318 |
| **Datos** | `public/labmetadata/ActionPacks.json` | Array `packs` |
| **Imagen** | `public/labimages/{packId}.png` | Con fallback a nombres legacy (ozzy.png, hulk.png) |

#### Duplicados / Replicación

Ver sección AdrianZERO — GEN especiales arriba. La rama de duplicados en render está en `pages/api/render/[tokenId].js` líneas ~898-980 (obtención dupInfo, herencia skin del padre) y líneas ~2124-2148 (texto PARENT).

#### Serum / Mutación

| Capa | Archivo | Función/sección |
|------|---------|-----------------|
| **Metadata** | `pages/api/metadata/[tokenId].js` | Atributo `UsedSerum` vía `serumModule.getTokenSerumHistory` |
| **Render** | `pages/api/render/[tokenId].js` | Lógica completa serum líneas ~1162-1233; ramas GoldenAdrian/AdrianGF/failed en PASO 2 líneas ~1431-1560 |
| **Skin assets serum** | `public/traits/ADRIAN/GEN{n}-Goldenfail.svg`, `public/traits/ADRIANGF/GF-Fail.svg`, `GF-Goldfail.svg`, `GEN{n}-Golden.svg` | — |

#### Traits animados / GIF (secuenciales multi-frame)

| Capa | Archivo | Función/sección |
|------|---------|-----------------|
| **Detección v1** | `lib/animated-traits-helper.js` | `getAnimatedTraits(traitIds)` línea 67; `isTraitAnimated(traitId)` línea 113; detecta variantes `{id}a.svg`, `{id}b.svg`... en `labimages/` |
| **Detección v2** | `lib/v2/render/gif-pipeline.js` | `detectAnimatedTraits(traitIds)` línea 16; mismo patrón filesystem |
| **Generación GIF** | `lib/gif-generator.js` | `generateGifFromLayers` (línea 171); `createBounceSquashFrameGenerator` (línea 543); usado por v1 render y v2 render |
| **Metadata** | `pages/api/metadata/[tokenId].js` | Detecta animados para cambiar `imageExtension` a `.gif` líneas ~332-380 |
| **Render v1** | `pages/api/render/[tokenId].js` | Bloque GIF líneas ~2393-2670 aproximado |
| **Render v2** | `pages/api/v2/render/[tokenId].js` | Bloque GIF líneas ~248-300 |

#### Studio T-Shit (30014-35000)

| Capa | Archivo | Función/sección |
|------|---------|-----------------|
| **Fast-path render v1** | `pages/api/render/[tokenId].js` | Líneas ~267-306: `isTShitV2` → `resolveTShitUri` → sirve PNG directamente |
| **Fast-path render v2** | `pages/api/v2/render/[tokenId].js` | Líneas ~51-80: misma lógica usando `rasteriseStudioSvg` |
| **Como trait equipado** | `pages/api/render/[tokenId].js` | `loadExternalTrait(traitId)` línea ~815; V1 (30000-30013) hardcoded URL, V2 (30014+) on-chain URI |
| **Resolver** | `lib/v2/rpc/tshit-resolver.js` | `isTShitV2(numId)` (rango 30014-35000); `resolveTShitUri(numId)` (llama `tshitGetDesignURI` on-chain) |
| **Metadata** | `public/labmetadata/studio.json` | Entrada por tokenId; el render usa URI on-chain, no este JSON |

#### OG Punks (100001-101003)

| Capa | Archivo | Función/sección |
|------|---------|-----------------|
| **Render** | `pages/api/render/[tokenId].js` | `loadOgpunkTrait(traitId)` línea ~860; carga desde `labimages/ogpunks/{id}.svg`; caso especial 101003 CAESAR sirve GIF (líneas ~1725-1737) |
| **Metadata** | `public/labmetadata/ogpunks.json` | Array `traits` |
| **Assets** | `public/labimages/ogpunks/{id}.svg/.gif` | — |

---

### 3. Inventario de archivos

#### Endpoints producción (`pages/api/render*`, `pages/api/metadata*`, `pages/api/v2/*`)

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

#### `lib/` raíz — helpers V1

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

#### `lib/renderers/` — renderers encapsulados

| Archivo | Líneas | Propósito | Importado por |
|---------|--------|-----------|---------------|
| `lib/renderers/floppy-renderer.js` | 788 | `FloppyRenderer` class — render completo de floppy disk card | `pages/api/render/floppy/[tokenId].js`, `svg.js` |
| `lib/renderers/card-v4-renderer.js` | 299 | `renderV4CardPng`, `buildV4CardSvg`, `renderV4CardFramePng` — layout V4 | floppy endpoint, floppy-v4 endpoint |
| `lib/renderers/adrianzero-renderer.js` | 1690 | `AdrianZeroRenderer` class | `pages/api/render/lambo/[tokenId].js` |
| `lib/renderers/gif-renderer.js` | 238 | `GifRenderer` class | `pages/api/render/gif.js` |

#### `lib/v2/` — stack V2

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

### 4. Índice de funciones clave

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

### 5. Duplicados / Código muerto — con evidencia

#### CONFIRMED-DEAD

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

#### IN-USE

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

#### NEEDS-RUNTIME-CHECK

| Elemento | Por qué necesita verificación |
|----------|------------------------------|
| `pages/api/rendershadow/[tokenId].js` | 0 referencias estáticas encontradas. Posible que algún cliente externo (OpenSea, frontend antiguo) llame directamente. Verificar en logs de Vercel antes de borrar. |
| `lib/external-render-client.js` | Usado por v1 custom-external y `debug/render-custom.js`. El servicio externo en Render.com puede estar activo o no. Verificar si `EXTERNAL_RENDER_SERVICE_URL` está configurado en Vercel. |
| `pages/api/render/displacement/[tokenId].js` | Sin referencias de producción encontradas. Podría ser llamado por alguna DApp directamente. Verificar logs. |
| `pages/api/render/nanobanana/[tokenId].js` | Sin referencias encontradas. Verificar si está deprecado vs el toggle 13 en v1 render. |

#### Divergencia SPECIAL_TOKENS v1 vs v2 — ✅ RESUELTO (commit c33b0a33)

**Era:** `pages/api/metadata/[tokenId].js` tenía SPECIAL_TOKENS inline (líneas 9-41) sin el ID 750 (TAXreaper), que sí estaba en `lib/v2/shared/constants.js`. `/api/metadata/750` (canónico) lo servía como AdrianZERO normal.

**Fix:** v1 metadata ahora hace `import { SPECIAL_TOKENS } from '../../../lib/v2/shared/constants.js'`. Fuente única. Verificado en vivo cache-bust (`x-vercel-cache: MISS`): `750 → TAXreaper #750 / specials/750.png`; `815 → WakaZERO #815` (sin regresión). Para añadir un nuevo special editar SOLO `lib/v2/shared/constants.js`.

---

### 6. Propuesta de renombrado/organización

Solo propuesta. No ejecutar en Fase 1.

#### A. Eliminar código muerto confirmado (Fase 2)

**Estado:** ✅ HECHO (commit a46862b4) — 20 archivos `*.backup*` + `scripts/validate-v2.js` + `scripts/parity-c2.mjs` eliminados. ⏳ DIFERIDO por decisión del usuario ("solo lo seguro"): el árbol v2-metadata sigue en sitio.

Orden seguro (pendiente):
1. Eliminar `pages/api/v2/metadata/[tokenId].js` + `lib/v2/metadata/builder.js` + `lib/v2/metadata/name-resolver.js` + `lib/v2/metadata/special-tokens.js` + `lib/v2/cache/metadata-cache.js`
2. Eliminar `pages/api/v2/render/custom-external/[tokenId].js`
3. Eliminar `pages/api/rendershadow/[tokenId].js` (tras verificar logs)
4. Eliminar `lib/v2/cache/trait-png-store.js` + `scripts/prerender-traits.js` si no se usan

**Riesgo**: Bajo si se verifica 0 tráfico en logs primero. El directorio `lib/v2/metadata/` quedaría vacío — borrar.

#### B. Consolidar SPECIAL_TOKENS (Fase 2) — ✅ HECHO (commit c33b0a33)

`SPECIAL_TOKENS` inline de `pages/api/metadata/[tokenId].js` reemplazado por `import { SPECIAL_TOKENS } from '../../../lib/v2/shared/constants.js'`. v1 metadata y v2 usan la misma fuente. Build verde, verificado en vivo. No rompió nada.

#### C. Renombrar para claridad

| Nombre actual | Nombre propuesto | Riesgo |
|--------------|-----------------|--------|
| `pages/api/render/custom/[tokenId].js` | `pages/api/render/custom-internal/[tokenId].js` | Rompe `pages/index.js` (1 referencia) |
| `lib/tag-logic.js` | `lib/v1/tag-logic.js` o mantener flat | Rompe v1 render + v1 metadata (dynamic imports por string) |
| `lib/v2/rpc/tshit-resolver.js` | `lib/rpc/tshit-resolver.js` (compartido) | Rompe todos los importers (5 archivos) |
| `lib/v2/shared/constants.js` | `lib/shared/constants.js` | Rompe toda la stack v2 |

**Recomendación**: No renombrar en Fase 2. El `lib/v2/rpc/tshit-resolver.js` ya está de facto compartido entre v1 y v2 — moverlo a `lib/` (sin namespace) refleja mejor la realidad, pero el esfuerzo de repath es alto.

#### D. Mover `lib/v2/` hacia neutralidad

Todo `lib/v2/rpc/`, `lib/v2/tags/`, `lib/v2/cache/`, `lib/v2/shared/` ya son usados por endpoints v1 (imports dinámicos). La separación `v2/` es un artefacto histórico. Una reorganización limpia sería `lib/rpc/`, `lib/tags/`, `lib/kv/`, `lib/constants.js`. Riesgo: ~30 archivos con imports a actualizar. Diferir a Fase 3 tras eliminar código muerto.

---

### Apéndice: Flujo del cache para un render normal (AdrianZERO)

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
