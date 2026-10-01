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

  const [editingProfile, setEditingProfile] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [profileForm, setProfileForm] = useState({
    name: "",
    lastName: "",
    phone: "",
  });
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: "",
    newPassword: "",
  });

  useEffect(() => {
    void load();
  }, [load]);

  /**
   * Manda una acción de la cuenta que **exige sesión** (`perfil`, `clave`) y refresca: un solo
   * sitio para el error, el aviso y el estado ocupado. Un 401 lo resuelve la ruta borrando la
   * cookie, así que aquí solo hay que decir qué pasó.
   */
  const send = useCallback(
    async (
      action: "perfil" | "clave",
      payload: Record<string, string>,
    ): Promise<boolean> => {
      setBusy(true);
      setError(null);
      setNotice(null);
      try {
        const response = await fetch("/api/cuenta", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ action, ...payload }),
        });
        const body = (await response.json()) as {
          customer?: AccountCustomer | null;
          error?: string;
        };
        if (!response.ok) {
          setError(body.error ?? "No se pudo completar la operacion.");
          return false;
        }
        if (body.customer !== undefined && body.customer !== null) {
          setCustomer(body.customer);
        } else {
          await load();
        }
        return true;
      } catch {
        setError("No se pudo contactar con la tienda. Intentalo otra vez.");
        return false;
      } finally {
        setBusy(false);
      }
    },
    [load],
  );

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
    const fullName = `${customer.name}${
      customer.lastName === null ? "" : ` ${customer.lastName}`
    }`;
    const initials = fullName
      .split(/\s+/)
      .filter((part) => part !== "")
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? "")
      .join("");

    return (
      <div className="flex flex-col gap-6" data-testid="account-profile">
        {/*
          Cabecera de la cuenta: **quien eres** (con su marca) y **la salida**, en la misma linea
          y separadas de los datos. Antes «Cerrar sesion» era un boton fantasma debajo del texto,
          indistinguible del resto: ahora es un boton **con borde y su icono**, al otro lado de la
          cabecera, que es donde el comprador lo busca.
        */}
        <header className="sf-card flex flex-wrap items-center justify-between gap-3 p-4">
          <div className="flex items-center gap-3">
            <span
              aria-hidden="true"
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary-soft text-md font-bold text-fg-accent"
            >
              {initials}
            </span>
            <div className="flex min-w-0 flex-col">
              <p
                className="truncate text-sm font-semibold text-fg"
                data-testid="account-name"
              >
                {fullName}
              </p>
              <p
                className="truncate text-xs text-fg-secondary"
                data-testid="account-email"
              >
                {customer.email}
              </p>
            </div>
          </div>

          <button
            type="button"
            className="sf-button sf-button-ghost inline-flex items-center gap-2 border border-line"
            onClick={() => void submit("salir")}
            disabled={busy}
            data-testid="account-logout"
          >
            <span aria-hidden="true">
              <svg
                viewBox="0 0 24 24"
                className="h-4 w-4"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.7"
                strokeLinecap="round"
                strokeLinejoin="round"
                focusable="false"
              >
                <path d="M15 12H4" />
                <path d="m8 8-4 4 4 4" />
                <path d="M11 4h6a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-6" />
              </svg>
            </span>
            {busy ? "Cerrando…" : "Cerrar sesión"}
          </button>
        </header>

        <p className="text-xs text-fg-tertiary">
          {customer.linkedToPartner
            ? "Tu cuenta esta enlazada a tu ficha de cliente del ERP: tus direcciones se editan alli."
            : "Tus pedidos quedan ligados a este correo. Para guardar direcciones, la tienda las enlaza a tu ficha del ERP."}
        </p>

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

        {/*
          Lo que el comprador puede **cambiar** de su cuenta (F4): sus datos y su contraseña.
          Antes esta pantalla solo dejaba entrar y salir, aunque el canal ya publicaba las dos
          operaciones (`PATCH /me` y `POST /me/password`).
        */}
        <div className="flex flex-col gap-3">
          <h2 className="sf-eyebrow">Tus datos</h2>

          {notice !== null ? (
            <p
              className="rounded-btn bg-ok-soft px-3 py-2 text-xs font-medium text-fg"
              data-testid="account-notice"
            >
              {notice}
            </p>
          ) : null}

          {error !== null ? (
            <p
              role="alert"
              className="text-xs text-fg-error"
              data-testid="account-actions-error"
            >
              {error}
            </p>
          ) : null}

          {!editingProfile ? (
            <button
              type="button"
              className="sf-button sf-button-ghost self-start border border-line"
              onClick={() => {
                setProfileForm({
                  name: customer.name,
                  lastName: customer.lastName ?? "",
                  phone: customer.phone ?? "",
                });
                setEditingProfile(true);
                setNotice(null);
                setError(null);
              }}
              data-testid="account-edit-profile"
            >
              Editar mis datos
            </button>
          ) : (
            <form
              className="sf-card flex flex-col gap-3 p-4"
              onSubmit={(event) => {
                event.preventDefault();
                void (async () => {
                  const ok = await send("perfil", {
                    name: profileForm.name.trim(),
                    lastName: profileForm.lastName.trim(),
                    phone: profileForm.phone.trim(),
                  });
                  if (ok) {
                    setEditingProfile(false);
                    setNotice("Tus datos quedaron guardados.");
                  }
                })();
              }}
            >
              <label
                className="text-xs font-medium text-fg-secondary"
                htmlFor="perfil-nombre"
              >
                Nombre
              </label>
              <input
                id="perfil-nombre"
                type="text"
                required
                autoComplete="given-name"
                className="sf-input"
                value={profileForm.name}
                onChange={(event) =>
                  setProfileForm({ ...profileForm, name: event.target.value })
                }
                data-testid="account-profile-name"
              />
              <label
                className="text-xs font-medium text-fg-secondary"
                htmlFor="perfil-apellido"
              >
                Apellido (opcional)
              </label>
              <input
                id="perfil-apellido"
                type="text"
                autoComplete="family-name"
                className="sf-input"
                value={profileForm.lastName}
                onChange={(event) =>
                  setProfileForm({
                    ...profileForm,
                    lastName: event.target.value,
                  })
                }
                data-testid="account-profile-lastname"
              />
              <label
                className="text-xs font-medium text-fg-secondary"
                htmlFor="perfil-telefono"
              >
                Telefono (opcional)
              </label>
              <input
                id="perfil-telefono"
                type="tel"
                autoComplete="tel"
                className="sf-input"
                value={profileForm.phone}
                onChange={(event) =>
                  setProfileForm({ ...profileForm, phone: event.target.value })
                }
                data-testid="account-profile-phone"
              />
              <div className="flex flex-wrap gap-2">
                <button
                  type="submit"
                  className="sf-button sf-button-primary"
                  disabled={busy}
                  data-testid="account-profile-save"
                >
                  {busy ? "Guardando…" : "Guardar mis datos"}
                </button>
                <button
                  type="button"
                  className="sf-button sf-button-ghost"
                  disabled={busy}
                  onClick={() => {
                    setEditingProfile(false);
                    setError(null);
                  }}
                  data-testid="account-profile-cancel"
                >
                  Cancelar
                </button>
              </div>
            </form>
          )}

          {!changingPassword ? (
            <button
              type="button"
              className="sf-button sf-button-ghost self-start border border-line"
              onClick={() => {
                setPasswordForm({ currentPassword: "", newPassword: "" });
                setChangingPassword(true);
                setNotice(null);
                setError(null);
              }}
              data-testid="account-change-password"
            >
              Cambiar mi contraseña
            </button>
          ) : (
            <form
              className="sf-card flex flex-col gap-3 p-4"
              onSubmit={(event) => {
                event.preventDefault();
                void (async () => {
                  const ok = await send("clave", {
                    currentPassword: passwordForm.currentPassword,
                    newPassword: passwordForm.newPassword,
                  });
                  if (ok) {
                    setChangingPassword(false);
                    setPasswordForm({ currentPassword: "", newPassword: "" });
                    setNotice("Tu contraseña quedó cambiada.");
                  }
                })();
              }}
            >
              <label
                className="text-xs font-medium text-fg-secondary"
                htmlFor="clave-actual"
              >
                Contraseña actual
              </label>
              <input
                id="clave-actual"
                type="password"
                required
                autoComplete="current-password"
                className="sf-input"
                value={passwordForm.currentPassword}
                onChange={(event) =>
                  setPasswordForm({
                    ...passwordForm,
                    currentPassword: event.target.value,
                  })
                }
                data-testid="account-current-password"
              />
              <label
                className="text-xs font-medium text-fg-secondary"
                htmlFor="clave-nueva"
              >
                Contraseña nueva
              </label>
              <input
                id="clave-nueva"
                type="password"
                required
                minLength={8}
                autoComplete="new-password"
                className="sf-input"
                value={passwordForm.newPassword}
                onChange={(event) =>
                  setPasswordForm({
                    ...passwordForm,
                    newPassword: event.target.value,
                  })
                }
                data-testid="account-new-password"
              />
              <p className="text-2xs text-fg-tertiary">
                Minimo 8 caracteres. Las sesiones abiertas siguen valiendo.
              </p>
              <div className="flex flex-wrap gap-2">
                <button
                  type="submit"
                  className="sf-button sf-button-primary"
                  disabled={busy}
                  data-testid="account-password-save"
                >
                  {busy ? "Cambiando…" : "Cambiar mi contraseña"}
                </button>
                <button
                  type="button"
                  className="sf-button sf-button-ghost"
                  disabled={busy}
                  onClick={() => {
                    setChangingPassword(false);
                    setError(null);
                  }}
                  data-testid="account-password-cancel"
                >
                  Cancelar
                </button>
              </div>
            </form>
          )}
        </div>

        <div>
          <h2 className="sf-eyebrow">Mis pedidos</h2>
          {orders.length === 0 ? (
            <div
              className="sf-card mt-2 flex flex-col items-start gap-2 p-4"
              data-testid="account-orders-empty"
            >
              <p className="text-sm text-fg-secondary">
                Todavia no hay pedidos con este correo.
              </p>
              <a className="sf-button sf-button-primary" href="/categorias">
                Ver el catalogo
              </a>
            </div>
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
                  {/* Estado y pago como **chips**: antes eran una linea corrida de texto y no se
                      distinguia de un vistazo si el pedido estaba pagado. */}
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-elevated px-2 py-0.5 text-2xs font-semibold text-fg-secondary">
                      {statusLabel(order.status)}
                    </span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-2xs font-semibold ${
                        order.paymentStatus === "paid"
                          ? "bg-ok-soft text-fg"
                          : "bg-elevated text-fg-secondary"
                      }`}
                    >
                      {paymentStatusLabel(order.paymentStatus)}
                    </span>
                    <span className="text-xs text-fg-tertiary">
                      {new Date(order.createdAt).toLocaleDateString("es-BO", {
                        day: "2-digit",
                        month: "2-digit",
                        year: "numeric",
                      })}{" "}
                      · {order.items.length}{" "}
                      {order.items.length === 1 ? "articulo" : "articulos"}
                    </span>
                  </div>
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

      {/* F4 — el comprador que hizo un pedido **sin cuenta** no tiene contraseña: se le dice y se
          le lleva al alta con el correo ya escrito (antes solo veia «Entrar» y no sabia que
          contrasena poner). */}
      {mode === "entrar" ? (
        <div
          className="sf-card flex flex-col gap-2 p-3"
          data-testid="account-guest-hint"
        >
          <p className="text-sm text-fg-secondary">
            <strong className="text-fg">¿Compraste como invitado?</strong> Si
            hiciste un pedido sin crear una cuenta,{" "}
            <strong>todavia no tienes contraseña</strong>: creala aqui con el
            mismo correo con el que compraste y veras tus pedidos.
          </p>
          <button
            type="button"
            className="sf-button sf-button-ghost self-start"
            onClick={() => {
              setMode("registro");
              setError(null);
            }}
            data-testid="account-create-password"
          >
            Crear mi contraseña con el correo de mi pedido
          </button>
        </div>
      ) : null}

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
