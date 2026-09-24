'use client';

import { useState, type MouseEvent } from 'react';

import { isPlaceholderImage } from '@/lib/media';

import { ProductImage } from './product-image';

interface ProductGalleryProps {
  images: readonly string[];
  name: string;
}

/**
 * Galeria de la ficha (F9.4): imagen principal con **zoom al pasar el puntero** y
 * miniaturas.
 *
 * El zoom solo se ofrece cuando hay **foto real**: si la imagen es el marcador de
 * posicion del seed, la tienda pinta su placeholder (D24) y ampliarlo no aporta
 * nada. El origen de la transformacion sigue al puntero, asi que la lupa cae donde
 * el comprador mira.
 *
 * El `data-testid="gallery-thumb"` por miniatura es contrato con el E2E.
 */
export function ProductGallery({ images, name }: ProductGalleryProps): JSX.Element {
  const sources = images.length > 0 ? images : [''];
  const [selected, setSelected] = useState(0);
  const [zoom, setZoom] = useState(false);
  const [origin, setOrigin] = useState('50% 50%');
  const current = sources[Math.min(selected, sources.length - 1)] ?? '';
  const canZoom = !isPlaceholderImage(current);

  function handleMove(event: MouseEvent<HTMLDivElement>): void {
    if (!canZoom) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * 100;
    const y = ((event.clientY - rect.top) / rect.height) * 100;
    setOrigin(`${x.toFixed(1)}% ${y.toFixed(1)}%`);
  }

  return (
    <div className="flex flex-col gap-3">
      <div
        className="relative overflow-hidden rounded-card border border-line bg-base shadow-card"
        onMouseEnter={() => setZoom(true)}
        onMouseLeave={() => {
          setZoom(false);
          setOrigin('50% 50%');
        }}
        onMouseMove={handleMove}
        data-zoom={zoom ? 'on' : 'off'}
      >
        <ProductImage
          src={current === '' ? null : current}
          alt={name}
          name={name}
          priority
          sizes="(min-width: 1024px) 45vw, 100vw"
          className="aspect-square w-full"
          imageClassName={`p-4 transition-transform duration-slower ease-expo ${zoom ? 'scale-[1.75]' : 'scale-100'}`}
          imageStyle={{ transformOrigin: origin }}
        />

        {canZoom ? (
          <span
            className="pointer-events-none absolute bottom-3 right-3 rounded-full border border-line bg-base px-3 py-1 text-2xs font-medium text-fg-secondary shadow-sm"
            aria-hidden="true"
          >
            {zoom ? 'Zoom activo' : 'Pasa el puntero para ampliar'}
          </span>
        ) : null}

        {sources.length > 1 ? (
          <span className="pointer-events-none absolute bottom-3 left-3 rounded-full border border-line bg-base px-3 py-1 text-2xs font-medium text-fg-secondary shadow-sm">
            {selected + 1} / {sources.length}
          </span>
        ) : null}
      </div>

      {sources.length > 1 ? (
        <ul className="flex flex-wrap gap-2" aria-label={`Imagenes de ${name}`}>
          {sources.map((source, index) => (
            <li key={`${source}-${index}`}>
              <button
                type="button"
                onClick={() => setSelected(index)}
                aria-pressed={index === selected}
                aria-label={`Ver imagen ${index + 1} de ${name}`}
                className={`sf-media block h-16 w-16 border-2 transition-colors duration-fast ${
                  index === selected ? 'border-primary' : 'border-line hover:border-primary-border'
                }`}
                data-testid="gallery-thumb"
              >
                <ProductImage
                  src={source === '' ? null : source}
                  alt=""
                  name={name}
                  placeholderSize="sm"
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
