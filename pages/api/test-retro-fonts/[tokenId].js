import { Resvg } from '@resvg/resvg-js';
import path from 'path';
import fs from 'fs';
import { textToSVGElement } from '../../../../lib/text-to-svg.js';

export default async function handler(req, res) {
  try {
    let { tokenId } = req.query;
    
    if (tokenId && tokenId.endsWith('.png')) {
      tokenId = tokenId.replace('.png', '');
    }
    
    if (!tokenId || isNaN(parseInt(tokenId))) {
      return res.status(400).json({ error: 'Invalid token ID' });
    }

    console.log(`[test-retro-fonts] ===== TEST FUENTES RETRO =====`);
    console.log(`[test-retro-fonts] Token ID: ${tokenId}`);

    // Función para crear SVG con una fuente específica
    function createSVGWithFont(fontPath, fontName) {
      try {
        const TextToSVG = require('text-to-svg');
        const instance = TextToSVG.loadSync(fontPath);
        
        const rarityTag = instance.getPath('LEGENDARY', {
          fontSize: 16,
          anchor: 'center middle'
        });
        
        const traitName = instance.getPath('DARK MODE', {
          fontSize: 48,
          anchor: 'center middle'
        });
        
        const category = instance.getPath('CATEGORY: Background', {
          fontSize: 24,
          anchor: 'start middle'
        });
        
        const maxSupply = instance.getPath('MAX SUPPLY: 15', {
          fontSize: 24,
          anchor: 'start middle'
        });
        
        const floppy = instance.getPath('FLOPPY: OG', {
          fontSize: 24,
          anchor: 'start middle'
        });
        
        const adrian = instance.getPath('Adrian', {
          fontSize: 32,
          anchor: 'end'
        });
        
        const lab = instance.getPath('LAB', {
          fontSize: 32,
          anchor: 'end'
        });
        
        // Extraer solo los datos del path
        const extractPath = (pathData) => {
          const match = pathData.match(/d="([^"]+)"/);
          return match ? match[1] : '';
        };
        
        return `
          <svg width="768" height="1024" xmlns="http://www.w3.org/2000/svg">
            <!-- Fondo principal -->
            <rect width="768" height="1024" fill="#ffffff"/>
            
            <!-- Contenedor de imagen con fondo dinámico -->
            <rect x="84" y="120" width="600" height="600" fill="#ffd70020"/>
            
            <!-- Tag de rareza -->
            <rect x="84" y="120" width="160" height="60" fill="#ffd700"/>
            <g transform="translate(164, 150)">
              <path d="${extractPath(rarityTag)}" fill="#ffffff"/>
            </g>
            
            <!-- Nombre del trait -->
            <rect x="84" y="760" width="600" height="80" fill="#0f4e6d"/>
            <g transform="translate(384, 800)">
              <path d="${extractPath(traitName)}" fill="#ffffff"/>
            </g>
            
            <!-- Datos del trait -->
            <g transform="translate(94, 880)">
              <path d="${extractPath(category)}" fill="#333333"/>
            </g>
            <g transform="translate(94, 915)">
              <path d="${extractPath(maxSupply)}" fill="#333333"/>
            </g>
            <g transform="translate(94, 950)">
              <path d="${extractPath(floppy)}" fill="#333333"/>
            </g>
            
            <!-- Logo AdrianLAB -->
            <g transform="translate(674, 950)">
              <path d="${extractPath(adrian)}" fill="#333333"/>
            </g>
            <g transform="translate(674, 985)">
              <path d="${extractPath(lab)}" fill="#ff69b4"/>
            </g>
            
            <!-- Título de la fuente -->
            <text x="384" y="50" font-family="Arial" font-size="24" text-anchor="middle" fill="#333333">${fontName}</text>
          </svg>
        `;
      } catch (error) {
        console.error(`[test-retro-fonts] Error con fuente ${fontName}:`, error);
        return `
          <svg width="768" height="1024" xmlns="http://www.w3.org/2000/svg">
            <rect width="768" height="1024" fill="#ffffff"/>
            <text x="384" y="512" font-family="Arial" font-size="24" text-anchor="middle" fill="#ff0000">Error con ${fontName}</text>
          </svg>
        `;
      }
    }

    // Crear SVGs con diferentes fuentes
    const fontTests = [
      {
        name: "VT323 (Terminal Retro)",
        path: path.join(process.cwd(), 'public', 'fonts', 'retro', 'VT323-Regular.ttf')
      },
      {
        name: "Press Start 2P (Pixel Retro)",
        path: path.join(process.cwd(), 'public', 'fonts', 'retro', 'PressStart2P-Regular.ttf')
      },
      {
        name: "Courier Prime (Máquina de Escribir)",
        path: path.join(process.cwd(), 'public', 'fonts', 'retro', 'CourierPrime-Regular.ttf')
      }
    ];

    const svgs = fontTests.map(font => ({
      name: font.name,
      svg: createSVGWithFont(font.path, font.name)
    }));

    // Crear SVG combinado
    const combinedSvg = `
      <svg width="768" height="3072" xmlns="http://www.w3.org/2000/svg">
        <rect width="768" height="3072" fill="#ffffff"/>
        
        <!-- VT323 -->
        <g transform="translate(0, 0)">
          ${svgs[0].svg.replace(/<svg[^>]*>/, '').replace(/<\/svg>/, '')}
        </g>
        
        <!-- Press Start 2P -->
        <g transform="translate(0, 1024)">
          ${svgs[1].svg.replace(/<svg[^>]*>/, '').replace(/<\/svg>/, '')}
        </g>
        
        <!-- Courier Prime -->
        <g transform="translate(0, 2048)">
          ${svgs[2].svg.replace(/<svg[^>]*>/, '').replace(/<\/svg>/, '')}
        </g>
        
        <!-- Leyenda -->
        <text x="384" y="30" font-family="Arial" font-size="20" text-anchor="middle" fill="#333333">COMPARACIÓN DE FUENTES RETRO</text>
      </svg>
    `;

    console.log(`[test-retro-fonts] SVG combinado generado`);

    try {
      // Renderizar SVG a PNG
      const resvg = new Resvg(Buffer.from(combinedSvg), {
        fitTo: {
          mode: 'width',
          value: 768
        }
      });
      
      const pngBuffer = resvg.render().asPng();
      console.log(`[test-retro-fonts] PNG generado, tamaño: ${pngBuffer.length} bytes`);

      // Configurar headers
      res.setHeader('Content-Type', 'image/png');
      res.setHeader('Cache-Control', 'public, max-age=3600');
      
      // Devolver imagen
      res.status(200).send(pngBuffer);
      
    } catch (error) {
      console.error('[test-retro-fonts] Error renderizando PNG:', error);
      res.status(500).json({ error: 'Error renderizando imagen' });
    }
    
  } catch (error) {
    console.error('[test-retro-fonts] Error:', error);
    res.status(500).json({ error: 'Error interno del servidor', details: error.message });
  }
} 