import { expect, test } from '@playwright/test';

import { getAllProducts, getProduct } from './helpers/erp-api';

const CITY = 'SCZ';

/**
 * F6/T228 — **servicio técnico** desde la ficha.
 *
 * El canal dice si la publicación tiene **vendedor** (`canRequestService`), que es quien
 * atiende la solicitud; el formulario la deja en el ERP por el puente del servidor (la clave
 * del canal no sale al navegador, D10). Los casos miden: que el formulario está cuando el
 * canal lo dice, que la validación corta **antes** de llamar al canal, que el alta real llega
 * al ERP y que un **pedido ajeno** devuelve el error del canal con su mensaje.
 */
test.describe('Servicio tecnico', () => {
  test('la ficha deja la solicitud en el ERP y la valida antes de llamar al canal', async ({
    page,
  }) => {
    const products = await getAllProducts();
    let slug: string | null = null;
    for (const candidate of products.slice(0, 12)) {
      const detail = await getProduct(candidate.slug, CITY);
      if (detail.canRequestService === true) {
        slug = candidate.slug;
        break;
      }
    }
    if (slug === null) {
      // Sin publicaciones con vendedor no hay nada que medir: se dice, no se salta en silencio.
      throw new Error(
        'El canal no publica ningun articulo con canRequestService en los primeros 12.',
      );
    }

    await page.goto(`/productos/${slug}`);
    const form = page.getByTestId('service-request-form');
    await expect(form).toBeVisible();

    // Sin correo ni motivo, la validación del formulario corta y NO se llama al canal.
    let calls = 0;
    page.on('request', (request) => {
      if (request.url().includes('/api/servicio-tecnico')) calls += 1;
    });
    await form.getByTestId('service-request-submit').click();
    await expect(form.getByTestId('service-request-error').first()).toBeVisible();
    expect(calls).toBe(0);

    // Un pedido que no es de ese correo: el canal responde 404 y su mensaje llega al comprador.
    const unique = Date.now().toString(36);
    await form.getByTestId('service-request-email').fill(`tecnico-${unique}@example.com`);
    await form.getByTestId('service-request-issue').fill(
      'La pantalla tiene una mancha y quiero revision tecnica.',
    );
    await form.getByTestId('service-request-order').fill('WEB-999999');
    await form.getByTestId('service-request-submit').click();
    await expect(form.getByTestId('service-request-error').first()).toContainText(
      'WEB-999999',
    );

    // Y sin pedido, el alta real queda registrada: el ERP responde con su mensaje.
    await form.getByTestId('service-request-order').fill('');
    await form.getByTestId('service-request-submit').click();
    const status = page.getByTestId('service-request-status');
    await expect(status).toBeVisible();
    await expect(status).toContainText('servicio');
  });
});
