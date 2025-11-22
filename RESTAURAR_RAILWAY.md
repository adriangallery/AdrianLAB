# 🔧 Guía para Restaurar el Servicio de Railway

## 📋 Situación Actual

El servicio de Railway fue eliminado por error. La URL anterior era:
- `https://adrianlab-production.up.railway.app`

## 🚀 Pasos para Restaurar

### 1. Crear Nuevo Servicio en Railway

**✅ Puedes añadirlo a tu proyecto existente** - En Railway, un proyecto puede tener múltiples servicios.

**Opción A: Añadir a un Proyecto Existente (Recomendado si ya tienes uno)**
1. Ve a [Railway Dashboard](https://railway.app)
2. Abre tu proyecto existente (el que ya usas para otra cosa)
3. Haz clic en **"New"** → **"GitHub Repo"**
4. Selecciona tu repositorio `AdrianLAB`
5. **IMPORTANTE**: En la configuración del servicio, establece:
   - **Root Directory**: `external-render/`
   - Railway detectará automáticamente Node.js
6. Dale un nombre al servicio (ej: `external-render` o `adrianlab-render`)

**Opción B: Crear un Proyecto Nuevo**
1. Ve a [Railway Dashboard](https://railway.app)
2. Haz clic en **"New Project"**
3. Selecciona **"Deploy from GitHub repo"**
4. Conecta tu repositorio `AdrianLAB`
5. **IMPORTANTE**: En la configuración del servicio, establece:
   - **Root Directory**: `external-render/`
   - Railway detectará automáticamente Node.js

### 2. Configurar Variables de Entorno en Railway

En la pestaña **Variables** del servicio en Railway, añade:

```
NODE_ENV=production
BASE_URL=https://adrianlab.vercel.app
```

**Nota**: `PORT` se asigna automáticamente por Railway, no necesitas configurarlo.

### 3. Obtener la Nueva URL

Una vez desplegado, Railway te dará una nueva URL pública. Será algo como:
- `https://tu-servicio-nuevo.up.railway.app`

### 4. Verificar que el Servicio Funciona

Prueba el health check:
```
GET https://tu-servicio-nuevo.up.railway.app/health
```

Debería responder:
```json
{
  "status": "ok",
  "service": "external-render"
}
```

### 5. Actualizar Variable de Entorno en Vercel

1. Ve a tu proyecto en [Vercel Dashboard](https://vercel.com)
2. Ve a **Settings** → **Environment Variables**
3. Busca o crea la variable:
   - **Name**: `EXTERNAL_RENDER_URL`
   - **Value**: `https://tu-servicio-nuevo.up.railway.app` (la nueva URL de Railway, SIN `/api/render/custom`)
4. Guarda los cambios
5. **Redeploy** la aplicación en Vercel para que tome la nueva variable

### 6. Verificar que Todo Funciona

Una vez actualizado, puedes verificar el estado usando:
```
https://adrianlab.vercel.app/api/test-railway-health
```

Debería responder con `status: "healthy"` si todo está correcto.

## 📝 Notas Importantes

- El servicio externo de Railway expone:
  - `GET /health` - Health check
  - `POST /render` - Renderizado de imágenes
  
- El endpoint `/api/render/custom-external/[tokenId]` en Vercel intentará usar Railway primero, y si falla, hará fallback al renderizado local.

- La URL de Railway debe ser la URL base del servicio, NO incluir rutas como `/api/render/custom`.

## 🔍 Troubleshooting

Si el servicio no funciona:

1. Verifica los logs en Railway Dashboard
2. Verifica que las variables de entorno estén correctas
3. Verifica que el root directory sea `external-render/`
4. Verifica que la variable `EXTERNAL_RENDER_URL` en Vercel esté actualizada
5. Haz un redeploy en Vercel después de cambiar las variables de entorno

