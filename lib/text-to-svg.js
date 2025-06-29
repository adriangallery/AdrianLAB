import TextToSVG from 'text-to-svg';
import path from 'path';
import fs from 'fs';

let textToSVGInstance = null;

/**
 * Inicializa la instancia de TextToSVG con la fuente Roboto
 */
function initializeTextToSVG() {
  if (textToSVGInstance) {
    return textToSVGInstance;
  }

  try {
    const fontPath = path.join(process.cwd(), 'public', 'fonts', 'Roboto-Regular.ttf');
    console.log(`[text-to-svg] Inicializando con fuente: ${fontPath}`);
    
    if (fs.existsSync(fontPath)) {
      textToSVGInstance = TextToSVG.loadSync(fontPath);
      console.log(`[text-to-svg] TextToSVG inicializado correctamente`);
      return textToSVGInstance;
    } else {
      console.error(`[text-to-svg] Fuente no encontrada: ${fontPath}`);
      throw new Error('Fuente Roboto no encontrada');
    }
  } catch (error) {
    console.error(`[text-to-svg] Error inicializando TextToSVG:`, error);
    throw error;
  }
}

/**
 * Convierte texto a path SVG
 * @param {string} text - Texto a convertir
 * @param {Object} options - Opciones de renderizado
 * @returns {string} - Path SVG
 */
export function textToPath(text, options = {}) {
  try {
    const instance = initializeTextToSVG();
    
    const defaultOptions = {
      fontSize: 48,
      anchor: 'middle',
      attributes: {
        fill: '#000000'
      }
    };
    
    const finalOptions = { ...defaultOptions, ...options };
    
    const pathData = instance.getPath(text, finalOptions);
    console.log(`[text-to-svg] Texto "${text}" convertido a path`);
    
    return pathData;
  } catch (error) {
    console.error(`[text-to-svg] Error convirtiendo texto a path:`, error);
    // Fallback: crear un path simple como placeholder
    return createFallbackPath(text, options);
  }
}

/**
 * Crea un path de fallback simple
 * @param {string} text - Texto
 * @param {Object} options - Opciones
 * @returns {string} - Path SVG simple
 */
function createFallbackPath(text, options = {}) {
  const fontSize = options.fontSize || 48;
  const width = text.length * fontSize * 0.6; // Estimación aproximada
  const height = fontSize;
  
  // Crear un rectángulo simple como placeholder
  const x = -width / 2;
  const y = -height / 2;
  
  return `M${x},${y} L${x + width},${y} L${x + width},${y + height} L${x},${y + height} Z`;
}

/**
 * Convierte texto a elemento SVG completo con path
 * @param {string} text - Texto a convertir
 * @param {Object} options - Opciones de renderizado
 * @returns {string} - Elemento SVG con path
 */
export function textToSVGElement(text, options = {}) {
  try {
    const pathData = textToPath(text, options);
    
    const defaultOptions = {
      fontSize: 48,
      x: 0,
      y: 0,
      fill: '#000000',
      stroke: null,
      strokeWidth: 0
    };
    
    const finalOptions = { ...defaultOptions, ...options };
    
    let pathElement = `<path d="${pathData}" fill="${finalOptions.fill}"`;
    
    if (finalOptions.stroke) {
      pathElement += ` stroke="${finalOptions.stroke}" stroke-width="${finalOptions.strokeWidth}"`;
    }
    
    pathElement += '/>';
    
    // Crear grupo con transformación
    const group = `<g transform="translate(${finalOptions.x}, ${finalOptions.y})">${pathElement}</g>`;
    
    console.log(`[text-to-svg] Elemento SVG creado para "${text}"`);
    return group;
    
  } catch (error) {
    console.error(`[text-to-svg] Error creando elemento SVG:`, error);
    // Fallback: elemento text simple
    return `<text x="${options.x || 0}" y="${options.y || 0}" font-family="Arial" font-size="${options.fontSize || 48}" text-anchor="middle" fill="${options.fill || '#000000'}">${text}</text>`;
  }
}

/**
 * Convierte múltiples líneas de texto a elementos SVG
 * @param {Array} lines - Array de objetos {text, x, y, fontSize, fill}
 * @returns {string} - Elementos SVG concatenados
 */
export function linesToSVG(lines) {
  try {
    const elements = lines.map(line => {
      return textToSVGElement(line.text, {
        x: line.x || 0,
        y: line.y || 0,
        fontSize: line.fontSize || 48,
        fill: line.fill || '#000000',
        stroke: line.stroke || null,
        strokeWidth: line.strokeWidth || 0
      });
    });
    
    return elements.join('\n');
  } catch (error) {
    console.error(`[text-to-svg] Error convirtiendo líneas a SVG:`, error);
    return '';
  }
}

/**
 * Crea un SVG completo con texto convertido a paths
 * @param {Object} config - Configuración del SVG
 * @returns {string} - SVG completo
 */
export function createSVGWithPaths(config) {
  const {
    width = 768,
    height = 1024,
    backgroundColor = '#ffffff',
    elements = []
  } = config;
  
  try {
    const svgElements = elements.map(element => {
      if (element.type === 'text') {
        return textToSVGElement(element.text, element.options);
      } else if (element.type === 'rect') {
        return `<rect x="${element.x}" y="${element.y}" width="${element.width}" height="${element.height}" fill="${element.fill}"/>`;
      } else if (element.type === 'path') {
        return `<path d="${element.d}" fill="${element.fill}"/>`;
      }
      return '';
    }).join('\n');
    
    const svg = `
      <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
        <rect width="${width}" height="${height}" fill="${backgroundColor}"/>
        ${svgElements}
      </svg>
    `;
    
    console.log(`[text-to-svg] SVG completo creado con ${elements.length} elementos`);
    return svg;
    
  } catch (error) {
    console.error(`[text-to-svg] Error creando SVG completo:`, error);
    throw error;
  }
} 