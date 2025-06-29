import { textToSVGElement } from '../../../lib/text-to-svg.js';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const text = searchParams.get('text') || 'Hello World';
    const fontSize = parseInt(searchParams.get('fontSize')) || 48;
    
    console.log(`[debug-metrics] Probando texto: "${text}" con fontSize: ${fontSize}`);
    
    // Obtener métricas usando la librería directamente
    const { TextToSVG } = await import('text-to-svg');
    const instance = TextToSVG.loadSync('./public/fonts/Roboto-VariableFont_wght.ttf');
    
    const metrics = instance.getMetrics(text, {
      fontSize: fontSize,
      anchor: 'middle'
    });
    
    console.log(`[debug-metrics] Métricas calculadas:`, metrics);
    
    // Generar SVG con texto como path
    const svgWithPath = textToSVGElement(text, {
      fontSize: fontSize,
      x: 200,
      y: 100,
      fill: '#ff0000'
    });
    
    // Generar SVG con texto normal para comparar
    const svgWithText = `<text x="200" y="100" font-family="Arial" font-size="${fontSize}" text-anchor="middle" fill="#0000ff">${text}</text>`;
    
    const fullSVG = `
      <svg width="400" height="200" xmlns="http://www.w3.org/2000/svg">
        <rect width="400" height="200" fill="#f0f0f0"/>
        <line x1="200" y1="0" x2="200" y2="200" stroke="#999" stroke-width="1"/>
        <line x1="0" y1="100" x2="400" y2="100" stroke="#999" stroke-width="1"/>
        ${svgWithPath}
        ${svgWithText}
        <circle cx="200" cy="100" r="3" fill="#00ff00"/>
      </svg>
    `;
    
    return new Response(fullSVG, {
      headers: {
        'Content-Type': 'image/svg+xml',
        'Cache-Control': 'no-cache'
      }
    });
    
  } catch (error) {
    console.error('[debug-metrics] Error:', error);
    return new Response(`Error: ${error.message}\nStack: ${error.stack}`, { 
      status: 500,
      headers: { 'Content-Type': 'text/plain' }
    });
  }
} 