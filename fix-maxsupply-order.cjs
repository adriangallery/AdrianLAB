const fs = require('fs');

const studioPath = 'public/labmetadata/studio.json';
const studioData = JSON.parse(fs.readFileSync(studioPath, 'utf8'));

let cambios = 0;
for (const tokenId in studioData) {
  const token = studioData[tokenId];
  // Reconstruir el objeto con el orden correcto y asegurando maxSupply
  const nuevo = {};
  if ('name' in token) nuevo.name = token.name;
  if ('category' in token) nuevo.category = token.category;
  if ('rarity' in token) nuevo.rarity = token.rarity;
  nuevo.maxSupply = ('maxSupply' in token) ? token.maxSupply : 1;
  if ('description' in token) nuevo.description = token.description;
  if ('external_url' in token) nuevo.external_url = token.external_url;
  if ('masterminds' in token) nuevo.masterminds = token.masterminds;
  studioData[tokenId] = nuevo;
  cambios++;
}

fs.writeFileSync(studioPath, JSON.stringify(studioData, null, 2));
console.log(`maxSupply asegurado y orden de claves corregido en ${cambios} tokens.`); 