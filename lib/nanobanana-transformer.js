/**
 * Transformador de imágenes usando Nano Banana (Google Gemini 2.5 Flash Image)
 * A través de Vercel AI Gateway
 */

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
    
    // Llamar a Nano Banana a través de AI Gateway usando fetch directo
    // Vercel AI Gateway requiere autenticación con API key
    // Intentar múltiples nombres de variables de entorno
    const apiKey = process.env.VERCEL_AI_GATEWAY_API_KEY 
      || process.env.AI_GATEWAY_API_KEY 
      || process.env.NEXT_PUBLIC_VERCEL_AI_GATEWAY_API_KEY
      || process.env.NEXT_PUBLIC_AI_GATEWAY_API_KEY;
    
    if (!apiKey) {
      // Log todas las variables de entorno disponibles para debugging (sin valores sensibles)
      const envKeys = Object.keys(process.env).filter(key => 
        key.includes('AI') || key.includes('GATEWAY') || key.includes('VERCEL')
      );
      console.error('[nanobanana-transformer] ❌ API Key no encontrada. Variables de entorno relacionadas:', envKeys);
      throw new Error('VERCEL_AI_GATEWAY_API_KEY o AI_GATEWAY_API_KEY no está configurada en las variables de entorno de Vercel');
    }
    
    console.log('[nanobanana-transformer] 🍌 API Key encontrada (longitud:', apiKey.length, 'caracteres)');
    
    console.log('[nanobanana-transformer] 🍌 Llamando a Vercel AI Gateway...');
    
    // Llamar directamente al AI Gateway usando fetch
    // Formato compatible con OpenAI para Gemini a través de AI Gateway
    const response = await fetch('https://ai-gateway.vercel.sh/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash-image',
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image_url',
                image_url: {
                  url: `data:image/png;base64,${base64Image}`
                }
              },
              {
                type: 'text',
                text: prompt
              }
            ]
          }
        ],
        max_tokens: 4096,
      }),
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`AI Gateway error: ${response.status} ${response.statusText} - ${errorText}`);
    }
    
    const data = await response.json();
    console.log('[nanobanana-transformer] 🍌 Respuesta recibida de AI Gateway');
    
    // Logging detallado de la estructura completa de la respuesta
    console.log('[nanobanana-transformer] 🍌 Estructura completa de la respuesta:', JSON.stringify(data, null, 2));
    console.log('[nanobanana-transformer] 🍌 Keys en data:', Object.keys(data));
    console.log('[nanobanana-transformer] 🍌 data.choices:', data.choices);
    if (data.choices && data.choices[0]) {
      console.log('[nanobanana-transformer] 🍌 data.choices[0]:', JSON.stringify(data.choices[0], null, 2));
      console.log('[nanobanana-transformer] 🍌 data.choices[0].message:', JSON.stringify(data.choices[0].message, null, 2));
    }
    
    // Intentar extraer contenido de múltiples ubicaciones posibles
    let responseText = '';
    
    // Ubicación 1: Formato estándar OpenAI Chat Completions
    if (data.choices?.[0]?.message?.content) {
      responseText = data.choices[0].message.content;
      console.log('[nanobanana-transformer] 🍌 Contenido encontrado en data.choices[0].message.content');
    }
    // Ubicación 2: Campo content directo
    else if (data.content) {
      responseText = typeof data.content === 'string' ? data.content : JSON.stringify(data.content);
      console.log('[nanobanana-transformer] 🍌 Contenido encontrado en data.content');
    }
    // Ubicación 3: Campo text directo
    else if (data.text) {
      responseText = typeof data.text === 'string' ? data.text : JSON.stringify(data.text);
      console.log('[nanobanana-transformer] 🍌 Contenido encontrado en data.text');
    }
    // Ubicación 4: Verificar si hay files o imágenes en la respuesta
    else if (data.files || data.choices?.[0]?.message?.files) {
      const files = data.files || data.choices[0].message.files;
      console.log('[nanobanana-transformer] 🍌 Archivos encontrados en la respuesta:', files);
      // Los archivos pueden contener la imagen transformada
    }
    
    console.log('[nanobanana-transformer] 🍌 Response text length:', responseText.length);
    if (responseText.length > 0) {
      console.log('[nanobanana-transformer] 🍌 Response text preview (primeros 500 chars):', responseText.substring(0, 500));
    }
    
    // La respuesta de Gemini puede incluir la imagen transformada de varias formas:
    // 1. Como parte del texto en formato data URL
    // 2. Como parte del contenido de respuesta (si el modelo soporta imágenes de salida)
    // 3. En un campo files separado
    // 4. Necesitamos verificar la estructura real de la respuesta
    
    let imageBuffer = null;
    
    // Método 1: Verificar si hay archivos en la respuesta
    const files = data.files || data.choices?.[0]?.message?.files || data.choices?.[0]?.files;
    if (files && Array.isArray(files) && files.length > 0) {
      console.log('[nanobanana-transformer] 🍌 Archivos encontrados en respuesta, procesando...');
      for (const file of files) {
        // Verificar si el archivo es una imagen
        if (file.mediaType?.startsWith('image/') || file.type?.startsWith('image/')) {
          try {
            // El archivo puede estar en diferentes formatos
            if (file.data) {
              // Base64 data
              imageBuffer = Buffer.from(file.data, 'base64');
              console.log('[nanobanana-transformer] 🍌 Imagen encontrada en files[].data');
            } else if (file.uint8Array) {
              // Uint8Array
              imageBuffer = Buffer.from(file.uint8Array);
              console.log('[nanobanana-transformer] 🍌 Imagen encontrada en files[].uint8Array');
            } else if (file.url) {
              // URL (puede ser data URL)
              if (file.url.startsWith('data:image/')) {
                const base64Match = file.url.match(/data:image\/[^;]+;base64,([A-Za-z0-9+/=]+)/);
                if (base64Match) {
                  imageBuffer = Buffer.from(base64Match[1], 'base64');
                  console.log('[nanobanana-transformer] 🍌 Imagen encontrada en files[].url (data URL)');
                }
              }
            }
            
            // Verificar que sea PNG válido si encontramos algo
            if (imageBuffer && imageBuffer.length > 0) {
              if (imageBuffer[0] === 0x89 && imageBuffer[1] === 0x50 && imageBuffer[2] === 0x4E && imageBuffer[3] === 0x47) {
                console.log('[nanobanana-transformer] 🍌 PNG válido confirmado');
                break; // Encontramos una imagen válida
              } else {
                console.log('[nanobanana-transformer] ⚠️ Archivo encontrado pero no es PNG válido, continuando búsqueda...');
                imageBuffer = null;
              }
            }
          } catch (e) {
            console.log('[nanobanana-transformer] ⚠️ Error procesando archivo:', e.message);
          }
        }
      }
    }
    
    // Método 2: Intentar extraer imagen del texto de respuesta (si no encontramos en files)
    if (!imageBuffer && responseText) {
      // Formato 1: data URL en el texto
      const dataUrlMatch = responseText.match(/data:image\/[^;]+;base64,([A-Za-z0-9+/=]+)/);
      if (dataUrlMatch) {
        imageBuffer = Buffer.from(dataUrlMatch[1], 'base64');
        console.log('[nanobanana-transformer] 🍌 Imagen encontrada en data URL del texto');
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
    }
    
    // Si aún no tenemos imagen, puede que la respuesta no contenga imagen
    // o que el formato sea diferente. En ese caso, lanzamos error con información detallada.
    if (!imageBuffer) {
      console.error('[nanobanana-transformer] ❌ No se pudo extraer imagen de la respuesta');
      console.error('[nanobanana-transformer] ❌ Estructura de respuesta completa:', JSON.stringify(data, null, 2));
      console.error('[nanobanana-transformer] ❌ Response text length:', responseText.length);
      if (responseText.length > 0) {
        console.error('[nanobanana-transformer] ❌ Response text preview:', responseText.substring(0, 500));
      }
      console.error('[nanobanana-transformer] ❌ Files encontrados:', files ? JSON.stringify(files, null, 2) : 'ninguno');
      
      throw new Error(`No se pudo extraer imagen de la respuesta de Nano Banana. Response text length: ${responseText.length}, Files: ${files ? files.length : 0}. La respuesta puede no contener una imagen transformada o el formato es diferente al esperado. Revisa los logs para ver la estructura completa de la respuesta.`);
    }
    
    console.log('[nanobanana-transformer] 🍌 Transformación completada, tamaño:', imageBuffer.length, 'bytes');
    return imageBuffer;
    
  } catch (error) {
    console.error('[nanobanana-transformer] ❌ Error transformando imagen:', error.message);
    console.error('[nanobanana-transformer] Stack:', error.stack);
    throw error;
  }
}

