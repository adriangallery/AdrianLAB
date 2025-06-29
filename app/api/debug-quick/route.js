import { textToSVGElement } from '../../../lib/text-to-svg.js';

export async function GET(request) {
  try {
    // Crear SVG simple para debug rápido
    const debugSVG = `
      <svg width="768" height="1024" xmlns="http://www.w3.org/2000/svg">
        <!-- Fondo -->
        <rect width="768" height="1024" fill="#ffffff"/>
        
        <!-- Marco de referencia -->
        <rect x="84" y="120" width="600" height="600" fill="#f0f0f0" stroke="#000000" stroke-width="1"/>
        
        <!-- Rectángulos de texto -->
        <rect x="84" y="120" width="160" height="60" fill="#a9a9a9" stroke="#ff0000" stroke-width="2"/>
        <rect x="84" y="760" width="600" height="80" fill="#0f4e6d" stroke="#ff0000" stroke-width="2"/>
        <rect x="84" y="880" width="600" height="24" fill="none" stroke="#00ff00" stroke-width="1"/>
        <rect x="84" y="915" width="600" height="24" fill="none" stroke="#00ff00" stroke-width="1"/>
        <rect x="84" y="950" width="600" height="24" fill="none" stroke="#00ff00" stroke-width="1"/>
        <rect x="84" y="985" width="600" height="24" fill="none" stroke="#00ff00" stroke-width="1"/>
        
        <!-- Puntos de referencia -->
        <circle cx="164" cy="150" r="3" fill="#ff0000"/>
        <circle cx="384" cy="800" r="3" fill="#ff0000"/>
        <circle cx="94" cy="880" r="3" fill="#00ff00"/>
        <circle cx="94" cy="915" r="3" fill="#00ff00"/>
        <circle cx="94" cy="950" r="3" fill="#00ff00"/>
        <circle cx="94" cy="985" r="3" fill="#00ff00"/>
        <circle cx="674" cy="985" r="3" fill="#0000ff"/>
        <circle cx="674" cy="1020" r="3" fill="#0000ff"/>
        <circle cx="674" cy="1055" r="3" fill="#0000ff"/>
        
        <!-- Textos de prueba -->
        ${textToSVGElement('COMMON', {
          x: 164,
          y: 150,
          fontSize: 16,
          fill: '#ffffff',
          anchor: 'middle'
        })}
        
        ${textToSVGElement('FLOPPY DISK', {
          x: 384,
          y: 800,
          fontSize: 48,
          fill: '#ffffff',
          anchor: 'middle'
        })}
        
        ${textToSVGElement('TRAIT: BODY', {
          x: 94,
          y: 880,
          fontSize: 24,
          fill: '#333333',
          anchor: 'start'
        })}
        
        ${textToSVGElement('SERIES: 1', {
          x: 94,
          y: 915,
          fontSize: 24,
          fill: '#333333',
          anchor: 'start'
        })}
        
        ${textToSVGElement('CATEGORY: BASE', {
          x: 94,
          y: 950,
          fontSize: 24,
          fill: '#333333',
          anchor: 'start'
        })}
        
        ${textToSVGElement('REQUIRED: NONE', {
          x: 94,
          y: 985,
          fontSize: 24,
          fill: '#333333',
          anchor: 'start'
        })}
        
        ${textToSVGElement('ORIGINAL', {
          x: 674,
          y: 985,
          fontSize: 24,
          fill: '#333333',
          anchor: 'end'
        })}
        
        ${textToSVGElement('Adrian', {
          x: 674,
          y: 1020,
          fontSize: 32,
          fill: '#333333',
          anchor: 'end'
        })}
        
        ${textToSVGElement('LAB', {
          x: 674,
          y: 1055,
          fontSize: 32,
          fill: '#ff69b4',
          anchor: 'end'
        })}
        
        <!-- Leyenda -->
        <text x="10" y="20" font-family="Arial" font-size="12" fill="#000000">
          Rojo: Centros | Verde: Izquierda | Azul: Derecha
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
    console.error('[debug-quick] Error:', error);
    return new Response(`Error: ${error.message}`, { 
      status: 500,
      headers: { 'Content-Type': 'text/plain' }
    });
  }
} 