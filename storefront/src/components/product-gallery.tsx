'use client';

import { useState } from 'react';

import { ProductImage } from './product-image';

interface ProductGalleryProps {
  images: readonly string[];
  name: string;
}

/** Galeria de la ficha: imagen principal + miniaturas (cliente por el cambio de foco). */
export function ProductGallery({ images, name }: ProductGalleryProps): JSX.Element {
  const sources = images.length > 0 ? images : [''];
  const [selected, setSelected] = useState(0);
  const current = sources[Math.min(selected, sources.length - 1)] ?? '';

  return (
    <div className="flex flex-col gap-3">
      <ProductImage
        src={current === '' ? null : current}
        alt={name}
        priority
        sizes="(min-width: 1024px) 40vw, 100vw"
        className="aspect-square w-full rounded-lg border border-line bg-elevated"
        imageClassName="p-0"
      />

      {sources.length > 1 ? (
        <ul className="flex flex-wrap gap-2" aria-label={`Imagenes de ${name}`}>
          {sources.map((source, index) => (
            <li key={`${source}-${index}`}>
              <button
                type="button"
                onClick={() => setSelected(index)}
                aria-pressed={index === selected}
                aria-label={`Ver imagen ${index + 1} de ${name}`}
                className={`block h-16 w-16 overflow-hidden rounded-md border bg-elevated ${
                  index === selected ? 'border-primary border-2' : 'border-line'
                }`}
                data-testid="gallery-thumb"
              >
                <ProductImage
                  src={source === '' ? null : source}
                  alt=""
                  sizes="64px"
                  className="h-full w-full"
                  imageClassName="p-1"
                />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
