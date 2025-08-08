# 🧬 LÓGICA COMPLETA DE SKINS Y SERUMS - ADRIANLAB

## 📊 RESUMEN EJECUTIVO

Este documento describe la lógica completa implementada para el manejo de skins y serums en el sistema AdrianLAB, incluyendo todas las combinaciones posibles y sus respectivos archivos SVG.

## 🎯 SERUMS IMPLEMENTADOS

### 1. **ADRIANGF Serum** (Token ID: 262144)
- **Descripción:** Serum que transforma un AdrianZERO en AdrianGF
- **Lógica:** Cambia el token base a 146 y usa skins específicos de AdrianGF

### 2. **GOLDENADRIAN Serum** (Token ID: 262145-262147)
- **Descripción:** Serum que puede aplicarse a AdrianZERO o AdrianGF
- **Lógica:** Usa skins específicos según el contexto (AdrianZERO o AdrianGF)

## 🏗️ ESTRUCTURA DE ARCHIVOS

### 📁 `public/traits/ADRIAN/`
```
ADRIAN/
├── GEN0-Golden.svg          # GoldenAdrian success en AdrianZERO
├── GEN0-Goldenfail.svg      # GoldenAdrian fail en AdrianZERO
├── GEN0-Medium.svg          # Skin base AdrianZERO
├── GEN0-Light.svg           # Skin base AdrianZERO
├── GEN0-Dark.svg            # Skin base AdrianZERO
├── GEN0-Alien.svg           # Skin base AdrianZERO
├── GEN0-Albino.svg          # Skin base AdrianZERO
└── ADRIANGF.svg             # Serum AdrianGF
```

### 📁 `public/traits/ADRIANGF/`
```
ADRIANGF/
├── GF0/
│   ├── GF0_Golden.svg       # GoldenAdrian success en AdrianGF
│   ├── GF0_Alien.svg        # Alien skin en AdrianGF
│   ├── GF0-Medium.svg       # Medium skin en AdrianGF
│   ├── GF0-Light.svg        # Light skin en AdrianGF
│   ├── GF0_Dark.svg         # Dark skin en AdrianGF
│   └── GEN0_Albino.svg      # Albino skin en AdrianGF
├── GF1/
│   ├── GF1_Golden.svg       # GoldenAdrian success en AdrianGF GEN1
│   ├── GF1_Alien.svg        # Alien skin en AdrianGF GEN1
│   ├── GF1-Medium.svg       # Medium skin en AdrianGF GEN1
│   ├── GF1-Light.svg        # Light skin en AdrianGF GEN1
│   ├── GF1_Dark.svg         # Dark skin en AdrianGF GEN1
│   └── GEN1_Albino.svg      # Albino skin en AdrianGF GEN1
├── GF2/
│   ├── GF2_Golden.svg       # GoldenAdrian success en AdrianGF GEN2
│   ├── GF2_Alien.svg        # Alien skin en AdrianGF GEN2
│   ├── GF2-Medium.svg       # Medium skin en AdrianGF GEN2
│   ├── GF2-Light.svg        # Light skin en AdrianGF GEN2
│   ├── GF2_Dark.svg         # Dark skin en AdrianGF GEN2
│   └── GEN2_Albino.svg      # Albino skin en AdrianGF GEN2
├── GF-Fail.svg              # AdrianGF fail
└── GF-Goldfail.svg          # GoldenAdrian fail en AdrianGF
```

## 🔄 FLUJO DE DETECCIÓN DE SERUMS

### 1. **Detección de Historial de Serums**
```javascript
const serumHistory = await serumModule.getTokenSerumHistory(cleanTokenId);
if (serumHistory && serumHistory.length > 0) {
  const lastSerum = serumHistory[serumHistory.length - 1];
  const serumSuccess = lastSerum[1];
  const serumMutation = lastSerum[3];
  
  // Verificar si hay un AdrianGF previo
  for (const serum of serumHistory) {
    if (serum[1] === true && serum[3] === "AdrianGF") {
      hasAdrianGFSerum = true;
      break;
    }
  }
}
```

### 2. **Lógica de Éxito/Fallo**
```javascript
if (serumSuccess) {
  // Serum exitoso
  if (serumMutation) {
    appliedSerum = serumMutation;
  }
} else {
  // Serum fallido
  serumFailed = true;
}
```

## 🎨 COMBINACIONES DE SKINS Y SERUMS

### **ADRIANZERO BASE (Sin Serum)**

| Skin Type | Archivo | Descripción |
|-----------|---------|-------------|
| Medium | `ADRIAN/GEN0-Medium.svg` | Skin base por defecto |
| Light | `ADRIAN/GEN0-Light.svg` | Skin claro |
| Dark | `ADRIAN/GEN0-Dark.svg` | Skin oscuro |
| Alien | `ADRIAN/GEN0-Alien.svg` | Skin alien |
| Albino | `ADRIAN/GEN0-Albino.svg` | Skin albino |

### **ADRIANZERO + ADRIANGF SERUM**

#### **✅ ADRIANGF Success**
| Skin Type | Archivo | Descripción |
|-----------|---------|-------------|
| Medium | `ADRIANGF/GF0/GF0-Medium.svg` | AdrianGF Medium |
| Light | `ADRIANGF/GF0/GF0-Light.svg` | AdrianGF Light |
| Dark | `ADRIANGF/GF0/GF0_Dark.svg` | AdrianGF Dark |
| Alien | `ADRIANGF/GF0/GF0_Alien.svg` | AdrianGF Alien |
| Albino | `ADRIANGF/GF0/GEN0_Albino.svg` | AdrianGF Albino |

#### **❌ ADRIANGF Fail**
| Archivo | Descripción |
|---------|-------------|
| `ADRIANGF/GF-Fail.svg` | AdrianGF fallido |

### **ADRIANZERO + GOLDENADRIAN SERUM**

#### **✅ GOLDENADRIAN Success**
| Skin Type | Archivo | Descripción |
|-----------|---------|-------------|
| Golden | `ADRIAN/GEN0-Golden.svg` | GoldenAdrian success en AdrianZERO |

#### **❌ GOLDENADRIAN Fail**
| Archivo | Descripción |
|---------|-------------|
| `ADRIAN/GEN0-Goldenfail.svg` | GoldenAdrian fallido en AdrianZERO |

### **ADRIANGF + GOLDENADRIAN SERUM**

#### **✅ GOLDENADRIAN Success (en AdrianGF)**
| Skin Type | Archivo | Descripción |
|-----------|---------|-------------|
| Golden | `ADRIANGF/GF0/GF0_Golden.svg` | GoldenAdrian success en AdrianGF |

#### **❌ GOLDENADRIAN Fail (en AdrianGF)**
| Archivo | Descripción |
|---------|-------------|
| `ADRIANGF/GF-Goldfail.svg` | GoldenAdrian fallido en AdrianGF |

## 🔧 LÓGICA DE IMPLEMENTACIÓN

### **1. Función `loadAdrianSvg`**

```javascript
const loadAdrianSvg = async (serumName, generation, skinType) => {
  if (serumName === "AdrianGF") {
    // Lógica para AdrianGF
    let skinFileName;
    if (skinType === "Albino") {
      skinFileName = `GEN${generation}_Albino.svg`;
    } else if (skinType === "Alien") {
      skinFileName = `GF${generation}_Alien.svg`;
    } else if (skinType === "Golden") {
      skinFileName = `GF${generation}_Golden.svg`;
    } else {
      skinFileName = `GF${generation}-${skinType}.svg`;
    }
    const path = `ADRIANGF/GF${generation}/${skinFileName}`;
  } else if (serumName === "GoldenAdrian") {
    // Lógica para GoldenAdrian
    let skinFileName;
    if (skinType === "Golden") {
      skinFileName = `GEN${generation}-Golden.svg`;
    } else {
      skinFileName = `GEN${generation}-${skinType}.svg`;
    }
    const path = `ADRIAN/${skinFileName}`;
  }
};
```

### **2. Lógica de Éxito/Fallo**

```javascript
// Lógica de éxito
if (appliedSerum === "AdrianGF") {
  const serumSkinImage = await loadAdrianSvg(appliedSerum, gen, skinType);
  if (serumSkinImage) {
    ctx.drawImage(serumSkinImage, 0, 0, 1000, 1000);
  }
} else if (appliedSerum === "GoldenAdrian") {
  const serumSkinImage = await loadAdrianSvg(appliedSerum, gen, skinType);
  if (serumSkinImage) {
    ctx.drawImage(serumSkinImage, 0, 0, 1000, 1000);
  }
}

// Lógica de fallo
else if (serumFailed) {
  let failPath;
  if (appliedSerum === "AdrianGF") {
    failPath = `ADRIANGF/GF-Fail.svg`;
  } else if (appliedSerum === "GoldenAdrian") {
    if (hasAdrianGFSerum) {
      failPath = `ADRIANGF/GF-Goldfail.svg`;
    } else {
      failPath = `ADRIAN/GEN${gen}-Goldenfail.svg`;
    }
  }
}
```

## 🎯 CASOS DE USO ESPECÍFICOS

### **Caso 1: AdrianZERO #222 + GoldenAdrian Success**
```
Token: 222
Serum History: [{ serumId: "262145", success: true, mutation: "GoldenAdrian" }]
Resultado: Usa ADRIAN/GEN0-Golden.svg
```

### **Caso 2: AdrianZERO #222 + GoldenAdrian Fail**
```
Token: 222
Serum History: [{ serumId: "262145", success: false, mutation: "GoldenAdrian" }]
Resultado: Usa ADRIAN/GEN0-Goldenfail.svg
```

### **Caso 3: AdrianGF #146 + GoldenAdrian Success**
```
Token: 146 (AdrianGF)
Serum History: [
  { serumId: "262144", success: true, mutation: "AdrianGF" },
  { serumId: "262145", success: true, mutation: "GoldenAdrian" }
]
Resultado: Usa ADRIANGF/GF0/GF0_Golden.svg
```

### **Caso 4: AdrianGF #146 + GoldenAdrian Fail**
```
Token: 146 (AdrianGF)
Serum History: [
  { serumId: "262144", success: true, mutation: "AdrianGF" },
  { serumId: "262145", success: false, mutation: "GoldenAdrian" }
]
Resultado: Usa ADRIANGF/GF-Goldfail.svg
```

## 🔄 SISTEMA DE CACHÉ

### **Caché SVG→PNG**
- Todos los skins se convierten de SVG a PNG y se cachean
- Evita reconversiones innecesarias
- TTL configurable por tipo de skin

### **Caché de Componentes**
- Backgrounds y traits se cachean individualmente
- Mejora el rendimiento en renders repetidos

## 🚀 OPTIMIZACIONES IMPLEMENTADAS

1. **Detección Inteligente de AdrianGF Previo**
   - Revisa todo el historial de serums
   - Determina el contexto correcto para GoldenAdrian

2. **Lógica de Fallo Dinámica**
   - Usa el archivo de fallo correcto según el contexto
   - Maneja múltiples serums en el historial

3. **Compatibilidad con Caché**
   - Integración completa con sistema de caché existente
   - No afecta el rendimiento actual

## 📝 NOTAS IMPORTANTES

1. **Orden de Precedencia:**
   - Serum más reciente tiene prioridad
   - AdrianGF previo afecta la lógica de GoldenAdrian

2. **Compatibilidad:**
   - Todos los cambios son retrocompatibles
   - No afecta tokens existentes

3. **Escalabilidad:**
   - Estructura preparada para nuevos serums
   - Lógica modular y extensible

## 🔍 DEBUGGING

### **Logs Clave**
```javascript
console.log(`[render] 🧬 LÓGICA ESPECIAL: Cargando skin ${serumName} para GEN${generation}, skin ${skinType}`);
console.log(`[render] AdrianGF previo detectado en historial`);
console.log(`[render] PASO 2 - 🧬 Skin ${serumName} exitoso (GEN${gen}, ${skinType}) renderizado correctamente`);
```

### **Verificación de Archivos**
- Todos los archivos SVG deben existir en las rutas especificadas
- Verificar permisos de lectura en producción
- Validar estructura de carpetas

---

**Última actualización:** $(date)
**Versión:** 2.0.0
**Autor:** AdrianLAB Team 