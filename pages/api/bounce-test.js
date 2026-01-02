/**
 * Endpoint simplificado para probar bounce animation
 * Separado del builder complejo para evitar conflictos
 */

import { Resvg } from '@resvg/resvg-js';
import { createCanvas, loadImage } from 'canvas';
import { calculateBounceWithDelay } from '../../lib/animation-helpers.js';
import { generateGifFromLayers } from '../../lib/gif-generator.js';

export default async function handler(req, res) {
  try {
    const {
      base = 'medium',
      fixed = '',
      bounceDir = 'y',
      bounceDist = 50,
      bounceCount = 3,
      bounceFrames = 12,
      bounceDelay = 2,
      width = 400,
      height = 400
    } = req.query;

    const isBounce = req.query.bounce === 'true';
    
    if (!isBounce) {
      return res.status(400).json({ error: 'bounce=true is required' });
    }

    const fixedIds = fixed ? fixed.split(',').map(id => id.trim()).filter(id => id) : [];
    
    if (fixedIds.length === 0) {
      return res.status(400).json({ error: 'At least one fixed trait is required' });
    }

    const bounceConfig = {
      enabled: true,
      direction: bounceDir,
      distance: parseFloat(bounceDist) || 50,
      bounces: parseInt(bounceCount) || 3,
      frames: parseInt(bounceFrames) || 12,
      delay: parseInt(bounceDelay) || 2
    };

    const totalFrames = parseInt(bounceFrames) || 12;
    const canvasWidth = parseInt(width) || 400;
    const canvasHeight = parseInt(height) || 400;

    console.log(`[bounce-test] Generando GIF con bounce:`);
    console.log(`[bounce-test] - Base: ${base}`);
    console.log(`[bounce-test] - Fixed traits: ${fixedIds.join(', ')}`);
    console.log(`[bounce-test] - Bounce config:`, bounceConfig);
    console.log(`[bounce-test] - Total frames: ${totalFrames}`);

    // Mapeo de skins base a sus rutas
    const baseSkinMap = {
      'medium': '/labimages/ADRIAN/GEN0-Medium.svg',
      'zero': '/labimages/ADRIAN/GEN0-Medium.svg',
      'dark': '/labimages/ADRIAN/GEN0-Dark.svg',
      'darkadrian': '/labimages/ADRIAN/GEN0-Dark.svg',
      'alien': '/labimages/ADRIAN/GEN0-Alien.svg',
      'albino': '/labimages/ADRIAN/GEN0-Albino.svg',
      'blankmannequin': '/labimages/blankmannequin.svg',
      'mannequin': '/labimages/mannequin.svg'
    };

    // Función para convertir SVG a PNG
    const svgToPng = async (id, w = canvasWidth) => {
      const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://adrianlab.vercel.app';
      let url;
      
      // Mapear skins base a sus rutas correctas
      if (baseSkinMap[id]) {
        url = `${baseUrl}${baseSkinMap[id]}`;
      } else {
        // Traits normales
        url = `${baseUrl}/labimages/${id}.svg`;
      }
      
      console.log(`[bounce-test] Cargando: ${url}`);
      
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Failed to load ${id}: ${response.status} (${url})`);
      }
      
      const svgContent = await response.text();
      const resvg = new Resvg(Buffer.from(svgContent), {
        fitTo: { mode: 'width', value: w },
        background: 'rgba(255, 255, 255, 0)'
      });
      
      return resvg.render().asPng();
    };

    // Pre-cargar todas las imágenes
    const basePng = base ? await svgToPng(base, canvasWidth) : null;
    const fixedPngs = await Promise.all(
      fixedIds.map(id => svgToPng(id, canvasWidth))
    );

    // Crear customFrameGenerator que aplica bounce por capas
    const customFrameGenerator = async (frameIndex, totalFrames) => {
      const layers = [];
      
      // 1. Base/Skin - con bounce SIN delay
      if (basePng) {
        const bounceTransform = calculateBounceWithDelay(
          frameIndex,
          totalFrames,
          bounceConfig.direction,
          bounceConfig.distance,
          bounceConfig.bounces,
          0 // Sin delay para skin
        );
        
        layers.push({
          pngBuffer: basePng,
          transform: bounceTransform
        });
      }
      
      // 2. Fixed traits - con bounce CON delay
      for (let i = 0; i < fixedIds.length; i++) {
        const bounceTransform = calculateBounceWithDelay(
          frameIndex,
          totalFrames,
          bounceConfig.direction,
          bounceConfig.distance,
          bounceConfig.bounces,
          bounceConfig.delay // Delay para traits
        );
        
        layers.push({
          pngBuffer: fixedPngs[i],
          transform: bounceTransform
        });
      }
      
      // Componer todas las capas
      const canvas = createCanvas(canvasWidth, canvasHeight);
      const ctx = canvas.getContext('2d');
      
      for (const layer of layers) {
        const img = await loadImage(layer.pngBuffer);
        
        if (layer.transform) {
          const { x = 0, y = 0, scale = 1, rotation = 0 } = layer.transform;
          
          ctx.save();
          ctx.translate(canvasWidth / 2 + x, canvasHeight / 2 + y);
          
          if (rotation !== 0) {
            ctx.rotate(rotation * Math.PI / 180);
          }
          
          if (scale !== 1) {
            ctx.scale(scale, scale);
          }
          
          ctx.drawImage(img, -canvasWidth / 2, -canvasHeight / 2, canvasWidth, canvasHeight);
          ctx.restore();
        } else {
          ctx.drawImage(img, 0, 0, canvasWidth, canvasHeight);
        }
      }
      
      return {
        pngBuffer: canvas.toBuffer('image/png'),
        delay: 500
      };
    };

    // Generar GIF usando generateGifFromLayers
    const gifBuffer = await generateGifFromLayers({
      stableLayers: [],
      animatedTraits: [],
      width: canvasWidth,
      height: canvasHeight,
      delay: 500,
      customFrameGenerator: customFrameGenerator
    });

    console.log(`[bounce-test] GIF generado: ${gifBuffer.length} bytes`);

    res.setHeader('Content-Type', 'image/gif');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.setHeader('X-Bounce', 'enabled');
    res.status(200).send(gifBuffer);

  } catch (error) {
    console.error('[bounce-test] Error:', error);
    res.status(500).json({ 
      error: 'Error generating bounce GIF',
      message: error.message,
      stack: error.stack
    });
  }
}

