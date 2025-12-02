# Análisis de Variables que Afectan al Render Final

Este documento analiza todas las variables que determinan el resultado final de un render para poder crear un sistema de almacenamiento basado en hash único.

## Variables que Afectan al Render

### 1. Query Parameters (req.query)
Estos parámetros vienen de la URL y afectan directamente al render:
- `closeup` (boolean): Renderiza en 640x640 en lugar de 1000x1000
- `shadow` (boolean): Aplica efecto de sombra
- `glow` (boolean): Aplica efecto de glow
- `bn` o `bw` (boolean): Renderiza en blanco y negro
- `uv` o `UV` (boolean): Aplica efecto UV/Blacklight
- `blackout` (boolean): Renderiza con efecto blackout (negro completo)
- `banana` (boolean): Aplica transformación Nano Banana (viene del toggle 13 onchain)

### 2. Token Data (del contrato core.getTokenData)
- `generation` (string/number): Generación del token (0, 1, 2, etc.)
- `mutationLevel` (string/number): Nivel de mutación
- `canReplicate` (boolean): Si puede replicar
- `hasBeenModified` (boolean): Si ha sido modificado

### 3. Skin (del contrato core.getTokenSkin)
- `skinId` (string/number): ID del skin
- `skinName` (string): Nombre del skin (ej: "Zero", "Medium", etc.)

### 4. Traits Equipados (del contrato traitsExtension.getAllEquippedTraits)
- `categories` (array): Categorías de los traits equipados
- `traitIds` (array): IDs de los traits equipados (ordenados por categoría)

**Nota**: El orden importa porque los traits se renderizan en un orden específico.

### 5. Serum (del contrato serumModule.getTokenSerumHistory)
- `appliedSerum` (string | null): Tipo de serum aplicado exitosamente ("GoldenAdrian", "AdrianGF", etc.)
- `serumFailed` (boolean): Si el último serum falló
- `failedSerumType` (string | null): Tipo de serum que falló
- `hasAdrianGFSerum` (boolean): Si hay un AdrianGF previo en el historial
- `serumHistory` (array): Historial completo de serums (para conversiones complejas)

**Nota**: El historial completo de serum puede afectar el render final (ej: GoldenAdrian fallido + AdrianGF exitoso → GF-Goldfail)

### 6. SKINTRAIT (trait especial)
- `skintraitPath` (string | null): Path al trait de skin especial (tiene máxima prioridad sobre skin base y serums)

### 7. Tags Especiales (de lib/tag-logic.js)
- `tagInfo.tag` (string | null): Tag especial del token ("SubZERO", "SamuraiZERO", etc.)
- `tagInfo.index` (number | null): Índice específico para algunos tags (ej: SamuraiZERO)

## Estrategia de Hash

Para crear un hash único que identifique un render específico, necesitamos:

1. **Normalizar todas las variables** a strings consistentes
2. **Ordenar arrays** para que el orden no afecte al hash
3. **Crear un objeto JSON** con todas las variables
4. **Generar un hash** (SHA-256 o similar) del JSON stringificado
5. **Usar el hash** como parte del nombre del archivo

## Formato del Nombre de Archivo

Propuesta de formato:
```
{tokenId}_{hash}.png
```

O más descriptivo (pero más largo):
```
{tokenId}_g{generation}_s{skinId}_{serum}_{hash}.png
```

O con todas las variables visibles:
```
{tokenId}_g{generation}_s{skinId}_serum{serum}_closeup{closeup}_shadow{shadow}_glow{glow}_bn{bn}_uv{uv}_blackout{blackout}_banana{banana}_{hash}.png
```

**Recomendación**: Usar formato corto con hash para evitar nombres demasiado largos:
```
{tokenId}_{hash}.png
```

El hash contendrá toda la información necesaria para verificar coincidencias.

## Consideraciones Especiales

1. **Orden de traits**: Los traits se renderizan en un orden específico, así que el orden importa. Debemos incluir el orden en el hash.

2. **Serum history complejo**: Para conversiones como GF-Goldfail, necesitamos incluir información del historial completo, no solo el último serum.

3. **Tags especiales**: Los tags pueden modificar traits (ej: SubZERO fuerza SKINTRAIT 1125), así que debemos incluir el tag en el hash.

4. **SKINTRAIT**: Tiene máxima prioridad, así que si existe, debe estar en el hash.

## Implementación

1. Crear función `generateRenderHash()` que:
   - Recibe todas las variables del render
   - Normaliza y ordena los datos
   - Genera un hash único
   - Retorna el hash

2. Crear función `getRenderFilename()` que:
   - Genera el hash usando `generateRenderHash()`
   - Construye el nombre del archivo
   - Retorna el nombre completo

3. Actualizar `lib/github-storage.js` para:
   - Aceptar hash en lugar de solo renderType
   - Buscar archivos por hash
   - Subir archivos con hash en el nombre

4. Actualizar `pages/api/render/[tokenId].js` para:
   - Generar hash antes de renderizar
   - Verificar si existe archivo con ese hash
   - Si existe, servir desde GitHub
   - Si no existe, renderizar y subir con el hash

