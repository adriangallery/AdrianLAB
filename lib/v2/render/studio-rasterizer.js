// ============================================
// Studio T-Shit pixel-perfect rasteriser
// ============================================
//
// Studio V2 SVGs embed the t-shirt template as a 148×148 PNG via <image>
// and draw the user's design with <rect>. If we just hand the SVG to Resvg,
// the embedded raster gets bilinearly interpolated when scaled 148→1000 and
// the t-shirt comes out blurry while the vector text stays crisp.
//
// This helper splits the two layers: the embedded PNG is upscaled with
// canvas nearest-neighbor (preserves pixel-art), the rest of the SVG is
// rendered through Resvg as vectors (already crisp), and the two are
// composed in a single 1000×1000 PNG.

import { createCanvas, loadImage } from 'canvas';
import { Resvg } from '@resvg/resvg-js';

const TARGET_SIZE = 1000;
const EMBEDDED_IMAGE_RE = /<image[^>]*href="(data:image\/png;base64,[^"]+)"[^/]*\/>/;

/**
 * Rasterise a Studio V2 SVG to a pixel-perfect 1000×1000 PNG buffer.
 * @param {Buffer|string} svgInput - The SVG bytes or text.
 * @returns {Promise<Buffer>} The composed PNG.
 */
export async function rasteriseStudioSvg(svgInput) {
  const svgText = Buffer.isBuffer(svgInput) ? svgInput.toString('utf8') : svgInput;
  const imgMatch = svgText.match(EMBEDDED_IMAGE_RE);

  const canvas = createCanvas(TARGET_SIZE, TARGET_SIZE);
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;

  if (imgMatch) {
    const tpl = await loadImage(imgMatch[1]);
    ctx.drawImage(tpl, 0, 0, TARGET_SIZE, TARGET_SIZE);
  }

  // Render the rest of the SVG (vector rects, text glyphs) on a transparent
  // background. Resvg handles vectors fine; the embedded <image> we already
  // drew is stripped out so the layer is overlay-only.
  const overlaySvg = imgMatch ? svgText.replace(imgMatch[0], '') : svgText;
  const overlayPng = new Resvg(overlaySvg, {
    fitTo: { mode: 'width', value: TARGET_SIZE },
  }).render().asPng();
  const overlayImg = await loadImage(overlayPng);
  ctx.drawImage(overlayImg, 0, 0, TARGET_SIZE, TARGET_SIZE);

  return canvas.toBuffer('image/png');
}
