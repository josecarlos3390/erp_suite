import { expect, test, type Page } from '@playwright/test';

import { getCategories } from './helpers/erp-api';

/**
 * Navegacion del encabezado (T209).
 *
 * **Defecto medido que este gate vigila**: el panel de subcategorias vivia **dentro**
 * del carril de categorias, que es un contenedor con scroll horizontal; en CSS un
 * `overflow-x: auto` obliga a `overflow-y: auto`, asi que el panel —`position:
 * absolute`— quedaba recortado por la caja del carril: con la sonda se midio que
 * **110 px de sus 108 px de alto** caian fuera y el comprador no veia el menu.
 *
 * La asercion no mira el pixel: recorre los ancestros, **intersecta sus cajas de
 * recorte** y exige que el area visible del panel sea su area completa. Con el
 * marcado anterior eso daba 0 px de alto visible (falla) y con el actual da el alto
 * entero (pasa).
 */

/** Alto/ancho del panel que de verdad se ve, descontando el recorte de sus ancestros. */
async function visibleBox(
  page: Page,
  selector: string,
): Promise<{ height: number; width: number; clippers: string[] }> {
  return await page.evaluate((target) => {
    const node = document.querySelector(target);
    if (node === null) return { height: 0, width: 0, clippers: ['no existe'] };
    const rect = node.getBoundingClientRect();
    let top = rect.top;
    let bottom = rect.bottom;
    let left = rect.left;
    let right = rect.right;
    const clippers: string[] = [];
    let ancestor = node.parentElement;
    while (ancestor !== null) {
      const style = window.getComputedStyle(ancestor);
      if (style.overflowX !== 'visible' || style.overflowY !== 'visible') {
        const box = ancestor.getBoundingClientRect();
        clippers.push(`${ancestor.tagName.toLowerCase()}[${style.overflowX}/${style.overflowY}]`);
        top = Math.max(top, box.top);
        bottom = Math.min(bottom, box.bottom);
        left = Math.max(left, box.left);
        right = Math.min(right, box.right);
      }
      ancestor = ancestor.parentElement;
    }
    return {
      height: Math.round(Math.max(0, bottom - top)),
      width: Math.round(Math.max(0, right - left)),
      clippers,
    };
  }, selector);
}

test.describe('Menu de categorias del encabezado', () => {
  test('el panel de subcategorias se ve completo, fuera del carril con scroll', async ({ page }) => {
    // Las categorias con hijas se descubren con el canal, nunca se codifican a mano.
    const categories = await getCategories();
    const withChildren = categories.filter((category) => category.children.length > 0);
    expect(
      withChildren.length,
      'El canal no publico ninguna categoria con subcategorias',
    ).toBeGreaterThan(0);
    const target = withChildren[0];
    expect(target).toBeDefined();
    if (target === undefined) return;

    await page.goto('/');

    const toggle = page.locator(
      `[data-testid="nav-category-toggle"][aria-label="Ver las subcategorias de ${target.name}"]`,
    );
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');

    const panel = page.getByTestId('nav-panel');
    await expect(panel).toBeVisible();
    // El panel es el que de verdad se pinta en su propio centro (no el contenido de
    // la pagina por detras): con el defecto, `elementFromPoint` devolvia el hero.
    const box = await panel.boundingBox();
    expect(box, 'El panel no se midio').not.toBeNull();
    if (box === null) return;
    const hit = await page.evaluate(
      ({ x, y }) => {
        const node = document.elementFromPoint(x, y);
        return node?.closest('[data-testid="nav-panel"]') !== null;
      },
      { x: box.x + box.width / 2, y: box.y + box.height / 2 },
    );
    expect(hit, 'El panel no es lo que se ve en su propio centro').toBe(true);

    // **La asercion del defecto**: nada lo recorta (antes: 0 de 121 px visibles).
    const visible = await visibleBox(page, '[data-testid="nav-panel"]');
    expect(
      visible.height,
      `El panel queda recortado por ${visible.clippers.join(', ') || 'ningun ancestro'}`,
    ).toBe(Math.round(box.height));
    expect(visible.width).toBe(Math.round(box.width));

    // Y el panel trae el arbol publicado: «Todo en X» mas cada hija con su conteo.
    const links = page.getByTestId('nav-panel-link');
    await expect(links).toHaveCount(target.children.length + 1);
    await expect(links.first()).toContainText(`Todo en ${target.name}`);

    // Navegar desde el panel: lleva a la categoria y el panel se cierra.
    await links.first().click();
    await expect(page).toHaveURL(new RegExp(`/categorias/${target.slug}$`));
    await expect(page.getByTestId('nav-panel')).toHaveCount(0);
  });

  test('el teclado abre el panel, entra en el con ArrowDown y sale con Escape', async ({ page }) => {
    const categories = await getCategories();
    const target = categories.find((category) => category.children.length > 0);
    expect(target, 'El canal no publico ninguna categoria con subcategorias').toBeDefined();
    if (target === undefined) return;

    await page.goto('/');
    const toggle = page.locator(
      `[data-testid="nav-category-toggle"][aria-label="Ver las subcategorias de ${target.name}"]`,
    );

    // El panel vive fuera del carril (es la unica forma de que el scroll no lo
    // recorte), asi que el teclado entra con ArrowDown en vez de atravesar el resto
    // de categorias; el boton declara `aria-expanded` y a quien controla.
    await toggle.focus();
    await page.keyboard.press('Enter');
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');
    // `aria-controls` aparece con el panel y nombra al panel abierto.
    await expect(toggle).toHaveAttribute('aria-controls', `nav-panel-${target.slug}`);
    await page.keyboard.press('ArrowDown');
    await expect(page.getByTestId('nav-panel-link').first()).toBeFocused();

    // Escape cierra el panel y devuelve el foco al boton que lo abrio.
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('nav-panel')).toHaveCount(0);
    await expect(toggle).toBeFocused();
  });
});
