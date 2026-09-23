/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  images: {
    // Las imagenes del seed del ERP son marcadores de posicion de picsum.photos
    // (dato de desarrollo declarado). picsum redirige a fastly.picsum.photos.
    remotePatterns: [
      { protocol: 'https', hostname: 'picsum.photos', pathname: '/**' },
      { protocol: 'https', hostname: 'fastly.picsum.photos', pathname: '/**' },
    ],
    minimumCacheTTL: 3600,
    deviceSizes: [320, 420, 640, 768, 1024, 1280, 1600],
  },
};

export default nextConfig;
