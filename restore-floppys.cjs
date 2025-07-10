const fs = require('fs');

// Leer el archivo actual
const traitsFile = fs.readFileSync('public/labmetadata/traits.json', 'utf8');
const traitsData = JSON.parse(traitsFile);

// Floppys que se perdieron (basado en el archivo original)
const floppys = [
  {
    "tokenId": 10000,
    "name": "OG Floppy",
    "category": "Floppy discs",
    "fileName": "OG-Floppy",
    "maxSupply": 100,
    "floppy": "OG",
    "traitsInside": 3,
    "description": "BE REAL | BE ADRIAN | AdrianLAB by HalfxTiger",
    "masterminds": ["Adrian | HalfxTiger"],
    "external_url": "https://adrianpunks.com/"
  },
  {
    "tokenId": 10001,
    "name": "STARTER Floppy",
    "category": "Floppy discs",
    "fileName": "STARTER-Floppy",
    "maxSupply": 1000,
    "floppy": "STARTER",
    "traitsInside": 2,
    "description": "BE REAL | BE ADRIAN | AdrianLAB by HalfxTiger",
    "masterminds": ["Adrian | HalfxTiger"],
    "external_url": "https://adrianpunks.com/"
  },
  {
    "tokenId": 10002,
    "name": "STARTER Floppy",
    "category": "Floppy discs",
    "fileName": "STARTER-Floppy",
    "maxSupply": 1000,
    "floppy": "STARTER",
    "traitsInside": 4,
    "description": "BE REAL | BE ADRIAN | AdrianLAB by HalfxTiger",
    "masterminds": ["Adrian | HalfxTiger"],
    "external_url": "https://adrianpunks.com/"
  },
  {
    "tokenId": 15000,
    "name": "Professor_X",
    "category": "Pagers",
    "fileName": "Professor_X",
    "maxSupply": 1,
    "traitsInside": "IDK",
    "description": "BE REAL | BE ADRIAN | AdrianLAB by HalfxTiger",
    "masterminds": ["Adrian | HalfxTiger"],
    "external_url": "https://adrianpunks.com/"
  },
  {
    "tokenId": 15001,
    "name": "Gooost",
    "category": "Pagers",
    "fileName": "Gooost",
    "maxSupply": 1,
    "traitsInside": "IDK",
    "description": "BE REAL | BE ADRIAN | AdrianLAB by HalfxTiger",
    "masterminds": ["Adrian | HalfxTiger"],
    "external_url": "https://adrianpunks.com/"
  },
  {
    "tokenId": 15002,
    "name": "Cor727",
    "category": "Pagers",
    "fileName": "Cor727",
    "maxSupply": 1,
    "traitsInside": "IDK",
    "description": "BE REAL | BE ADRIAN | AdrianLAB by HalfxTiger",
    "masterminds": ["Adrian | HalfxTiger"],
    "external_url": "https://adrianpunks.com/"
  },
  {
    "tokenId": 15003,
    "name": "Filthy",
    "category": "Pagers",
    "fileName": "Filthy",
    "maxSupply": 1,
    "traitsInside": "IDK",
    "description": "BE REAL | BE ADRIAN | AdrianLAB by HalfxTiger",
    "masterminds": ["Adrian | HalfxTiger"],
    "external_url": "https://adrianpunks.com/"
  },
  {
    "tokenId": 15004,
    "name": "WasSa",
    "category": "Pagers",
    "fileName": "WasSa",
    "maxSupply": 1,
    "traitsInside": "IDK",
    "description": "BE REAL | BE ADRIAN | AdrianLAB by HalfxTiger",
    "masterminds": ["Adrian | HalfxTiger"],
    "external_url": "https://adrianpunks.com/"
  }
];

// Agregar los floppys al final de los traits existentes
const updatedTraits = [...traitsData.traits, ...floppys];

// Crear el nuevo objeto de datos
const updatedData = {
  ...traitsData,
  traits: updatedTraits
};

// Actualizar el metadata
updatedData.metadata = {
  totalTraits: updatedTraits.length,
  categories: [
    "Background",
    "Ear", 
    "Eyes",
    "Head",
    "Mouth",
    "Neck",
    "Nose",
    "Skin",
    "Swag",
    "GEAR",
    "BEARD",
    "Randomshit",
    "Floppy discs",
    "Pagers"
  ],
  floppy: "OG",
  description: "OG Floppy Traits Collection - Base de datos de todos los traits disponibles en la colección OG Floppy"
};

// Escribir el archivo actualizado
fs.writeFileSync('public/labmetadata/traits.json', JSON.stringify(updatedData, null, 2));

console.log('Floppys restaurados exitosamente!');
console.log(`Total de traits: ${updatedTraits.length}`);
console.log('Floppys agregados:');
floppys.forEach(floppy => {
  console.log(`- Token ${floppy.tokenId}: ${floppy.name} (${floppy.category})`);
}); 