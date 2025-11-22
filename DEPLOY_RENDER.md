# 🚀 Guía de Despliegue en Render.com

## 📋 Requisitos Previos

- ✅ Cuenta en Render.com conectada a GitHub
- ✅ Repositorio `AdrianLAB` en GitHub

## 🔧 Pasos para Desplegar

### 1. Crear Nuevo Servicio Web en Render

1. Ve a [Render Dashboard](https://dashboard.render.com)
2. Haz clic en **"New +"** → **"Web Service"**
3. Selecciona tu repositorio `AdrianLAB` de GitHub
4. Si no aparece, haz clic en **"Connect account"** y autoriza Render para acceder a tu GitHub

### 2. Configurar el Servicio

**Configuración básica:**
- **Name**: `adrianlab-external-render` (o el nombre que prefieras)
- **Region**: Elige la región más cercana a tus usuarios (ej: `Oregon (US West)`)
- **Branch**: `main` (o la rama que uses)
- **Root Directory**: `external-render` ⚠️ **IMPORTANTE**
- **Runtime**: `Node`
- **Build Command**: `npm install` (o déjalo vacío, Render lo detectará automáticamente)
- **Start Command**: `npm start` (o déjalo vacío, Render lo detectará automáticamente)

**Plan:**
- Selecciona **"Free"** (750 horas/mes, suficiente para desarrollo)

### 3. Configurar Variables de Entorno

En la sección **"Environment Variables"**, añade:

```
NODE_ENV=production
BASE_URL=https://adrianlab.vercel.app
```

**Nota**: `PORT` se asigna automáticamente por Render, no necesitas configurarlo.

### 4. Desplegar

1. Haz clic en **"Create Web Service"**
2. Render comenzará a construir y desplegar el servicio
3. Esto puede tardar 5-10 minutos la primera vez (instalación de dependencias)
4. Verás los logs en tiempo real

### 5. Obtener la URL del Servicio

Una vez desplegado, Render te dará una URL pública. Será algo como:
```
https://adrianlab-external-render.onrender.com
```

**⚠️ IMPORTANTE**: En el plan gratuito, el servicio se "duerme" después de 15 minutos de inactividad. El primer request después de dormirse puede tardar 30-60 segundos en despertar el servicio.

### 6. Verificar que el Servicio Funciona

Prueba el health check:
```
GET https://tu-servicio.onrender.com/health
```

Debería responder:
```json
{
  "status": "ok",
  "service": "external-render"
}
```

### 7. Actualizar Variable de Entorno en Vercel

1. Ve a tu proyecto en [Vercel Dashboard](https://vercel.com)
2. Ve a **Settings** → **Environment Variables**
3. Busca o crea la variable:
   - **Name**: `EXTERNAL_RENDER_URL`
   - **Value**: `https://tu-servicio.onrender.com` (la URL completa de Render, SIN rutas adicionales)
4. Guarda los cambios
5. **Redeploy** la aplicación en Vercel para que tome la nueva variable

### 8. Verificar que Todo Funciona

Una vez actualizado, puedes verificar el estado usando:
```
https://adrianlab.vercel.app/api/test-railway-health
```

Debería responder con `status: "healthy"` si todo está correcto.

## 📝 Notas Importantes

### Auto-Sleep en Plan Gratuito

- El servicio se duerme después de **15 minutos de inactividad**
- El primer request después de dormirse puede tardar **30-60 segundos** en responder
- Los requests subsecuentes son normales

**Soluciones para evitar el sleep:**
1. Usar un servicio de "ping" periódico (cada 10-14 minutos) para mantener el servicio activo
2. Actualizar a plan pago ($7/mes) para evitar el auto-sleep

### Límites del Plan Gratuito

- **750 horas/mes** de tiempo de ejecución
- **512MB RAM**
- **0.5 CPU compartido**
- Auto-sleep después de 15 minutos de inactividad

### Estructura del Servicio

El servicio expone dos endpoints:
- `GET /health` - Health check
- `POST /render` - Renderizado de imágenes (recibe JSON con datos del token)

## 🔍 Troubleshooting

### El servicio no inicia

1. Verifica los logs en Render Dashboard
2. Verifica que el **Root Directory** sea `external-render`
3. Verifica que `package.json` tenga el script `start`
4. Verifica que Node.js >= 18 esté disponible

### El servicio se duerme constantemente

- Es normal en el plan gratuito
- Considera usar un servicio de ping periódico
- O actualiza a plan pago

### Error al conectar desde Vercel

1. Verifica que `EXTERNAL_RENDER_URL` en Vercel sea la URL completa de Render
2. Verifica que no incluya rutas adicionales (solo la URL base)
3. Haz redeploy en Vercel después de cambiar la variable
4. Verifica los logs en Render para ver si llegan los requests

## 🎯 Próximos Pasos

Una vez desplegado y funcionando:

1. ✅ Verifica que el health check funciona
2. ✅ Actualiza `EXTERNAL_RENDER_URL` en Vercel
3. ✅ Haz redeploy en Vercel
4. ✅ Prueba el endpoint `/api/render/custom-external/[tokenId]` en Vercel
5. ✅ Verifica los logs en Render para confirmar que recibe requests

## 📚 Recursos

- [Render Documentation](https://render.com/docs)
- [Render Free Tier Limits](https://render.com/docs/free)
- [Render Environment Variables](https://render.com/docs/environment-variables)

