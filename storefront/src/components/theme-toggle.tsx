'use client';

import { useEffect, useState } from 'react';

import { THEME_INIT_SCRIPT, THEME_STORAGE_KEY, type StoreTheme } from '@/lib/theme';

/**
 * Conmutador de tema claro/oscuro (F9.1).
 *
 * Islote cliente declarado: solo lee/escribe `localStorage` y el atributo
 * `data-theme` del `<html>` — **no** conoce la clave del canal ni la URL del ERP
 * (D10). El tema real se aplica antes del primer pintado con `THEME_INIT_SCRIPT`,
 * asi que el boton arranca en un estado neutro (`null`) para no provocar un
 * desajuste de hidratacion y se corrige en el primer efecto.
 */
export function ThemeToggle(): JSX.Element {
  const [theme, setTheme] = useState<StoreTheme | null>(null);

  useEffect(() => {
    const current = document.documentElement.dataset.theme;
    setTheme(current === 'dark' ? 'dark' : 'light');
  }, []);

  const next: StoreTheme = theme === 'dark' ? 'light' : 'dark';
  const label = theme === null ? 'Cambiar tema' : next === 'dark' ? 'Tema oscuro' : 'Tema claro';

  return (
    <button
      type="button"
      className="sf-icon-btn"
      data-testid="theme-toggle"
      data-theme-state={theme ?? 'unknown'}
      aria-label={label}
      title={label}
      onClick={() => {
        setTheme(next);
        try {
          document.documentElement.dataset.theme = next;
          window.localStorage.setItem(THEME_STORAGE_KEY, next);
        } catch {
          // Un navegador con el almacenamiento bloqueado no debe romper la pagina:
          // el tema se queda solo en memoria para esta visita.
        }
      }}
    >
      <span aria-hidden="true">{theme === 'dark' ? <SunIcon /> : <MoonIcon />}</span>
    </button>
  );
}

function SunIcon(): JSX.Element {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M19.1 4.9l-1.4 1.4M6.3 17.7l-1.4 1.4" />
    </svg>
  );
}

function MoonIcon(): JSX.Element {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12.8A8.5 8.5 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z" />
    </svg>
  );
}

/** Script de arranque del tema: se inyecta en el `<head>` (una sola vez). */
export function ThemeScript(): JSX.Element {
  return <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />;
}
