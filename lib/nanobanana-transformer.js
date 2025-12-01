/**
 * Transformador de imágenes usando Nano Banana (Google Gemini 2.5 Flash Image)
 * A través de Vercel AI Gateway
 */

import { generateText } from 'ai';
import { google } from '@ai-sdk/google';
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
    
    // Construir prompt (usar custom si se proporciona, sino el default)
    const prompt = customPrompt || buildNanobananaPrompt();
    
    console.log('[nanobanana-transformer] 🍌 Prompt construido, llamando a Nano Banana...');
    console.log('[nanobanana-transformer] 🍌 Prompt length:', prompt.length);
    
    // Llamar a Nano Banana a través de AI Gateway usando generateText
    // Usar formato de modelo como string según documentación de Vercel AI Gateway
    // Gemini 2.5 Flash Image soporta imágenes en los mensajes
    // Nota: La respuesta puede contener la imagen transformada en diferentes formatos
    const result = await generateText({
      model: 'google/gemini-2.5-flash-image',
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              image: base64Image,
              mimeType: 'image/png'
            },
            {
              type: 'text',
              text: prompt
            }
          ]
        }
      ],
    });
    
    console.log('[nanobanana-transformer] 🍌 Respuesta recibida de Nano Banana');
    console.log('[nanobanana-transformer] 🍌 Response:', {
      textLength: result.text?.length || 0,
      finishReason: result.finishReason,
      usage: result.usage
    });
    
    // La respuesta de Gemini puede incluir la imagen transformada de varias formas:
    // 1. Como parte del texto en formato data URL
    // 2. Como parte del contenido de respuesta (si el modelo soporta imágenes de salida)
    // 3. Necesitamos verificar la estructura real de la respuesta
    
    let imageBuffer = null;
    const responseText = result.text || '';
    
    // Intentar extraer imagen de diferentes formatos posibles
    // Formato 1: data URL en el texto
    const dataUrlMatch = responseText.match(/data:image\/[^;]+;base64,([A-Za-z0-9+/=]+)/);
    if (dataUrlMatch) {
      imageBuffer = Buffer.from(dataUrlMatch[1], 'base64');
      console.log('[nanobanana-transformer] 🍌 Imagen encontrada en data URL');
    } else {
      // Formato 2: Base64 puro (sin prefijo data URL)
      // Verificar si el texto completo es base64 válido
      const cleanText = responseText.trim();
      if (cleanText.length > 100 && /^[A-Za-z0-9+/=]+$/.test(cleanText)) {
        try {
          imageBuffer = Buffer.from(cleanText, 'base64');
          // Verificar que sea una imagen válida (PNG empieza con bytes específicos)
          if (imageBuffer[0] === 0x89 && imageBuffer[1] === 0x50 && imageBuffer[2] === 0x4E && imageBuffer[3] === 0x47) {
            console.log('[nanobanana-transformer] 🍌 Imagen encontrada como base64 puro (PNG válido)');
          } else {
            imageBuffer = null; // No es una imagen PNG válida
          }
        } catch (e) {
          console.log('[nanobanana-transformer] ⚠️ Error parseando base64:', e.message);
        }
      }
    }
    
    // Si aún no tenemos imagen, puede que la respuesta no contenga imagen
    // o que el formato sea diferente. En ese caso, lanzamos error.
    if (!imageBuffer) {
      console.error('[nanobanana-transformer] ❌ No se pudo extraer imagen. Response text preview:', responseText.substring(0, 200));
      throw new Error('No se pudo extraer imagen de la respuesta de Nano Banana. La respuesta puede no contener una imagen transformada o el formato es diferente al esperado.');
    }
    
    console.log('[nanobanana-transformer] 🍌 Transformación completada, tamaño:', imageBuffer.length, 'bytes');
    return imageBuffer;
    
  } catch (error) {
    console.error('[nanobanana-transformer] ❌ Error transformando imagen:', error.message);
    console.error('[nanobanana-transformer] Stack:', error.stack);
    throw error;
  }
}

