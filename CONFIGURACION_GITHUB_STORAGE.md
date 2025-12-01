# 🔧 Configuración de GitHub Storage para Toggles

Esta guía te ayudará a configurar las variables de entorno necesarias en Vercel para el sistema de almacenamiento en GitHub.

## 📋 Variables de Entorno Necesarias

### 1. **GITHUB_TOKEN** (OBLIGATORIO)
Token de GitHub con permisos de escritura al repositorio.

#### Cómo crear el token:
1. Ve a GitHub → **Settings** → **Developer settings** → **Personal access tokens** → **Tokens (classic)**
   - O directamente: https://github.com/settings/tokens
2. Haz clic en **"Generate new token"** → **"Generate new token (classic)"**
3. Configura el token:
   - **Note**: `AdrianLAB Vercel Storage` (o el nombre que prefieras)
   - **Expiration**: Elige la duración (recomendado: 90 días o "No expiration" si es seguro)
   - **Scopes**: Marca estos permisos:
     - ✅ `repo` (Full control of private repositories)
       - Esto incluye: `repo:status`, `repo_deployment`, `public_repo`, `repo:invite`, `security_events`
4. Haz clic en **"Generate token"**
5. **⚠️ IMPORTANTE**: Copia el token inmediatamente (solo se muestra una vez)
   - Si lo pierdes, tendrás que crear uno nuevo

#### Valor del token:
```
ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```
(Será una cadena que empieza con `ghp_`)

---

### 2. **GITHUB_OWNER** (OPCIONAL - tiene valor por defecto)
Propietario del repositorio de GitHub.

**Valor actual detectado**: `adriangallery`

**Valor por defecto si no se configura**: `adriangallery`

**Puedes omitir esta variable** si el owner es `adriangallery`.

---

### 3. **GITHUB_REPO** (OPCIONAL - tiene valor por defecto)
Nombre del repositorio de GitHub.

**Valor actual detectado**: `AdrianLAB`

**Valor por defecto si no se configura**: `AdrianLAB`

**Puedes omitir esta variable** si el repo es `AdrianLAB`.

---

### 4. **GITHUB_BRANCH** (OPCIONAL - tiene valor por defecto)
Rama de GitHub donde se almacenarán los archivos.

**Valor actual detectado**: `main`

**Valor por defecto si no se configura**: `main`

**Puedes omitir esta variable** si usas la rama `main`.

---

### 5. **GITHUB_STORAGE_PATH** (OPCIONAL - tiene valor por defecto)
Ruta dentro del repositorio donde se almacenarán los archivos renderizados.

**Valor por defecto**: `public/rendered-toggles`

**Estructura de archivos que se creará**:
```
public/
  rendered-toggles/
    123.png              (render normal)
    123_closeup.png     (render closeup)
    123_shadow.png      (render shadow)
    123_glow.png        (render glow)
    123_bn.png          (render blanco y negro)
    123_uv.png          (render UV)
    123_blackout.png    (render blackout)
```

**Puedes omitir esta variable** si quieres usar la ruta por defecto.

---

## 🚀 Configuración en Vercel

### Paso 1: Acceder a la configuración de Vercel
1. Ve a tu proyecto en Vercel: https://vercel.com
2. Selecciona el proyecto **AdrianLAB**
3. Ve a **Settings** → **Environment Variables**

### Paso 2: Añadir las variables
Añade las siguientes variables de entorno:

#### Variable obligatoria:
| Variable | Valor | Environment |
|----------|-------|-------------|
| `GITHUB_TOKEN` | `ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx` | Production, Preview, Development |

#### Variables opcionales (solo si quieres cambiar los valores por defecto):
| Variable | Valor | Environment |
|----------|-------|-------------|
| `GITHUB_OWNER` | `adriangallery` | Production, Preview, Development |
| `GITHUB_REPO` | `AdrianLAB` | Production, Preview, Development |
| `GITHUB_BRANCH` | `main` | Production, Preview, Development |
| `GITHUB_STORAGE_PATH` | `public/rendered-toggles` | Production, Preview, Development |

### Paso 3: Guardar y redeploy
1. Haz clic en **"Save"**
2. Vercel te pedirá hacer un **redeploy** para aplicar los cambios
3. Haz clic en **"Redeploy"** o espera al próximo deploy automático

---

## ✅ Verificación

### Verificar que funciona:
1. **Prueba con un token que tenga toggle activo**:
   ```
   GET https://adrianlab.vercel.app/api/render/[tokenId]
   ```
   Donde `[tokenId]` es un token con toggle activo.

2. **Revisa los logs de Vercel**:
   - Deberías ver mensajes como:
     - `[render] 🎨 TOGGLE: Token X tiene closeup activo`
     - `[github-storage] ✅ Archivo subido exitosamente a GitHub`
     - `[github-storage] 📦 Archivo ya existe en GitHub`

3. **Verifica en GitHub**:
   - Ve a: https://github.com/adriangallery/AdrianLAB/tree/main/public/rendered-toggles
   - Deberías ver los archivos PNG subidos

---

## 🔒 Seguridad

- ✅ El token de GitHub está almacenado de forma segura en Vercel
- ✅ Solo se usa para escribir en el repositorio especificado
- ✅ No se expone en el código del cliente
- ✅ Los archivos se almacenan en una carpeta específica (`public/rendered-toggles`)

---

## 📝 Resumen de Configuración Mínima

**Solo necesitas configurar UNA variable**:
- `GITHUB_TOKEN`: Tu token de GitHub

**Las demás variables tienen valores por defecto** que funcionan con tu configuración actual:
- `GITHUB_OWNER`: `adriangallery` (detectado automáticamente)
- `GITHUB_REPO`: `AdrianLAB` (detectado automáticamente)
- `GITHUB_BRANCH`: `main` (detectado automáticamente)
- `GITHUB_STORAGE_PATH`: `public/rendered-toggles` (valor por defecto)

---

## 🆘 Troubleshooting

### Error: "GITHUB_TOKEN no está configurada"
- Verifica que añadiste la variable en Vercel
- Asegúrate de hacer redeploy después de añadir la variable

### Error: "Not Found" al verificar archivos
- Verifica que el token tiene permisos `repo`
- Verifica que el owner y repo son correctos

### Error: "Bad credentials"
- El token puede haber expirado
- Crea un nuevo token y actualízalo en Vercel

### Los archivos no se suben
- Revisa los logs de Vercel para ver errores específicos
- Verifica que el token tiene permisos de escritura

---

## 📞 ¿Necesitas ayuda?

Si tienes problemas, revisa:
1. Los logs de Vercel en tiempo real
2. Los logs de la consola del navegador
3. El estado del repositorio en GitHub

