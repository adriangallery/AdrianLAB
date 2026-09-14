import fs from 'fs';
import { Resvg } from '@resvg/resvg-js';
const which = process.argv[2];
const svg = fs.readFileSync('preview-card-v2.svg', 'utf8');
const variants = {
  full: svg,
  noImg: svg.replace(/<image[^>]*\/>/g, ''),
  noImgPoly: svg.replace(/<image[^>]*\/>/g, '').replace(/<polygon[^/]*\/>/g, ''),
  noImgPolyPath: svg.replace(/<image[^>]*\/>/g, '').replace(/<polygon[^/]*\/>/g, '').replace(/<path[^/]*\/>/g, ''),
  trivial: '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect width="100" height="100" fill="red"/></svg>',
};
const s = variants[which];
console.log('len', s.length);
const png = new Resvg(s, { fitTo: { mode: 'width', value: 768 } }).render().asPng();
console.log(which, 'OK', png.length);
