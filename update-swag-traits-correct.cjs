const fs = require('fs');

// Datos correctos proporcionados por el usuario (formato: tokenId, maxSupply, category, name)
const correctData = [
  { tokenId: 440, name: "Bear-Coat", maxSupply: 132 },
  { tokenId: 441, name: "Bikini-Blue", maxSupply: 42 },
  { tokenId: 442, name: "Bikini-Gold", maxSupply: 15 },
  { tokenId: 443, name: "Bikini-Leopard", maxSupply: 113 },
  { tokenId: 444, name: "Bikini-Pink", maxSupply: 191 },
  { tokenId: 445, name: "Blouse-Black", maxSupply: 114 },
  { tokenId: 446, name: "Blouse-Pink", maxSupply: 39 },
  { tokenId: 447, name: "Blouse-White", maxSupply: 141 },
  { tokenId: 448, name: "Chinchilla-Coat", maxSupply: 45 },
  { tokenId: 449, name: "Double-D-Sweatshirt", maxSupply: 26 },
  { tokenId: 450, name: "Dress-Blue", maxSupply: 112 },
  { tokenId: 451, name: "Dress-Purple", maxSupply: 77 },
  { tokenId: 452, name: "Dress-Red", maxSupply: 155 },
  { tokenId: 453, name: "Faux-Leopard-Coat", maxSupply: 99 },
  { tokenId: 454, name: "Flamenco-Dress", maxSupply: 96 },
  { tokenId: 455, name: "HQ-Jacket", maxSupply: 88 },
  { tokenId: 456, name: "I-Love-Adrian-Shirt", maxSupply: 79 },
  { tokenId: 457, name: "Jessica-Dress", maxSupply: 155 },
  { tokenId: 458, name: "Latex-Suit-GF", maxSupply: 75 },
  { tokenId: 459, name: "Little-Black-Dress", maxSupply: 174 },
  { tokenId: 460, name: "Loungerie-Black-Red", maxSupply: 112 },
  { tokenId: 461, name: "Loungerie-Black", maxSupply: 159 },
  { tokenId: 462, name: "Pink-Bathrope", maxSupply: 77 },
  { tokenId: 463, name: "Pipi-Shirt", maxSupply: 117 },
  { tokenId: 464, name: "Playboy-Bunny-White", maxSupply: 97 },
  { tokenId: 465, name: "Smoking-Gold-No-Shirt", maxSupply: 124 },
  { tokenId: 466, name: "Summer-Dress", maxSupply: 108 },
  { tokenId: 467, name: "V-Shirt-White-GF", maxSupply: 38 },
  { tokenId: 468, name: "Tank-Top-Black", maxSupply: 75 },
  { tokenId: 469, name: "Tank-Top-Pink", maxSupply: 33 },
  { tokenId: 470, name: "Tank-Top-White", maxSupply: 204 },
  { tokenId: 471, name: "Tassles-Pink", maxSupply: 156 },
  { tokenId: 472, name: "Tassles-Red", maxSupply: 45 },
  { tokenId: 473, name: "Towel", maxSupply: 146 },
  { tokenId: 474, name: "T-Shirt-White-GF", maxSupply: 127 },
  { tokenId: 475, name: "Wet-T-Shirt", maxSupply: 154 },
  { tokenId: 476, name: "Wicked-Weasel-Black", maxSupply: 127 },
  { tokenId: 477, name: "Wicked-Weasel-Blue", maxSupply: 176 },
  { tokenId: 478, name: "Wicked-Weasel-Green", maxSupply: 84 },
  { tokenId: 479, name: "Wicked-Weasel-Pink", maxSupply: 128 },
  { tokenId: 480, name: "Yes-We-Can-Shirt", maxSupply: 213 }
];

// Leer el archivo traits.json
const traitsPath = 'public/labmetadata/traits.json';
const traitsData = JSON.parse(fs.readFileSync(traitsPath, 'utf8'));

// Actualizar los tokens del 440 al 480
correctData.forEach(correctItem => {
  const traitIndex = traitsData.traits.findIndex(trait => trait.tokenId === correctItem.tokenId && trait.category === "SWAG");
  
  if (traitIndex !== -1) {
    // Actualizar el trait existente
    traitsData.traits[traitIndex].name = correctItem.name;
    traitsData.traits[traitIndex].fileName = correctItem.name;
    traitsData.traits[traitIndex].maxSupply = correctItem.maxSupply;
    
    console.log(`✅ Actualizado token ${correctItem.tokenId}: ${correctItem.name} (maxSupply: ${correctItem.maxSupply})`);
  } else {
    console.log(`❌ No se encontró el token ${correctItem.tokenId} en la categoría SWAG`);
  }
});

// Guardar los cambios
fs.writeFileSync(traitsPath, JSON.stringify(traitsData, null, 2));
console.log('\n🎉 Archivo traits.json actualizado exitosamente con los datos correctos!'); 