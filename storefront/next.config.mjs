/**
 * Configuracion del build de la tienda.
 *
 * `IMAGE_REMOTE_HOSTS` (T216-bis): hosts **ajenos** desde los que el ERP sirve las fotos
 * reales de una empresa, separados por comas (`cdn.tienda-a.com, fotos.tienda-a.com`). El
 * `next/image` solo optimiza imagenes de hosts declarados, asi que sin esta variable las
 * fotos reales de una tienda publicada no se pintan (el placeholder local si, porque es
 * propio). Los hosts de **marcador de posicion** del seed (`picsum.photos`, dato de
 * desarrollo declarado) se conservan: la tienda los trata como «sin foto» y dibuja su
 * placeholder de marca (D24).
 */

/** @type {import('next').NextConfig} */
const placeholderHosts = [
  { protocol: 'https', hostname: 'picsum.photos', pathname: '/**' },
  { protocol: 'https', hostname: 'fastly.picsum.photos', pathname: '/**' },
];

const configuredHosts = (process.env.IMAGE_REMOTE_HOSTS ?? '')
  .split(',')
  .map((host) => host.trim())
  .filter((host) => host !== '');

const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  images: {
    remotePatterns: [
      ...placeholderHosts,
      ...configuredHosts.map((hostname) => ({
        protocol: 'https',
        hostname,
        pathname: '/**',
      })),
    ],
    minimumCacheTTL: 3600,
    deviceSizes: [320, 420, 640, 768, 1024, 1280, 1600],
  },
};

export default nextConfig;
