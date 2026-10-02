import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { expect, test } from '@playwright/test';

import { isPlaceholderImage, productGallery, productMonogram, showPlaceholdersFrom } from '../src/lib/media';

/**
 * **Reglas de medios de la tienda** (D24): que se pinta como foto real y que como placeholder.
 *
 * Por que este caso existe (incremento de la biblioteca de medios, 2026-10-01): la tienda decide
 * con `isPlaceholderImage` si una URL es el marcador de posicion del seed (`picsum.photos`) o una
 * **foto real**. Desde que el ERP firma subidas a Cloudflare R2, la **foto que sube el usuario**
 * llega de un host que no esta en esa lista: si alguien la anadiera —o si la regla se relajara— la
 * tienda volveria a tapar las fotos reales con el monograma y **nada** lo delataria, porque el
 * sintoma (placeholder) es justo el estado por defecto. Es la regla **pura**: se prueba aqui, sin
 * navegador ni API, igual que la del mapa (`e2e/mapa-tiendas.spec.ts`).
 *
 * El host de R2 **no** se codifica a mano: se lee de `IMAGE_REMOTE_HOSTS` (la misma variable con la
 * que `next.config.mjs` declara los hosts de `next/image`), y si no esta definida el caso lo dice
 * en vez de pasar en vacio. Como el **worker** de Playwright no hereda el entorno del `webServer`
 * —donde `playwright.config.ts` si la define—, la variable se completa desde `.env.local`, que es
 * donde vive en desarrollo.
 */

/** Hosts declarados en `IMAGE_REMOTE_HOSTS` (los que `next/image` puede optimizar). */
function configuredHosts(): string[] {
  const fromEnv = process.env.IMAGE_REMOTE_HOSTS;
  const raw = fromEnv !== undefined && fromEnv.trim() !== '' ? fromEnv : fromEnvLocal();
  return raw
    .split(',')
    .map((host) => host.trim())
    .filter((host) => host !== '');
}

/** `IMAGE_REMOTE_HOSTS` de `storefront/.env.local` (ignorado por git); cadena vacia si no esta. */
function fromEnvLocal(): string {
  try {
    const file = resolve(__dirname, '..', '.env.local');
    for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
      const match = /^\s*IMAGE_REMOTE_HOSTS\s*=\s*(.*)$/.exec(line);
      if (match !== null) return (match[1] ?? '').replace(/^["']|["']$/g, '').trim();
    }
  } catch {
    // Sin `.env.local` el caso falla con el mensaje de abajo, que dice que declarar.
  }
  return '';
}

test.describe('Reglas de medios: foto real contra marcador de posicion', () => {
  test('una URL de la biblioteca de medios NO es un marcador: la tienda pinta la foto', () => {
    const hosts = configuredHosts();
    expect(
      hosts.length,
      'IMAGE_REMOTE_HOSTS no declara ningun host: el caso no mediria la foto real',
    ).toBeGreaterThan(0);

    for (const host of hosts) {
      expect(
        isPlaceholderImage(`https://${host}/tenant/1/item/33/8f14e45f-ceea-467a-9c1e-2b5a7c9d0e11.png`),
        `una foto de ${host} (la biblioteca de medios) no puede tratarse como marcador`,
      ).toBe(false);
      // La decision es por **host**, no por la forma de la ruta: cualquier objeto del bucket vale.
      expect(isPlaceholderImage(`https://${host}/cualquier/ruta/foto.png`)).toBe(false);
    }
  });

  test('los marcadores del seed siguen siendo marcadores (y lo vacio tambien)', () => {
    // El dato de desarrollo del seed: la tienda lo sustituye por su monograma (D24).
    expect(isPlaceholderImage('https://picsum.photos/seed/WEB-0026-1/800/800')).toBe(true);
    expect(isPlaceholderImage('https://fastly.picsum.photos/id/1/800/800')).toBe(true);
    expect(isPlaceholderImage('https://placehold.co/800x800')).toBe(true);

    // Sin foto no hay foto: nulo, vacio o solo espacios.
    expect(isPlaceholderImage(null)).toBe(true);
    expect(isPlaceholderImage(undefined)).toBe(true);
    expect(isPlaceholderImage('')).toBe(true);
    expect(isPlaceholderImage('   ')).toBe(true);

    // Una ruta relativa o una cadena que no es URL la decide el navegador, no esta regla: no se
    // marca como marcador (seria tapar una foto propia del despliegue).
    expect(isPlaceholderImage('/imagenes/foto.png')).toBe(false);
    expect(isPlaceholderImage('no-es-una-url')).toBe(false);
  });

  test('la galeria pinta primero la principal y conserva el orden publicado del resto', () => {
    const a = 'https://picsum.photos/seed/WEB-0026-1/800/800';
    const b = 'https://picsum.photos/seed/WEB-0026-2/800/800';
    const c = 'https://picsum.photos/seed/WEB-0026-3/800/800';

    // El caso que motivo el arreglo: la principal esta cargada la ultima (el usuario sube su foto
    // despues) y el canal publica la galeria por `sortOrder` — la principal tiene que verse.
    expect(productGallery([a, b, c], c)).toEqual([c, a, b]);
    // Sin principal conocida, el orden es el que publica el canal (no se inventa uno).
    expect(productGallery([a, b, c], null)).toEqual([a, b, c]);
    expect(productGallery([a, b, c], undefined)).toEqual([a, b, c]);
    // Una principal que **no** esta en la galeria no se anade: la galeria es lo que el canal
    // publica (si el objeto se cayo, el `onError` de la imagen pinta el placeholder).
    expect(productGallery([a, b], 'https://picsum.photos/seed/OTRA/800/800')).toEqual([a, b]);
    // Sin galeria no hay nada que ordenar.
    expect(productGallery([], a)).toEqual([]);
  });

  test('el monograma del placeholder sale del nombre del articulo', () => {
    expect(productMonogram('Aceite Sintetico')).toBe('AS');
    expect(productMonogram('iPhone 15 128GB')).toBe('I1');
    // Un nombre sin dos palabras utiles no puede dejar el placeholder en blanco.
    expect(productMonogram('A')).toBe('·');
    expect(productMonogram('   ')).toBe('·');
  });

  test('el modo demostracion pinta el relleno como foto y deja el monograma de respaldo', () => {
    // Encendido: los hosts de relleno dejan de ser marcadores (se pintan como fotos reales).
    expect(isPlaceholderImage('https://picsum.photos/seed/WEB-0026-1/800/800', true)).toBe(false);
    expect(isPlaceholderImage('https://fastly.picsum.photos/id/1/800/800', true)).toBe(false);
    expect(isPlaceholderImage('https://placehold.co/800x800', true)).toBe(false);
    // El respaldo **no** cambia: sin URL no hay foto, se pinte lo que se pinte.
    expect(isPlaceholderImage(null, true)).toBe(true);
    expect(isPlaceholderImage(undefined, true)).toBe(true);
    expect(isPlaceholderImage('', true)).toBe(true);
    expect(isPlaceholderImage('   ', true)).toBe(true);
    // Y una foto real sigue siendo foto real, con la bandera en los dos estados.
    expect(isPlaceholderImage('https://pub-ejemplo.r2.dev/foto.png', true)).toBe(false);
    expect(isPlaceholderImage('https://pub-ejemplo.r2.dev/foto.png', false)).toBe(false);
    // El defecto (sin segundo argumento) es el de siempre: D24 intacto.
    expect(isPlaceholderImage('https://picsum.photos/seed/WEB-0026-1/800/800')).toBe(true);
  });

  test('la bandera del modo demostracion solo se enciende con `true`', () => {
    expect(showPlaceholdersFrom('true')).toBe(true);
    expect(showPlaceholdersFrom(' TRUE ')).toBe(true);
    expect(showPlaceholdersFrom('True')).toBe(true);
    // Cualquier otro valor —incluida la variable ausente o vacia— deja el defecto.
    expect(showPlaceholdersFrom('false')).toBe(false);
    expect(showPlaceholdersFrom('1')).toBe(false);
    expect(showPlaceholdersFrom('yes')).toBe(false);
    expect(showPlaceholdersFrom('')).toBe(false);
    expect(showPlaceholdersFrom('   ')).toBe(false);
    expect(showPlaceholdersFrom(undefined)).toBe(false);
    expect(showPlaceholdersFrom(null)).toBe(false);
  });

  test('el gate arranca la tienda con el modo demostracion apagado', () => {
    // La suite mide el **defecto** (D24): las dos configuraciones de Playwright fijan
    // `STOREFRONT_SHOW_PLACEHOLDERS` a `false` porque `next start` **si** carga `.env.local` —donde
    // vive encendida la demo local—. El efecto de ese pin lo pincha `e2e/producto.spec.ts`, que exige
    // el monograma (`data-placeholder`) en la ficha de un articulo con URLs de relleno; quien la
    // encienda a proposito (`STOREFRONT_SHOW_PLACEHOLDERS=true npm run e2e`) ya sabe que entonces mide
    // la demo y no el defecto.
    expect(showPlaceholdersFrom('false')).toBe(false);
  });
});
