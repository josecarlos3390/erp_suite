import type { Metadata } from 'next';
import type { ReactNode } from 'react';

import { CartHydration } from '@/components/cart-hydration';
import { SiteFooter } from '@/components/site-footer';
import { SiteHeader } from '@/components/site-header';
import { ThemeScript } from '@/components/theme-toggle';
import { SITE_DESCRIPTION, SITE_NAME, siteUrl } from '@/lib/site';

import './globals.css';

function metadataBaseUrl(): URL {
  try {
    return new URL(siteUrl());
  } catch {
    return new URL('http://localhost:3000');
  }
}

export const metadata: Metadata = {
  metadataBase: metadataBaseUrl(),
  title: {
    default: `${SITE_NAME} · Catalogo en linea`,
    template: `%s · ${SITE_NAME}`,
  },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  alternates: { canonical: '/' },
  openGraph: {
    type: 'website',
    locale: 'es_BO',
    siteName: SITE_NAME,
    title: SITE_NAME,
    description: SITE_DESCRIPTION,
  },
  robots: { index: true, follow: true },
};

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
 */
export default function RootLayout({ children }: RootLayoutProps): JSX.Element {
  return (
    <html lang="es" suppressHydrationWarning>
      <head>
        <ThemeScript />
        <link rel="preload" href="/fonts/inter-400-latin.woff2" as="font" type="font/woff2" crossOrigin="anonymous" />
        <link rel="preload" href="/fonts/inter-700-latin.woff2" as="font" type="font/woff2" crossOrigin="anonymous" />
      </head>
      <body className="flex min-h-screen flex-col bg-base text-fg">
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
      </body>
    </html>
  );
}
