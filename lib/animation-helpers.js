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
 * Easing functions para animaciones premium
 */
const EASING = {
  // Quint out: muy suave, empieza rápido y desacelera elegantemente
  quintOut: (t) => 1 - Math.pow(1 - t, 5),
  // Quint in-out: suave en ambos extremos
  quintInOut: (t) => t < 0.5 ? 16 * t * t * t * t * t : 1 - Math.pow(-2 * t + 2, 5) / 2,
  // Cubic out
  cubicOut: (t) => 1 - Math.pow(1 - t, 3),
  // Elastic out (para overshoot)
  elasticOut: (t) => {
    const c4 = (2 * Math.PI) / 3;
    return t === 0 ? 0 : t === 1 ? 1 : Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * c4) + 1;
  },
  // Back out (overshoot suave)
  backOut: (t) => {
    const c1 = 1.70158;
    const c3 = c1 + 1;
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
  }
};

/**
 * Calcula transformación para efecto "Apple Exploded View" estilo Z-depth
 * Simula separación por eje Z (profundidad) en 2D usando escala y offset Y
 * 
 * @param {Object} config - Configuración
 * @param {number} config.frameIndex - Frame actual (0-based)
 * @param {number} config.totalFrames - Total de frames
 * @param {number} config.layerIndex - Índice de la capa (0 = más atrás, mayor = más adelante)
 * @param {number} config.totalLayers - Total de capas
 * @param {number} config.maxZOffset - Offset máximo en Y para simular Z (px)
 * @param {number} config.maxScale - Escala máxima para capas frontales (ej: 1.08)
 * @param {number} config.staggerFrames - Frames de delay entre capas (efecto cascada)
 * @param {boolean} config.withOvershoot - Añadir micro-overshoot al final
 * @param {boolean} config.loopAnimation - Si la animación debe hacer loop (explode -> reassemble)
 * @returns {Object} { x, y, scale, rotation, opacity }
 */
export function calculateAppleExplodeZ(config) {
  const {
    frameIndex,
    totalFrames,
    layerIndex,
    totalLayers,
    maxZOffset = 60,      // Máximo offset Y para simular profundidad
    maxScale = 1.06,      // Escala máxima para capas frontales
    staggerFrames = 1,    // Delay entre capas
    withOvershoot = true,
    loopAnimation = true
  } = config;
  
  // Calcular progreso base (0 a 1)
  let rawProgress = totalFrames > 1 ? frameIndex / (totalFrames - 1) : 0;
  
  // Si es loop, hacer: 0→1 (explode) luego 1→0 (reassemble)
  // Dividir la animación: primera mitad explode, segunda mitad reassemble
  if (loopAnimation) {
    if (rawProgress <= 0.5) {
      // Primera mitad: explode (0 → 1)
      rawProgress = rawProgress * 2;
    } else {
      // Segunda mitad: reassemble (1 → 0)
      rawProgress = (1 - rawProgress) * 2;
    }
  }
  
  // Aplicar stagger: cada capa empieza más tarde
  // Normalizar el índice de capa (0 = fondo, 1 = frente)
  const normalizedLayer = totalLayers > 1 ? layerIndex / (totalLayers - 1) : 0;
  
  // Las capas frontales empiezan a moverse primero (stagger inverso)
  // Esto crea el efecto de "despegue" desde el frente
  const staggerOffset = (1 - normalizedLayer) * staggerFrames / totalFrames;
  let layerProgress = Math.max(0, Math.min(1, (rawProgress - staggerOffset) / (1 - staggerOffset * totalLayers)));
  
  // Aplicar easing quint-out para movimiento premium
  let easedProgress = EASING.quintOut(layerProgress);
  
  // Añadir micro-overshoot si está habilitado
  if (withOvershoot && layerProgress > 0.7) {
    // Pequeño overshoot del 4% al final
    const overshootPhase = (layerProgress - 0.7) / 0.3;
    const overshoot = Math.sin(overshootPhase * Math.PI) * 0.04;
    easedProgress = Math.min(1.04, easedProgress + overshoot);
  }
  
  // === Calcular transformaciones basadas en Z-order ===
  
  // Offset Y: capas frontales (mayor layerIndex) suben más (simula venir hacia la cámara)
  // Las capas del fondo bajan ligeramente
  const zFactor = normalizedLayer - 0.5; // -0.5 a 0.5
  const y = -zFactor * maxZOffset * easedProgress; // Negativo porque Y aumenta hacia abajo
  
  // Offset X: muy sutil, solo para dar sensación de abanico
  // Capas frontales van ligeramente a la derecha, traseras a la izquierda
  const x = zFactor * (maxZOffset * 0.15) * easedProgress;
  
  // Escala: capas frontales se agrandan (más cerca), traseras se achican
  const scaleRange = maxScale - (1 / maxScale); // ej: 1.06 - 0.94 = 0.12
  const scale = 1 + (zFactor * scaleRange * easedProgress);
  
  // Rotación: muy sutil, alternando por capa para efecto mecánico
  const rotationDirection = layerIndex % 2 === 0 ? 1 : -1;
  const rotation = rotationDirection * 2 * easedProgress; // Máximo ±2 grados
  
  // Opacidad: mantener 1 (sin fade)
  const opacity = 1;
  
  return {
    x: Math.round(x), // Redondear para pixel-perfect
    y: Math.round(y),
    scale,
    rotation,
    opacity
  };
}

