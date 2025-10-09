# ESTRATEGIA DE IMPLEMENTACIÓN SAMURAIZERO

## RESUMEN EJECUTIVO

SamuraiZERO es una colección especial dentro de AdrianZERO que comprende los tokens **500-1099** (600 tokens total). Esta colección requiere una lógica de renderizado simplificada que bypassa la composición compleja de traits y utiliza imágenes pre-renderizadas junto con metadata hardcodeado.

## ALCANCE DE CAMBIOS

### Tokens Afectados
- **Rango**: 500-1099 (inclusive)
- **Total**: 600 tokens
- **Fuera del rango**: Tokens 0-499 y 1100+ mantienen lógica normal

### Archivos de Recursos
- **Imágenes**: `/public/labimages/samuraizero/` (formato: `{tokenId}.svg`)
- **Metadata**: `/public/labmetadata/samuraimetadata.json` (estructura simplificada)

## IMPLEMENTACIÓN POR RENDERPOINT

### 1. RENDER DE IMAGEN NORMAL (`/api/render/[tokenId].js`)

#### Ubicación del Cambio
- **Archivo**: `pages/api/render/[tokenId].js`
- **Líneas aproximadas**: 200-1100 (función principal)

#### Lógica Actual
```javascript
// Lógica compleja actual:
1. Conectar con contratos blockchain
2. Obtener datos del token (generation, mutationLevel, etc.)
3. Obtener skin del token
4. Obtener traits equipados
5. Renderizar capas en orden específico:
   - BACKGROUND
   - ADRIAN
   - SKIN
   - MUTATION (si > 0)
   - Otras capas según traits-order.js
   - TOP (capa final)
```

#### Lógica Nueva para SamuraiZERO (500-1099)
```javascript
// Detección de rango SamuraiZERO
if (cleanTokenId >= 500 && cleanTokenId <= 1099) {
  // LÓGICA SIMPLIFICADA SAMURAIZERO
  1. Cargar imagen SVG desde /public/labimages/samuraizero/{tokenId}.svg
  2. Convertir SVG → PNG (usar caché SVG→PNG)
  3. Retornar imagen PNG (compatible con OpenSea)
} else {
  // LÓGICA NORMAL ADRIANZERO (mantener código actual)
}
```

#### Puntos de Implementación Específicos
1. **Detección temprana** (línea ~200): Añadir verificación de rango antes de conectar con contratos
2. **Bypass de contratos** (líneas ~230-250): Saltar todas las llamadas a blockchain
3. **Carga de imagen** (línea ~470): Reemplazar lógica de composición con carga directa
4. **Renderizado TOP** (líneas ~468-496): Usar imagen SamuraiZERO como única capa

### 2. RENDER CUSTOM DE IMAGEN (`/api/render/custom/[tokenId].js`)

#### Ubicación del Cambio
- **Archivo**: `pages/api/render/custom/[tokenId].js`
- **Líneas aproximadas**: 400-1540 (función principal)

#### Lógica Actual
```javascript
// Lógica compleja actual:
1. Procesar parámetros de customización
2. Conectar con contratos blockchain
3. Obtener traits equipados
4. Aplicar customizaciones
5. Renderizar capas en orden específico
6. Aplicar efectos especiales
```

#### Lógica Nueva para SamuraiZERO (500-1099)
```javascript
// Detección de rango SamuraiZERO
if (cleanTokenId >= 500 && cleanTokenId <= 1099) {
  // LÓGICA SIMPLIFICADA SAMURAIZERO
  1. Cargar imagen SVG desde /public/labimages/samuraizero/{tokenId}.svg
  2. Aplicar customizaciones básicas (si aplicables)
  3. Convertir SVG → PNG (usar caché SVG→PNG)
  4. Retornar imagen PNG (compatible con OpenSea)
} else {
  // LÓGICA NORMAL ADRIANZERO (mantener código actual)
}
```

#### Puntos de Implementación Específicos
1. **Detección temprana** (línea ~400): Añadir verificación de rango
2. **Bypass de contratos** (líneas ~450-500): Saltar llamadas a blockchain
3. **Carga de imagen** (línea ~1420): Reemplazar lógica de composición
4. **Renderizado TOP** (líneas ~1422-1454): Usar imagen SamuraiZERO

### 3. RENDER DE METADATA (`/api/metadata/[tokenId].js`)

#### Ubicación del Cambio
- **Archivo**: `pages/api/metadata/[tokenId].js`
- **Líneas aproximadas**: 3-567 (función principal)

#### Lógica Actual
```javascript
// Lógica compleja actual:
1. Conectar con contratos blockchain
2. Obtener historial de nombres (AdrianNameRegistry)
3. Obtener status y profileName (PatientZERO)
4. Obtener traits equipados (TraitsExtension)
5. Obtener datos de serum (SerumModule)
6. Construir metadata dinámicamente
7. Aplicar lógica de nombres personalizados
8. Generar atributos desde traits
```

#### Lógica Nueva para SamuraiZERO (500-1099)
```javascript
// Detección de rango SamuraiZERO
if (cleanTokenId >= 500 && cleanTokenId <= 1099) {
  // LÓGICA SIMPLIFICADA SAMURAIZERO
  1. Cargar metadata desde /public/labmetadata/samuraimetadata.json
  2. Buscar entrada específica por tokenId
  3. Actualizar campo "image" con URL correcta: /api/render/{tokenId}.png
  4. Retornar metadata pre-construido (compatible con OpenSea)
} else {
  // LÓGICA NORMAL ADRIANZERO (mantener código actual)
}
```

#### Puntos de Implementación Específicos
1. **Detección temprana** (línea ~50): Añadir verificación de rango
2. **Bypass de contratos** (líneas ~150-200): Saltar todas las llamadas a blockchain
3. **Carga de JSON** (línea ~300): Implementar carga de samuraimetadata.json
4. **Búsqueda de token** (línea ~350): Buscar entrada específica por tokenId
5. **Retorno directo** (línea ~400): Retornar metadata sin procesamiento adicional

## ESTRUCTURA DEL JSON SAMURAIZERO

### Ubicación
- **Archivo**: `/public/labmetadata/samuraimetadata.json`
- **Tamaño**: 35,342 líneas
- **Tokens**: 500-1099 (600 entradas)

### Estructura de Entrada
```json
{
  "name": "Adrian_Zero_Samurai",
  "description": "SamuraiZERO by HalfxTiger",
  "collection": [
    {
      "name": "ShurikenRain #500",
      "description": "SamuraiZERO by HalfxTiger",
      "image": "500.svg",
      "attributes": [
        {
          "trait_type": "Background",
          "value": "Mountain-Red"
        },
        // ... más atributos
      ]
    }
    // ... más tokens
  ]
}
```

### Campos Simplificados
- **name**: Nombre del token con número
- **description**: Descripción fija
- **image**: URL del endpoint de render (ej: `https://adrianlab.vercel.app/api/render/550.png`)
- **attributes**: Atributos pre-definidos
- **external_url**: URL fija
- **masterminds**: Creadores fijos

### Compatibilidad con OpenSea
- **Formato de imagen**: PNG (no SVG) para compatibilidad total
- **URL de imagen**: Usar endpoint `/api/render/{tokenId}.png` estándar
- **Metadata estándar**: Estructura compatible con OpenSea
- **Atributos**: Formato `trait_type` y `value` estándar

## ORDEN DE IMPLEMENTACIÓN RECOMENDADO

### Fase 1: Preparación
1. **Backup de archivos**: Crear copias de seguridad de los 3 archivos principales
2. **Validación de recursos**: Verificar que todas las imágenes 500-1099 existen
3. **Validación de JSON**: Confirmar estructura completa del metadata

### Fase 2: Implementación por Prioridad
1. **Metadata** (menor riesgo): Implementar lógica simplificada
2. **Render normal** (mayor uso): Implementar bypass de contratos
3. **Render custom** (funcionalidad especial): Implementar lógica simplificada

### Fase 3: Testing
1. **Tokens de prueba**: 500, 750, 1000, 1099
2. **Tokens límite**: 499, 1100 (verificar lógica normal)
3. **Casos edge**: Tokens inexistentes, errores de carga

## SISTEMA DE CACHÉ PARA SAMURAIZERO

### Cachés Existentes a Reutilizar

#### 1. **Caché de AdrianZERO Render** ✅ **REUTILIZAR**
- **Archivo**: `lib/cache.js` (líneas 385-489)
- **Funciones**: `getCachedAdrianZeroRender()`, `setCachedAdrianZeroRender()`
- **TTL**: 24h para tokens normales (1-9999)
- **Uso**: Cachear imágenes PNG renderizadas de SamuraiZERO
- **Clave**: `adrianzero_render_{tokenId}`

#### 2. **Caché de JSON** ✅ **REUTILIZAR**
- **Archivo**: `lib/json-cache.js`
- **Funciones**: `getCachedJson()`, `setCachedJson()`
- **TTL**: 7 días (perfecto para metadata estático)
- **Uso**: Cachear `samuraimetadata.json` completo
- **Clave**: `/public/labmetadata/samuraimetadata.json`

#### 3. **Caché de Componentes** ✅ **REUTILIZAR**
- **Archivo**: `lib/component-cache.js`
- **Funciones**: `getCachedComponent()`, `setCachedComponent()`
- **TTL**: 24 horas
- **Uso**: Cachear imágenes SVG individuales de SamuraiZERO
- **Clave**: `trait_{tokenId}` (usando tipo "trait")

#### 4. **Caché SVG→PNG** ✅ **REUTILIZAR**
- **Archivo**: `lib/svg-png-cache.js`
- **Funciones**: `getCachedSvgPng()`, `setCachedSvgPng()`
- **TTL**: 24 horas
- **Uso**: Cachear conversiones de SVG a PNG para SamuraiZERO
- **Clave**: Hash MD5 del contenido SVG

### Cachés NO Necesarios para SamuraiZERO

#### ❌ **Caché de Contratos** - NO USAR
- **Razón**: SamuraiZERO bypassa completamente las llamadas a blockchain
- **Archivo**: `lib/contract-cache.js`
- **Impacto**: Ahorro de memoria y complejidad

#### ❌ **Caché de AdrianZERO SVG** - NO USAR
- **Razón**: SamuraiZERO usa imágenes pre-renderizadas, no genera SVG
- **Archivo**: `lib/cache.js` (líneas 620-733)

### Estrategia de Caché Específica

#### **Para Render de Imagen**:
```javascript
// 1. Verificar caché de AdrianZERO render (PNG final)
const cachedImage = getCachedAdrianZeroRender(tokenId);
if (cachedImage) return cachedImage;

// 2. Cargar imagen SVG desde componente cache
const svgImage = getCachedComponent('trait', tokenId);
if (!svgImage) {
  // Cargar SVG desde archivo y cachear
  const svgBuffer = await loadSamuraiImage(tokenId);
  setCachedComponent('trait', tokenId, svgBuffer);
}

// 3. Convertir SVG→PNG (usar caché SVG→PNG)
const svgContent = svgImage.toString();
const pngBuffer = getCachedSvgPng(svgContent);
if (!pngBuffer) {
  const convertedPng = await convertSvgToPng(svgContent);
  setCachedSvgPng(svgContent, convertedPng);
  return convertedPng;
}

// 4. Cachear resultado final PNG
setCachedAdrianZeroRender(tokenId, pngBuffer);
return pngBuffer;
```

#### **Para Metadata**:
```javascript
// 1. Verificar caché de JSON
const cachedJson = await getCachedJson('/public/labmetadata/samuraimetadata.json');
if (!cachedJson) {
  // Cargar y cachear JSON completo
  const jsonData = await loadSamuraiMetadata();
  setCachedJson('/public/labmetadata/samuraimetadata.json', jsonData);
}

// 2. Buscar token específico en JSON cacheado
const tokenData = cachedJson.collection.find(item => 
  item.name.includes(`#${tokenId}`)
);

// 3. Actualizar URL de imagen para compatibilidad con OpenSea
if (tokenData) {
  tokenData.image = `https://adrianlab.vercel.app/api/render/${tokenId}.png`;
  tokenData.external_url = `https://adrianlab.vercel.app/api/render/${tokenId}.png`;
}

// 4. Retornar metadata actualizado
return tokenData;
```

### TTL Recomendado para SamuraiZERO

| Componente | TTL Actual | TTL SamuraiZERO | Justificación |
|------------|------------|-----------------|---------------|
| **Imágenes PNG** | 24h | **48h** | Imágenes estáticas, cambio poco frecuente |
| **Metadata JSON** | 7 días | **7 días** | Mantener igual, es estático |
| **Componentes SVG** | 24h | **48h** | Imágenes pre-renderizadas |
| **Conversiones SVG→PNG** | 24h | **48h** | Mismo contenido, mayor duración |

### Modificaciones Necesarias en Caché

#### 1. **Actualizar TTL en `lib/cache.js`**
```javascript
// Línea ~392: Modificar getAdrianZeroRenderTTL()
export function getAdrianZeroRenderTTL(tokenId) {
  const tokenIdNum = parseInt(tokenId);
  
  if (tokenIdNum >= 500 && tokenIdNum <= 1099) {
    return 172800000; // 48h - SamuraiZERO (imágenes estáticas)
  } else if (tokenIdNum >= 1 && tokenIdNum <= 9999) {
    return 86400000; // 24h - Tokens normales
  } else if (tokenIdNum >= 30000 && tokenIdNum <= 35000) {
    return 172800000; // 48h - T-shirts personalizados
  } else if (tokenIdNum === 262144) {
    return 172800000; // 48h - Serum
  } else {
    return 3600000; // 1h - Fallback
  }
}
```

#### 2. **Actualizar TTL en `lib/component-cache.js`**
```javascript
// Línea ~3: Modificar COMPONENT_TTL para SamuraiZERO
const COMPONENT_TTL = 24 * 60 * 60 * 1000; // 24 horas (mantener)

// Añadir función específica para SamuraiZERO
export function getSamuraiComponentTTL(tokenId) {
  const tokenIdNum = parseInt(tokenId);
  if (tokenIdNum >= 500 && tokenIdNum <= 1099) {
    return 48 * 60 * 60 * 1000; // 48h para SamuraiZERO
  }
  return COMPONENT_TTL; // 24h para otros
}
```

#### 3. **Actualizar TTL en `lib/svg-png-cache.js`**
```javascript
// Línea ~3: Modificar SVG_PNG_TTL para SamuraiZERO
const SVG_PNG_TTL = 24 * 60 * 60 * 1000; // 24 horas (mantener)

// Añadir función específica para SamuraiZERO
export function getSamuraiSvgPngTTL(svgContent) {
  // Detectar si es SamuraiZERO por contenido o tokenId
  if (svgContent.includes('samurai') || svgContent.includes('SamuraiZERO')) {
    return 48 * 60 * 60 * 1000; // 48h para SamuraiZERO
  }
  return SVG_PNG_TTL; // 24h para otros
}
```

#### 4. **Añadir Funciones de Invalidación Específicas**
```javascript
// En lib/cache.js - Añadir funciones para SamuraiZERO
export function invalidateSamuraiZERORange(startId = 500, endId = 1099) {
  let invalidated = 0;
  
  // Invalidar AdrianZERO render
  invalidated += invalidateAdrianZeroRenderRange(startId, endId);
  
  // Invalidar componentes
  for (let tokenId = startId; tokenId <= endId; tokenId++) {
    if (invalidateComponent('trait', tokenId)) {
      invalidated++;
    }
  }
  
  console.log(`[cache] Invalidated ${invalidated} SamuraiZERO entries for range ${startId}-${endId}`);
  return invalidated;
}

export function getSamuraiZEROCacheStats() {
  const allKeys = Array.from(memoryCache.keys());
  const samuraiKeys = allKeys.filter(key => {
    const tokenId = parseInt(key.replace(/.*_(\d+)$/, '$1'));
    return tokenId >= 500 && tokenId <= 1099;
  });
  
  return {
    totalSamuraiEntries: samuraiKeys.length,
    renderEntries: samuraiKeys.filter(k => k.startsWith('adrianzero_render_')).length,
    componentEntries: samuraiKeys.filter(k => k.startsWith('trait_')).length,
    svgPngEntries: samuraiKeys.filter(k => k.includes('svg')).length,
    keys: samuraiKeys
  };
}
```

## CONSIDERACIONES TÉCNICAS

### Performance
- **Ventaja**: Eliminación de llamadas a blockchain para 600 tokens
- **Carga**: Imágenes pre-renderizadas más rápidas
- **Caché**: Reutilización de 4 sistemas de caché existentes
- **Memoria**: Optimización con TTL extendido para componentes estáticos

### Mantenibilidad
- **Código limpio**: Lógica condicional clara por rango
- **Fácil reversión**: Cambios localizados y documentados
- **Escalabilidad**: Fácil añadir más rangos especiales

### Compatibilidad
- **Backward compatibility**: Tokens 0-499 y 1100+ sin cambios
- **API consistency**: Mismos endpoints y formatos de respuesta
- **Error handling**: Manejo de errores consistente

## VALIDACIÓN POST-IMPLEMENTACIÓN

### Tests Obligatorios
1. **Token 500**: Primer SamuraiZERO
2. **Token 1099**: Último SamuraiZERO  
3. **Token 499**: Último AdrianZERO normal
4. **Token 1100**: Primer AdrianZERO post-SamuraiZERO
5. **Token 0**: AdrianZERO base
6. **Token 10000+**: AdrianZERO avanzado

### Validación con URLs Existentes
Basado en los resultados de [adrianlab.vercel.app/api/metadata/230](https://adrianlab.vercel.app/api/metadata/230) y [adrianlab.vercel.app/api/metadata/550](https://adrianlab.vercel.app/api/metadata/550):

#### **Token 230** (Fuera del rango - Lógica Normal):
- ✅ **Estado actual**: Funciona con lógica estándar
- ✅ **Contratos**: Conecta correctamente con blockchain
- ✅ **Metadata**: Genera atributos dinámicamente
- ✅ **Imagen**: URL `/api/render/230.png` funciona

#### **Token 550** (Dentro del rango - Lógica SamuraiZERO):
- ❌ **Estado actual**: Error `!exist` en blockchain
- ✅ **Después de implementación**: Usará lógica SamuraiZERO
- ✅ **Metadata**: Cargará desde `samuraimetadata.json`
- ✅ **Imagen**: URL `/api/render/550.png` funcionará
- ✅ **Formato**: PNG compatible con OpenSea

### Métricas de Éxito
- **Tiempo de respuesta**: < 500ms para SamuraiZERO
- **Tasa de error**: 0% para tokens válidos
- **Consistencia visual**: Imágenes idénticas a archivos fuente
- **Metadata correcto**: Atributos y metadatos exactos

## ARCHIVOS A MODIFICAR

### Archivos Principales (REQUERIDOS)
1. `pages/api/render/[tokenId].js` - Render normal
2. `pages/api/render/custom/[tokenId].js` - Render custom  
3. `pages/api/metadata/[tokenId].js` - Metadata

### Archivos de Caché (REQUERIDOS)
1. `lib/cache.js` - Actualizar TTL y añadir funciones SamuraiZERO
2. `lib/component-cache.js` - Añadir TTL específico para SamuraiZERO
3. `lib/svg-png-cache.js` - Añadir TTL específico para SamuraiZERO

### Archivos de Soporte (OPCIONAL)
1. `lib/renderers/adrianzero-renderer.js` - Clase renderer
2. `lib/traits-order.js` - Orden de capas (verificar compatibilidad)

### Archivos de Recursos (YA EXISTENTES)
1. `public/labimages/samuraizero/` - Imágenes SVG (600 archivos)
2. `public/labmetadata/samuraimetadata.json` - Metadata JSON (35,342 líneas)

### Archivos de Caché NO Modificados
1. `lib/contract-cache.js` - NO USAR (SamuraiZERO bypassa contratos)
2. `lib/json-cache.js` - NO MODIFICAR (ya funciona para metadata)

## NOTAS IMPORTANTES

### Transiciones
- **Token 500**: Primer SamuraiZERO (cambio de lógica)
- **Token 1100**: Vuelta a lógica normal AdrianZERO
- **Sin overlap**: Rango 500-1099 es exclusivo para SamuraiZERO

### Fallbacks
- **Imagen no encontrada**: Error 404 estándar
- **Metadata no encontrado**: Error 500 con mensaje descriptivo
- **Token inválido**: Validación existente se mantiene

### Logging
- **SamuraiZERO**: Logs específicos para identificar uso de lógica simplificada
- **Performance**: Medir tiempo de carga vs lógica normal
- **Errores**: Tracking específico para problemas de SamuraiZERO

---

**Fecha de creación**: $(date)
**Versión**: 1.0
**Autor**: AdrianLAB Development Team
**Estado**: Pendiente de implementación
