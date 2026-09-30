import "server-only";

import { cookies } from "next/headers";

/**
 * **Sesión del comprador en la tienda** (F4, 2026-09-30).
 *
 * El token lo emite el canal (`POST /storefront/customers` y `…/login`) y la tienda lo guarda en
 * una cookie **httpOnly**: el navegador la manda en cada petición al servidor de la tienda, pero
 * **JavaScript no puede leerla** (un XSS no se lleva la sesión), y el canal no la ve nunca porque
 * quien habla con él es el servidor de la tienda (`route handler`), que añade el
 * `Authorization: Bearer`.
 *
 * Decisiones deliberadas: `sameSite: 'lax'` (la cookie no viaja en peticiones cruzadas, pero
 * sobrevive a la navegación normal), `secure` **solo** en producción (en local la tienda va por
 * HTTP) y **30 días**, los mismos que dura el token: si la cookie viviera más que el token, el
 * comprador vería «sesión caducada» sin motivo; si viviera menos, tendría que entrar de nuevo sin
 * que nadie se lo pidiera.
 */
export const CUSTOMER_COOKIE = "storefront_session";

export const CUSTOMER_COOKIE_MAX_AGE = 30 * 24 * 60 * 60;

/** Token de la sesión, o `null` si no hay (o está vacío). */
export function readCustomerToken(): string | null {
  const value = cookies().get(CUSTOMER_COOKIE)?.value?.trim() ?? "";
  return value === "" ? null : value;
}

/** Guarda la sesión. */
export function writeCustomerSession(token: string): void {
  cookies().set({
    name: CUSTOMER_COOKIE,
    value: token,
    path: "/",
    maxAge: CUSTOMER_COOKIE_MAX_AGE,
    sameSite: "lax",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
  });
}

/** Cierra la sesión en la tienda (el token sigue siendo válido en el canal hasta que caduque). */
export function clearCustomerSession(): void {
  cookies().delete(CUSTOMER_COOKIE);
}
