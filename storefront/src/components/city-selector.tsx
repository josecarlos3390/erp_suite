'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

interface CitySelectorProps {
  cities: readonly { code: string; name: string }[];
  selectedCode: string;
}

/**
 * Selector de ciudad (F9.1).
 *
 * Escribe la cookie `storefront_city` por el route handler `/api/ciudad`
 * (nunca desde el navegador hacia el ERP: D10) y refresca la pagina para que el
 * servidor vuelva a pedir la existencia del almacen de esa ciudad.
 *
 * Sigue siendo un `<select>` **nativo**: el E2E lo maneja con `selectOption` y es
 * lo mas usable en movil.
 */
export function CitySelector({ cities, selectedCode }: CitySelectorProps): JSX.Element {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  async function handleChange(code: string): Promise<void> {
    setError(null);
    try {
      const response = await fetch('/api/ciudad', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ city: code }),
      });
      if (!response.ok) {
        setError('No se pudo cambiar la ciudad.');
        return;
      }
      startTransition(() => {
        router.refresh();
      });
    } catch {
      setError('No se pudo cambiar la ciudad.');
    }
  }

  return (
    <div className="flex items-center gap-1.5">
      <span aria-hidden="true" className="hidden text-fg-tertiary sm:inline">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 21s7-5.4 7-11a7 7 0 1 0-14 0c0 5.6 7 11 7 11Z" />
          <circle cx="12" cy="10" r="2.5" />
        </svg>
      </span>
      <label htmlFor="selector-ciudad" className="sr-only">
        Ciudad de entrega
      </label>
      <select
        id="selector-ciudad"
        className="sf-field h-11 w-auto min-h-0 py-0 pr-2 text-sm font-medium"
        value={selectedCode}
        disabled={pending}
        data-testid="selector-ciudad"
        onChange={(event) => {
          void handleChange(event.target.value);
        }}
      >
        {cities.map((city) => (
          <option key={city.code} value={city.code}>
            {city.name}
          </option>
        ))}
      </select>
      {error !== null ? (
        <span role="alert" className="text-xs text-fg-error">
          {error}
        </span>
      ) : null}
    </div>
  );
}
