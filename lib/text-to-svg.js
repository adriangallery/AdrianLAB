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
    const fontPath = path.join(process.cwd(), 'public', 'fonts', 'Roboto', 'Roboto-VariableFont_wdth,wght.ttf');
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
    
    // Extraer solo los datos del path, no el elemento completo
    const pathMatch = pathData.match(/d="([^"]+)"/);
    if (pathMatch) {
      return pathMatch[1];
    }
    
    // Si no hay match, devolver el pathData tal como está
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
    const instance = initializeTextToSVG();
    
    const defaultOptions = {
      fontSize: 48,
      x: 0,
      y: 0,
      fill: '#000000',
      stroke: null,
      strokeWidth: 0,
      anchor: 'middle'  // Anclaje por defecto: centro horizontal
    };
    
    const finalOptions = { ...defaultOptions, ...options };
    
    // Obtener el path data con el anclaje especificado
    const pathData = instance.getPath(text, {
      fontSize: finalOptions.fontSize,
      anchor: finalOptions.anchor
    });
    
    // Extraer solo los datos del path, no el elemento completo
    const pathMatch = pathData.match(/d="([^"]+)"/);
    if (!pathMatch) {
      throw new Error('No se pudo extraer el path data del SVG generado');
    }
    
    const d = pathMatch[1];
    
    console.log(`[text-to-svg] Texto "${text}" convertido a path con anclaje "${finalOptions.anchor}" en (${finalOptions.x}, ${finalOptions.y})`);
    
    // Crear el elemento path
    let pathElement = `<path d="${d}" fill="${finalOptions.fill}"`;
    
    if (finalOptions.stroke) {
      pathElement += ` stroke="${finalOptions.stroke}" stroke-width="${finalOptions.strokeWidth}"`;
    }
    
    pathElement += '/>';
    
    // Crear grupo con transformación directa al punto deseado
    const group = `<g transform="translate(${finalOptions.x}, ${finalOptions.y})">${pathElement}</g>`;
    
    return group;
    
  } catch (error) {
    console.error(`[text-to-svg] Error creando elemento SVG:`, error);
    // Fallback: elemento text simple
    return `<text x="${options.x || 0}" y="${options.y || 0}" font-family="Arial" font-size="${options.fontSize || 48}" text-anchor="middle" fill="${options.fill || '#000000'}">${text}</text>`;
  }
}

/**
 * Convierte múltiples líneas de texto a elementos SVG
 * @param {Array} lines - Array de objetos {text, x, y, fontSize, fill, anchor}
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
        strokeWidth: line.strokeWidth || 0,
        anchor: line.anchor || 'middle'
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