'use client';

import Image from 'next/image';
import { useState } from 'react';

interface ProductImageProps {
  src: string | null;
  alt: string;
  sizes?: string;
  priority?: boolean;
  className?: string;
  imageClassName?: string;
}

/**
 * Respaldo local: SVG en linea (sin colores hexadecimales: usa las variables de
 * los tokens a traves de `currentColor` y las clases del tema).
 */
function FallbackArt(): JSX.Element {
  return (
    <span
      className="flex h-full w-full items-center justify-center bg-surface text-fg-tertiary"
      data-fallback="true"
    >
      <svg
        viewBox="0 0 24 24"
        className="h-1/3 w-1/3"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        focusable="false"
      >
        <rect x="3" y="4.5" width="18" height="15" rx="2" />
        <circle cx="8.5" cy="10" r="1.6" />
        <path d="M4 17.5l5-5 4 4 2.5-2.5L20 17.5" />
      </svg>
    </span>
  );
}

/**
 * Imagen de producto con respaldo local.
 *
 * Las imagenes del seed del ERP son marcadores de posicion de `picsum.photos`
 * (dato de desarrollo declarado). Si la URL viene vacia, si el optimizador de
 * Next falla o si el host no esta accesible, se pinta el respaldo: la pagina
 * nunca muestra una imagen rota.
 */
export function ProductImage({
  src,
  alt,
  sizes = '(min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw',
  priority = false,
  className,
  imageClassName,
}: ProductImageProps): JSX.Element {
  const [failed, setFailed] = useState(false);
  const hasSource = src !== null && src.trim() !== '';
  const useFallback = !hasSource || failed;

  return (
    <span className={`relative block overflow-hidden ${className ?? ''}`}>
      {useFallback ? (
        <FallbackArt />
      ) : (
        <Image
          src={src}
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
