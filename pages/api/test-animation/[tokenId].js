import path from 'path';
import fs from 'fs';

// Cache para traits animados
const animatedTraitsCache = new Map();

// Función para detectar si un SVG es animado
const detectSvgAnimation = (svgContent) => {
  const animationPatterns = [
    '<animate', '<animateTransform', '<animateMotion',
    '@keyframes', 'animation:', 'transition:', 'dur=', 'repeatCount='
  ];
  
  return animationPatterns.some(pattern => svgContent.includes(pattern));
};

// Función para cargar SVG y detectar animación
const loadAndDetectAnimation = async (path) => {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://adrianlab.vercel.app';
    const imageUrl = `${baseUrl}/traits/${path}`;
    
    const response = await fetch(imageUrl);
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    
    const svgContent = await response.text();
    const isAnimated = detectSvgAnimation(svgContent);
    
    return {
      content: svgContent,
      isAnimated: isAnimated
    };
  } catch (error) {
    console.error(`Error cargando SVG ${path}:`, error.message);
    return { content: null, isAnimated: false };
  }
};

// Función principal de detección híbrida
const isTraitAnimated = async (traitData, traitPath) => {
  // Prioridad 1: Metadata en traits.json
  if (traitData && traitData.animated !== undefined) {
    return traitData.animated;
  }
  
  // Prioridad 2: Cache
  if (animatedTraitsCache.has(traitPath)) {
    return animatedTraitsCache.get(traitPath);
  }
  
  // Prioridad 3: Detección dinámica
  try {
    const svgData = await loadAndDetectAnimation(traitPath);
    animatedTraitsCache.set(traitPath, svgData.isAnimated);
    return svgData.isAnimated;
  } catch (error) {
    console.warn(`No se pudo detectar animación para ${traitPath}:`, error);
    return false;
  }
};

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { tokenId } = req.query;
    const cleanTokenId = tokenId?.replace('.png', '') || tokenId;
    
    console.log(`[test-animation] Probando detección de animaciones para token ${cleanTokenId}`);

    // Cargar datos de traits.json
    const labmetadataPath = path.join(process.cwd(), 'public', 'labmetadata', 'traits.json');
    const labmetadataBuffer = fs.readFileSync(labmetadataPath);
    const labmetadata = JSON.parse(labmetadataBuffer.toString());

    // Buscar el trait específico
    const traitData = labmetadata.traits.find(t => t.tokenId === parseInt(cleanTokenId));
    
    if (!traitData) {
      return res.status(404).json({ 
        error: 'Trait no encontrado',
        tokenId: cleanTokenId 
      });
    }

    // Construir path del trait
    const traitPath = `${traitData.category}/${traitData.fileName}.svg`;
    
    // Detectar animación
    const isAnimated = await isTraitAnimated(traitData, traitPath);
    
    // Obtener contenido SVG para análisis
    const svgData = await loadAndDetectAnimation(traitPath);
    
    // Buscar patrones específicos en el SVG
    const animationPatterns = [
      '<animate', '<animateTransform', '<animateMotion',
      '@keyframes', 'animation:', 'transition:', 'dur=', 'repeatCount='
    ];
    
    const foundPatterns = animationPatterns.filter(pattern => 
      svgData.content && svgData.content.includes(pattern)
    );

    const result = {
      tokenId: parseInt(cleanTokenId),
      name: traitData.name,
      category: traitData.category,
      fileName: traitData.fileName,
      path: traitPath,
      metadata: {
        animated: traitData.animated,
        maxSupply: traitData.maxSupply,
        floppy: traitData.floppy
      },
      detection: {
        isAnimated: isAnimated,
        dynamicDetection: svgData.isAnimated,
        foundPatterns: foundPatterns,
        svgLoaded: !!svgData.content
      },
      cache: {
        cached: animatedTraitsCache.has(traitPath),
        cacheValue: animatedTraitsCache.get(traitPath)
      }
    };

    console.log(`[test-animation] Resultado para token ${cleanTokenId}:`, result);

    res.setHeader('Content-Type', 'application/json');
    res.status(200).json(result);

  } catch (error) {
    console.error('[test-animation] Error:', error);
    res.status(500).json({ 
      error: 'Error interno del servidor',
      message: error.message 
    });
  }
} 