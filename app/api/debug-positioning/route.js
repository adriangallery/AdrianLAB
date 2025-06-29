import { textToSVGElement } from '../../../lib/text-to-svg.js';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const tokenId = searchParams.get('tokenId') || '1';
    
    // Simular datos del token
    const tokenData = {
      name: 'FLOPPY DISK',
      trait: 'BODY',
      series: '1',
      category: 'BASE',
      required: 'NONE',
      origin: 'ORIGINAL'
    };
    
    const rarity = { tag: 'COMMON', bg: '#a9a9a9' };
    
    // Crear SVG con guías visuales para verificar posicionamiento
    const debugSVG = `
      <svg width="768" height="1024" xmlns="http://www.w3.org/2000/svg">
        <!-- Fondo principal -->
        <rect width="768" height="1024" fill="#ffffff"/>
        
        <!-- Contenedor de imagen con fondo dinámico -->
        <rect x="84" y="120" width="600" height="600" fill="${rarity.bg}20"/>
        
        <!-- Tag de rareza con guías -->
        <rect x="84" y="120" width="160" height="60" fill="${rarity.bg}" stroke="#ff0000" stroke-width="2"/>
        <circle cx="${84 + 160 / 2}" cy="${120 + 60 / 2}" r="3" fill="#ff0000"/>
        ${textToSVGElement(rarity.tag, {
          x: 84 + 160 / 2,
          y: 120 + 60 / 2,
          fontSize: 16,
          fill: '#ffffff',
          anchor: 'center middle'
        })}
        
        <!-- Nombre del trait con guías -->
        <rect x="84" y="760" width="600" height="80" fill="#0f4e6d" stroke="#ff0000" stroke-width="2"/>
        <circle cx="${84 + 600 / 2}" cy="${760 + 80 / 2}" r="3" fill="#ff0000"/>
        ${textToSVGElement(tokenData.name, {
          x: 84 + 600 / 2,
          y: 760 + 80 / 2,
          fontSize: 48,
          fill: '#ffffff',
          anchor: 'center middle'
        })}
        
        <!-- Líneas de datos con guías -->
        <rect x="84" y="880" width="600" height="24" fill="none" stroke="#00ff00" stroke-width="1"/>
        <line x1="84" y1="880" x2="90" y2="880" stroke="#00ff00" stroke-width="2"/>
        ${textToSVGElement(`TRAIT: ${tokenData.trait}`, {
          x: 84,
          y: 880,
          fontSize: 24,
          fill: '#333333',
          anchor: 'left middle'
        })}
        
        <rect x="84" y="915" width="600" height="24" fill="none" stroke="#00ff00" stroke-width="1"/>
        <line x1="84" y1="915" x2="90" y2="915" stroke="#00ff00" stroke-width="2"/>
        ${textToSVGElement(`SERIES: ${tokenData.series}`, {
          x: 84,
          y: 915,
          fontSize: 24,
          fill: '#333333',
          anchor: 'left middle'
        })}
        
        <rect x="84" y="950" width="600" height="24" fill="none" stroke="#00ff00" stroke-width="1"/>
        <line x1="84" y1="950" x2="90" y2="950" stroke="#00ff00" stroke-width="2"/>
        ${textToSVGElement(`CATEGORY: ${tokenData.category}`, {
          x: 84,
          y: 950,
          fontSize: 24,
          fill: '#333333',
          anchor: 'left middle'
        })}
        
        <rect x="84" y="985" width="600" height="24" fill="none" stroke="#00ff00" stroke-width="1"/>
        <line x1="84" y1="985" x2="90" y2="985" stroke="#00ff00" stroke-width="2"/>
        ${textToSVGElement(`REQUIRED: ${tokenData.required}`, {
          x: 84,
          y: 985,
          fontSize: 24,
          fill: '#333333',
          anchor: 'left middle'
        })}
        
        <!-- Origin con guías -->
        <line x1="684" y1="985" x2="690" y2="985" stroke="#0000ff" stroke-width="2"/>
        ${textToSVGElement(tokenData.origin, {
          x: 684,
          y: 985,
          fontSize: 24,
          fill: '#333333',
          anchor: 'right middle'
        })}
        
        <!-- Logo AdrianLAB con guías -->
        <line x1="684" y1="1020" x2="690" y2="1020" stroke="#0000ff" stroke-width="2"/>
        ${textToSVGElement('Adrian', {
          x: 684,
          y: 1020,
          fontSize: 32,
          fill: '#333333',
          anchor: 'right middle'
        })}
        
        <line x1="684" y1="1055" x2="690" y2="1055" stroke="#0000ff" stroke-width="2"/>
        ${textToSVGElement('LAB', {
          x: 684,
          y: 1055,
          fontSize: 32,
          fill: '#ff69b4',
          anchor: 'right middle'
        })}
        
        <!-- Leyenda -->
        <text x="10" y="20" font-family="Arial" font-size="12" fill="#000000">
          Rojo: Centros de rectángulos | Verde: Líneas izquierdas | Azul: Líneas derechas
        </text>
      </svg>
    `;
    
    return new Response(debugSVG, {
      headers: {
        'Content-Type': 'image/svg+xml',
        'Cache-Control': 'no-cache'
      }
    });
    
  } catch (error) {
    console.error('[debug-positioning] Error:', error);
    return new Response(`Error: ${error.message}\nStack: ${error.stack}`, { 
      status: 500,
      headers: { 'Content-Type': 'text/plain' }
    });
  }
} 