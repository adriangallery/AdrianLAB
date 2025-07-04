# 🎨 Custom Render API - AdrianLAB

## Descripción

La Custom Render API permite generar previews de tokens AdrianZERO con traits modificados sin afectar el token original en blockchain. Es perfecta para que los usuarios vean cómo se verían sus tokens con diferentes combinaciones de traits antes de hacer cambios reales.

## 🚀 Endpoint

```
GET /api/render/custom/{tokenId}?{categoria}={traitId}
GET /api/render/custom/{tokenId}?trait={traitId}
```

## 📋 Parámetros

### Formato 1: Por Categorías (Recomendado)
| Parámetro | Tipo | Descripción | Ejemplo |
|-----------|------|-------------|---------|
| `tokenId` | number | ID del token AdrianZERO a modificar | `1`, `2`, `3` |
| `eyes` | number | ID del trait de ojos | `7`, `8`, `9` |
| `mouth` | number | ID del trait de boca | `22`, `23`, `24` |
| `head` | number | ID del trait de cabeza | `13`, `14`, `15` |
| `background` | number | ID del trait de fondo | `1`, `2`, `3` |
| `body` | number | ID del trait de cuerpo | `10`, `11`, `12` |
| `clothing` | number | ID del trait de ropa | `40`, `41`, `42` |
| `accessories` | number | ID del trait de accesorios | `50`, `51`, `52` |
| `skin` | number | ID del trait de skin | `37`, `38` |

### Formato 2: Por IDs Directos (Nuevo)
| Parámetro | Tipo | Descripción | Ejemplo |
|-----------|------|-------------|---------|
| `tokenId` | number | ID del token AdrianZERO a modificar | `1`, `2`, `3` |
| `trait` | number | ID directo del trait (se mapea automáticamente a categoría) | `7`, `18`, `22` |

## 🎯 Ejemplos de Uso

### Formato 1: Por Categorías

#### Ejemplo 1: Cambiar solo los ojos
```
GET /api/render/custom/1?eyes=7
```
- Token 1 con ojos tipo 7
- Mantiene todos los otros traits originales

#### Ejemplo 2: Cambiar múltiples traits
```
GET /api/render/custom/3?eyes=8&mouth=22&head=13
```
- Token 3 con ojos tipo 8, boca tipo 22, y cabeza tipo 13
- Mantiene todos los otros traits originales

#### Ejemplo 3: Cambiar fondo y skin
```
GET /api/render/custom/5?background=2&skin=37
```
- Token 5 con fondo tipo 2 y skin tipo 37
- Mantiene todos los otros traits originales

### Formato 2: Por IDs Directos

#### Ejemplo 1: Cambiar un trait por ID
```
GET /api/render/custom/1?trait=18
```
- Token 1 con trait ID 18 (Crazy Hair - categoría HEAD)
- Mantiene todos los otros traits originales

#### Ejemplo 2: Cambiar múltiples traits por IDs
```
GET /api/render/custom/3?trait=8&trait=22&trait=13
```
- Token 3 con traits IDs 8 (3D Laser Eyes), 22 (Cigarett), y 13 (Black Fedora)
- Mantiene todos los otros traits originales

#### Ejemplo 3: Resolver conflictos automáticamente
```
GET /api/render/custom/1?trait=7&trait=8&trait=9&trait=22&trait=23
```
- **Traits 7, 8, 9** son todos de categoría EYES → Solo se usa el último (9 - Regular Shades)
- **Traits 22, 23** son ambos de categoría MOUTH → Solo se usa el último (23 - Drool)
- Resultado: Token con ojos tipo 9 y boca tipo 23

#### Ejemplo 4: Combinar ambos formatos
```
GET /api/render/custom/5?trait=18&eyes=7&background=2
```
- Token 5 con trait ID 18 (Crazy Hair), ojos tipo 7, y fondo tipo 2
- Mantiene todos los otros traits originales

## 🔧 Implementación en dApps

### JavaScript/React

```javascript
// Componente React para preview de traits
function TraitPreview({ tokenId, selectedTraits, useDirectIds = false }) {
  const [previewUrl, setPreviewUrl] = useState('');
  
  useEffect(() => {
    const params = new URLSearchParams();
    
    if (useDirectIds) {
      // Usar formato de IDs directos
      selectedTraits.forEach(traitId => {
        params.append('trait', traitId);
      });
    } else {
      // Usar formato de categorías
      Object.entries(selectedTraits).forEach(([category, traitId]) => {
        if (traitId) {
          params.append(category.toLowerCase(), traitId);
        }
      });
    }
    
    const url = `/api/render/custom/${tokenId}?${params.toString()}`;
    setPreviewUrl(url);
  }, [tokenId, selectedTraits, useDirectIds]);
  
  return (
    <div>
      <h3>Preview del Token #{tokenId}</h3>
      <img src={previewUrl} alt={`Token ${tokenId} preview`} />
    </div>
  );
}

// Uso del componente con categorías
<TraitPreview 
  tokenId={1} 
  selectedTraits={{
    eyes: 7,
    mouth: 22,
    head: 13
  }} 
/>

// Uso del componente con IDs directos
<TraitPreview 
  tokenId={1} 
  selectedTraits={[7, 22, 13]}
  useDirectIds={true}
/>
```

### Vanilla JavaScript

```javascript
// Función para generar preview URL con categorías
function generatePreviewUrl(tokenId, traits) {
  const baseUrl = 'https://adrianlab.vercel.app/api/render/custom';
  const params = new URLSearchParams();
  
  Object.entries(traits).forEach(([category, traitId]) => {
    if (traitId) {
      params.append(category.toLowerCase(), traitId);
    }
  });
  
  return `${baseUrl}/${tokenId}?${params.toString()}`;
}

// Función para generar preview URL con IDs directos
function generatePreviewUrlDirect(tokenId, traitIds) {
  const baseUrl = 'https://adrianlab.vercel.app/api/render/custom';
  const params = new URLSearchParams();
  
  traitIds.forEach(traitId => {
    params.append('trait', traitId);
  });
  
  return `${baseUrl}/${tokenId}?${params.toString()}`;
}

// Ejemplos de uso
const previewUrl1 = generatePreviewUrl(1, { eyes: 7, mouth: 22 });
console.log(previewUrl1);
// Output: https://adrianlab.vercel.app/api/render/custom/1?eyes=7&mouth=22

const previewUrl2 = generatePreviewUrlDirect(1, [7, 22]);
console.log(previewUrl2);
// Output: https://adrianlab.vercel.app/api/render/custom/1?trait=7&trait=22
```

### HTML Directo

```html
<!-- Preview con categorías -->
<img src="https://adrianlab.vercel.app/api/render/custom/1?eyes=7&mouth=22" 
     alt="Token 1 con ojos 7 y boca 22" />

<!-- Preview con IDs directos -->
<img src="https://adrianlab.vercel.app/api/render/custom/1?trait=7&trait=22" 
     alt="Token 1 con traits 7 y 22" />

<!-- Preview dinámico con JavaScript -->
<div id="preview-container">
  <img id="preview-image" src="" alt="Token preview" />
</div>

<script>
function updatePreview(tokenId, traits, useDirectIds = false) {
  const params = new URLSearchParams();
  
  if (useDirectIds) {
    traits.forEach(traitId => {
      params.append('trait', traitId);
    });
  } else {
    Object.entries(traits).forEach(([category, traitId]) => {
      if (traitId) {
        params.append(category.toLowerCase(), traitId);
      }
    });
  }
  
  const url = `https://adrianlab.vercel.app/api/render/custom/${tokenId}?${params.toString()}`;
  document.getElementById('preview-image').src = url;
}

// Ejemplos de uso
updatePreview(1, { eyes: 7, mouth: 22 }); // Con categorías
updatePreview(1, [7, 22], true); // Con IDs directos
</script>
```

## 🎨 Interfaz de Usuario Sugerida

### Selector de Traits por Categorías
```javascript
const traitCategories = {
  eyes: [
    { id: 6, name: '3D Glasses Big' },
    { id: 7, name: '3D Glasses' },
    { id: 8, name: '3D Laser Eyes' },
    { id: 9, name: 'Regular Shades' }
  ],
  mouth: [
    { id: 22, name: 'Cigarett' },
    { id: 23, name: 'Drool' },
    { id: 24, name: 'Joint' },
    { id: 25, name: 'Pipe' },
    { id: 26, name: 'Sad' },
    { id: 27, name: 'Smirk' },
    { id: 28, name: 'Vape' }
  ],
  head: [
    { id: 13, name: 'Black Fedora' },
    { id: 14, name: 'Buzz' },
    { id: 15, name: 'Cap Backward' },
    { id: 16, name: 'Cap Forward' },
    { id: 17, name: 'Crazy Hair 3D' },
    { id: 18, name: 'Crazy Hair' },
    { id: 19, name: 'Short' },
    { id: 20, name: 'Tiara Tonsure' },
    { id: 21, name: 'Wild' }
  ]
};
```

### Selector de Traits por IDs Directos
```javascript
// Lista completa de traits con sus IDs
const allTraits = [
  { id: 1, name: 'Dark Mode', category: 'Background' },
  { id: 2, name: 'Light Mode', category: 'Background' },
  { id: 3, name: 'White', category: 'Background' },
  { id: 4, name: 'Diamond Earring', category: 'Ear' },
  { id: 5, name: 'Gold Earring', category: 'Ear' },
  { id: 6, name: '3D Glasses Big', category: 'Eyes' },
  { id: 7, name: '3D Glasses', category: 'Eyes' },
  { id: 8, name: '3D Laser Eyes', category: 'Eyes' },
  { id: 9, name: 'Regular Shades', category: 'Eyes' },
  { id: 13, name: 'Black Fedora', category: 'Head' },
  { id: 14, name: 'Buzz', category: 'Head' },
  { id: 15, name: 'Cap Backward', category: 'Head' },
  { id: 16, name: 'Cap Forward', category: 'Head' },
  { id: 17, name: 'Crazy Hair 3D', category: 'Head' },
  { id: 18, name: 'Crazy Hair', category: 'Head' },
  { id: 19, name: 'Short', category: 'Head' },
  { id: 20, name: 'Tiara Tonsure', category: 'Head' },
  { id: 21, name: 'Wild', category: 'Head' },
  { id: 22, name: 'Cigarett', category: 'Mouth' },
  { id: 23, name: 'Drool', category: 'Mouth' },
  { id: 24, name: 'Joint', category: 'Mouth' },
  { id: 25, name: 'Pipe', category: 'Mouth' },
  { id: 26, name: 'Sad', category: 'Mouth' },
  { id: 27, name: 'Smirk', category: 'Mouth' },
  { id: 28, name: 'Vape', category: 'Mouth' }
  // ... más traits
];
```

## 🔒 Características de Seguridad

- ✅ **No modifica tokens reales** - Solo genera previews
- ✅ **Sin cache** - Cada request genera una imagen fresca
- ✅ **Validación de parámetros** - Solo acepta trait IDs válidos
- ✅ **Rate limiting** - Protección contra abuso
- ✅ **CORS habilitado** - Acceso desde dApps externas
- ✅ **Mapeo automático** - Los IDs se mapean automáticamente a categorías
- ✅ **Resolución de conflictos** - Detecta y resuelve automáticamente traits de la misma categoría

## ⚠️ Resolución de Conflictos de Categoría

Cuando se especifican múltiples traits de la misma categoría, el sistema automáticamente:

1. **Detecta el conflicto** - Identifica traits que pertenecen a la misma categoría
2. **Selecciona el último** - Usa solo el trait especificado más recientemente
3. **Registra la decisión** - Muestra logs detallados de qué traits fueron seleccionados/descartados

### Ejemplo de Conflicto:
```
GET /api/render/custom/1?trait=7&trait=8&trait=9
```

**Logs del sistema:**
```
[custom-render] Trait ID 7 (3D Glasses) mapeado a categoría EYES
[custom-render] Trait ID 8 (3D Laser Eyes) mapeado a categoría EYES  
[custom-render] Trait ID 9 (Regular Shades) mapeado a categoría EYES
[custom-render] ⚠️  Conflicto detectado en categoría EYES:
[custom-render]   ❌ DESCARTADO - Trait 7 (3D Glasses)
[custom-render]   ❌ DESCARTADO - Trait 8 (3D Laser Eyes)
[custom-render]   ✅ SELECCIONADO - Trait 9 (Regular Shades)
[custom-render] Final: Categoría EYES = Trait 9 (Regular Shades)
```

**Resultado:** Solo se renderiza el trait 9 (Regular Shades) para la categoría EYES.

## 📊 Categorías de Traits Disponibles

| Categoría | Descripción | Ejemplos de IDs |
|-----------|-------------|-----------------|
| `background` | Fondos del token | 1, 2, 3 |
| `eyes` | Tipos de ojos/gafas | 6, 7, 8, 9 |
| `mouth` | Expresiones de boca | 22, 23, 24, 25, 26, 27, 28 |
| `head` | Sombreros y peinados | 13, 14, 15, 16, 17, 18, 19, 20, 21 |
| `body` | Tipos de cuerpo | 10, 11, 12 |
| `clothing` | Ropa y vestimenta | 40, 41, 42 |
| `accessories` | Accesorios | 50, 51, 52 |

## 🎯 Ventajas de Cada Formato

### Formato por Categorías
- ✅ **Más intuitivo** - Sabes exactamente qué categoría estás modificando
- ✅ **Mejor para UIs** - Fácil de organizar por secciones
- ✅ **Validación clara** - Evitas mezclar categorías

### Formato por IDs Directos
- ✅ **Más simple** - Solo necesitas el ID del trait
- ✅ **Menos parámetros** - Una sola URL para múltiples traits
- ✅ **Flexible** - Puedes mezclar traits de diferentes categorías fácilmente
- ✅ **Ideal para listas** - Perfecto cuando tienes una lista de traits favoritos

## 🔗 URLs de Ejemplo

### Formato por Categorías
```
https://adrianlab.vercel.app/api/render/custom/1?eyes=7&mouth=22&head=18
https://adrianlab.vercel.app/api/render/custom/5?background=2&skin=37
https://adrianlab.vercel.app/api/render/custom/10?eyes=8&head=13
```

### Formato por IDs Directos
```
https://adrianlab.vercel.app/api/render/custom/1?trait=7&trait=22&trait=18
https://adrianlab.vercel.app/api/render/custom/5?trait=2&trait=37
https://adrianlab.vercel.app/api/render/custom/10?trait=8&trait=13
```

### Combinación de Ambos Formatos
```
https://adrianlab.vercel.app/api/render/custom/1?trait=18&eyes=7&mouth=22
https://adrianlab.vercel.app/api/render/custom/5?trait=37&background=2&skin=38
```

## 🚀 Casos de Uso

1. **Marketplace de Traits** - Preview antes de comprar
2. **Editor de Tokens** - Visualizar cambios antes de aplicar
3. **Galería de Combinaciones** - Mostrar diferentes looks
4. **Sistema de Recomendaciones** - Sugerir traits compatibles
5. **Social Features** - Compartir looks personalizados

## 📞 Soporte

Para soporte técnico o preguntas sobre la API:
- **GitHub**: [AdrianLAB Repository](https://github.com/adriangallery/AdrianLAB)
- **Documentación**: [API Docs](https://adrianlab.vercel.app)

---

*Desarrollado por AdrianLAB Team* 🧪 