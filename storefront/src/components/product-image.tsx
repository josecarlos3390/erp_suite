'use client';

import Image from 'next/image';
import { useState } from 'react';

import { isPlaceholderImage } from '@/lib/media';

import { ProductPlaceholder } from './product-placeholder';

interface ProductImageProps {
  src: string | null;
  alt: string;
  /** Nombre del articulo para el monograma del placeholder (por defecto, `alt`). */
  name?: string;
  /** Marca publicada por el ERP (se pinta en el placeholder). */
  brand?: string | null;
  /** Tamano del monograma cuando no hay foto. */
  placeholderSize?: 'sm' | 'md' | 'lg';
  sizes?: string;
  priority?: boolean;
  className?: string;
  imageClassName?: string;
  /**
   * `true` para el arte de campana del CMS (`home-hero`/`home-strip`): una foto de
   * marcador ahi es arte intencional de la campana, no una foto de producto
   * equivocada, asi que se pinta tal cual. En articulos se sustituye por el
   * placeholder propio (D24).
   */
  allowStockHost?: boolean;
}

/**
 * Imagen de producto de la tienda (F9.1).
 *
 * Reglas (D24):
 *   1. Sin `src`, con host de **marcador de posicion** (`picsum.photos`, dato de
 *      desarrollo del seed) o con error de carga → **placeholder propio** de la
 *      tienda (fondo neutro + monograma + marca). Nunca una foto aleatoria ni una
 *      imagen rota.
 *   2. Con foto real → `next/image` optimizada, encuadre `object-contain` (la
 *      fotografia de producto con fondo blanco se ve consistente) y zoom sutil al
 *      pasar por la tarjeta.
 */
export function ProductImage({
  src,
  alt,
  name,
  brand = null,
  placeholderSize = 'md',
  sizes = '(min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw',
  priority = false,
  className,
  imageClassName,
  allowStockHost = false,
}: ProductImageProps): JSX.Element {
  const [failed, setFailed] = useState(false);
  const usePlaceholder = failed || (!allowStockHost && isPlaceholderImage(src));
  const source = src !== null && src.trim() !== '' ? src : null;

  return (
    <span className={`sf-media block ${className ?? ''}`}>
      {usePlaceholder || source === null ? (
        <ProductPlaceholder name={name ?? alt} brand={brand} size={placeholderSize} />
      ) : (
        <Image
          src={source}
          alt={alt}
          fill
          sizes={sizes}
          priority={priority}
          className={`object-contain ${imageClassName ?? ''}`}
          onError={() => setFailed(true)}
        />
      )}
    </span>
  );
}
