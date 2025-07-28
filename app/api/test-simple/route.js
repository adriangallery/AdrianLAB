import { Resvg } from '@resvg/resvg-js';

export async function GET(request) {
  try {
    // Extraer tokenId de la URL
    const url = new URL(request.url);
    const pathParts = url.pathname.split('/');
    const tokenId = pathParts[pathParts.length - 1]?.replace('.png', '') || '559';
    
    console.log(`[test-simple] 🧪 Iniciando test simple para token ${tokenId}`);

    // Validar tokenId
    if (!tokenId || isNaN(parseInt(tokenId))) {
      console.error(`[test-simple] Token ID inválido: ${tokenId}`);
      return new Response(JSON.stringify({ error: 'Invalid token ID' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Cargar SVG del trait usando fetch HTTP (sin cache)
    let traitSvgContent = '';
    try {
      const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://adrianlab.vercel.app';
      const imageUrl = `${baseUrl}/labimages/${tokenId}.svg`;
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
      return new Response(JSON.stringify({ error: 'SVG no encontrado', details: error.message }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Crear SVG SIMPLIFICADO (solo el trait + fondo básico)
    const simpleSvg = `
      <svg width="768" height="1024" xmlns="http://www.w3.org/2000/svg">
        <!-- Fondo blanco simple -->
        <rect width="768" height="1024" fill="#ffffff"/>
        
        <!-- Título del test -->
        <text x="384" y="50" font-family="Arial, sans-serif" font-size="32" text-anchor="middle" fill="#333333">TEST SIMPLE - TOKEN ${tokenId}</text>
        
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
      const headers = {
        'Content-Type': 'image/png',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
        'X-Test-Simple': 'true',
        'X-Token-ID': tokenId,
        'X-SVG-Size': traitSvgContent.length.toString(),
        'X-PNG-Size': pngBuffer.length.toString()
      };
      
      // Devolver imagen
      return new Response(pngBuffer, {
        status: 200,
        headers: headers
      });
      
    } catch (error) {
      console.error('[test-simple] ❌ Error renderizando:', error);
      return new Response(JSON.stringify({ 
        error: 'Error renderizando imagen simplificada', 
        details: error.message,
        tokenId: tokenId,
        svgSize: traitSvgContent.length
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
  } catch (error) {
    console.error('[test-simple] Error general:', error);
    return new Response(JSON.stringify({ error: 'Error interno del servidor' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
} 