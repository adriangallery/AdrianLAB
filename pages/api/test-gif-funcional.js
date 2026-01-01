import { Resvg } from '@resvg/resvg-js';
import { GifFrame, BitmapImage, GifCodec, GifUtil } from 'gifwrap';
import { PNG } from 'pngjs';
import sharp from 'sharp';
import GifEncoder from 'gif-encoder-2';
import { createCanvas, loadImage } from 'canvas';

/**
 * Enfoque A: gifwrap con Resvg
 * Reutiliza el stack actual pero simplificado
 */
async function generateGifWithGifwrap(svgIds, delay) {
  console.log(`[test-gif-simple] [GIFWRAP] Iniciando generación con ${svgIds.length} SVGs`);
  const frames = [];
  
  // 1. Cargar y convertir cada SVG a PNG
  for (let i = 0; i < svgIds.length; i++) {
    const id = svgIds[i];
    console.log(`[test-gif-simple] [GIFWRAP] Cargando SVG ${i + 1}/${svgIds.length}: ${id}`);
    
    const url = `https://adrianlab.vercel.app/labimages/${id}.svg`;
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`Failed to load SVG ${id}: ${response.status}`);
    }
    
    const svgContent = await response.text();
    console.log(`[test-gif-simple] [GIFWRAP] SVG ${id} cargado, tamaño: ${svgContent.length} bytes`);
    
    // Resvg: SVG → PNG
    const resvg = new Resvg(Buffer.from(svgContent), {
      fitTo: { mode: 'width', value: 400 }
    });
    const pngBuffer = resvg.render().asPng();
    console.log(`[test-gif-simple] [GIFWRAP] PNG ${id} generado, tamaño: ${pngBuffer.length} bytes`);
    
    frames.push(pngBuffer);
  }
  
  // 2. Convertir PNG → GifFrame
  console.log(`[test-gif-simple] [GIFWRAP] Convirtiendo ${frames.length} PNGs a GifFrames...`);
  const gifFrames = [];
  const delayCentisecs = Math.round(delay / 10);
  
  for (let i = 0; i < frames.length; i++) {
    const pngBuffer = frames[i];
    
    // Parsear PNG con pngjs
    const pngImage = PNG.sync.read(pngBuffer);
    console.log(`[test-gif-simple] [GIFWRAP] Frame ${i + 1}: ${pngImage.width}x${pngImage.height}`);
    
    // Crear BitmapImage
    const bitmapImage = new BitmapImage({
      width: pngImage.width,
      height: pngImage.height,
      data: pngImage.data
    });
    
    // Crear GifFrame
    const gifFrame = new GifFrame(bitmapImage, { delayCentisecs });
    gifFrames.push(gifFrame);
  }
  
  // 3. Cuantizar colores a 256
  console.log(`[test-gif-simple] [GIFWRAP] Cuantizando ${gifFrames.length} frames a 256 colores...`);
  GifUtil.quantizeSorokin(gifFrames, 256);
  console.log(`[test-gif-simple] [GIFWRAP] Cuantización completada`);
  
  // 4. Generar GIF
  console.log(`[test-gif-simple] [GIFWRAP] Generando GIF...`);
  const codec = new GifCodec();
  const outputGif = await codec.encodeGif(gifFrames, { loops: 0 });
  
  console.log(`[test-gif-simple] [GIFWRAP] GIF generado exitosamente: ${outputGif.buffer.length} bytes`);
  return outputGif.buffer;
}

/**
 * Enfoque B: sharp + gif-encoder-2
 * Implementación moderna y optimizada
 */
async function generateGifWithSharp(svgIds, delay) {
  console.log(`[test-gif-simple] [SHARP] Iniciando generación con ${svgIds.length} SVGs`);
  const width = 400;
  const height = 400;
  
  // 1. Inicializar encoder
  const encoder = new GifEncoder(width, height);
  encoder.start();
  encoder.setRepeat(0);   // Loop infinito
  encoder.setDelay(delay);
  encoder.setQuality(10); // 1-20, menor = mejor calidad
  
  console.log(`[test-gif-simple] [SHARP] Encoder inicializado: ${width}x${height}, delay: ${delay}ms`);
  
  // 2. Cargar y procesar cada SVG
  for (let i = 0; i < svgIds.length; i++) {
    const id = svgIds[i];
    console.log(`[test-gif-simple] [SHARP] Procesando SVG ${i + 1}/${svgIds.length}: ${id}`);
    
    const url = `https://adrianlab.vercel.app/labimages/${id}.svg`;
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`Failed to load SVG ${id}: ${response.status}`);
    }
    
    const svgBuffer = await response.arrayBuffer();
    console.log(`[test-gif-simple] [SHARP] SVG ${id} cargado, tamaño: ${svgBuffer.byteLength} bytes`);
    
    // sharp: SVG → PNG con dimensiones exactas
    const pngBuffer = await sharp(Buffer.from(svgBuffer))
      .resize(width, height, { 
        fit: 'contain', 
        background: { r: 255, g: 255, b: 255, alpha: 1 }
      })
      .png()
      .toBuffer();
    
    console.log(`[test-gif-simple] [SHARP] PNG ${id} generado, tamaño: ${pngBuffer.length} bytes`);
    
    // Cargar en canvas para obtener ImageData
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');
    const img = await loadImage(pngBuffer);
    ctx.drawImage(img, 0, 0);
    
    // Agregar frame al encoder
    const imageData = ctx.getImageData(0, 0, width, height);
    encoder.addFrame(imageData.data);
    console.log(`[test-gif-simple] [SHARP] Frame ${i + 1} agregado al encoder`);
  }
  
  // 3. Finalizar y obtener buffer
  console.log(`[test-gif-simple] [SHARP] Finalizando encoder...`);
  encoder.finish();
  const gifBuffer = encoder.out.getData();
  
  console.log(`[test-gif-simple] [SHARP] GIF generado exitosamente: ${gifBuffer.length} bytes`);
  return gifBuffer;
}

/**
 * Handler principal del endpoint
 */
export default async function handler(req, res) {
  const startTime = Date.now();
  
  try {
    // Parsear parámetros
    const { 
      method = 'gifwrap', 
      svgs = '32,870,1028', 
      delay = '500' 
    } = req.query;
    
    const svgIds = svgs.split(',').map(id => id.trim());
    const delayMs = parseInt(delay);
    
    // Validaciones básicas
    if (svgIds.length < 2) {
      return res.status(400).json({ 
        error: 'Se requieren al menos 2 SVGs',
        usage: '/api/test-gif-simple?method=gifwrap&svgs=32,870,1028&delay=500'
      });
    }
    
    if (svgIds.length > 10) {
      return res.status(400).json({ 
        error: 'Máximo 10 SVGs permitidos',
        usage: '/api/test-gif-simple?method=gifwrap&svgs=32,870,1028&delay=500'
      });
    }
    
    if (delayMs < 10 || delayMs > 5000) {
      return res.status(400).json({ 
        error: 'Delay debe estar entre 10 y 5000 ms',
        usage: '/api/test-gif-simple?method=gifwrap&svgs=32,870,1028&delay=500'
      });
    }
    
    if (!['gifwrap', 'sharp'].includes(method)) {
      return res.status(400).json({ 
        error: 'Método debe ser "gifwrap" o "sharp"',
        usage: '/api/test-gif-simple?method=gifwrap&svgs=32,870,1028&delay=500'
      });
    }
    
    console.log(`[test-gif-simple] ========================================`);
    console.log(`[test-gif-simple] Request recibido:`);
    console.log(`[test-gif-simple] - Método: ${method}`);
    console.log(`[test-gif-simple] - SVGs: [${svgIds.join(', ')}]`);
    console.log(`[test-gif-simple] - Delay: ${delayMs}ms`);
    console.log(`[test-gif-simple] ========================================`);
    
    // Generar GIF según el método elegido
    let gifBuffer;
    
    if (method === 'sharp') {
      gifBuffer = await generateGifWithSharp(svgIds, delayMs);
    } else {
      gifBuffer = await generateGifWithGifwrap(svgIds, delayMs);
    }
    
    const duration = Date.now() - startTime;
    
    console.log(`[test-gif-simple] ========================================`);
    console.log(`[test-gif-simple] ✅ GIF generado exitosamente`);
    console.log(`[test-gif-simple] - Método: ${method}`);
    console.log(`[test-gif-simple] - Duración: ${duration}ms`);
    console.log(`[test-gif-simple] - Tamaño: ${gifBuffer.length} bytes (${(gifBuffer.length / 1024).toFixed(2)} KB)`);
    console.log(`[test-gif-simple] - Frames: ${svgIds.length}`);
    console.log(`[test-gif-simple] ========================================`);
    
    // Configurar headers
    res.setHeader('Content-Type', 'image/gif');
    res.setHeader('Content-Length', gifBuffer.length);
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.setHeader('X-Method', method);
    res.setHeader('X-Duration-Ms', duration.toString());
    res.setHeader('X-Size-Bytes', gifBuffer.length.toString());
    res.setHeader('X-Size-KB', (gifBuffer.length / 1024).toFixed(2));
    res.setHeader('X-Frame-Count', svgIds.length.toString());
    res.setHeader('X-Frame-Delay-Ms', delayMs.toString());
    
    return res.status(200).send(gifBuffer);
    
  } catch (error) {
    const duration = Date.now() - startTime;
    
    console.error('[test-gif-simple] ❌ ERROR:', error);
    console.error('[test-gif-simple] Stack:', error.stack);
    console.error(`[test-gif-simple] Duración hasta error: ${duration}ms`);
    
    return res.status(500).json({ 
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      duration: `${duration}ms`
    });
  }
}

