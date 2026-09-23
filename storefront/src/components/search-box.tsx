'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';

interface SearchBoxProps {
  defaultValue?: string;
}

/** Buscador de la cabecera: navega a /buscar?q= (tambien funciona sin JS). */
export function SearchBox({ defaultValue = '' }: SearchBoxProps): JSX.Element {
  const router = useRouter();
  const [value, setValue] = useState(defaultValue);

  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    const query = value.trim();
    router.push(query === '' ? '/buscar' : `/buscar?q=${encodeURIComponent(query)}`);
  }

  return (
    <form
      role="search"
      method="get"
      action="/buscar"
      onSubmit={handleSubmit}
      className="flex w-full items-center gap-2"
    >
      <label htmlFor="buscador" className="sr-only">
        Buscar productos
      </label>
      <input
        id="buscador"
        type="search"
        name="q"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder="Buscar productos, marcas..."
        autoComplete="off"
        className="sf-field"
        data-testid="buscador"
      />
      <button
        type="submit"
        className="sf-btn bg-primary px-4 text-primary-fg hover:bg-primary-hover"
        aria-label="Buscar"
      >
        Buscar
      </button>
    </form>
  );
}
