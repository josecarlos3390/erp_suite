'use client';

import Image from 'next/image';
import { useState } from 'react';

import { pageImageSource } from '@/lib/media';

import { useShowPlaceholders } from './show-placeholders';

interface PageImageProps {
  /** `imageUrl` que publica el canal para la pagina (`null` = no tiene imagen). */
  src: string | null | undefined;
  /** Texto alternativo **descriptivo** (el titulo de la pagina). */
  alt: string;
}

/**
 * Imagen de una **pagina del CMS** (`GET /storefront/pages/:slug` → `imageUrl`).
 *
 * Por que es un componente aparte y no `ProductImage`: el respaldo es distinto. Un articulo sin
 * foto enseña el **monograma** de la tienda (dice «aqui iria la foto de este articulo»); una pagina
 * de texto sin imagen **no pinta nada** —un cuadro con letras sobre «Envios y devoluciones» no
 * significa nada—. La regla de que se considera foto vive en `pageImageSource()`
 * (`src/lib/media.ts`), junto a la de los articulos, para que las dos no puedan contar cosas
 * distintas (D24).
 *
 * El modo demostracion se lee del **contexto** (`useShowPlaceholders`, el mismo valor que resuelve
 * el servidor por peticion), asi que el HTML que pinta el servidor y el que hidrata el navegador
 * coinciden. Y si la imagen **falla** al cargar (`onError`: objeto borrado del bucket, host sin
 * declarar en el optimizador) se retira en vez de dejar el icono de imagen rota.
 *
 * **Movil**: la imagen se encuadra en una columna de `max-w-3xl` (la misma del texto) y usa
 * `width`/`height` con `h-auto w-full`, asi que se adapta al ancho disponible sin desbordar; no se
 * fuerza recorte (`object-cover`) porque la fotografia de una pagina no tiene una proporcion fija.
 */
export function PageImage({ src, alt }: PageImageProps): JSX.Element | null {
  const [failed, setFailed] = useState(false);
  const showPlaceholders = useShowPlaceholders();
  const source = pageImageSource(src, showPlaceholders);

  if (source === null || failed) return null;

  return (
    <div
      className="max-w-3xl overflow-hidden rounded-card border border-border bg-surface"
      data-testid="page-image"
    >
      <Image
        src={source}
        alt={alt}
        width={1200}
        height={630}
        sizes="(min-width: 768px) 48rem, 100vw"
        className="h-auto w-full"
        onError={() => setFailed(true)}
      />
    </div>
  );
}
