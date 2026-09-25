import { expect, type Page } from '@playwright/test';

/**
 * Espera a que la tienda muestre lo que el ERP **publica ahora**.
 *
 * La ficha y el catalogo se sirven con la **cache del canal** (60 s, `src/lib/erp.ts`): si una
 * prueba reserva o entrega existencia de un articulo, la copia que la tienda ya tiene puede
 * seguir diciendo el numero anterior durante esa ventana. Medido (T226): el gate fallaba de
 * forma intermitente con `Expected "Disponible: 9" / Received "Disponible: 10"` —el ERP ya
 * habia movido el stock y la pagina servia su copia—, y ese fallo **no** era del producto.
 *
 * En vez de asumir que el dato es instantaneo (falso) o de dar la asercion por buena (peor), la
 * prueba **recarga y espera a que converja**, con tope: si no converge en la ventana de la
 * cache, el fallo es real y se reporta.
 */
export async function waitForStorefrontConvergence(
  page: Page,
  check: () => Promise<boolean>,
  label: string,
  timeoutMs = 90_000,
): Promise<number> {
  const started = Date.now();
  for (;;) {
    if (await check()) return (Date.now() - started) / 1000;
    if (Date.now() - started > timeoutMs) {
      throw new Error(
        `La tienda no mostro ${label} dentro de la ventana de cache (${Math.round(timeoutMs / 1000)} s).`,
      );
    }
    await page.waitForTimeout(5_000);
    await page.reload();
  }
}

/** `true` cuando el elemento tiene **exactamente** el texto pedido. */
export async function hasText(
  page: Page,
  testId: string,
  expected: string,
): Promise<boolean> {
  const locator = page.getByTestId(testId).first();
  if ((await locator.count()) === 0) return false;
  return (await locator.innerText()).trim() === expected;
}

/**
 * Asercion de existencia tolerante a la cache: espera la convergencia y **despues** afirma el
 * texto, de modo que el valor final sigue siendo exacto.
 */
export async function expectAvailability(
  page: Page,
  expected: string,
  label: string,
): Promise<void> {
  const seconds = await waitForStorefrontConvergence(
    page,
    () => hasText(page, 'detail-availability', expected),
    label,
  );
  if (seconds > 1) {
    console.log(
      `[cache] ${label} tardo ${seconds.toFixed(1)} s en coincidir con el ERP`,
    );
  }
  await expect(page.getByTestId('detail-availability')).toHaveText(expected);
}
