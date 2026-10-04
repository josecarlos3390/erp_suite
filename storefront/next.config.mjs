/**
 * Configuracion del build de la tienda.
 *
 * `IMAGE_REMOTE_HOSTS` (T216-bis): hosts **ajenos** desde los que el ERP sirve las fotos
 * reales de una empresa, separados por comas (`cdn.tienda-a.com, fotos.tienda-a.com`). El
 * `next/image` solo optimiza imagenes de hosts declarados, asi que sin esta variable las
 * fotos reales de una tienda publicada no se pintan (el placeholder local si, porque es
 * propio). Los hosts de **marcador de posicion** del seed (`picsum.photos`,
 * `fastly.picsum.photos`, `placehold.co`, dato de desarrollo declarado en
 * `PLACEHOLDER_HOSTS` de `src/lib/media.ts`) se conservan: la tienda los trata como «sin
 * foto» y dibuja su placeholder de marca (D24) — **salvo** en modo demostracion
 * (`STOREFRONT_SHOW_PLACEHOLDERS`, que esta encendido en produccion), donde se pintan como
 * fotos y el optimizador los necesita declarados: `placehold.co` faltaba aqui y la imagen
 * salia rota (defecto medido el 2026-10-02: el codigo listaba **3** hosts y este archivo
 * declaraba **2**). La divergencia entre las dos listas la sujeta el caso «todo host de
 * relleno esta declarado en los remotePatterns» de `e2e/media.spec.ts`, que **importa** las
 * dos (esto no se puede comprobar a ojo).
 */

/** @type {import('next').NextConfig} */
const placeholderHosts = [
  { protocol: 'https', hostname: 'picsum.photos', pathname: '/**' },
  { protocol: 'https', hostname: 'fastly.picsum.photos', pathname: '/**' },
  // `placehold.co`: el tercer host de `PLACEHOLDER_HOSTS` (marcadores del CMS y de las
  // paginas); sin declararlo, en modo demostracion el optimizador responde 400 «"url"
  // parameter is not allowed» y la imagen se ve rota en vez de pintarse (medido).
  // **Ojo, medido y declarado** (2026-10-02): declarar el host es **necesario y no
  // suficiente** para este host — `https://placehold.co/800x800` sirve **SVG**
  // (`content-type: image/svg+xml`) y el optimizador lo rechaza igual («"url" parameter is
  // valid but image type is not allowed»); con la extension (`/800x800.png`, `image/png`)
  // responde **200**. Servir SVG exigiria `dangerouslyAllowSVG` + `contentSecurityPolicy`
  // (una decision de seguridad que **no** se toma aqui) o que el CMS publique la URL con
  // formato. Hoy nada publica `placehold.co`: el relleno del seed es `picsum.photos`
  // (PNG/JPEG) y este host esta en la lista de reglas desde D24.
  { protocol: 'https', hostname: 'placehold.co', pathname: '/**' },
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
