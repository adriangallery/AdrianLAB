# Informe: AdrianZERO / AdrianLAB → fully on-chain

> Análisis de viabilidad y coste para mover el render de AdrianZERO/AdrianLAB de off-chain (Vercel) a 100% on-chain (SVG on-chain), al estilo del minter TigerPunks.
> Datos de gas reales: ETH $1.664,61 · gas mainnet 0,127 gwei (2026-06-24). Guardado para retomar más adelante.

## Respuestas directas

1. **¿Redesplegar el contrato de AdrianZERO? → NO.** `AdrianLabCore` (Base `0x6E369BF0E4e0c106192D606FB6d85836d684DA75`, ERC721Enumerable, **no es proxy**) ya tiene `tokenURI()` que **delega en un `extensionsContract` ajustable** (`setExtensionsContract`, onlyOwner) con fallback a `baseURI` (`setBaseURI`, onlyOwner). Se despliega un **renderer on-chain nuevo** y se enchufa con `setExtensionsContract(...)`. Sin tocar el contrato original ni los holders.
   - `tokenURI`: `Contratos/AdrianZERO/adrianlabcore.sol:514-524`
   - setters: `adrianlabcore.sol:609` (setBaseURI), `:528` (setExtensionsContract)

2. **El estado de traits YA está on-chain.** `AdrianTraitsExtensions.equippedTrait[tokenId][category] = traitId` (`Contratos/AdrianLAB/adriantraitsextensions.sol:54-56`). El renderer lee eso directamente → **no necesitas tabla token→combo** como TigerPunks (te ahorras ~20M gas + la curación).

3. **Coste de gas (una vez, hoy):** **~$18 a ~$72** según resolución. Render y mint siguen **gratis** (view).

## Cómo funciona hoy
- Render **off-chain en Vercel** (`adrianlab.vercel.app/api/render/[id].png`): pipeline de ~2.670 líneas (`pages/api/render/[tokenId].js`), compone capas SVG sobre canvas 1000×1000 con `@resvg` + `sharp`.
- **Dinámico**: cada render lee on-chain `getTokenData` (generación, mutación, skin) + `getAllEquippedTraits` y compone en vivo. Serums que mutan, GenZERO duplicator, SubZERO (skin forzado), efectos (shadow/glow/UV/blackout/banana), traits animados (GIF), texto de mensaje, closeups, ~10 sub-colecciones (OG Punks, SamuraiZERO, ZEROmovies S1/S2, Floppy, Pagers, Action Packs…).
- Contratos clave (Base): Core `0x6E369…DA75`, TraitsExtension `0x0995c0da…f8d6`, PatientZERO `0x41bd1d62…172f`, SerumModule `0xEb84a51F…B2Ec`. tokenURI → `https://adrianlab.vercel.app/api/metadata/{id}`.

## Parecidos y diferencias con TigerPunks

| | TigerPunks | AdrianZERO/LAB |
|---|---|---|
| Traits | Fijos por token (tabla on-chain) | **Dinámicos** (equip on-chain ya existe) |
| Tabla combos | Sí (~100KB, ~20M gas) | **No hace falta** |
| Arte | Pixel-art 24×24, 300 colores | **Detallado, ~14.000 colores**, viewBox hasta 1024px |
| Contrato | Deploy nuevo | **Reusa el existente** (renderer enchufable) |
| Colección | Cerrada, 10k | **Viva** (siguen saliendo traits) |

## Coste de gas medido (deploy del arte on-chain, una vez)
Arte real RLE-codificado 2-byte (mismo encoding que TigerPunks). ~410 trait SVGs, 17 categorías. ~14k colores → **paleta 2-byte obligatoria**. Sin tabla de combos. +renderer ~4M gas incluido.

| Resolución | Arte on-chain | Gas deploy | Hoy (0,13 gw) | 0,5 gw | 2 gw |
|---|---|---|---|---|---|
| 48×48 px | 381 KB | ~83M | **$18** | $69 | $277 |
| 64×64 px | 505 KB | ~109M | **$23** | $90 | $362 |
| Nativa (full) | ~1,6 MB | ~340M | **$72** | $283 | $1.132 |

Nota: el sub-agente estimó "$40/KB inviable" usando coste de *calldata*; el real con SSTORE2 es ~200 gas/byte → tabla de arriba. Arte vía SSTORE2 (excede EIP-170) en contrato art-store ampliable (patrón `TigerArt.sol`).

## El coste REAL es la ingeniería, no el gas
- ✅ **Directo (patrón TigerPunks):** leer `equippedTrait` por categoría → dibujar cada trait RLE en z-order + skin/generación. ~80% visual.
- ⚠️ **Trabajo:** skins/generaciones/mutación, serums (AdrianGF), GenZERO duplicator, SubZERO, overrides por token.
- 🔴 **No trivial en SVG puro:** efectos canvas (glow/shadow → filtros SVG factibles; UV/blackout = transformaciones de color, factibles), **traits animados** (→ `<animate>`, como los 1/1, pesan más), texto de mensaje, y ~10 sub-colecciones con lógica propia (cada una mini-proyecto).
- ➕ **Colección viva:** salen packs nuevos → registro de arte SSTORE2 **ampliable** (cada trait nuevo = un write, ~200 gas/byte al lanzarlo), no un deploy único congelado. El renderer mapea traitId→offset del blob.

## Recomendación / fases
1. **Fase 1 — colección principal AdrianZERO:** renderer on-chain que lee `equippedTrait` + skin/generación y compone las 17 categorías a ~**64×64** (~$23 hoy). Enchufar vía `setExtensionsContract`. Simplificar efectos exóticos al inicio. Es el renderer de TigerPunks pero leyendo estado vivo.
2. **Fase 2 —** efectos (glow/shadow/UV como filtros SVG) + traits animados (delta-SVG).
3. **Fase 3 —** sub-colecciones on-chain una a una (o dejarlas off-chain).
4. **Registro de arte ampliable** para packs futuros.

**Ventaja vs TigerPunks:** no rehaces el contrato ni gestionas combos; el estado dinámico ya vive on-chain → "fully on-chain" aquí es sobre todo **mover el render**, y a precios de hoy cuesta calderilla.

## Archivos de referencia
- Render: `AdrianLAB/pages/api/render/[tokenId].js`, `pages/api/metadata/[tokenId].js`, `lib/contracts.js`
- Arte: `AdrianLAB/public/traits/{CATEGORY}/*.svg` (~410 archivos, 17 categorías)
- Contratos: `Contratos/AdrianZERO/adrianlabcore.sol`, `Contratos/AdrianZERO/AdrianLabextensions.sol`, `Contratos/AdrianLAB/adriantraitsextensions.sol`, `Contratos/CONTRACTS_REGISTRY.md`
- Patrón renderer on-chain a reutilizar: `AdrianPunks/tigerpunks-onchain/src/{TigerRenderer,TigerArt,TigerData,TigerLayout}.sol`
