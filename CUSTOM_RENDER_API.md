# 🎨 Custom Render API - AdrianLAB

## Descripción

La Custom Render API permite generar previews de tokens AdrianZERO con traits modificados sin afectar el token original en blockchain. Es perfecta para que los usuarios vean cómo se verían sus tokens con diferentes combinaciones de traits antes de hacer cambios reales.

## 🚀 Endpoint

```
GET /api/render/custom/{tokenId}?{categoria}={traitId}
```

## 📋 Parámetros

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

## 🎯 Ejemplos de Uso

### Ejemplo 1: Cambiar solo los ojos
```
GET /api/render/custom/1?eyes=7
```
- Token 1 con ojos tipo 7
- Mantiene todos los otros traits originales

### Ejemplo 2: Cambiar múltiples traits
```
GET /api/render/custom/3?eyes=8&mouth=22&head=13
```
- Token 3 con ojos tipo 8, boca tipo 22, y cabeza tipo 13
- Mantiene todos los otros traits originales

### Ejemplo 3: Cambiar fondo y skin
```
GET /api/render/custom/5?background=2&skin=37
```
- Token 5 con fondo tipo 2 y skin tipo 37
- Mantiene todos los otros traits originales

## 🔧 Implementación en dApps

### JavaScript/React

```javascript
// Componente React para preview de traits
function TraitPreview({ tokenId, selectedTraits }) {
  const [previewUrl, setPreviewUrl] = useState('');
  
  useEffect(() => {
    // Construir URL con traits seleccionados
    const params = new URLSearchParams();
    Object.entries(selectedTraits).forEach(([category, traitId]) => {
      if (traitId) {
        params.append(category.toLowerCase(), traitId);
      }
    });
    
    const url = `/api/render/custom/${tokenId}?${params.toString()}`;
    setPreviewUrl(url);
  }, [tokenId, selectedTraits]);
  
  return (
    <div>
      <h3>Preview del Token #{tokenId}</h3>
      <img src={previewUrl} alt={`Token ${tokenId} preview`} />
    </div>
  );
}

// Uso del componente
<TraitPreview 
  tokenId={1} 
  selectedTraits={{
    eyes: 7,
    mouth: 22,
    head: 13
  }} 
/>
```

### Vanilla JavaScript

```javascript
// Función para generar preview URL
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

// Ejemplo de uso
const previewUrl = generatePreviewUrl(1, {
  eyes: 7,
  mouth: 22
});

console.log(previewUrl);
// Output: https://adrianlab.vercel.app/api/render/custom/1?eyes=7&mouth=22
```

### HTML Directo

```html
<!-- Preview estático -->
<img src="https://adrianlab.vercel.app/api/render/custom/1?eyes=7&mouth=22" 
     alt="Token 1 con ojos 7 y boca 22" />

<!-- Preview dinámico con JavaScript -->
<div id="preview-container">
  <img id="preview-image" src="" alt="Token preview" />
</div>

<script>
function updatePreview(tokenId, traits) {
  const params = new URLSearchParams();
  Object.entries(traits).forEach(([category, traitId]) => {
    if (traitId) {
      params.append(category.toLowerCase(), traitId);
    }
  });
  
  const url = `https://adrianlab.vercel.app/api/render/custom/${tokenId}?${params.toString()}`;
  document.getElementById('preview-image').src = url;
}

// Ejemplo de uso
updatePreview(1, { eyes: 7, mouth: 22 });
</script>
```

## 🎨 Interfaz de Usuario Sugerida

### Selector de Traits
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

## 🔒 Características de Seguridad

- ✅ **No modifica tokens reales** - Solo genera previews
- ✅ **Sin cache** - Cada request genera una imagen fresca
- ✅ **Validación de parámetros** - Solo acepta trait IDs válidos
- ✅ **Rate limiting** - Protección contra abuso
- ✅ **CORS habilitado** - Acceso desde dApps externas

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
| `skin` | Tipos de skin especiales | 37, 38 |

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