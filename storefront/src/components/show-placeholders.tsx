'use client';

import { createContext, useContext, type ReactNode } from 'react';

/**
 * Modo demostracion de imagenes: el valor que resuelve el **servidor** (`showPlaceholderImages()`)
 * y que el layout reparte a los componentes de cliente.
 *
 * Por que un contexto y no una variable de entorno con `NEXT_PUBLIC_`: los componentes que deciden
 * el monograma son de cliente, pero su HTML lo pinta el servidor en cada peticion, asi que la
 * bandera puede llegar **por el payload** —un solo valor, el mismo en servidor y en cliente— sin
 * quedar incrustada en el bundle. La medicion esta en `src/lib/show-placeholders.ts`.
 *
 * El **defecto** del contexto es `false`: cualquier arbol que no monte el proveedor se comporta
 * exactamente como hoy (D24: el marcador de posicion no es una foto del producto).
 */
const ShowPlaceholdersContext = createContext(false);

interface ShowPlaceholdersProviderProps {
  /** `true` solo con `STOREFRONT_SHOW_PLACEHOLDERS=true` (modo demostracion). */
  show: boolean;
  children: ReactNode;
}

export function ShowPlaceholdersProvider({
  show,
  children,
}: ShowPlaceholdersProviderProps): JSX.Element {
  return <ShowPlaceholdersContext.Provider value={show}>{children}</ShowPlaceholdersContext.Provider>;
}

/** ¿Hay que pintar las fotos de relleno como fotos reales? (modo demostracion) */
export function useShowPlaceholders(): boolean {
  return useContext(ShowPlaceholdersContext);
}
