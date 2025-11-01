// API endpoint para AdrianMoves: combina imagen PNG base + GIF animado
import path from 'path';
import fs from 'fs';
import { createCanvas, loadImage } from 'canvas';
import { Gif, GifFrame, BitmapImage, GifUtil } from 'gifwrap';

export default async function handler(req, res) {
  // Configurar CORS
  const allowedOrigins = [
    'https://adrianzero.com',
    'https://www.adrianzero.com',
    'https://adrianlab.vercel.app',
    'http://localhost:3000',
    'http://localhost:3001'
  ];
  
  const origin = req.headers.origin;
  if (origin && allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Extraer tokenId de la ruta, eliminando .gif si existe
    const { tokenId } = req.query;
    
    if (!tokenId) {
      return res.status(400).json({ error: 'Token ID requerido' });
    }
    
    const cleanTokenId = tokenId.toString().replace(/\.gif$/, '');
    
    if (!cleanTokenId || isNaN(parseInt(cleanTokenId))) {
      return res.status(400).json({ error: 'Token ID inválido' });
    }
    
    console.log(`[adrianmoves] 📥 Request recibido - tokenId original: ${tokenId}, limpio: ${cleanTokenId}`);
    
    console.log(`[adrianmoves] 🎬 Iniciando generación de GIF animado para token ${cleanTokenId}`);

    // ===== PASO 1: Obtener imagen PNG base del endpoint render =====
    console.log(`[adrianmoves] 📸 Obteniendo imagen PNG base...`);
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://adrianlab.vercel.app';
    const renderUrl = `${baseUrl}/api/render/${cleanTokenId}.png`;
    
    let baseImageBuffer;
    try {
      const renderResponse = await fetch(renderUrl);
      if (!renderResponse.ok) {
        throw new Error(`Error obteniendo imagen base: ${renderResponse.status}`);
      }
      const arrayBuffer = await renderResponse.arrayBuffer();
      baseImageBuffer = Buffer.from(arrayBuffer);
      console.log(`[adrianmoves] ✅ Imagen PNG base obtenida (${baseImageBuffer.length} bytes)`);
    } catch (error) {
      console.error(`[adrianmoves] ❌ Error obteniendo imagen base:`, error.message);
      return res.status(500).json({ 
        error: 'Error obteniendo imagen base',
        details: error.message 
      });
    }

    // Cargar imagen base en canvas
    const baseImage = await loadImage(baseImageBuffer);
    console.log(`[adrianmoves] ✅ Imagen base cargada: ${baseImage.width}x${baseImage.height}`);

    // ===== PASO 2: Cargar GIF de animación =====
    console.log(`[adrianmoves] 🎬 Cargando GIF de animación...`);
    const gifPath = path.join(process.cwd(), 'public', 'labimages', 'specials', '442.gif');
    
    if (!fs.existsSync(gifPath)) {
      console.error(`[adrianmoves] ❌ GIF no encontrado en: ${gifPath}`);
      return res.status(404).json({ 
        error: 'GIF de animación no encontrado',
        path: gifPath 
      });
    }

    let gifFrames;
    try {
      const gifBuffer = fs.readFileSync(gifPath);
      const gif = await GifUtil.read(gifBuffer);
      gifFrames = gif.frames;
      console.log(`[adrianmoves] ✅ GIF cargado: ${gifFrames.length} frames`);
    } catch (error) {
      console.error(`[adrianmoves] ❌ Error cargando GIF:`, error.message);
      return res.status(500).json({ 
        error: 'Error cargando GIF',
        details: error.message 
      });
    }

    // ===== PASO 3: Combinar cada frame del GIF con la imagen base =====
    console.log(`[adrianmoves] 🎨 Combinando frames...`);
    const outputFrames = [];
    const frameDelay = gifFrames[0] ? (gifFrames[0].delayCentisecs || 10) * 10 : 100; // ms

    for (let i = 0; i < gifFrames.length; i++) {
      const frame = gifFrames[i];
      console.log(`[adrianmoves] 🎬 Procesando frame ${i + 1}/${gifFrames.length}...`);

      // Crear canvas del tamaño de la imagen base (1000x1000)
      const combinedCanvas = createCanvas(1000, 1000);
      const ctx = combinedCanvas.getContext('2d');

      // Dibujar imagen base
      ctx.drawImage(baseImage, 0, 0, 1000, 1000);

      // Convertir frame del GIF a imagen para canvas
      // gifwrap usa formato Jimp bitmap
      const frameBitmap = frame.bitmap;
      
      // Crear canvas temporal para el frame
      const frameCanvas = createCanvas(frameBitmap.width, frameBitmap.height);
      const frameCtx = frameCanvas.getContext('2d');
      
      // Obtener datos de imagen del frame (Jimp bitmap.data es un Buffer)
      const imageData = frameCtx.createImageData(frameBitmap.width, frameBitmap.height);
      const data = imageData.data;
      
      // Jimp bitmap.data ya está en formato RGBA
      const frameData = frameBitmap.data;
      for (let j = 0; j < data.length && j < frameData.length; j++) {
        data[j] = frameData[j];
      }
      
      frameCtx.putImageData(imageData, 0, 0);
      
      // Convertir canvas a imagen para poder escalarla
      const frameImageData = frameCanvas.toBuffer('image/png');
      const frameImage = await loadImage(frameImageData);

      // Dibujar frame del GIF reducido al 50% centrado
      const scaledWidth = frameBitmap.width * 0.5;
      const scaledHeight = frameBitmap.height * 0.5;
      const x = (1000 - scaledWidth) / 2;
      const y = (1000 - scaledHeight) / 2;
      
      ctx.drawImage(frameImage, x, y, scaledWidth, scaledHeight);

      // Convertir canvas combinado a bitmap para el nuevo GIF
      // Obtener ImageData del canvas combinado
      const combinedImageData = ctx.getImageData(0, 0, 1000, 1000);
      const pixelData = combinedImageData.data;
      
      // Crear bitmap compatible con gifwrap directamente desde ImageData
      // BitmapImage espera un objeto con: width, height, data (Buffer en formato RGBA)
      // ImageData.data es Uint8ClampedArray, necesitamos convertirlo a Buffer
      const bitmapData = Buffer.from(pixelData);
      const combinedBitmap = new BitmapImage({
        width: 1000,
        height: 1000,
        data: bitmapData
      });
      
      // Crear nuevo frame con el delay original
      const delayCentisecs = frame.delayCentisecs || 10;
      const newFrame = new GifFrame(delayCentisecs, combinedBitmap);
      outputFrames.push(newFrame);
    }

    // ===== PASO 4: Generar GIF final =====
    console.log(`[adrianmoves] 🎬 Generando GIF final con ${outputFrames.length} frames...`);
    
    try {
      const outputGif = new Gif(outputFrames, {
        loops: 0, // Loop infinito
        colorScope: Gif.ColorScope.DEFAULT
      });
      
      const gifBuffer = await GifUtil.write(outputGif);
      console.log(`[adrianmoves] ✅ GIF generado exitosamente (${gifBuffer.length} bytes)`);

      // Configurar headers
      res.setHeader('Content-Type', 'image/gif');
      res.setHeader('Content-Length', gifBuffer.length);
      res.setHeader('Cache-Control', 'public, max-age=3600');
      res.setHeader('X-Version', 'ADRIANMOVES-v1');
      res.setHeader('X-Frame-Count', outputFrames.length.toString());
      res.setHeader('X-Frame-Delay', `${frameDelay}ms`);

      return res.status(200).send(gifBuffer);

    } catch (error) {
      console.error(`[adrianmoves] ❌ Error generando GIF:`, error.message);
      return res.status(500).json({ 
        error: 'Error generando GIF',
        details: error.message 
      });
    }

  } catch (error) {
    console.error(`[adrianmoves] ❌ Error general:`, error);
    return res.status(500).json({ 
      error: 'Error general',
      details: error.message 
    });
  }
}

