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
});
