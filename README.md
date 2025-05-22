# AdrianLAB

Proyecto para renderizar y gestionar metadatos de NFTs para la colección AdrianLAB.

## Estructura del Proyecto

- `/pages/api/render/[tokenId].js`: API para renderizar tokens
- `/pages/api/metadata/[tokenId].js`: API para generar metadatos
- `/lib`: Funcionalidades de blockchain y contratos
- `/public/traits`: Assets para diferentes rasgos de los NFTs
- `/abis`: ABIs de contratos inteligentes

## Desarrollo

```bash
# Instalar dependencias
npm install

# Ejecutar servidor de desarrollo
npm run dev
```

## Producción

```bash
# Construir para producción
npm run build

# Iniciar servidor de producción
npm start
``` 