'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

interface CitySelectorProps {
  cities: readonly { code: string; name: string }[];
  selectedCode: string;
}

/**
 * Selector de ciudad.
 *
 * Escribe la cookie `storefront_city` por el route handler `/api/ciudad`
 * (nunca desde el navegador hacia el ERP: D10) y refresca la pagina para que el
 * servidor vuelva a pedir la existencia del almacen de esa ciudad.
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
    <div className="flex items-center gap-2">
      <label htmlFor="selector-ciudad" className="text-xs font-medium text-fg-secondary">
        Ciudad
      </label>
      <select
        id="selector-ciudad"
        className="sf-field w-auto"
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
