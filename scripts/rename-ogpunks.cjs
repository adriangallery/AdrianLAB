const fs = require('fs');
const path = require('path');
const dir = path.join(process.cwd(), 'public', 'labimages', 'ogpunks');
const files = fs.readdirSync(dir)
  .filter(f => f.toLowerCase().endsWith('.svg'))
  .sort((a,b)=> a.localeCompare(b, 'en', { numeric: true, sensitivity: 'base' }));

if (files.length === 0) {
  console.error('No hay SVGs en ogpunks/');
  process.exit(1);
}

const startId = 100001;
const endId = startId + files.length - 1;
if (files.length !== 1000) {
  console.warn(`Aviso: se encontraron ${files.length} archivos. Se renombrarán ${files.length} como ${startId}-${endId}.`);
}

// Primera pasada: renombrar a nombres temporales únicos
files.forEach((fname, idx) => {
  const src = path.join(dir, fname);
  const tmp = path.join(dir, `__TMP__${String(idx).padStart(4,'0')}.svg`);
  fs.renameSync(src, tmp);
});

// Segunda pasada: renombrar a destino final secuencial
for (let i = 0; i < files.length; i++) {
  const tmp = path.join(dir, `__TMP__${String(i).padStart(4,'0')}.svg`);
  const targetId = startId + i;
  const dst = path.join(dir, `${targetId}.svg`);
  fs.renameSync(tmp, dst);
}

console.log(`Renombrados ${files.length} archivos → ${startId}-${endId}.`);
