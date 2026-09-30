"use client";

import { useCallback, useEffect, useState } from "react";

import { formatMoney } from "@/lib/format";
import { paymentStatusLabel, statusLabel } from "@/lib/checkout";

/**
 * **Cuenta del comprador** (F4, 2026-09-30): alta, entrada, perfil y «Mis pedidos».
 *
 * Habla **solo** con `/api/cuenta` (el puente de la tienda): el token del canal vive en una cookie
 * **httpOnly** y este componente nunca lo ve —así un XSS no se lleva la sesión—. Cuando el canal
 * dice que la sesión ya no vale, la ruta borra la cookie y aquí se vuelve al formulario.
 */

interface AccountCustomer {
  id: number;
  email: string;
  name: string;
  lastName: string | null;
  phone: string | null;
  linkedToPartner: boolean;
  addresses: Array<{
    id: number;
    label: string | null;
    address: string;
    zone: string | null;
    city: string | null;
    isDefault: boolean;
  }>;
  lastLoginAt: string | null;
}

interface AccountOrder {
  orderNumber: string;
  trackingCode: string | null;
  status: string;
  paymentStatus: string;
  total: number;
  currency: string;
  createdAt: string;
  items: Array<{ name: string; quantity: number }>;
}

type Mode = "entrar" | "registro";

export function AccountPanel(): JSX.Element {
  const [mode, setMode] = useState<Mode>("entrar");
  const [customer, setCustomer] = useState<AccountCustomer | null>(null);
  const [orders, setOrders] = useState<AccountOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    email: "",
    password: "",
    name: "",
    lastName: "",
    phone: "",
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/cuenta", { cache: "no-store" });
      const payload = (await response.json()) as {
        customer?: AccountCustomer | null;
        orders?: AccountOrder[];
        error?: string;
      };
      if (!response.ok) {
        setError(payload.error ?? "No se pudo leer tu cuenta.");
        setCustomer(null);
        setOrders([]);
        return;
      }
      setCustomer(payload.customer ?? null);
      setOrders(payload.orders ?? []);
      setError(null);
    } catch {
      setError("No se pudo leer tu cuenta. Revisa tu conexion.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const submit = useCallback(
    async (action: Mode | "salir") => {
      setBusy(true);
      setError(null);
      try {
        const response = await fetch("/api/cuenta", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ action, ...form }),
        });
        const payload = (await response.json()) as {
          customer?: AccountCustomer | null;
          error?: string;
        };
        if (!response.ok) {
          setError(payload.error ?? "No se pudo completar la operacion.");
          return;
        }
        if (action === "salir") {
          setCustomer(null);
          setOrders([]);
          setForm({
            email: "",
            password: "",
            name: "",
            lastName: "",
            phone: "",
          });
          return;
        }
        setForm((current) => ({ ...current, password: "" }));
        await load();
      } catch {
        setError("No se pudo contactar con la tienda. Intentalo otra vez.");
      } finally {
        setBusy(false);
      }
    },
    [form, load],
  );

  if (loading) {
    return (
      <p className="text-sm text-fg-secondary" data-testid="account-loading">
        Cargando tu cuenta…
      </p>
    );
  }

  if (customer !== null) {
    return (
      <div className="flex flex-col gap-6" data-testid="account-profile">
        <div className="sf-card p-4">
          <p
            className="text-sm font-semibold text-fg"
            data-testid="account-name"
          >
            {customer.name}
            {customer.lastName === null ? "" : ` ${customer.lastName}`}
          </p>
          <p className="text-xs text-fg-secondary" data-testid="account-email">
            {customer.email}
          </p>
          <p className="mt-2 text-xs text-fg-tertiary">
            {customer.linkedToPartner
              ? "Tu cuenta esta enlazada a tu ficha de cliente del ERP: tus direcciones se editan alli."
              : "Tus pedidos quedan ligados a este correo. Para guardar direcciones, la tienda las enlaza a tu ficha del ERP."}
          </p>
          <button
            type="button"
            className="sf-button sf-button-ghost mt-3"
            onClick={() => void submit("salir")}
            disabled={busy}
            data-testid="account-logout"
          >
            Cerrar sesion
          </button>
        </div>

        {customer.addresses.length > 0 ? (
          <div className="sf-card p-4">
            <h2 className="sf-eyebrow">Tus direcciones</h2>
            <ul
              className="mt-2 flex flex-col gap-1"
              data-testid="account-addresses"
            >
              {customer.addresses.map((address) => (
                <li key={address.id} className="text-xs text-fg-secondary">
                  <span className="font-medium text-fg">
                    {address.label ?? address.address}
                  </span>
                  {" · "}
                  {address.address}
                  {address.zone === null ? "" : ` · ${address.zone}`}
                  {address.isDefault ? " · predeterminada" : ""}
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <div>
          <h2 className="sf-eyebrow">Mis pedidos</h2>
          {orders.length === 0 ? (
            <p
              className="mt-2 text-sm text-fg-secondary"
              data-testid="account-orders-empty"
            >
              Todavia no hay pedidos con este correo.
            </p>
          ) : (
            <ul
              className="mt-2 flex flex-col gap-2"
              data-testid="account-orders"
            >
              {orders.map((order) => (
                <li key={order.orderNumber} className="sf-card p-3">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <a
                      className="sf-link font-semibold"
                      href={
                        order.trackingCode === null
                          ? `/seguimiento?order=${encodeURIComponent(order.orderNumber)}`
                          : `/pedido/${encodeURIComponent(order.orderNumber)}?c=${encodeURIComponent(order.trackingCode)}`
                      }
                      data-testid="account-order-link"
                    >
                      {order.orderNumber}
                    </a>
                    <span className="text-sm font-medium text-fg">
                      {formatMoney(order.total, order.currency)}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-fg-secondary">
                    {statusLabel(order.status)} ·{" "}
                    {paymentStatusLabel(order.paymentStatus)} ·{" "}
                    {new Date(order.createdAt).toLocaleDateString("es-BO", {
                      day: "2-digit",
                      month: "2-digit",
                      year: "numeric",
                    })}{" "}
                    · {order.items.length}{" "}
                    {order.items.length === 1 ? "articulo" : "articulos"}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4" data-testid="account-form">
      <div className="flex gap-2" role="tablist" aria-label="Cuenta">
        {(["entrar", "registro"] as const).map((value) => (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={mode === value}
            className={`sf-button ${mode === value ? "sf-button-primary" : "sf-button-ghost"}`}
            onClick={() => {
              setMode(value);
              setError(null);
            }}
            data-testid={`account-tab-${value}`}
          >
            {value === "entrar" ? "Entrar" : "Crear cuenta"}
          </button>
        ))}
      </div>

      <form
        className="sf-card flex flex-col gap-3 p-4"
        onSubmit={(event) => {
          event.preventDefault();
          void submit(mode);
        }}
      >
        <label
          className="text-xs font-medium text-fg-secondary"
          htmlFor="cuenta-email"
        >
          Correo
        </label>
        <input
          id="cuenta-email"
          type="email"
          autoComplete="email"
          required
          className="sf-input"
          value={form.email}
          onChange={(event) => setForm({ ...form, email: event.target.value })}
          data-testid="account-email-input"
        />

        {mode === "registro" ? (
          <>
            <label
              className="text-xs font-medium text-fg-secondary"
              htmlFor="cuenta-nombre"
            >
              Nombre
            </label>
            <input
              id="cuenta-nombre"
              type="text"
              autoComplete="given-name"
              required
              className="sf-input"
              value={form.name}
              onChange={(event) =>
                setForm({ ...form, name: event.target.value })
              }
              data-testid="account-name-input"
            />
            <label
              className="text-xs font-medium text-fg-secondary"
              htmlFor="cuenta-apellido"
            >
              Apellido (opcional)
            </label>
            <input
              id="cuenta-apellido"
              type="text"
              autoComplete="family-name"
              className="sf-input"
              value={form.lastName}
              onChange={(event) =>
                setForm({ ...form, lastName: event.target.value })
              }
              data-testid="account-lastname-input"
            />
            <label
              className="text-xs font-medium text-fg-secondary"
              htmlFor="cuenta-telefono"
            >
              Telefono (opcional)
            </label>
            <input
              id="cuenta-telefono"
              type="tel"
              autoComplete="tel"
              className="sf-input"
              value={form.phone}
              onChange={(event) =>
                setForm({ ...form, phone: event.target.value })
              }
              data-testid="account-phone-input"
            />
          </>
        ) : null}

        <label
          className="text-xs font-medium text-fg-secondary"
          htmlFor="cuenta-clave"
        >
          Contrasena
        </label>
        <input
          id="cuenta-clave"
          type="password"
          autoComplete={
            mode === "registro" ? "new-password" : "current-password"
          }
          required
          minLength={mode === "registro" ? 8 : undefined}
          className="sf-input"
          value={form.password}
          onChange={(event) =>
            setForm({ ...form, password: event.target.value })
          }
          data-testid="account-password-input"
        />
        {mode === "registro" ? (
          <p className="text-2xs text-fg-tertiary">Minimo 8 caracteres.</p>
        ) : null}

        {error !== null ? (
          <p
            role="alert"
            className="text-xs text-fg-error"
            data-testid="account-error"
          >
            {error}
          </p>
        ) : null}

        <button
          type="submit"
          className="sf-button sf-button-primary"
          disabled={busy}
          data-testid="account-submit"
        >
          {busy
            ? "Un momento…"
            : mode === "entrar"
              ? "Entrar"
              : "Crear mi cuenta"}
        </button>
      </form>

      <p className="text-xs text-fg-tertiary">
        Tu sesion vive en una cookie de la tienda (no se guarda tu contrasena en
        el navegador) y los estados del pedido y del pago son los que publica el
        documento del ERP.
      </p>
    </div>
  );
}
