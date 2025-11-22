# Servicio Externo de Renderizado

Servicio independiente para renderizar imágenes AdrianZERO, externalizando el proceso CPU-intensivo fuera de Vercel.

## Descripción

Este servicio recibe los datos necesarios para renderizar una imagen AdrianZERO y devuelve el PNG renderizado. Esto reduce significativamente el consumo de CPU en Vercel.

## Instalación

```bash
cd external-render
npm install
```

## Desarrollo Local

```bash
npm run dev
```

El servicio estará disponible en `http://localhost:3000`

## Deployment

### Opción 1: Render.com (Recomendado - Free Tier)

1. Conectar el repositorio de GitHub a Render.com
2. Crear un nuevo **Web Service**
3. Configurar:
   - **Root Directory**: `external-render`
   - **Build Command**: `npm install` (o dejar vacío)
   - **Start Command**: `npm start` (o dejar vacío)
   - **Plan**: Free (750 horas/mes)
4. Configurar variables de entorno:
   - `NODE_ENV=production`
   - `BASE_URL=https://adrianlab.vercel.app`
5. Render asignará automáticamente el puerto y la URL pública

**Nota**: Ver guía completa en `DEPLOY_RENDER.md` en la raíz del proyecto.

### Opción 2: Railway

1. Conectar el repositorio de GitHub a Railway
2. Seleccionar el directorio `external-render/` como raíz del proyecto
3. Railway detectará automáticamente Node.js
4. Configurar variables de entorno:
   - `NODE_ENV=production`
   - `BASE_URL=https://adrianlab.vercel.app`
5. Railway asignará automáticamente el puerto y la URL pública

## Endpoints

### GET /health
Health check del servicio.

**Respuesta:**
```json
{
  "status": "ok",
  "service": "external-render"
}
```

### POST /render
Renderiza una imagen AdrianZERO.

**Body (JSON):**
```json
{
  "tokenId": "148",
  "generation": "0",
  "skinType": "Medium",
  "finalTraits": {...},
  "appliedSerum": null,
  "serumSuccess": false,
  "hasAdrianGFSerum": false,
  "serumHistory": null,
  "failedSerumType": null,
  "baseImagePath": "ADRIAN/GEN0-Medium.svg",
  "skintraitPath": null,
  "skinTraitPath": null,
  "isCloseup": false,
  "traitsMapping": {...}
}
```

**Respuesta:**
- Content-Type: `image/png`
- Headers:
  - `X-Render-Time`: Tiempo de renderizado en ms
  - `X-Service`: `external-render`

## Variables de Entorno

- `PORT`: Puerto del servicio (Render/Railway lo asignan automáticamente)
- `BASE_URL`: URL base de AdrianLAB (default: `https://adrianlab.vercel.app`)
- `NODE_ENV`: Entorno (production/development)

## Uso desde Vercel

El endpoint `/api/render/custom-external/[tokenId]` intenta usar este servicio primero. Si falla, hace fallback al renderizado local.

Configurar en Vercel:
- `EXTERNAL_RENDER_URL`: URL del servicio externo (Render o Railway)
- `EXTERNAL_RENDER_ENABLED`: `true` (default)
- `EXTERNAL_RENDER_TIMEOUT`: `30000` (30 segundos)

**Ejemplo de URL**:
- Render: `https://adrianlab-external-render.onrender.com`
- Railway: `https://adrianlab-production.up.railway.app`

