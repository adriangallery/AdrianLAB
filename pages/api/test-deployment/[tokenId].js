export default async function handler(req, res) {
  try {
    const { tokenId } = req.query;
    const cleanTokenId = tokenId.replace('.png', '') || '559';
    
    console.log(`[test-deployment] 🧪 Test deployment para token ${cleanTokenId} - VERSION NUEVA`);
    
    // Respuesta simple para verificar que funciona
    return res.status(200).json({ 
      message: 'Test deployment funcionando',
      tokenId: cleanTokenId,
      timestamp: new Date().toISOString(),
      version: 'NUEVA VERSION',
      status: 'OK'
    });
    
  } catch (error) {
    console.error('[test-deployment] Error:', error);
    return res.status(500).json({ error: 'Error interno' });
  }
} 