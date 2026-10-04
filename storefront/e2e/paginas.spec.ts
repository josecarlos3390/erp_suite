import { expect, test } from '@playwright/test';

import {
  erpAdminLogin,
  listPages,
  setPageImage,
  type ApiWebPage,
} from './helpers/erp-api';

/**
 * Gate de la **imagen de la pagina del CMS** (2026-10-03).
 *
 * Que sujeta: que `imageUrl` —el campo que el back office ya edita y el canal publica— llegue de
 * verdad a la pantalla. El §39 del plan lo midio a mano (A/B cambiando solo `page.tsx`: **0 → 1**
 * nodo) y este caso lo deja automatizado, que era el hueco declarado.
 *
 * **Se mide el HTML del servidor, no el DOM hidratado**, y es deliberado: si la foto no existe (o
 * su host no esta declarado en el optimizador), el `onError` del componente la **retira** a
 * proposito. Eso es comportamiento correcto y no lo que hay que medir aqui: lo que se mide es que
 * el canal publicando `imageUrl` la pagina pinta el nodo, y que sin foto (o con un marcador del
 * seed y el modo demostracion apagado) **no pinta nada** —no hay monograma en una pagina de texto—.
 *
 * **Una carga por URL**: `getPage` se cachea 600 s en el servidor, asi que cada caso usa una pagina
 * distinta (la semilla trae dos) en vez de recargar la misma y arriesgarse a leer la copia vieja.
 */

/** Host que el canal publica como foto real: **no** es ninguno de los marcadores de D24. */
const REAL_IMAGE = 'https://cdn.example.com/pagina-del-cms.jpg';

/** Marcador del seed: con el modo demostracion **apagado** (el de los gates) no se pinta. */
const PLACEHOLDER_IMAGE = 'https://picsum.photos/seed/pagina-del-cms/1200/630';

let token = '';
let conImagen: ApiWebPage;
let conMarcador: ApiWebPage;

test.beforeAll(async () => {
  token = await erpAdminLogin();
  const paginas = await listPages(token);

  const primera = paginas.find((page) => page.slug === 'quienes-somos');
  const segunda = paginas.find((page) => page.slug === 'envios-y-devoluciones');
  expect(
    primera,
    'la semilla del canal trae la pagina "quienes-somos"',
  ).toBeTruthy();
  expect(
    segunda,
    'la semilla del canal trae la pagina "envios-y-devoluciones"',
  ).toBeTruthy();

  conImagen = { ...(primera as ApiWebPage), imageUrl: REAL_IMAGE };
  conMarcador = { ...(segunda as ApiWebPage), imageUrl: PLACEHOLDER_IMAGE };

  // Las dos de una vez, antes de que ningun caso cargue su URL: la cache de datos del servidor
  // todavia no tiene entrada para ninguna de las dos.
  await setPageImage(token, conImagen.id, REAL_IMAGE);
  await setPageImage(token, conMarcador.id, PLACEHOLDER_IMAGE);
});

test.afterAll(async () => {
  if (token === '') return;
  // Se deja el dato como estaba (sin imagen): el arnes restaura la base, pero un spec no se apoya
  // en eso para no dejar basura si se corre suelto.
  if (conImagen) await setPageImage(token, conImagen.id, null);
  if (conMarcador) await setPageImage(token, conMarcador.id, null);
});

test('con imagen publicada, la pagina pinta el nodo y su texto alternativo', async ({
  request,
}) => {
  const response = await request.get(`/paginas/${conImagen.slug}`);
  expect(response.status()).toBe(200);
  const html = await response.text();

  expect(html).toContain('data-testid="page-image"');
  expect(html).toContain(`Imagen de la pagina: ${conImagen.title}`);
  // El texto de la pagina sigue donde estaba: la imagen se suma, no sustituye.
  expect(html).toContain(conImagen.title);
});

test('con un marcador de relleno no pinta imagen (D24, modo demostracion apagado)', async ({
  request,
}) => {
  const response = await request.get(`/paginas/${conMarcador.slug}`);
  expect(response.status()).toBe(200);
  const html = await response.text();

  // El canal publica la URL, pero es de relleno: la pagina **no** la pinta ni deja hueco.
  expect(html).not.toContain('data-testid="page-image"');
  expect(html).toContain(conMarcador.title);
});
