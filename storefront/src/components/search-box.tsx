'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';

interface SearchBoxProps {
  defaultValue?: string;
}

/**
 * Buscador de la cabecera (F9.1): navega a `/buscar?q=` y **tambien funciona sin
 * JavaScript** (es un `form` GET real). El boton lleva lupa y texto; en pantallas
 * pequenas el texto se oculta pero el `aria-label` se mantiene.
 */
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
      className="flex w-full items-center gap-2 rounded-card border border-line bg-base p-1 shadow-sm transition-shadow duration-base focus-within:border-primary focus-within:shadow-card"
    >
      <label htmlFor="buscador" className="sr-only">
        Buscar productos
      </label>
      <span aria-hidden="true" className="pl-2 text-fg-tertiary">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.6-3.6" />
        </svg>
      </span>
      <input
        id="buscador"
        type="search"
        name="q"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder="Buscar productos, marcas..."
        autoComplete="off"
        className="min-h-[40px] flex-1 border-0 bg-transparent text-sm text-fg outline-none placeholder:text-fg-tertiary focus:outline-none"
        data-testid="buscador"
      />
      <button type="submit" className="sf-btn sf-btn-primary min-h-[40px] px-4" aria-label="Buscar">
        <span className="hidden sm:inline">Buscar</span>
        <span className="sm:hidden" aria-hidden="true">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.6-3.6" />
          </svg>
        </span>
      </button>
    </form>
  );
}
