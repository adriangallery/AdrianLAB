const fs = require('fs');

const studioPath = 'public/labmetadata/studio.json';
const studioData = JSON.parse(fs.readFileSync(studioPath, 'utf8'));

let cambios = 0;
for (const tokenId in studioData) {
  if (!('maxSupply' in studioData[tokenId])) {
    studioData[tokenId].maxSupply = 1;
    cambios++;
  }
}

fs.writeFileSync(studioPath, JSON.stringify(studioData, null, 2));
console.log(`maxSupply añadido a ${cambios} tokens que no lo tenían.`); 