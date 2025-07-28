import { Resvg } from '@resvg/resvg-js';

export default async function handler(req, res) {
  try {
    const { tokenId } = req.query;
    const cleanTokenId = tokenId.replace('.png', '') || '559';
    
    console.log(`[test-simple] 🧪 Iniciando test simple para token ${cleanTokenId}`);

    // Validar tokenId
    if (!cleanTokenId || isNaN(parseInt(cleanTokenId))) {
      console.error(`[test-simple] Token ID inválido: ${cleanTokenId}`);
      return res.status(400).json({ error: 'Invalid token ID' });
    }

    // Cargar SVG del trait usando fetch HTTP (sin cache)
    let traitSvgContent = '';
    try {
      const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://adrianlab.vercel.app';
      const imageUrl = `${baseUrl}/labimages/${cleanTokenId}.svg`;
      console.log(`[test-simple] Cargando SVG desde URL: ${imageUrl}`);
      
      const response = await fetch(imageUrl);
      if (response.ok) {
        const svgBuffer = await response.arrayBuffer();
        traitSvgContent = Buffer.from(svgBuffer).toString();
        console.log(`[test-simple] ✅ SVG cargado, tamaño: ${svgBuffer.byteLength} bytes`);
      } else {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
    } catch (error) {
      console.error(`[test-simple] ❌ Error cargando SVG: ${error.message}`);
      return res.status(404).json({ error: 'SVG no encontrado', details: error.message });
    }

    // Crear SVG SIMPLIFICADO (solo el trait + fondo básico)
    const simpleSvg = `
      <svg width="768" height="1024" xmlns="http://www.w3.org/2000/svg">
        <!-- Fondo blanco simple -->
        <rect width="768" height="1024" fill="#ffffff"/>
        
        <!-- Título del test -->
        <text x="384" y="50" font-family="Arial, sans-serif" font-size="32" text-anchor="middle" fill="#333333">TEST SIMPLE - TOKEN ${cleanTokenId}</text>
        
        <!-- Trait centrado y escalado (sin frame, sin mannequin) -->
        <g transform="translate(84, 120) scale(4)">
          ${traitSvgContent.replace(/<svg[^>]*>/, '').replace(/<\/svg>/, '')}
        </g>
        
        <!-- Info del test -->
        <text x="384" y="950" font-family="Arial, sans-serif" font-size="24" text-anchor="middle" fill="#666666">Sin Frame - Sin Mannequin - Sin Cache</text>
        <text x="384" y="980" font-family="Arial, sans-serif" font-size="20" text-anchor="middle" fill="#999999">SVG Size: ${traitSvgContent.length} bytes</text>
      </svg>
    `;

    console.log(`[test-simple] SVG simplificado generado, tamaño: ${simpleSvg.length} bytes`);

    try {
      // Renderizar con Resvg (sin cache)
      console.log(`[test-simple] Renderizando con Resvg...`);
      const resvg = new Resvg(Buffer.from(simpleSvg), {
        fitTo: {
          mode: 'width',
          value: 768
        }
      });
      
      const pngBuffer = resvg.render().asPng();
      console.log(`[test-simple] ✅ Renderizado exitoso, tamaño PNG: ${pngBuffer.length} bytes`);

      // Configurar headers (sin cache)
      res.setHeader('Content-Type', 'image/png');
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      res.setHeader('X-Test-Simple', 'true');
      res.setHeader('X-Token-ID', cleanTokenId);
      res.setHeader('X-SVG-Size', traitSvgContent.length.toString());
      res.setHeader('X-PNG-Size', pngBuffer.length.toString());
      
      // Devolver imagen
      res.status(200).send(pngBuffer);
      
    } catch (error) {
      console.error('[test-simple] ❌ Error renderizando:', error);
      res.status(500).json({ 
        error: 'Error renderizando imagen simplificada', 
        details: error.message,
        tokenId: cleanTokenId,
        svgSize: traitSvgContent.length
      });
    }
    
  } catch (error) {
    console.error('[test-simple] Error general:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
} 