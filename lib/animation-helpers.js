/**
 * Animation helpers for applying predefined animations to GIF frames
 * Supports bounce, circular, shake, orbit, zoom, and other animations
 */

/**
 * Calcula posición de bounce con delay por capa
 * @param {number} frameIndex - Frame actual (0-based)
 * @param {number} totalFrames - Total de frames
 * @param {string} direction - 'x', 'y', o 'both'
 * @param {number} distance - Distancia del bounce en píxeles
 * @param {number} bounces - Número de bounces en el ciclo
 * @param {number} delayFrames - Delay en frames para esta capa (0 = sin delay)
 * @returns {Object} { x, y, scale, rotation }
 */
export function calculateBounceWithDelay(frameIndex, totalFrames, direction, distance, bounces, delayFrames = 0) {
  // Aplicar delay como offset de fase: los traits empiezan más tarde en el ciclo
  // Si delayFrames = 2, cuando frameIndex = 0, los traits están en la posición que el skin tenía 2 frames antes
  // Usamos frameIndex - delayFrames para que los traits "vayan detrás"
  const effectiveFrame = frameIndex - delayFrames;
  
  // Normalizar el frame efectivo al rango [0, totalFrames-1] usando módulo
  // Esto permite que el delay funcione correctamente incluso al inicio
  const normalizedFrame = ((effectiveFrame % totalFrames) + totalFrames) % totalFrames;
  const progress = totalFrames > 1 ? normalizedFrame / (totalFrames - 1) : 0;
  
  // Calcular bounce usando seno
  // Multiplicamos por bounces para crear múltiples ciclos de bounce
  const bounceProgress = Math.abs(Math.sin(progress * Math.PI * bounces));
  const offset = distance * bounceProgress;
  
  // Debug log (solo en desarrollo)
  if (process.env.NODE_ENV !== 'production' && frameIndex < 3) {
    console.log(`[calculateBounceWithDelay] frameIndex=${frameIndex}, totalFrames=${totalFrames}, delayFrames=${delayFrames}, effectiveFrame=${effectiveFrame}, normalizedFrame=${normalizedFrame}, progress=${progress.toFixed(3)}, bounceProgress=${bounceProgress.toFixed(3)}, offset=${offset.toFixed(2)}`);
  }
  
  // Aplicar según dirección
  if (direction === 'x') {
    return { x: offset, y: 0, scale: 1, rotation: 0 };
  } else if (direction === 'y') {
    return { x: 0, y: offset, scale: 1, rotation: 0 };
  } else { // both
    return { x: offset * 0.7, y: offset, scale: 1, rotation: 0 };
  }
}

/**
 * Calcula posición circular
 * @param {number} frameIndex - Frame actual (0-based)
 * @param {number} totalFrames - Total de frames
 * @param {number} radius - Radio del círculo
 * @param {number} rotations - Número de rotaciones completas
 * @param {number} direction - 1 para clockwise, -1 para counter-clockwise
 * @returns {Object} { x, y, scale, rotation }
 */
export function calculateCircular(frameIndex, totalFrames, radius, rotations = 1, direction = 1) {
  const progress = totalFrames > 1 ? frameIndex / (totalFrames - 1) : 0;
  const angle = progress * rotations * Math.PI * 2 * direction;
  const x = Math.cos(angle) * radius;
  const y = Math.sin(angle) * radius;
  
  return { x, y, scale: 1, rotation: 0 };
}

/**
 * Calcula posición shake (movimiento aleatorio determinístico)
 * @param {number} frameIndex - Frame actual (0-based)
 * @param {number} intensity - Intensidad del shake
 * @param {number} speed - Velocidad del shake
 * @returns {Object} { x, y, scale, rotation }
 */
export function calculateShake(frameIndex, intensity, speed = 0.3) {
  const seed = frameIndex * speed;
  const x = (Math.sin(seed) + Math.cos(seed * 2)) * intensity;
  const y = (Math.cos(seed) + Math.sin(seed * 3)) * intensity;
  
  return { x, y, scale: 1, rotation: 0 };
}

/**
 * Calcula posición orbit (similar a circular pero con más control)
 * @param {number} frameIndex - Frame actual (0-based)
 * @param {number} totalFrames - Total de frames
 * @param {number} radius - Radio de la órbita
 * @param {number} rotations - Número de rotaciones
 * @param {number} direction - 1 para clockwise, -1 para counter-clockwise
 * @returns {Object} { x, y, scale, rotation }
 */
export function calculateOrbit(frameIndex, totalFrames, radius, rotations = 2, direction = 1) {
  return calculateCircular(frameIndex, totalFrames, radius, rotations, direction);
}

/**
 * Calcula zoom (escala)
 * @param {number} frameIndex - Frame actual (0-based)
 * @param {number} totalFrames - Total de frames
 * @param {number} minScale - Escala mínima
 * @param {number} maxScale - Escala máxima
 * @param {string} easing - 'linear' o 'bounce'
 * @returns {Object} { x, y, scale, rotation }
 */
export function calculateZoom(frameIndex, totalFrames, minScale, maxScale, easing = 'linear') {
  const progress = totalFrames > 1 ? frameIndex / (totalFrames - 1) : 0;
  let scale;
  
  if (easing === 'bounce') {
    const bounceProgress = Math.abs(Math.sin(progress * Math.PI * 2));
    scale = minScale + (maxScale - minScale) * bounceProgress;
  } else {
    // Linear
    scale = minScale + (maxScale - minScale) * progress;
  }
  
  return { x: 0, y: 0, scale, rotation: 0 };
}

/**
 * Calcula posición linear
 * @param {number} frameIndex - Frame actual (0-based)
 * @param {number} totalFrames - Total de frames
 * @param {number} xDistance - Distancia en X
 * @param {number} yDistance - Distancia en Y
 * @returns {Object} { x, y, scale, rotation }
 */
export function calculateLinear(frameIndex, totalFrames, xDistance, yDistance) {
  const progress = totalFrames > 1 ? frameIndex / (totalFrames - 1) : 0;
  const x = xDistance * progress;
  const y = yDistance * progress;
  
  return { x, y, scale: 1, rotation: 0 };
}

/**
 * Calcula posición de explosión (displacement) para efecto de separación de traits
 * Versión básica: separación radial simple
 * @param {number} frameIndex - Frame actual (0-based)
 * @param {number} totalFrames - Total de frames
 * @param {number} traitIndex - Índice del trait (0-based) para calcular ángulo
 * @param {number} totalTraits - Total de traits para distribuir uniformemente
 * @param {number} distance - Distancia máxima de separación en píxeles
 * @param {string} easing - Tipo de easing: 'linear', 'ease-out', 'ease-in-out' (default: 'ease-out')
 * @returns {Object} { x, y, scale, rotation }
 */
export function calculateExplodeDisplacement(frameIndex, totalFrames, traitIndex, totalTraits, distance, easing = 'ease-out') {
  // Ángulo para cada trait (distribución uniforme en círculo)
  // Añadir offset inicial para que el primer trait no esté siempre en la misma dirección
  const angle = (traitIndex / totalTraits) * 2 * Math.PI;
  
  // Progreso de la animación (0 a 1)
  const progress = totalFrames > 1 ? frameIndex / (totalFrames - 1) : 0;
  
  // Aplicar easing
  let easedProgress;
  if (easing === 'ease-out') {
    // Ease-out cubic: empieza rápido y termina lento
    easedProgress = 1 - Math.pow(1 - progress, 3);
  } else if (easing === 'ease-in-out') {
    // Ease-in-out cubic: empieza lento, acelera, termina lento
    easedProgress = progress < 0.5
      ? 4 * progress * progress * progress
      : 1 - Math.pow(-2 * progress + 2, 3) / 2;
  } else {
    // Linear
    easedProgress = progress;
  }
  
  // Calcular distancia actual basada en el progreso
  const currentDistance = distance * easedProgress;
  
  // Calcular posición usando trigonometría
  const x = Math.cos(angle) * currentDistance;
  const y = Math.sin(angle) * currentDistance;
  
  // Opcional: añadir rotación ligera basada en el progreso
  const rotation = easedProgress * 5; // Rotación máxima de 5 grados
  
  // Opcional: escala ligeramente reducida al separarse (efecto de profundidad)
  const scale = 1 - (easedProgress * 0.1); // Escala mínima de 0.9
  
  return { x, y, scale, rotation };
}

/**
 * Easing functions para animaciones premium (Apple-style)
 */
export const EASING = {
  // Quint out: muy suave, empieza rápido y desacelera elegantemente
  quintOut: (t) => 1 - Math.pow(1 - t, 5),
  // Quint in-out: suave en ambos extremos
  quintInOut: (t) => t < 0.5 ? 16 * t * t * t * t * t : 1 - Math.pow(-2 * t + 2, 5) / 2,
  // Cubic out (para settle)
  cubicOut: (t) => 1 - Math.pow(1 - t, 3),
  // Sine in-out (para camera orbit)
  sineInOut: (t) => -(Math.cos(Math.PI * t) - 1) / 2,
  // Back out (overshoot suave ~6%)
  backOut: (t, overshoot = 0.06) => {
    const c1 = 1.70158 * (overshoot / 0.1);
    const c3 = c1 + 1;
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
  }
};

/**
 * Z-Bands por categoría de trait (Apple exploded view spec)
 * Define cuánto se separa cada grupo en el eje Z
 */
const Z_BANDS = {
  background: { min: 0, max: 20 },      // Casi no se mueve
  core: { min: 40, max: 120 },          // BODY, FACE - movimiento moderado
  features: { min: 120, max: 180 },     // EYES, HAIR - más separación
  accessories: { min: 160, max: 220 },  // GLASSES, HAT - máxima separación
  outline: { min: 220, max: 240 }       // OUTLINE - muy adelante
};

/**
 * Mapea categoría de trait a su grupo Z-band
 */
function getCategoryZBand(category) {
  const categoryUpper = (category || '').toUpperCase();
  
  if (categoryUpper === 'BACKGROUND') return Z_BANDS.background;
  if (['ADRIAN', 'BODY', 'FACE', 'SKIN', 'SKINTRAIT'].includes(categoryUpper)) return Z_BANDS.core;
  if (['EYES', 'HAIR', 'MOUTH', 'NOSE', 'BEARD'].includes(categoryUpper)) return Z_BANDS.features;
  if (['GLASSES', 'HAT', 'HEAD', 'GEAR', 'SWAG', 'EAR', 'NECK', 'RANDOMSHIT', 'PAGERS', 'FLOPPY DISCS'].includes(categoryUpper)) return Z_BANDS.accessories;
  if (categoryUpper === 'OUTLINE' || categoryUpper === 'TOP') return Z_BANDS.outline;
  
  // Default: features
  return Z_BANDS.features;
}

/**
 * Timeline phases para Apple exploded view (normalized 0-1)
 * Basado en spec: 4.2s total, comprimido para GIF
 */
const TIMELINE_PHASES = {
  FLAT_HERO:    { start: 0.00, end: 0.14 },  // 0.0-0.6s → 0-14%
  PREP:         { start: 0.14, end: 0.24 },  // 0.6-1.0s → 14-24%
  OPEN_EXPLODE: { start: 0.24, end: 0.62 },  // 1.0-2.6s → 24-62%
  HOLD:         { start: 0.62, end: 0.81 },  // 2.6-3.4s → 62-81%
  CLOSE:        { start: 0.81, end: 1.00 }   // 3.4-4.2s → 81-100%
};

/**
 * Calcula transformación para efecto "Apple Exploded View" con 5 fases
 * Sigue especificación exacta: FLAT → PREP → EXPLODE → HOLD → CLOSE
 * 
 * RESTRICCIONES:
 * - NO redibuja traits
 * - Solo translate(x,y), rotateZ (max 6°), scale (simula Z), opacity
 * - Coordenadas redondeadas a enteros (pixel-perfect)
 * 
 * @param {Object} config - Configuración
 * @returns {Object} { x, y, scale, rotation, opacity }
 */
export function calculateAppleExplodeZ(config) {
  const {
    frameIndex,
    totalFrames,
    layerIndex,
    totalLayers,
    category = 'features',  // Categoría del trait para z-band
    maxZOffset = 60,        // Offset base en Y para simular Z
    staggerFrames = 1,      // Frames de delay entre capas
    withOvershoot = true,
    loopAnimation = true
  } = config;
  
  // Calcular progreso global (0 a 1)
  const globalProgress = totalFrames > 1 ? frameIndex / (totalFrames - 1) : 0;
  
  // Obtener z-band para esta categoría
  const zBand = getCategoryZBand(category);
  const zBandFactor = (zBand.max - zBand.min) / 240; // Normalizado 0-1
  
  // Normalizar índice de capa
  const normalizedLayer = totalLayers > 1 ? layerIndex / (totalLayers - 1) : 0;
  
  // Determinar fase actual y progreso dentro de la fase
  let phaseProgress = 0;
  let currentPhase = 'FLAT_HERO';
  
  if (globalProgress < TIMELINE_PHASES.FLAT_HERO.end) {
    currentPhase = 'FLAT_HERO';
    phaseProgress = 0; // Todo en flat
  } else if (globalProgress < TIMELINE_PHASES.PREP.end) {
    currentPhase = 'PREP';
    const phaseStart = TIMELINE_PHASES.PREP.start;
    const phaseEnd = TIMELINE_PHASES.PREP.end;
    phaseProgress = (globalProgress - phaseStart) / (phaseEnd - phaseStart);
  } else if (globalProgress < TIMELINE_PHASES.OPEN_EXPLODE.end) {
    currentPhase = 'OPEN_EXPLODE';
    const phaseStart = TIMELINE_PHASES.OPEN_EXPLODE.start;
    const phaseEnd = TIMELINE_PHASES.OPEN_EXPLODE.end;
    phaseProgress = (globalProgress - phaseStart) / (phaseEnd - phaseStart);
  } else if (globalProgress < TIMELINE_PHASES.HOLD.end) {
    currentPhase = 'HOLD';
    phaseProgress = 1; // Mantener en máxima separación
  } else {
    currentPhase = 'CLOSE';
    const phaseStart = TIMELINE_PHASES.CLOSE.start;
    const phaseEnd = TIMELINE_PHASES.CLOSE.end;
    phaseProgress = 1 - ((globalProgress - phaseStart) / (phaseEnd - phaseStart)); // Invertido
  }
  
  // === Calcular transformaciones por fase ===
  let x = 0, y = 0, scale = 1, rotation = 0, opacity = 1;
  
  if (currentPhase === 'FLAT_HERO') {
    // Todo en flat, sin transformación
    return { x: 0, y: 0, scale: 1, rotation: 0, opacity: 1 };
  }
  
  if (currentPhase === 'PREP') {
    // Micro tensión: muy sutil push-in (scale ligeramente mayor)
    const prepEased = EASING.quintInOut(phaseProgress);
    scale = 1 + (0.02 * prepEased); // Max 2% scale up
    // Micro tilt: rotación muy sutil
    rotation = prepEased * 1.5 * (layerIndex % 2 === 0 ? 1 : -1); // Max ±1.5°
    return { x: 0, y: 0, scale, rotation, opacity: 1 };
  }
  
  // Para OPEN_EXPLODE, HOLD y CLOSE: calcular separación Z
  
  // Aplicar stagger: capas frontales empiezan primero
  const staggerOffset = (1 - normalizedLayer) * (staggerFrames / totalFrames) * 3;
  let layerProgress = Math.max(0, Math.min(1, (phaseProgress - staggerOffset) / (1 - staggerOffset)));
  
  // Aplicar easing según fase
  let easedProgress;
  if (currentPhase === 'OPEN_EXPLODE') {
    // Quint-out con overshoot
    easedProgress = EASING.quintOut(layerProgress);
    
    // Overshoot del 6% cerca del final
    if (withOvershoot && layerProgress > 0.75) {
      const overshootPhase = (layerProgress - 0.75) / 0.25;
      const overshoot = Math.sin(overshootPhase * Math.PI) * 0.06;
      easedProgress = Math.min(1.06, easedProgress + overshoot);
    }
  } else if (currentPhase === 'CLOSE') {
    // Quint-in-out para cierre suave
    easedProgress = EASING.quintInOut(layerProgress);
  } else {
    // HOLD: mantener en máximo
    easedProgress = 1;
  }
  
  // === Calcular offsets basados en Z-band y progreso ===
  
  // Factor Z basado en categoría y posición en la capa
  const zFactor = (normalizedLayer - 0.3) * zBandFactor; // -0.3 a 0.7 * zBandFactor
  
  // Offset Y: simula profundidad Z (capas frontales suben)
  y = -zFactor * maxZOffset * easedProgress;
  
  // Offset X: muy sutil abanico (max 16px según spec)
  x = zFactor * 16 * easedProgress * (layerIndex % 2 === 0 ? 1 : -1);
  
  // Escala: simula acercamiento/alejamiento por Z
  const maxScale = 1 + (zBandFactor * 0.08); // Max 1.08 para accessories
  const minScale = 1 - (zBandFactor * 0.04); // Min 0.96 para background
  scale = 1 + (zFactor * (maxScale - minScale) * easedProgress);
  
  // Rotación: muy sutil, max 6° según spec, alternando por capa
  const rotationDir = layerIndex % 2 === 0 ? 1 : -1;
  rotation = rotationDir * Math.min(6, zBandFactor * 8) * easedProgress;
  
  // Durante HOLD: añadir micro-movimiento de "respiración"
  if (currentPhase === 'HOLD') {
    const holdPhaseStart = TIMELINE_PHASES.HOLD.start;
    const holdPhaseEnd = TIMELINE_PHASES.HOLD.end;
    const holdProgress = (globalProgress - holdPhaseStart) / (holdPhaseEnd - holdPhaseStart);
    
    // Orbit muy sutil (simular cámara)
    const orbitOffset = Math.sin(holdProgress * Math.PI * 2) * 2;
    x += orbitOffset * zBandFactor;
    
    // Micro-respiración en scale
    scale *= 1 + (Math.sin(holdProgress * Math.PI * 2) * 0.005);
  }
  
  return {
    x: Math.round(x), // Pixel-perfect: redondear a enteros
    y: Math.round(y),
    scale,
    rotation,
    opacity
  };
}

