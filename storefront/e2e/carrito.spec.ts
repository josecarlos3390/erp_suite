import { expect, test } from '@playwright/test';

import { getAllProducts } from './helpers/erp-api';

test.describe('Carrito', () => {
  test('agregar desde la ficha actualiza el contador y /carrito muestra la linea', async ({
    page,
  }) => {
    const products = await getAllProducts();
    // Solo se puede comprar lo que tiene existencia en la ciudad elegida.
    const target = products.find((product) => product.availability.inStock);
    expect(target, 'El catalogo no tiene ningun producto con existencia').toBeDefined();
    if (target === undefined) return;

    await page.goto(`/productos/${target.slug}`);
    await expect(page.getByTestId('cart-count')).toHaveText('0');

    await page.getByTestId('add-to-cart').click();
    await expect(page.getByTestId('add-to-cart-status')).toBeVisible();
    await expect(page.getByTestId('cart-count')).toHaveText('1');

    await page.getByTestId('cart-link').click();
    await expect(page).toHaveURL(/\/carrito$/);

    const line = page.getByTestId('cart-line');
    await expect(line).toHaveCount(1);
    await expect(line).toHaveAttribute('data-slug', target.slug);
    await expect(line.getByRole('link', { name: target.name })).toBeVisible();
    await expect(page.getByTestId('cart-items')).toHaveText('1');

    // La nota del checkout (el precio final lo confirma el ERP) esta a la vista.
    await expect(page.getByTestId('cart-checkout-note')).toContainText('el ERP');

    // Subir la cantidad actualiza linea, unidades y contador del encabezado.
    await page.getByLabel(`Agregar una unidad de ${target.name}`).click();
    await expect(page.getByTestId('cart-line-quantity')).toHaveValue('2');
    await expect(page.getByTestId('cart-items')).toHaveText('2');
    await expect(page.getByTestId('cart-count')).toHaveText('2');

    // Bajarla vuelve a 1.
    await page.getByLabel(`Quitar una unidad de ${target.name}`).click();
    await expect(page.getByTestId('cart-line-quantity')).toHaveValue('1');
    await expect(page.getByTestId('cart-items')).toHaveText('1');

    // Y quitar la linea deja el carrito vacio.
    await page.getByTestId('cart-line-remove').click();
    await expect(page.getByTestId('cart-line')).toHaveCount(0);
    await expect(page.getByTestId('cart-count')).toHaveText('0');
    await expect(page.getByRole('heading', { name: 'Tu carrito esta vacio' })).toBeVisible();
  });

  test('el carrito sobrevive a la recarga de la pagina', async ({ page }) => {
    const products = await getAllProducts();
    const target = products.find((product) => product.availability.inStock);
    if (target === undefined) return;

    await page.goto(`/productos/${target.slug}`);
    await page.getByTestId('add-to-cart').click();
    await expect(page.getByTestId('cart-count')).toHaveText('1');

    await page.reload();
    await expect(page.getByTestId('cart-count')).toHaveText('1');

    await page.goto('/carrito');
    await expect(page.getByTestId('cart-line')).toHaveCount(1);
    await expect(page.getByTestId('cart-line')).toHaveAttribute('data-slug', target.slug);
  });

  test('agregar desde la grilla (quick-add) no navega y suma al carrito', async ({ page }) => {
    const products = await getAllProducts();
    const target = products.find((product) => product.availability.inStock);
    expect(target, 'El catalogo no tiene ningun producto con existencia').toBeDefined();
    if (target === undefined) return;

    const category = target.category?.slug;
    expect(category, 'El producto elegido no tiene categoria publicada').toBeDefined();
    if (category === undefined) return;

    await page.goto(`/categorias/${category}`);
    await expect(page.getByTestId('cart-count')).toHaveText('0');

    // La tarjeta del articulo trae su boton de compra rapida (F9.3).
    const card = page.locator(`[data-testid="product-card"][data-slug="${target.slug}"]`);
    await expect(card).toBeVisible();
    const quickAdd = card.getByTestId('quick-add');
    await expect(quickAdd).toBeEnabled();
    await quickAdd.click();

    // No navega (el boton vive fuera del enlace de la imagen) y el contador sube.
    await expect(page).toHaveURL(new RegExp(`/categorias/${category}$`));
    await expect(page.getByTestId('cart-count')).toHaveText('1');

    await page.goto('/carrito');
    const line = page.getByTestId('cart-line');
    await expect(line).toHaveCount(1);
    await expect(line).toHaveAttribute('data-slug', target.slug);
  });

  test('desde el carrito se entra al checkout con el articulo cargado', async ({ page }) => {
    const products = await getAllProducts();
    const target = products.find((product) => product.availability.inStock);
    if (target === undefined) return;

    await page.goto(`/productos/${target.slug}`);
    await page.getByTestId('add-to-cart').click();
    await expect(page.getByTestId('cart-count')).toHaveText('1');

    await page.goto('/carrito');
    await page.getByTestId('cart-checkout-link').click();

    await expect(page).toHaveURL(/\/checkout$/);
    // El checkout arranca con el articulo del carrito y la ciudad elegida.
    await expect(page.getByTestId('checkout-cart-line')).toContainText(target.name);
    await expect(page.getByTestId('checkout-step-1')).toHaveAttribute('data-state', 'current');
    await expect(page.getByTestId('checkout-city-name')).toContainText('Santa Cruz');
  });

  test('el carrito y el checkout comparten la barra de pasos y el resumen es pegajoso', async ({
    page,
  }) => {
    // F9.5: el camino de pago dice en que paso esta el comprador (barra de progreso),
    // el resumen acompana el scroll y al cambiar de paso el foco viaja al panel nuevo.
    const products = await getAllProducts();
    const target = products.find((product) => product.availability.inStock);
    expect(target, 'El catalogo no tiene ningun producto con existencia').toBeDefined();
    if (target === undefined) return;

    await page.goto(`/productos/${target.slug}`);
    await page.getByTestId('add-to-cart').click();
    await expect(page.getByTestId('cart-count')).toHaveText('1');

    await page.goto('/carrito');
    // El carrito es el paso actual; los tres del checkout siguen pendientes y no
    // comparten testid con los del checkout (mismo contrato, dos paginas).
    await expect(page.getByTestId('cart-progress')).toContainText('Carrito');
    await expect(page.getByTestId('cart-step-1')).toHaveAttribute('data-state', 'pending');
    await expect(page.getByTestId('cart-step-3')).toHaveAttribute('data-state', 'pending');
    await expect(page.getByTestId('checkout-step-1')).toHaveCount(0);

    // El resumen es pegajoso en escritorio (`lg:top-32`), no un bloque que se va.
    const resumenCarrito = page.locator('aside[aria-label="Resumen del carrito"]');
    await expect(resumenCarrito).toHaveCSS('position', 'sticky');
    await expect(resumenCarrito).toHaveCSS('top', '128px');

    await page.getByTestId('cart-checkout-link').click();
    await expect(page).toHaveURL(/\/checkout$/);
    await expect(page.getByTestId('checkout-progress')).toBeVisible();
    await expect(page.getByTestId('checkout-step-1')).toHaveAttribute('data-state', 'current');
    await expect(page.getByTestId('checkout-step-2')).toHaveAttribute('data-state', 'pending');
    await expect(page.locator('aside[aria-label="Tu carrito"]')).toHaveCSS('position', 'sticky');

    // Paso 1 -> 2: el paso nuevo queda marcado y con el foco dentro (el lector de
    // pantalla anuncia donde esta el comprador y la barra no queda bajo el encabezado).
    await page.getByTestId('checkout-email').fill('e2e-pasos@example.com');
    await page.getByTestId('checkout-name').fill('Comprador E2E');
    await page.getByTestId('checkout-phone').fill('70012345');
    await page.getByTestId('checkout-street').fill('Av. Los Sauces #120');
    await page.getByTestId('checkout-district').fill('Equipetrol');
    await page.getByTestId('checkout-next-1').click();

    await expect(page.getByTestId('checkout-step-1')).toHaveAttribute('data-state', 'done');
    await expect(page.getByTestId('checkout-step-2')).toHaveAttribute('data-state', 'current');
    await expect(page.locator('section[aria-labelledby="paso-entrega"]')).toBeFocused();
    // Y la barra de pasos no queda escondida debajo del encabezado pegajoso: se mide
    // la distancia entre el borde inferior del encabezado y el inicio de la barra.
    await expect
      .poll(
        async () => {
          const barra = await page.getByTestId('checkout-progress').boundingBox();
          const encabezado = await page.locator('header').first().boundingBox();
          if (barra === null || encabezado === null) return -1;
          return Math.round(barra.y - (encabezado.y + encabezado.height));
        },
        { message: 'La barra de pasos quedo debajo del encabezado pegajoso' },
      )
      .toBeGreaterThanOrEqual(0);
  });

  test('la carga de la tienda muestra el esqueleto, no un carrito vacio que el comprador no tiene', async ({
    browser,
  }) => {
    // F9.5: el store del carrito rehidrata **despues** del montaje (`skipHydration`), asi
    // que el primer HTML es el mismo que se pinta sin JavaScript. Antes traia el estado
    // vacio («Tu carrito esta vacio») en /carrito y una linea de texto suelta en
    // /checkout; ahora trae el esqueleto con la forma real de cada pantalla.
    const context = await browser.newContext({ javaScriptEnabled: false });
    const page = await context.newPage();

    await page.goto('/carrito');
    await expect(page.getByTestId('cart-loading')).toBeVisible();
    await expect(page.getByTestId('cart-empty')).toHaveCount(0);
    await expect(page.getByTestId('cart-line')).toHaveCount(0);

    await page.goto('/checkout');
    await expect(page.getByTestId('checkout-loading')).toBeVisible();
    await expect(page.getByTestId('checkout-empty')).toHaveCount(0);
    await expect(page.getByTestId('checkout-form')).toHaveCount(0);

    await context.close();
  });
});
