import { expect, test } from '@playwright/test';

import { openStorePage, VISUAL_CASES } from './store-cases';

/**
 * Gate **visual** de la tienda (F9.6/D26): capturas de referencia de las pantallas
 * de compra, en claro y en oscuro.
 *
 * **Contra que mide.** Contra el **fixture grabado** del canal
 * (`e2e/visual/channel-fixture.mjs`), no contra el ERP real: los nombres, los
 * precios y la existencia son los mismos en cada corrida, asi que un fallo del
 * gate significa «cambio el diseno», no «cambio el dato». El E2E funcional
 * (`npm run e2e`) sigue midiendo contra el ERP y el seed reales.
 *
 * **Que se captura.** La pantalla completa (`fullPage`) y **sin mascaras**: al no
 * haber datos variables no hay nada que tapar, y una caja que se mueve se ve.
 *
 * **Como se actualizan.** Solo a proposito y revisando la imagen:
 * `$env:STORE_VISUAL_RECORD='1'; npm run e2e:visual:update` (con la API del ERP en
 * marcha, para volver a grabar el fixture y las capturas).
 *
 * **Plataforma.** Las capturas de referencia se generan y se comparan en la misma
 * plataforma (Windows + Chromium de Playwright, `deviceScaleFactor: 1`), igual que
 * el gate visual del back office: el render de las tipografias no es identico
 * entre sistemas operativos.
 */
test.describe('Gate visual de la tienda', () => {
  for (const item of VISUAL_CASES) {
    test(`${item.name} (${item.theme})`, async ({ browser }) => {
      const context = await browser.newContext({
        viewport: { width: 1280, height: 900 },
        deviceScaleFactor: 1,
        colorScheme: item.theme,
        reducedMotion: 'reduce',
      });
      try {
        const page = await openStorePage(context, item);
        await expect(page).toHaveScreenshot(`${item.name}.png`, { fullPage: true });
      } finally {
        await context.close();
      }
    });
  }
});
