import Link from "next/link";

import { readCustomerToken } from "@/lib/customer-session";

/**
 * Enlace a la **cuenta del comprador** (F4) en la cabecera.
 *
 * Es un componente de **servidor** y por eso puede leer la cookie de sesión —`httpOnly`: el
 * navegador no la ve— y cambiar el rótulo: «Mi cuenta» con sesión, «Entrar» sin ella, así que el
 * comprador sabe de un vistazo si está dentro. **No** llama al canal: la sesión solo se comprueba
 * cuando entra a `/cuenta` (un token caducado se resuelve allí borrando la cookie).
 *
 * Antes de esto la cuenta existía pero **no se llegaba a ella desde ningún sitio**: la entrada
 * vivía solo en el resumen del pedido, al final del checkout.
 */
export function AccountLink(): JSX.Element {
  const signedIn = readCustomerToken() !== null;

  return (
    <Link
      href="/cuenta"
      className="sf-btn sf-btn-secondary gap-2 px-3"
      aria-label={signedIn ? "Mi cuenta" : "Entrar en tu cuenta"}
      data-testid="account-link"
    >
      <span aria-hidden="true">
        <svg
          viewBox="0 0 24 24"
          className="h-5 w-5"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
          focusable="false"
        >
          <circle cx="12" cy="8.5" r="3.5" />
          <path d="M5 20c0-3.3 3.1-5.5 7-5.5s7 2.2 7 5.5" />
        </svg>
      </span>
      <span className="hidden sm:inline" data-testid="account-link-label">
        {signedIn ? "Mi cuenta" : "Entrar"}
      </span>
    </Link>
  );
}
