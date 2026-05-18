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
  async rewrites() {
    return [
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
    ]
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