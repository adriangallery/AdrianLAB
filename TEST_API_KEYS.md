# 🧪 Guía de Testing - API Keys de Alchemy

## 📋 Variables de Entorno Configuradas

Las siguientes variables deben estar configuradas en Vercel y Railway:

- `ALCHEMY_API_KEY_PRIMARY` - Nueva key (primera opción)
- `ALCHEMY_API_KEY` - Key actual principal (segunda opción)
- `ALCHEMY_API_KEY_FALLBACK` - Key actual fallback (tercera opción)
- `INFURA_PROJECT_ID` - Infura (cuarta opción)

## 🔄 Orden de Fallback

1. **ALCHEMY_API_KEY_PRIMARY** (nueva key)
2. **ALCHEMY_API_KEY** (actual principal)
3. **ALCHEMY_API_KEY_FALLBACK** (actual fallback)
4. **INFURA_PROJECT_ID** (Infura)
5. **Base RPC público** (último recurso)

## ✅ Testing en Vercel

### 1. Verificar que las variables están configuradas

1. Ve a [Vercel Dashboard](https://vercel.com)
2. Selecciona tu proyecto `AdrianLAB`
3. Ve a **Settings** → **Environment Variables**
4. Verifica que existan las 4 variables mencionadas arriba

### 2. Probar endpoint de debug (recomendado)

El endpoint `/api/debug/render-custom` muestra información detallada del provider usado:

```
GET https://adrianlab.vercel.app/api/debug/render-custom?tokenId=393
```

**Qué buscar en los logs:**
- Debe aparecer: `[contracts] Intentando conectar con Alchemy (PRIMARY - nueva key)...`
- Si funciona: `[contracts] ✅ Conexión exitosa con Alchemy (PRIMARY)`
- Si falla y usa fallback: `[contracts] ⚠️ Alchemy PRIMARY failed, trying Alchemy principal...`

### 3. Probar endpoint de render normal

```
GET https://adrianlab.vercel.app/api/render/393
```

**Qué verificar:**
- La imagen se renderiza correctamente
- Revisa los logs en Vercel Dashboard → **Deployments** → **Functions** → Ver logs

### 4. Verificar logs en Vercel

1. Ve a **Deployments** → Selecciona el último deployment
2. Haz clic en **Functions** → Selecciona cualquier función
3. Busca en los logs mensajes que empiecen con `[contracts]`
4. Deberías ver qué provider se está usando

### 5. Test de fallback (opcional)

Para probar que el fallback funciona, puedes temporalmente:
1. Cambiar `ALCHEMY_API_KEY_PRIMARY` a un valor inválido en Vercel
2. Hacer una request
3. Verificar que usa el siguiente fallback
4. Restaurar el valor correcto

## ✅ Testing en Railway

### 1. Verificar que las variables están configuradas

1. Ve a [Railway Dashboard](https://railway.app)
2. Selecciona tu proyecto
3. Selecciona el servicio `external-render` (si aplica)
4. Ve a **Variables**
5. Verifica que existan las variables (aunque Railway no las use directamente, es bueno tenerlas por si se necesitan en el futuro)

**Nota:** El servicio de Railway (`external-render`) actualmente NO usa estas keys directamente, ya que solo renderiza imágenes. Sin embargo, si en el futuro se añade funcionalidad blockchain, las keys estarán disponibles.

### 2. Verificar que el servicio funciona

```
GET https://adrianlab-production.up.railway.app/health
```

Debería responder:
```json
{
  "status": "ok",
  "service": "external-render"
}
```

## 🔍 Cómo Verificar qué Provider se Está Usando

### Opción 1: Endpoint de Debug (Más fácil)

```
GET https://adrianlab.vercel.app/api/debug/render-custom?tokenId=393
```

En la página HTML que se muestra, busca en la consola de logs:
- Si ves `✅ Conexión exitosa con Alchemy (PRIMARY)` → Está usando la nueva key
- Si ves `✅ Conexión exitosa con Alchemy (principal)` → Está usando la key actual principal
- Si ves `✅ Conexión exitosa con Alchemy (fallback)` → Está usando la key fallback
- Si ves `✅ Conexión exitosa con Infura` → Está usando Infura
- Si ves `🔄 Usando Base RPC público` → Está usando el RPC público

### Opción 2: Logs de Vercel

1. Ve a Vercel Dashboard → **Deployments**
2. Selecciona el último deployment
3. Haz clic en **Functions**
4. Selecciona cualquier función que use `getContracts()` (ej: `/api/render/[tokenId]`)
5. Busca en los logs líneas que contengan `[contracts]`
6. Verás qué provider se está usando

### Opción 3: Test Simple

```
GET https://adrianlab.vercel.app/api/test-simple/1
```

Este endpoint también usa `getContracts()` y mostrará logs en la consola.

## 🐛 Troubleshooting

### Problema: No se conecta con PRIMARY

**Síntomas:**
- Logs muestran: `⚠️ Alchemy PRIMARY failed, trying Alchemy principal...`

**Soluciones:**
1. Verifica que `ALCHEMY_API_KEY_PRIMARY` esté configurada en Vercel
2. Verifica que el valor sea correcto (sin espacios, sin comillas)
3. Verifica que la key tenga permisos para Base Mainnet
4. Verifica que la key no esté bloqueada por rate limits

### Problema: Usa siempre el último fallback

**Síntomas:**
- Siempre ve `🔄 Usando Base RPC público`

**Soluciones:**
1. Verifica que todas las variables estén configuradas
2. Verifica que los valores sean correctos
3. Revisa los logs para ver qué error específico está ocurriendo

### Problema: Variables no se cargan

**Síntomas:**
- El código no encuentra las variables de entorno

**Soluciones:**
1. En Vercel, asegúrate de que las variables estén en el ambiente correcto (Production, Preview, Development)
2. Después de añadir variables, haz un nuevo deployment
3. Verifica que los nombres de las variables sean exactos (case-sensitive)

## 📝 Checklist de Testing

- [ ] Variables configuradas en Vercel
- [ ] Variables configuradas en Railway (opcional, para futuro)
- [ ] Endpoint de debug muestra que usa PRIMARY
- [ ] Endpoint de render funciona correctamente
- [ ] Logs muestran el provider correcto
- [ ] Fallback funciona si PRIMARY falla (test opcional)

## 🎯 Resultado Esperado

Después de la implementación, deberías ver en los logs:

```
[contracts] Intentando conectar con Alchemy (PRIMARY - nueva key)...
[contracts] ✅ Conexión exitosa con Alchemy (PRIMARY)
```

Esto confirma que está usando la nueva API key como primera opción.

