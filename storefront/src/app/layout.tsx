import type { Metadata } from 'next';
import type { ReactNode } from 'react';

import { CartHydration } from '@/components/cart-hydration';
import { ShowPlaceholdersProvider } from '@/components/show-placeholders';
import { SiteFooter } from '@/components/site-footer';
import { SiteHeader } from '@/components/site-header';
import { ThemeScript } from '@/components/theme-toggle';
import { currentChannelOrDefault } from '@/lib/channels';
import { showPlaceholderImages } from '@/lib/show-placeholders';

import './globals.css';

function metadataBaseUrl(url: string): URL {
  try {
    return new URL(url);
  } catch {
    return new URL('http://localhost:3000');
  }
}

/**
 * Metadatos **por host**: con un despliegue sirviendo varios dominios, el título, la descripción,
 * el `metadataBase` y el Open Graph tienen que ser los de la tienda de **ese** dominio (antes eran
 * constantes del despliegue y la canónica apuntaba siempre al mismo sitio).
 */
export async function generateMetadata(): Promise<Metadata> {
  const channel = await currentChannelOrDefault();
  return {
    metadataBase: metadataBaseUrl(channel.url),
    title: {
      default: `${channel.name} · Catalogo en linea`,
      template: `%s · ${channel.name}`,
    },
    description: channel.description,
    applicationName: channel.name,
    alternates: { canonical: '/' },
    openGraph: {
      type: 'website',
      locale: 'es_BO',
      siteName: channel.name,
      title: channel.name,
      description: channel.description,
    },
    robots: { index: true, follow: true },
  };
}

interface RootLayoutProps {
  children: ReactNode;
}

/**
 * Cascaron de la tienda (F9.1).
 *
 * Orden de carga pensado para el primer pintado: primero el **tema** (script en
 * linea que aplica `data-theme` antes de pintar, sin destello), despues el
 * **preload** de los dos pesos de Inter que usa el encabezado y los titulos, y
 * solo entonces el resto. La tipografia se sirve self-hosted desde `/fonts`
 * (`sync:fonts`), nunca desde una red externa (D25).
 *
 * El **modo demostracion** de imagenes (`STOREFRONT_SHOW_PLACEHOLDERS`) se resuelve **aqui**, una
 * vez por peticion, y se reparte por contexto: el defecto sigue siendo el de D24 (monograma) y las
 * paginas no tienen que saber nada de la bandera. Ver `src/lib/show-placeholders.ts`.
 */
export default function RootLayout({ children }: RootLayoutProps): JSX.Element {
  const showPlaceholders = showPlaceholderImages();

  return (
    <html lang="es" suppressHydrationWarning>
      <head>
        <ThemeScript />
        <link rel="preload" href="/fonts/inter-400-latin.woff2" as="font" type="font/woff2" crossOrigin="anonymous" />
        <link rel="preload" href="/fonts/inter-700-latin.woff2" as="font" type="font/woff2" crossOrigin="anonymous" />
      </head>
      <body className="flex min-h-screen flex-col bg-base text-fg">
        <ShowPlaceholdersProvider show={showPlaceholders}>
          <a
            href="#contenido"
            className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-toast focus:rounded-btn focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-fg"
          >
            Saltar al contenido
          </a>
          <SiteHeader />
          <main id="contenido" className="sf-container flex-1 py-6 md:py-8">
            {children}
          </main>
          <SiteFooter />
          <CartHydration />
        </ShowPlaceholdersProvider>
      </body>
    </html>
  );
}
