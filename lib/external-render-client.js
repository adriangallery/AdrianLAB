/**
 * Cliente para comunicarse con el servicio externo de renderizado
 */

const EXTERNAL_RENDER_URL = process.env.EXTERNAL_RENDER_URL;
const EXTERNAL_RENDER_ENABLED = process.env.EXTERNAL_RENDER_ENABLED !== 'false';
const EXTERNAL_RENDER_TIMEOUT = parseInt(process.env.EXTERNAL_RENDER_TIMEOUT || '30000');

/**
 * Verifica si el servicio externo está disponible
 */
export async function checkExternalServiceHealth() {
  if (!EXTERNAL_RENDER_URL) {
    return false;
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000); // 5s para health check

    const response = await fetch(`${EXTERNAL_RENDER_URL}/health`, {
      signal: controller.signal,
      method: 'GET'
    });

    clearTimeout(timeoutId);
    return response.ok;
  } catch (error) {
    console.error('[external-render-client] Health check falló:', error.message);
    return false;
  }
}

/**
 * Renderiza una imagen usando el servicio externo
 * @param {Object} renderData - Datos necesarios para el renderizado
 * @returns {Promise<Buffer|null>} - Buffer PNG o null si falla
 */
export async function renderViaExternalService(renderData) {
  if (!EXTERNAL_RENDER_ENABLED || !EXTERNAL_RENDER_URL) {
    console.log('[external-render-client] Servicio externo deshabilitado o URL no configurada');
    return null;
  }

  try {
    console.log('[external-render-client] 🚀 Enviando request al servicio externo:', {
      tokenId: renderData.tokenId,
      url: EXTERNAL_RENDER_URL
    });

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), EXTERNAL_RENDER_TIMEOUT);

    const response = await fetch(`${EXTERNAL_RENDER_URL}/render`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(renderData),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }

    const pngBuffer = Buffer.from(await response.arrayBuffer());
    const renderTime = response.headers.get('X-Render-Time');
    
    console.log(`[external-render-client] ✅ Imagen renderizada exitosamente (${renderTime}ms, ${pngBuffer.length} bytes)`);
    
    return pngBuffer;
  } catch (error) {
    if (error.name === 'AbortError') {
      console.error('[external-render-client] ⏱️ Timeout esperando respuesta del servicio externo');
    } else {
      console.error('[external-render-client] ❌ Error en servicio externo:', error.message);
    }
    return null;
  }
}

/**
 * Renderiza un GIF usando el servicio externo
 * @param {Object} gifData - Datos necesarios para generar el GIF
 * @returns {Promise<Buffer|null>} - Buffer GIF o null si falla
 */
export async function renderGifViaExternalService(gifData) {
  if (!EXTERNAL_RENDER_ENABLED || !EXTERNAL_RENDER_URL) {
    console.log('[external-render-client] Servicio externo deshabilitado o URL no configurada');
    return null;
  }

  try {
    console.log('[external-render-client] 🎬 Enviando request de GIF al servicio externo:', {
      tokenId: gifData.tokenId,
      frames: gifData.frames,
      pattern: gifData.pattern,
      url: EXTERNAL_RENDER_URL
    });

    // Timeout más largo para GIFs (pueden tardar más)
    const gifTimeout = EXTERNAL_RENDER_TIMEOUT * 3; // 3x el timeout normal
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), gifTimeout);

    const response = await fetch(`${EXTERNAL_RENDER_URL}/gif`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(gifData),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }

    const gifBuffer = Buffer.from(await response.arrayBuffer());
    const renderTime = response.headers.get('X-Render-Time');
    const frameCount = response.headers.get('X-Frame-Count');
    
    console.log(`[external-render-client] ✅ GIF generado exitosamente (${renderTime}ms, ${frameCount} frames, ${gifBuffer.length} bytes)`);
    
    return gifBuffer;
  } catch (error) {
    if (error.name === 'AbortError') {
      console.error('[external-render-client] ⏱️ Timeout esperando respuesta del servicio externo para GIF');
    } else {
      console.error('[external-render-client] ❌ Error en servicio externo para GIF:', error.message);
    }
    return null;
  }
}

/**
 * Prepara los datos de renderizado para enviar al servicio externo
 * @param {Object} params - Parámetros del renderizado
 * @returns {Object} - Datos formateados para el servicio
 */
export function prepareRenderData({
  tokenId,
  generation,
  skinType,
  finalTraits,
  appliedSerum,
  serumSuccess,
  hasAdrianGFSerum,
  serumHistory,
  failedSerumType,
  baseImagePath,
  skintraitPath,
  skinTraitPath,
  isCloseup,
  traitsMapping,
  tagInfo = null,
  samuraiImageIndex = null
}) {
  return {
    tokenId,
    generation: generation.toString(),
    skinType,
    finalTraits,
    appliedSerum,
    serumSuccess,
    hasAdrianGFSerum,
    serumHistory: serumHistory ? serumHistory.map(s => [
      s[0]?.toString(),
      s[1],
      s[2]?.toString(),
      s[3]
    ]) : null,
    failedSerumType,
    baseImagePath,
    skintraitPath,
    skinTraitPath,
    isCloseup,
    traitsMapping,
    tagInfo, // Añadir tagInfo para que el servicio externo pueda aplicar lógica de tags
    samuraiImageIndex // Índice de imagen para SamuraiZERO (500 + samuraiIndex)
  };
}

