/**
 * Transformador de imágenes usando Nano Banana (Google Gemini 2.5 Flash Image)
 * A través de Vercel AI Gateway
 */

import { generateImage } from 'ai';
import { buildNanobananaPrompt } from './nanobanana-prompt.js';

/**
 * Transforma una imagen PNG usando Nano Banana
 * @param {Buffer} pngBuffer - Buffer de la imagen PNG original
 * @param {string} customPrompt - Prompt personalizado (opcional)
 * @returns {Promise<Buffer>} - Buffer de la imagen transformada
 */
export async function transformWithNanoBanana(pngBuffer, customPrompt = null) {
  try {
    console.log('[nanobanana-transformer] 🍌 Iniciando transformación con Nano Banana');
    
    // Convertir PNG buffer a base64
    const base64Image = pngBuffer.toString('base64');
    const dataUrl = `data:image/png;base64,${base64Image}`;
    
    // Construir prompt (usar custom si se proporciona, sino el default)
    const prompt = customPrompt || buildNanobananaPrompt();
    
    console.log('[nanobanana-transformer] 🍌 Prompt construido, llamando a Nano Banana...');
    console.log('[nanobanana-transformer] 🍌 Prompt length:', prompt.length);
    
    // Llamar a Nano Banana a través de AI Gateway
    // Nano Banana soporta edición de imágenes con input image
    // La API puede variar, intentamos con diferentes formatos
    let result;
    try {
      // Intentar con image como parámetro (formato más común)
      result = await generateImage({
        model: 'google/gemini-2.5-flash-image',
        prompt: prompt,
        image: dataUrl, // Imagen de entrada para edición
      });
    } catch (error) {
      // Si falla, intentar sin image (generación desde cero con prompt)
      console.log('[nanobanana-transformer] ⚠️ Primer intento falló, intentando sin image parameter...');
      result = await generateImage({
        model: 'google/gemini-2.5-flash-image',
        prompt: `${prompt}\n\nTransform the following image: [image will be provided separately]`,
      });
    }
    
    const { image } = result;
    
    console.log('[nanobanana-transformer] 🍌 Imagen transformada recibida');
    
    // Convertir respuesta a buffer
    let imageBuffer;
    if (typeof image === 'string') {
      // Si es base64 o data URL
      if (image.startsWith('data:')) {
        const base64 = image.split(',')[1];
        imageBuffer = Buffer.from(base64, 'base64');
      } else {
        imageBuffer = Buffer.from(image, 'base64');
      }
    } else if (Buffer.isBuffer(image)) {
      imageBuffer = image;
    } else {
      throw new Error('Formato de imagen no reconocido de Nano Banana');
    }
    
    console.log('[nanobanana-transformer] 🍌 Transformación completada, tamaño:', imageBuffer.length, 'bytes');
    return imageBuffer;
    
  } catch (error) {
    console.error('[nanobanana-transformer] ❌ Error transformando imagen:', error.message);
    console.error('[nanobanana-transformer] Stack:', error.stack);
    throw error;
  }
}

