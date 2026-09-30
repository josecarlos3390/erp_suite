import type { Metadata } from "next";

import { AccountPanel } from "@/components/account-panel";

/**
 * **Mi cuenta** (F4, 2026-09-30): la cara del comprador de la cuenta de cliente del canal. El
 * formulario y el historial viven en `AccountPanel` (componente de cliente) porque hablan con
 * `/api/cuenta`; esta página solo pone el marco.
 *
 * `robots: noindex` a propósito: es una pantalla privada y no aporta nada en un buscador.
 */
export const metadata: Metadata = {
  title: "Mi cuenta",
  description:
    "Entra con tu correo para ver tus pedidos de la tienda y el estado de tu pago.",
  robots: { index: false, follow: false },
};

export default function AccountPage(): JSX.Element {
  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <p className="sf-eyebrow">Tu cuenta</p>
        <h1 className="sf-h1 text-fg" data-testid="account-title">
          Mi cuenta
        </h1>
        <p className="text-sm text-fg-secondary">
          Entra con el correo con el que hiciste tus pedidos: veras su estado y
          el del pago, tal como los publica el ERP.
        </p>
      </header>

      <AccountPanel />
    </div>
  );
}
