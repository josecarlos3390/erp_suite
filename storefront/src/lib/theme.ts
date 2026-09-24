/**
 * Tema de la tienda (F9.1): clave de almacenamiento y utilidades compartidas por
 * el script sin destello (`theme-script.tsx`) y el conmutador cliente.
 *
 * El tema es una preferencia **local** del comprador (`localStorage`), no una
 * preferencia del ERP: no viaja al backend ni toca cookies del canal (D10).
 */
export const THEME_STORAGE_KEY = 'sf-theme';

export type StoreTheme = 'light' | 'dark';

/** Script que aplica el tema antes del primer pintado (evita el destello). */
export const THEME_INIT_SCRIPT = `(function(){try{var k='${THEME_STORAGE_KEY}';var s=window.localStorage.getItem(k);var d=window.matchMedia&&window.matchMedia('(prefers-color-scheme: dark)').matches;var t=(s==='dark'||s==='light')?s:(d?'dark':'light');document.documentElement.dataset.theme=t;}catch(e){}})();`;
