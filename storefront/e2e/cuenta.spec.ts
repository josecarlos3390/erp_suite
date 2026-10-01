import { expect, test } from "@playwright/test";

import { findShippableProduct, placeOrder } from "./helpers/erp-api";

/**
 * Gate E2E de la **cuenta de cliente** (F4, 2026-09-30): el comprador crea su cuenta, entra, ve
 * **sus** pedidos y cierra sesión.
 *
 * Lo que se mide aquí y no en el spec del backend: que la tienda guarde la sesión en una cookie
 * **httpOnly** (el token no lo ve JavaScript: un XSS no se lleva la sesión), que el formulario
 * funcione contra el canal real, que el historial sea el del **correo de la cuenta** y que cerrar
 * sesión vuelva al formulario.
 *
 * Los datos se **descubren** por el canal (el artículo para el pedido): nunca se codifican a mano.
 * Cada caso usa un correo distinto (`e2e-cuenta-…`) para no chocar con el `@@unique` del canal.
 */

const CITY = "SCZ";

/** Correo único por corrida: el canal no deja registrar dos cuentas con el mismo. */
function uniqueEmail(prefix: string): string {
  return `e2e-cuenta-${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}@example.com`;
}

test.describe("Cuenta de cliente (F4)", () => {
  test("sin sesion la pagina ofrece entrar o crear cuenta", async ({
    page,
  }) => {
    await page.goto("/cuenta");

    await expect(page.getByTestId("account-title")).toBeVisible();
    await expect(page.getByTestId("account-form")).toBeVisible();
    await expect(page.getByTestId("account-tab-entrar")).toHaveAttribute(
      "aria-selected",
      "true",
    );
    await expect(page.getByTestId("account-email-input")).toBeVisible();
    await expect(page.getByTestId("account-profile")).toHaveCount(0);
  });

  test("el que compro como invitado ve que no tiene contraseña y va al alta con su correo", async ({
    page,
  }) => {
    // Lo que le paso al usuario: `/cuenta` pedia «Entrar» y quien hizo un pedido **sin cuenta**
    // no tenia —ni sabia que necesitaba— una contraseña. El aviso lo dice y lleva al alta
    // **conservando el correo** ya escrito.
    const email = uniqueEmail("invitado");
    await page.goto("/cuenta");
    await page.getByTestId("account-email-input").fill(email);

    const hint = page.getByTestId("account-guest-hint");
    await expect(hint).toBeVisible();
    await expect(hint).toContainText("todavia no tienes contraseña");

    await page.getByTestId("account-create-password").click();

    await expect(page.getByTestId("account-tab-registro")).toHaveAttribute(
      "aria-selected",
      "true",
    );
    await expect(page.getByTestId("account-email-input")).toHaveValue(email);
    await expect(page.getByTestId("account-name-input")).toBeVisible();
    // El aviso es de «Entrar»: en el alta ya no aplica.
    await expect(page.getByTestId("account-guest-hint")).toHaveCount(0);
  });

  test("crear la cuenta deja la sesion en una cookie httpOnly y se puede cerrar", async ({
    page,
    context,
  }) => {
    const email = uniqueEmail("alta");

    await page.goto("/cuenta");
    await page.getByTestId("account-tab-registro").click();
    await page.getByTestId("account-email-input").fill(email);
    await page.getByTestId("account-name-input").fill("Compradora E2E");
    await page.getByTestId("account-password-input").fill("clave-e2e-2026");
    await page.getByTestId("account-submit").click();

    // El perfil aparece con el nombre y el correo de la cuenta.
    await expect(page.getByTestId("account-profile")).toBeVisible();
    await expect(page.getByTestId("account-name")).toHaveText("Compradora E2E");
    await expect(page.getByTestId("account-email")).toHaveText(email);
    // Sin pedidos todavia, y lo dice.
    await expect(page.getByTestId("account-orders-empty")).toBeVisible();

    // La sesion vive en una cookie **httpOnly**: el navegador la manda, JavaScript no la lee.
    const cookies = await context.cookies();
    const session = cookies.find(
      (cookie) => cookie.name === "storefront_session",
    );
    expect(session, "la cookie de sesion existe").toBeDefined();
    expect(session?.httpOnly).toBe(true);
    // Y el token **no** queda en el HTML (ni en un script que lo pueda leer).
    expect(await page.content()).not.toContain(
      session?.value ?? "no-hay-token",
    );

    // Cerrar sesion vuelve al formulario y borra la cookie.
    await page.getByTestId("account-logout").click();
    await expect(page.getByTestId("account-form")).toBeVisible();
    const after = await context.cookies();
    expect(
      after.find((cookie) => cookie.name === "storefront_session"),
    ).toBeUndefined();
  });

  test("el historial muestra el pedido hecho con ese correo y solo ese", async ({
    page,
  }) => {
    const target = await findShippableProduct(CITY);
    const email = uniqueEmail("historial");

    // Se compra **con ese correo** por el canal (el pedido del visitante, como en el checkout).
    const order = await placeOrder({
      idempotencyKey: `e2e-cuenta-${Date.now().toString(36)}`,
      cityCode: CITY,
      items: [{ itemId: target.itemId, quantity: 1 }],
      customer: {
        email,
        name: "Comprador Historial",
        phone: "70012345",
        street: "Av. Los Sauces #120",
        district: "Equipetrol",
      },
    });

    // La cuenta se crea **despues** de comprar: el historial va por correo, no por una relacion
    // previa (es el caso real del comprador que compra como invitado y luego se registra).
    await page.goto("/cuenta");
    await page.getByTestId("account-tab-registro").click();
    await page.getByTestId("account-email-input").fill(email);
    await page.getByTestId("account-name-input").fill("Comprador Historial");
    await page.getByTestId("account-password-input").fill("clave-e2e-2026");
    await page.getByTestId("account-submit").click();

    await expect(page.getByTestId("account-orders")).toBeVisible();
    const links = page.getByTestId("account-order-link");
    await expect(links).toHaveCount(1);
    await expect(links.first()).toHaveText(order.orderNumber);
    // Y lleva a la confirmacion del pedido con su codigo (la pantalla que ya existe).
    await expect(links.first()).toHaveAttribute(
      "href",
      new RegExp(`/pedido/${order.orderNumber}\\?c=`),
    );
  });

  test("una sesion invalida no deja ver la cuenta: vuelve al formulario", async ({
    page,
    context,
  }) => {
    // Cookie con un token que el canal no reconoce (firmado por nadie).
    await context.addCookies([
      {
        name: "storefront_session",
        value: "token-invalido-de-prueba",
        domain: "127.0.0.1",
        path: "/",
        httpOnly: true,
      },
    ]);

    await page.goto("/cuenta");

    // La tienda no muestra un error que el comprador no puede arreglar: borra la cookie y le
    // ofrece entrar. (El canal responde 401 y la ruta lo traduce.)
    await expect(page.getByTestId("account-form")).toBeVisible();
    await expect(page.getByTestId("account-profile")).toHaveCount(0);
    const cookies = await context.cookies();
    expect(
      cookies.find((cookie) => cookie.name === "storefront_session"),
    ).toBeUndefined();
  });
});
