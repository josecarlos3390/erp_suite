import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { expect, test } from '@playwright/test';

import {
  isPlaceholderImage,
  pageImageSource,
  PLACEHOLDER_HOSTS,
  productGallery,
  productMonogram,
  showPlaceholdersFrom,
} from '../src/lib/media';
import type { StorePage } from '../src/lib/erp';

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

/** Forma del `images.remotePatterns` que declara `next.config.mjs`. */
interface RemotePatternLike {
  protocol?: string;
  hostname?: string;
  pathname?: string;
}

interface NextConfigLike {
  images?: { remotePatterns?: RemotePatternLike[] };
}

/**
 * Hosts declarados en **`images.remotePatterns` de `next.config.mjs`**: los unicos que el
 * optimizador de `next/image` acepta.
 *
 * Se **importa el archivo de configuracion de verdad** (no se copia la lista al spec) porque el
 * defecto que este caso sujeta es exactamente que las dos listas se separen: `src/lib/media.ts`
 * lista los hosts de relleno y `next.config.mjs` los declara, y nada ataba una con otra.
 */
async function declaredRemoteHosts(): Promise<string[]> {
  // `next.config.mjs` es JavaScript sin declaracion de tipos y `allowJs` esta apagado, asi que TS no
  // puede tiparlo (TS7016); la forma que el caso usa esta declarada arriba, en `NextConfigLike`.
  // @ts-expect-error TS7016: el archivo de configuracion no publica `.d.mts`.
  const config = (await import('../next.config.mjs')) as { default: NextConfigLike };
  return (config.default.images?.remotePatterns ?? [])
    .map((pattern) => pattern.hostname)
    .filter((host): host is string => typeof host === 'string' && host !== '');
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

  test('todo host de relleno del codigo esta declarado en los `remotePatterns` de `next.config.mjs`', async () => {
    const declared = await declaredRemoteHosts();
    expect(
      declared.length,
      'next.config.mjs no declara ningun host remoto: este caso no mediria nada',
    ).toBeGreaterThan(0);

    // La mitad que faltaba: el **modo demostracion** (encendido en produccion) pinta los hosts de
    // relleno `como fotos reales`, asi que el optimizador de `next/image` recibe sus URLs y
    // **rechaza** (400) cualquier host que no este declarado: la imagen del catalogo, del banner o
    // de la pagina del CMS sale **rota**. Medido el 2026-10-02: `placehold.co` estaba en
    // `PLACEHOLDER_HOSTS` y **no** aqui.
    const missing = PLACEHOLDER_HOSTS.filter((host) => !declared.includes(host));
    expect(
      missing,
      `hosts de relleno sin declarar en images.remotePatterns: ${missing.join(', ')}. ` +
        'Anadelos a `placeholderHosts` de next.config.mjs: la tienda los pinta en modo ' +
        'demostracion (STOREFRONT_SHOW_PLACEHOLDERS) y el optimizador solo sirve hosts declarados.',
    ).toEqual([]);
  });

  test('la imagen de una pagina del CMS: se pinta la foto real, nunca el relleno (salvo demo) y nada si no hay imagen', () => {
    // El **contrato** del canal para `GET /storefront/pages/:slug` (`{ slug, title, content,
    // imageUrl, updatedAt }`, con `imageUrl: string | null`). Se declara aqui porque los specs
    // entran en `tsc --noEmit`: si `imageUrl` desapareciera de `StorePage`, el gate diria que la
    // tienda dejo de leer el campo.
    const relleno = 'https://placehold.co/1200x630.png';
    const fotoReal = 'https://pub-43d22e70fe3e40b88de89bac6537eaa9.r2.dev/pagina/envios.png';
    const conRelleno: StorePage = {
      slug: 'envios-y-devoluciones',
      title: 'Envios y devoluciones',
      content: 'Texto de la pagina.',
      imageUrl: relleno,
      updatedAt: '2026-10-02T00:00:00.000Z',
    };
    const conFoto: StorePage = { ...conRelleno, imageUrl: fotoReal };
    const sinImagen: StorePage = { ...conRelleno, imageUrl: null };

    // Defecto (D24): una URL de relleno **no** se pinta en la pagina...
    expect(pageImageSource(conRelleno.imageUrl)).toBeNull();
    // ...y con el modo demostracion **si** (que es lo que obliga a su host a estar declarado).
    expect(pageImageSource(conRelleno.imageUrl, true)).toBe(relleno);
    // La foto real se pinta, con la bandera en los dos estados.
    expect(pageImageSource(conFoto.imageUrl)).toBe(fotoReal);
    expect(pageImageSource(conFoto.imageUrl, true)).toBe(fotoReal);
    // Una pagina **sin** imagen no pinta **nada**: no hay monograma en una pagina de texto.
    expect(pageImageSource(sinImagen.imageUrl)).toBeNull();
    expect(pageImageSource(sinImagen.imageUrl, true)).toBeNull();
    // Un canal anterior al campo (`undefined` en runtime) es «sin imagen», no un error.
    expect(pageImageSource(undefined)).toBeNull();
    expect(pageImageSource('   ')).toBeNull();
    // Y ningun host de la lista es de adorno: todos se pintan en modo demostracion, asi que todos
    // tienen que estar declarados (el caso de arriba).
    for (const host of PLACEHOLDER_HOSTS) {
      const url = `https://${host}/1200x630.png`;
      expect(pageImageSource(url, true), `${host} deberia pintarse en modo demostracion`).toBe(url);
      expect(pageImageSource(url), `${host} no deberia pintarse por defecto`).toBeNull();
    }

    // **Declarado (2026-10-02)**: lo que este caso **no** mide es la pagina **renderizada** con su
    // imagen (aqui no hay navegador: es la regla pura). El render se midio **a mano** con el
    // servidor real y la API local que durante esa ventana si publicaba `imageUrl` para
    // `quienes-somos`: **A/B del mismo HTML** cambiando solo `page.tsx` → **antes** (el de HEAD)
    // **0** nodos `page-image` y **0** URLs del canal; **despues** **1** nodo con
    // `alt="Imagen de la pagina: Quiénes somos"` y **9** referencias
    // `/_next/image?url=https%3A%2F%2Fcdn.example.com%2Fquienes-somos.jpg` (el `srcSet`).
    //
    // El caso automatizado que falta —y que hay que escribir aqui el dia que el canal publique el
    // campo de forma estable— es la **correspondencia en las dos direcciones**, leyendo el **HTML
    // del servidor** (`request.get`, sin JavaScript, para no depender de que la imagen cargue:
    // un host sin declarar la retiraria en el navegador por `onError`, y esa es la regla del
    // optimizador, con su propio caso en este spec):
    //   1. `GET /storefront/pages` (el indice) y, por cada pagina, `GET /storefront/pages/:slug`;
    //   2. pedir `/paginas/<slug>` y exigir `[data-testid="page-image"]` presente **si y solo si**
    //      `pageImageSource(channel.imageUrl, showPlaceholders)` no es `null`;
    //   3. y `data-placeholder="true"` **ausente** siempre: una pagina de texto no lleva monograma.
    // Se probó con un `e2e/paginas.spec.ts` que **no se commiteo**: la API local se cayo a mitad de
    // la verificacion (medido: `http://localhost:3001/health` → conexion rechazada) y un spec que
    // nunca corrio en verde no se deja en el repo.
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
