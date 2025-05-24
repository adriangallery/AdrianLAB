// Endpoint principal para redireccionar a la ruta de renderizado de FLOPPY DISKS

export default function handler(req, res) {
  // Extraer el tokenId de la URL, si existe
  const tokenId = req.query.tokenId || '1';
  
  // Redireccionar a la ruta de renderizado de FLOPPY DISKS
  res.redirect(307, `/api/floppy/render/${tokenId}`);
} 