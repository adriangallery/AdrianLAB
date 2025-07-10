const fs = require('fs');

// Leer el archivo actual
const traitsFile = fs.readFileSync('public/labmetadata/traits.json', 'utf8');
const traitsData = JSON.parse(traitsFile);

// Nuevos traits a agregar/corregir (168-246)
const newTraits = [
  {"tokenId":168,"name":"Longer-Hair-Blond","category":"Head","fileName":"Longer-Hair-Blond","maxSupply":8,"floppy":"STARTER","description":"BE REAL | BE ADRIAN | AdrianLAB by HalfxTiger","masterminds":["Adrian | HalfxTiger"],"external_url":"https://adrianpunks.com/"},
  {"tokenId":169,"name":"Longer-Hair-Brown","category":"Head","fileName":"Longer-Hair-Brown","maxSupply":14,"floppy":"STARTER","description":"BE REAL | BE ADRIAN | AdrianLAB by HalfxTiger","masterminds":["Adrian | HalfxTiger"],"external_url":"https://adrianpunks.com/"},
  {"tokenId":170,"name":"Longer-Hair-White","category":"Head","fileName":"Longer-Hair-White","maxSupply":13,"floppy":"STARTER","description":"BE REAL | BE ADRIAN | AdrianLAB by HalfxTiger","masterminds":["Adrian | HalfxTiger"],"external_url":"https://adrianpunks.com/"},
  {"tokenId":171,"name":"Mohawk-Green","category":"Head","fileName":"Mohawk-Green","maxSupply":16,"floppy":"STARTER","description":"BE REAL | BE ADRIAN | AdrianLAB by HalfxTiger","masterminds":["Adrian | HalfxTiger"],"external_url":"https://adrianpunks.com/"},
  {"tokenId":172,"name":"Mohawk-Red","category":"Head","fileName":"Mohawk-Red","maxSupply":11,"floppy":"STARTER","description":"BE REAL | BE ADRIAN | AdrianLAB by HalfxTiger","masterminds":["Adrian | HalfxTiger"],"external_url":"https://adrianpunks.com/"},
  {"tokenId":173,"name":"Mohawk","category":"Head","fileName":"Mohawk","maxSupply":8,"floppy":"STARTER","description":"BE REAL | BE ADRIAN | AdrianLAB by HalfxTiger","masterminds":["Adrian | HalfxTiger"],"external_url":"https://adrianpunks.com/"},
  {"tokenId":174,"name":"Mullet-Blonde","category":"Head","fileName":"Mullet-Blonde","maxSupply":10,"floppy":"STARTER","description":"BE REAL | BE ADRIAN | AdrianLAB by HalfxTiger","masterminds":["Adrian | HalfxTiger"],"external_url":"https://adrianpunks.com/"},
  {"tokenId":175,"name":"Mullet","category":"Head","fileName":"Mullet","maxSupply":16,"floppy":"STARTER","description":"BE REAL | BE ADRIAN | AdrianLAB by HalfxTiger","masterminds":["Adrian | HalfxTiger"],"external_url":"https://adrianpunks.com/"},
  {"tokenId":176,"name":"Popper-Blonde","category":"Head","fileName":"Popper-Blonde","maxSupply":12,"floppy":"STARTER","description":"BE REAL | BE ADRIAN | AdrianLAB by HalfxTiger","masterminds":["Adrian | HalfxTiger"],"external_url":"https://adrianpunks.com/"},
  {"tokenId":177,"name":"Popper","category":"Head","fileName":"Popper","maxSupply":17,"floppy":"STARTER","description":"BE REAL | BE ADRIAN | AdrianLAB by HalfxTiger","masterminds":["Adrian | HalfxTiger"],"external_url":"https://adrianpunks.com/"},
  {"tokenId":178,"name":"Short-Blond","category":"Head","fileName":"Short-Blond","maxSupply":15,"floppy":"STARTER","description":"BE REAL | BE ADRIAN | AdrianLAB by HalfxTiger","masterminds":["Adrian | HalfxTiger"],"external_url":"https://adrianpunks.com/"},
  {"tokenId":179,"name":"Short-White","category":"Head","fileName":"Short-White","maxSupply":9,"floppy":"STARTER","description":"BE REAL | BE ADRIAN | AdrianLAB by HalfxTiger","masterminds":["Adrian | HalfxTiger"],"external_url":"https://adrianpunks.com/"},
  {"tokenId":180,"name":"Short","category":"Head","fileName":"Short","maxSupply":16,"floppy":"STARTER","description":"BE REAL | BE ADRIAN | AdrianLAB by HalfxTiger","masterminds":["Adrian | HalfxTiger"],"external_url":"https://adrianpunks.com/"},
  {"tokenId":181,"name":"Snoop","category":"Head","fileName":"Snoop","maxSupply":13,"floppy":"STARTER","description":"BE REAL | BE ADRIAN | AdrianLAB by HalfxTiger","masterminds":["Adrian | HalfxTiger"],"external_url":"https://adrianpunks.com/"},
  {"tokenId":182,"name":"Spike","category":"Head","fileName":"Spike","maxSupply":15,"floppy":"STARTER","description":"BE REAL | BE ADRIAN | AdrianLAB by HalfxTiger","masterminds":["Adrian | HalfxTiger"],"external_url":"https://adrianpunks.com/"},
  {"tokenId":183,"name":"Tonsure-White","category":"Head","fileName":"Tonsure-White","maxSupply":13,"floppy":"STARTER","description":"BE REAL | BE ADRIAN | AdrianLAB by HalfxTiger","masterminds":["Adrian | HalfxTiger"],"external_url":"https://adrianpunks.com/"},
  {"tokenId":184,"name":"Tonsure","category":"Head","fileName":"Tonsure","maxSupply":8,"floppy":"STARTER","description":"BE REAL | BE ADRIAN | AdrianLAB by HalfxTiger","masterminds":["Adrian | HalfxTiger"],"external_url":"https://adrianpunks.com/"},
  {"tokenId":185,"name":"Wild-Blonde","category":"Head","fileName":"Wild-Blonde","maxSupply":16,"floppy":"STARTER","description":"BE REAL | BE ADRIAN | AdrianLAB by HalfxTiger","masterminds":["Adrian | HalfxTiger"],"external_url":"https://adrianpunks.com/"},
  {"tokenId":186,"name":"Wild","category":"Head","fileName":"Wild","maxSupply":14,"floppy":"STARTER","description":"BE REAL | BE ADRIAN | AdrianLAB by HalfxTiger","masterminds":["Adrian | HalfxTiger"],"external_url":"https://adrianpunks.com/"},
  {"tokenId":187,"name":"Bandana-Blue","category":"Head","fileName":"Bandana-Blue","maxSupply":16,"floppy":"STARTER","description":"BE REAL | BE ADRIAN | AdrianLAB by HalfxTiger","masterminds":["Adrian | HalfxTiger"],"external_url":"https://adrianpunks.com/"},
  {"tokenId":188,"name":"Beats-Headphones","category":"Head","fileName":"Beats-Headphones","maxSupply":6,"floppy":"STARTER","description":"BE REAL | BE ADRIAN | AdrianLAB by HalfxTiger","masterminds":["Adrian | HalfxTiger"],"external_url":"https://adrianpunks.com/"},
  {"tokenId":189,"name":"Black-Hoodie-Up","category":"Head","fileName":"Black-Hoodie-Up","maxSupply":15,"floppy":"STARTER","description":"BE REAL | BE ADRIAN | AdrianLAB by HalfxTiger","masterminds":["Adrian | HalfxTiger"],"external_url":"https://adrianpunks.com/"},
  {"tokenId":190,"name":"Bloods-Bandana","category":"Head","fileName":"Bloods-Bandana","maxSupply":12,"floppy":"STARTER","description":"BE REAL | BE ADRIAN | AdrianLAB by HalfxTiger","masterminds":["Adrian | HalfxTiger"],"external_url":"https://adrianpunks.com/"},
  {"tokenId":191,"name":"Brain","category":"Head","fileName":"Brain","maxSupply":6,"floppy":"STARTER","description":"BE REAL | BE ADRIAN | AdrianLAB by HalfxTiger","masterminds":["Adrian | HalfxTiger"],"external_url":"https://adrianpunks.com/"},
  {"tokenId":192,"name":"Cap-Backward-Black","category":"Head","fileName":"Cap-Backward-Black","maxSupply":16,"floppy":"STARTER","description":"BE REAL | BE ADRIAN | AdrianLAB by HalfxTiger","masterminds":["Adrian | HalfxTiger"],"external_url":"https://adrianpunks.com/"},
  {"tokenId":193,"name":"Cap-Backward-Blue","category":"Head","fileName":"Cap-Backward-Blue","maxSupply":14,"floppy":"STARTER","description":"BE REAL | BE ADRIAN | AdrianLAB by HalfxTiger","masterminds":["Adrian | HalfxTiger"],"external_url":"https://adrianpunks.com/"},
  {"tokenId":194,"name":"Cap-Backward-Purple","category":"Head","fileName":"Cap-Backward-Purple","maxSupply":15,"floppy":"STARTER","description":"BE REAL | BE ADRIAN | AdrianLAB by HalfxTiger","masterminds":["Adrian | HalfxTiger"],"external_url":"https://adrianpunks.com/"},
  {"tokenId":195,"name":"Cap-Forward","category":"Head","fileName":"Cap-Forward","maxSupply":15,"floppy":"STARTER","description":"BE REAL | BE ADRIAN | AdrianLAB by HalfxTiger","masterminds":["Adrian | HalfxTiger"],"external_url":"https://adrianpunks.com/"},
  {"tokenId":196,"name":"Cowboy-Hat-Black","category":"Head","fileName":"Cowboy-Hat-Black","maxSupply":9,"floppy":"STARTER","description":"BE REAL | BE ADRIAN | AdrianLAB by HalfxTiger","masterminds":["Adrian | HalfxTiger"],"external_url":"https://adrianpunks.com/"},
  {"tokenId":197,"name":"Cowboy-Hat","category":"Head","fileName":"Cowboy-Hat","maxSupply":12,"floppy":"STARTER","description":"BE REAL | BE ADRIAN | AdrianLAB by HalfxTiger","masterminds":["Adrian | HalfxTiger"],"external_url":"https://adrianpunks.com/"},
  {"tokenId":198,"name":"Crips-Bandana","category":"Head","fileName":"Crips-Bandana","maxSupply":15,"floppy":"STARTER","description":"BE REAL | BE ADRIAN | AdrianLAB by HalfxTiger","masterminds":["Adrian | HalfxTiger"],"external_url":"https://adrianpunks.com/"},
  {"tokenId":199,"name":"Crown","category":"Head","fileName":"Crown","maxSupply":17,"floppy":"STARTER","description":"BE REAL | BE ADRIAN | AdrianLAB by HalfxTiger","masterminds":["Adrian | HalfxTiger"],"external_url":"https://adrianpunks.com/"},
  {"tokenId":200,"name":"Cyan-Cap","category":"Head","fileName":"Cyan-Cap","maxSupply":9,"floppy":"STARTER","description":"BE REAL | BE ADRIAN | AdrianLAB by HalfxTiger","masterminds":["Adrian | HalfxTiger"],"external_url":"https://adrianpunks.com/"},
  {"tokenId":201,"name":"Dad-Cap-Beige","category":"Head","fileName":"Dad-Cap-Beige","maxSupply":13,"floppy":"STARTER","description":"BE REAL | BE ADRIAN | AdrianLAB by HalfxTiger","masterminds":["Adrian | HalfxTiger"],"external_url":"https://adrianpunks.com/"},
  {"tokenId":202,"name":"Dad-Cap-Black","category":"Head","fileName":"Dad-Cap-Black","maxSupply":14,"floppy":"STARTER","description":"BE REAL | BE ADRIAN | AdrianLAB by HalfxTiger","masterminds":["Adrian | HalfxTiger"],"external_url":"https://adrianpunks.com/"},
  {"tokenId":203,"name":"Do-rag","category":"Head","fileName":"Do-rag","maxSupply":9,"floppy":"STARTER","description":"BE REAL | BE ADRIAN | AdrianLAB by HalfxTiger","masterminds":["Adrian | HalfxTiger"],"external_url":"https://adrianpunks.com/"},
  {"tokenId":204,"name":"Dojo-Headband","category":"Head","fileName":"Dojo-Headband","maxSupply":15,"floppy":"STARTER","description":"BE REAL | BE ADRIAN | AdrianLAB by HalfxTiger","masterminds":["Adrian | HalfxTiger"],"external_url":"https://adrianpunks.com/"},
  {"tokenId":205,"name":"Drill-Sergeant","category":"Head","fileName":"Drill-Sergeant","maxSupply":12,"floppy":"STARTER","description":"BE REAL | BE ADRIAN | AdrianLAB by HalfxTiger","masterminds":["Adrian | HalfxTiger"],"external_url":"https://adrianpunks.com/"},
  {"tokenId":206,"name":"Fedora-Brown","category":"Head","fileName":"Fedora-Brown","maxSupply":11,"floppy":"STARTER","description":"BE REAL | BE ADRIAN | AdrianLAB by HalfxTiger","masterminds":["Adrian | HalfxTiger"],"external_url":"https://adrianpunks.com/"},
  {"tokenId":207,"name":"Fes","category":"Head","fileName":"Fes","maxSupply":7,"floppy":"STARTER","description":"BE REAL | BE ADRIAN | AdrianLAB by HalfxTiger","masterminds":["Adrian | HalfxTiger"],"external_url":"https://adrianpunks.com/"},
  {"tokenId":208,"name":"Football-Helmet-Blue","category":"Head","fileName":"Football-Helmet-Blue","maxSupply":8,"floppy":"STARTER","description":"BE REAL | BE ADRIAN | AdrianLAB by HalfxTiger","masterminds":["Adrian | HalfxTiger"],"external_url":"https://adrianpunks.com/"},
  {"tokenId":209,"name":"Football-Helmet-Green","category":"Head","fileName":"Football-Helmet-Green","maxSupply":15,"floppy":"STARTER","description":"BE REAL | BE ADRIAN | AdrianLAB by HalfxTiger","masterminds":["Adrian | HalfxTiger"],"external_url":"https://adrianpunks.com/"},
  {"tokenId":210,"name":"Football-Helmet-Red","category":"Head","fileName":"Football-Helmet-Red","maxSupply":13,"floppy":"STARTER","description":"BE REAL | BE ADRIAN | AdrianLAB by HalfxTiger","masterminds":["Adrian | HalfxTiger"],"external_url":"https://adrianpunks.com/"},
  {"tokenId":211,"name":"French-Barett","category":"Head","fileName":"French-Barett","maxSupply":11,"floppy":"STARTER","description":"BE REAL | BE ADRIAN | AdrianLAB by HalfxTiger","masterminds":["Adrian | HalfxTiger"],"external_url":"https://adrianpunks.com/"},
  {"tokenId":212,"name":"G.I.-Helmet","category":"Head","fileName":"G.I.-Helmet","maxSupply":14,"floppy":"STARTER","description":"BE REAL | BE ADRIAN | AdrianLAB by HalfxTiger","masterminds":["Adrian | HalfxTiger"],"external_url":"https://adrianpunks.com/"},
  {"tokenId":213,"name":"Gimp-Mask","category":"Head","fileName":"Gimp-Mask","maxSupply":13,"floppy":"STARTER","description":"BE REAL | BE ADRIAN | AdrianLAB by HalfxTiger","masterminds":["Adrian | HalfxTiger"],"external_url":"https://adrianpunks.com/"},
  {"tokenId":214,"name":"Gray-Hoodie-Up","category":"Head","fileName":"Gray-Hoodie-Up","maxSupply":9,"floppy":"STARTER","description":"BE REAL | BE ADRIAN | AdrianLAB by HalfxTiger","masterminds":["Adrian | HalfxTiger"],"external_url":"https://adrianpunks.com/"},
  {"tokenId":215,"name":"Green-Barett","category":"Head","fileName":"Green-Barett","maxSupply":15,"floppy":"STARTER","description":"BE REAL | BE ADRIAN | AdrianLAB by HalfxTiger","masterminds":["Adrian | HalfxTiger"],"external_url":"https://adrianpunks.com/"},
  {"tokenId":216,"name":"Hard-Head","category":"Head","fileName":"Hard-Head","maxSupply":13,"floppy":"STARTER","description":"BE REAL | BE ADRIAN | AdrianLAB by HalfxTiger","masterminds":["Adrian | HalfxTiger"],"external_url":"https://adrianpunks.com/"},
  {"tokenId":217,"name":"Hazmat-Helmet","category":"Head","fileName":"Hazmat-Helmet","maxSupply":11,"floppy":"STARTER","description":"BE REAL | BE ADRIAN | AdrianLAB by HalfxTiger","masterminds":["Adrian | HalfxTiger"],"external_url":"https://adrianpunks.com/"},
  {"tokenId":218,"name":"Head-Band","category":"Head","fileName":"Head-Band","maxSupply":14,"floppy":"STARTER","description":"BE REAL | BE ADRIAN | AdrianLAB by HalfxTiger","masterminds":["Adrian | HalfxTiger"],"external_url":"https://adrianpunks.com/"},
  {"tokenId":219,"name":"Headphones","category":"Head","fileName":"Headphones","maxSupply":11,"floppy":"STARTER","description":"BE REAL | BE ADRIAN | AdrianLAB by HalfxTiger","masterminds":["Adrian | HalfxTiger"],"external_url":"https://adrianpunks.com/"},
  {"tokenId":220,"name":"Lumberjack-Hat-Blue","category":"Head","fileName":"Lumberjack-Hat-Blue","maxSupply":12,"floppy":"STARTER","description":"BE REAL | BE ADRIAN | AdrianLAB by HalfxTiger","masterminds":["Adrian | HalfxTiger"],"external_url":"https://adrianpunks.com/"},
  {"tokenId":221,"name":"Lumberjack-Hat-Red","category":"Head","fileName":"Lumberjack-Hat-Red","maxSupply":11,"floppy":"STARTER","description":"BE REAL | BE ADRIAN | AdrianLAB by HalfxTiger","masterminds":["Adrian | HalfxTiger"],"external_url":"https://adrianpunks.com/"},
  {"tokenId":222,"name":"Mash-Cap-Black","category":"Head","fileName":"Mash-Cap-Black","maxSupply":9,"floppy":"STARTER","description":"BE REAL | BE ADRIAN | AdrianLAB by HalfxTiger","masterminds":["Adrian | HalfxTiger"],"external_url":"https://adrianpunks.com/"},
  {"tokenId":223,"name":"Mash-Cap-HT","category":"Head","fileName":"Mash-Cap-HT","maxSupply":16,"floppy":"STARTER","description":"BE REAL | BE ADRIAN | AdrianLAB by HalfxTiger","masterminds":["Adrian | HalfxTiger"],"external_url":"https://adrianpunks.com/"},
  {"tokenId":224,"name":"Matador-Hat","category":"Head","fileName":"Matador-Hat","maxSupply":10,"floppy":"STARTER","description":"BE REAL | BE ADRIAN | AdrianLAB by HalfxTiger","masterminds":["Adrian | HalfxTiger"],"external_url":"https://adrianpunks.com/"},
  {"tokenId":225,"name":"MM-Club","category":"Head","fileName":"MM-Club","maxSupply":14,"floppy":"STARTER","description":"BE REAL | BE ADRIAN | AdrianLAB by HalfxTiger","masterminds":["Adrian | HalfxTiger"],"external_url":"https://adrianpunks.com/"},
  {"tokenId":226,"name":"Ninja-Headband","category":"Head","fileName":"Ninja-Headband","maxSupply":13,"floppy":"STARTER","description":"BE REAL | BE ADRIAN | AdrianLAB by HalfxTiger","masterminds":["Adrian | HalfxTiger"],"external_url":"https://adrianpunks.com/"},
  {"tokenId":227,"name":"Pilot-Helmet","category":"Head","fileName":"Pilot-Helmet","maxSupply":18,"floppy":"STARTER","description":"BE REAL | BE ADRIAN | AdrianLAB by HalfxTiger","masterminds":["Adrian | HalfxTiger"],"external_url":"https://adrianpunks.com/"},
  {"tokenId":228,"name":"Playboy-Bunny-Ears","category":"Head","fileName":"Playboy-Bunny-Ears","maxSupply":12,"floppy":"STARTER","description":"BE REAL | BE ADRIAN | AdrianLAB by HalfxTiger","masterminds":["Adrian | HalfxTiger"],"external_url":"https://adrianpunks.com/"},
  {"tokenId":229,"name":"Police-Cap","category":"Head","fileName":"Police-Cap","maxSupply":20,"floppy":"STARTER","description":"BE REAL | BE ADRIAN | AdrianLAB by HalfxTiger","masterminds":["Adrian | HalfxTiger"],"external_url":"https://adrianpunks.com/"},
  {"tokenId":230,"name":"Purple-Cap","category":"Head","fileName":"Purple-Cap","maxSupply":12,"floppy":"STARTER","description":"BE REAL | BE ADRIAN | AdrianLAB by HalfxTiger","masterminds":["Adrian | HalfxTiger"],"external_url":"https://adrianpunks.com/"},
  {"tokenId":231,"name":"Purple-Hoodie-Up","category":"Head","fileName":"Purple-Hoodie-Up","maxSupply":14,"floppy":"STARTER","description":"BE REAL | BE ADRIAN | AdrianLAB by HalfxTiger","masterminds":["Adrian | HalfxTiger"],"external_url":"https://adrianpunks.com/"},
  {"tokenId":232,"name":"Red-Barett","category":"Head","fileName":"Red-Barett","maxSupply":11,"floppy":"STARTER","description":"BE REAL | BE ADRIAN | AdrianLAB by HalfxTiger","masterminds":["Adrian | HalfxTiger"],"external_url":"https://adrianpunks.com/"},
  {"tokenId":233,"name":"S.W.A.T-Helmet","category":"Head","fileName":"S.W.A.T-Helmet","maxSupply":12,"floppy":"STARTER","description":"BE REAL | BE ADRIAN | AdrianLAB by HalfxTiger","masterminds":["Adrian | HalfxTiger"],"external_url":"https://adrianpunks.com/"},
  {"tokenId":234,"name":"Space-Helmet","category":"Head","fileName":"Space-Helmet","maxSupply":13,"floppy":"STARTER","description":"BE REAL | BE ADRIAN | AdrianLAB by HalfxTiger","masterminds":["Adrian | HalfxTiger"],"external_url":"https://adrianpunks.com/"},
  {"tokenId":235,"name":"Tassle-Hat","category":"Head","fileName":"Tassle-Hat","maxSupply":17,"floppy":"STARTER","description":"BE REAL | BE ADRIAN | AdrianLAB by HalfxTiger","masterminds":["Adrian | HalfxTiger"],"external_url":"https://adrianpunks.com/"},
  {"tokenId":236,"name":"Tiara","category":"Head","fileName":"Tiara","maxSupply":17,"floppy":"STARTER","description":"BE REAL | BE ADRIAN | AdrianLAB by HalfxTiger","masterminds":["Adrian | HalfxTiger"],"external_url":"https://adrianpunks.com/"},
  {"tokenId":237,"name":"Tiger-Hat","category":"Head","fileName":"Tiger-Hat","maxSupply":5,"floppy":"STARTER","description":"BE REAL | BE ADRIAN | AdrianLAB by HalfxTiger","masterminds":["Adrian | HalfxTiger"],"external_url":"https://adrianpunks.com/"},
  {"tokenId":238,"name":"Top-Hat","category":"Head","fileName":"Top-Hat","maxSupply":13,"floppy":"STARTER","description":"BE REAL | BE ADRIAN | AdrianLAB by HalfxTiger","masterminds":["Adrian | HalfxTiger"],"external_url":"https://adrianpunks.com/"},
  {"tokenId":239,"name":"Yellow-Cap","category":"Head","fileName":"Yellow-Cap","maxSupply":13,"floppy":"STARTER","description":"BE REAL | BE ADRIAN | AdrianLAB by HalfxTiger","masterminds":["Adrian | HalfxTiger"],"external_url":"https://adrianpunks.com/"},
  {"tokenId":240,"name":"Adrian-Tattoo","category":"Randomshit","fileName":"Adrian-Tattoo","maxSupply":13,"floppy":"STARTER","description":"BE REAL | BE ADRIAN | AdrianLAB by HalfxTiger","masterminds":["Adrian | HalfxTiger"],"external_url":"https://adrianpunks.com/"},
  {"tokenId":241,"name":"Hoop-Earring","category":"Randomshit","fileName":"Hoop-Earring","maxSupply":17,"floppy":"STARTER","description":"BE REAL | BE ADRIAN | AdrianLAB by HalfxTiger","masterminds":["Adrian | HalfxTiger"],"external_url":"https://adrianpunks.com/"},
  {"tokenId":242,"name":"Silver-Cross","category":"Randomshit","fileName":"Silver-Cross","maxSupply":14,"floppy":"STARTER","description":"BE REAL | BE ADRIAN | AdrianLAB by HalfxTiger","masterminds":["Adrian | HalfxTiger"],"external_url":"https://adrianpunks.com/"},
  {"tokenId":243,"name":"Bane-Mask","category":"Mouth","fileName":"Bane-Mask","maxSupply":13,"floppy":"STARTER","description":"BE REAL | BE ADRIAN | AdrianLAB by HalfxTiger","masterminds":["Adrian | HalfxTiger"],"external_url":"https://adrianpunks.com/"},
  {"tokenId":244,"name":"Blunt","category":"Mouth","fileName":"Blunt","maxSupply":12,"floppy":"STARTER","description":"BE REAL | BE ADRIAN | AdrianLAB by HalfxTiger","masterminds":["Adrian | HalfxTiger"],"external_url":"https://adrianpunks.com/"},
  {"tokenId":245,"name":"Gas-Mask","category":"Mouth","fileName":"Gas-Mask","maxSupply":9,"floppy":"STARTER","description":"BE REAL | BE ADRIAN | AdrianLAB by HalfxTiger","masterminds":["Adrian | HalfxTiger"],"external_url":"https://adrianpunks.com/"},
  {"tokenId":246,"name":"Red-Lip-Cigarett","category":"Mouth","fileName":"Red-Lip-Cigarett","maxSupply":11,"floppy":"STARTER","description":"BE REAL | BE ADRIAN | AdrianLAB by HalfxTiger","masterminds":["Adrian | HalfxTiger"],"external_url":"https://adrianpunks.com/"}
];

// Filtrar traits existentes hasta el token 167
const existingTraits = traitsData.traits.filter(trait => trait.tokenId <= 167);

// Combinar traits existentes con nuevos traits
const updatedTraits = [...existingTraits, ...newTraits];

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

console.log('Archivo traits.json actualizado exitosamente!');
console.log(`Total de traits: ${updatedTraits.length}`); 