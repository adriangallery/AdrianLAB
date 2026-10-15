# Generador de grids de ZERO

Grid PNG para redes con los renders de los ZERO (AdrianLAB), casillas con el logo y los colores de ZERO
(negro + amarillo ácido `#EDFF00`, fuente ADRIAN_ZERO). Reutiliza los builders del repo (sharp, resvg,
text-to-svg). Sin claves ni servicios propios: baja los renders de `lab.adrianzero.com/api/render/<id>`,
lee `totalSupply` del core en Base por RPC público y guarda caché en `/var/tmp/zero-grid/cache`.

```bash
npm ci --ignore-scripts   # una vez
node scripts/zero-grid/zero-grid.mjs --random --grid 4x4 --format square
node scripts/zero-grid/zero-grid.mjs --latest --format portrait --title "NEW ZEROS" --subtitle "lab.adrianzero.com" --theme acid
node scripts/zero-grid/zero-grid.mjs --ids 10,500,1200-1205 --format x --title "GM ZERO" --logos 2 --out gm.png
```

| Opción | Valores |
|---|---|
| origen | `--ids 12,57,300-310` · `--random` (por defecto) · `--latest` (los últimos minteados) |
| `--grid` | `3`, `4`, `5` o `CxF` (por defecto 4x4; en X 6x3) |
| `--format` | `square` 1080×1080 · `portrait` 1080×1350 · `x` 1200×675 |
| `--title` / `--subtitle` | texto opcional arriba (con el logo) / abajo |
| `--theme` | `dark` (fondo negro) · `acid` (fondo amarillo) |
| `--logos N` | casillas con el logo (por defecto ~1/4 del grid) |
| `--all` | con `--random`/`--latest`, incluye ZERO sin traits (por defecto se saltan) |
| `--seed N` / `--out` | repetir el mismo aleatorio / ruta de salida (por defecto `/var/tmp/zero-grid/`) |
