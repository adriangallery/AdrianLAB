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

