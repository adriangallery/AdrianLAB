/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    domains: []
  },
  // Keep historical render snapshots in /public (served via CDN) but out of
  // each serverless function bundle — they push the lambda over Vercel's
  // 250 MB uncompressed limit when many GIF auto-uploads accumulate.
  experimental: {
    outputFileTracingExcludes: {
      '*': [
        'public/rendered-toggles/**',
        'public/rendered-traits/**',
      ],
    },
    // Force-include directories that are read via dynamic process.cwd() paths
    // (Next's Node File Tracer can't follow those statically).
    outputFileTracingIncludes: {
      '/api/**': [
        'public/labmetadata/**',
        'public/labimages/ogpunks/**',
        'public/fonts/**',
      ],
    },
  },
  // L2 (plan AdrianZERO 2026-09): la metadata de traits/floppies tiene UNA fuente, la que devuelve
  // uri() de AdrianTraitsCore (/api/metadata/floppy/<id>.json). Las rutas duplicadas antiguas
  // redirigen ahí en vez de servir otro payload con URLs de un deploy concreto (VERCEL_URL).
  async redirects() {
    return [
      { source: '/api/floppy/metadata/:id(\\d+).json', destination: '/api/metadata/floppy/:id.json', permanent: true },
      { source: '/api/floppy/metadata/:id(\\d+)', destination: '/api/metadata/floppy/:id.json', permanent: true },
      { source: '/api/trait/metadata/:id(\\d+).json', destination: '/api/metadata/floppy/:id.json', permanent: true },
      { source: '/api/trait/metadata/:id(\\d+)', destination: '/api/metadata/floppy/:id.json', permanent: true },
    ]
  },
  async rewrites() {
    // Mudanza de ZERO al mini, fase 2: en Vercel la metadata se reenvía al mini (lab.adrianzero.com) sin
    // tocar las URLs on-chain. Solo en el build de Vercel (VERCEL=1): el mini construye sin esa variable y
    // así nunca se reenvía a sí mismo. Interruptor de emergencia: LAB_METADATA_ON_MINI=0 y redeploy.
    // Fase 3: los renders (/api/render/*, a donde apunta el `image` de la metadata) también salen del mini.
    // Interruptor propio: LAB_RENDER_ON_MINI=0 y redeploy.
    const onVercel = process.env.VERCEL === '1'
    const metadataOnMini = onVercel && process.env.LAB_METADATA_ON_MINI !== '0'
    const renderOnMini = onVercel && process.env.LAB_RENDER_ON_MINI !== '0'
    const beforeFiles = [
      ...(metadataOnMini ? [{ source: '/api/metadata/:path*', destination: 'https://lab.adrianzero.com/api/metadata/:path*' }] : []),
      ...(renderOnMini ? [{ source: '/api/render/:path*', destination: 'https://lab.adrianzero.com/api/render/:path*' }] : []),
      // Render v2 (ZEROmovies S1/S2: el v1 redirige ahí con una URL relativa, y la usa el TraitLab)
      ...(renderOnMini ? [{ source: '/api/v2/render/:path*', destination: 'https://lab.adrianzero.com/api/v2/render/:path*' }] : []),
    ]
    return { beforeFiles, afterFiles: [
      {
        source: '/metadata/:path*',
        destination: '/metadata/:path*.json'
      },
      // custom-external stays on V1 (has working GIF animated trait pipeline)
      { source: '/api/render/custom-external/:path*', destination: '/api/render/custom-external/:path*' },
      // Floppy metadata stays on V1 (handles .json extension, traits 1-9999, floppies, serums, packs)
      { source: '/api/metadata/floppy/:id.json', destination: '/api/metadata/floppy/:id.json' },
      { source: '/api/metadata/floppy/:id', destination: '/api/metadata/floppy/:id' },
      // [C2-Fase5 2026-05-18] /api/metadata → v1 canonical. ZEROmovies S1/S2 ported.
      // v2 still accessible directly at /api/v2/metadata for emergency comparison.
      // V1 render is canonical — no catch-all redirect to v2.
      // All /api/render/* paths are served by v1 (pages/api/render/).
      // The v2 render endpoint (/api/v2/render/*) is still accessible directly.
    ] }
  },
  webpack(config) {
    config.module.rules.push({
      test: /\.(ttf|otf|woff|woff2)$/,
      type: 'asset/resource'
    });
    // Asegurar que los archivos JSON se resuelvan correctamente
    config.resolve.extensionAlias = {
      '.js': ['.js', '.ts', '.tsx'],
      '.json': ['.json']
    };
    return config;
  }
}

export default nextConfig; 