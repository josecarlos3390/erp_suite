import { NextResponse } from "next/server";

import {
  CUSTOMER_COOKIE,
  clearCustomerSession,
  readCustomerToken,
  writeCustomerSession,
} from "@/lib/customer-session";
import { ErpError, erpCustomer } from "@/lib/erp";

/**
 * **Puente de la cuenta del comprador** (F4, 2026-09-30): el único sitio donde el token de sesión
 * cruza la frontera. El navegador solo habla con **esta** ruta (`/api/cuenta`), nunca con el canal:
 *  - `GET`  → perfil y pedidos del comprador con sesión (`customer: null` si no hay).
 *  - `POST` → `{ action: 'registro' | 'entrar' | 'salir' }`: alta, inicio de sesión o cierre.
 *
 * El token viaja al canal como `Authorization: Bearer` y a la tienda como cookie **httpOnly**
 * (ver `lib/customer-session.ts`). Si el canal responde **401** (token caducado o revocado), la
 * cookie se **borra** y la tienda se comporta como si no hubiera sesión: el comprador ve el
 * formulario de entrada en vez de un error que no puede arreglar.
 */
export async function GET(): Promise<NextResponse> {
  const token = readCustomerToken();
  if (token === null) {
    return NextResponse.json({ customer: null, orders: [] });
  }

  try {
    const customer = await erpCustomer<unknown>(
      "GET",
      "/storefront/customers/me",
      {
        token,
      },
    );
    const orders = await erpCustomer<unknown[]>(
      "GET",
      "/storefront/customers/me/orders",
      { token },
    );
    return NextResponse.json({ customer, orders });
  } catch (error) {
    if (error instanceof ErpError && error.status === 401) {
      const response = NextResponse.json({ customer: null, orders: [] });
      response.cookies.delete(CUSTOMER_COOKIE);
      return response;
    }
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "No se pudo leer la cuenta en el ERP.",
      },
      { status: 502 },
    );
  }
}

interface AccountActionBody {
  action?: unknown;
  email?: unknown;
  password?: unknown;
  name?: unknown;
  lastName?: unknown;
  phone?: unknown;
  currentPassword?: unknown;
  newPassword?: unknown;
}

/** Recorta un campo de texto del cuerpo (el canal valida sus longitudes). */
function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export async function POST(request: Request): Promise<NextResponse> {
  let body: AccountActionBody | null = null;
  try {
    body = (await request.json()) as AccountActionBody;
  } catch {
    body = null;
  }
  const action = text(body?.action);

  if (action === "salir") {
    clearCustomerSession();
    return NextResponse.json({ customer: null });
  }

  // Acciones que **exigen sesión**: editar el perfil y cambiar la contraseña. Se resuelven con el
  // token de la cookie; un 401 del canal borra la cookie y devuelve al formulario.
  if (action === "perfil" || action === "clave") {
    const token = readCustomerToken();
    if (token === null) {
      return NextResponse.json(
        { error: "Tu sesion ha caducado. Entra de nuevo." },
        { status: 401 },
      );
    }
    try {
      if (action === "perfil") {
        const fields = {
          ...(text(body?.name) === "" ? {} : { name: text(body?.name) }),
          ...(text(body?.lastName) === ""
            ? {}
            : { lastName: text(body?.lastName) }),
          ...(text(body?.phone) === "" ? {} : { phone: text(body?.phone) }),
        };
        if (Object.keys(fields).length === 0) {
          return NextResponse.json(
            { error: "Escribe al menos tu nombre para guardar tus datos." },
            { status: 400 },
          );
        }
        const customer = await erpCustomer<unknown>(
          "PATCH",
          "/storefront/customers/me",
          { token, body: fields },
        );
        return NextResponse.json({ customer });
      }

      const currentPassword =
        typeof body?.currentPassword === "string" ? body.currentPassword : "";
      const newPassword =
        typeof body?.newPassword === "string" ? body.newPassword : "";
      if (currentPassword === "" || newPassword === "") {
        return NextResponse.json(
          { error: "Escribe tu contrasena actual y la nueva." },
          { status: 400 },
        );
      }
      await erpCustomer<unknown>("POST", "/storefront/customers/me/password", {
        token,
        body: { currentPassword, newPassword },
      });
      return NextResponse.json({ ok: true });
    } catch (error) {
      if (error instanceof ErpError) {
        const status =
          error.status >= 400 && error.status <= 599 ? error.status : 502;
        const response = NextResponse.json(
          { error: error.message },
          { status },
        );
        // El **401 de `clave`** es «la contraseña actual no es correcta», no una sesión
        // caducada: borrar la cookie ahí echaría al comprador por equivocarse al teclearla
        // (medido en el E2E). En `perfil` sí es la sesión, y se borra para volver al formulario.
        if (error.status === 401 && action === "perfil") {
          response.cookies.delete(CUSTOMER_COOKIE);
        }
        return response;
      }
      return NextResponse.json(
        { error: "No se pudo completar la operacion con el ERP." },
        { status: 502 },
      );
    }
  }

  if (action !== "registro" && action !== "entrar") {
    return NextResponse.json(
      { error: "Accion de cuenta invalida." },
      { status: 400 },
    );
  }

  const email = text(body?.email);
  const password = typeof body?.password === "string" ? body.password : "";
  if (email === "" || password === "") {
    return NextResponse.json(
      { error: "Escribe tu correo y tu contrasena." },
      { status: 400 },
    );
  }
  if (action === "registro" && text(body?.name) === "") {
    return NextResponse.json(
      { error: "Escribe tu nombre para crear la cuenta." },
      { status: 400 },
    );
  }

  const endpoint =
    action === "registro"
      ? "/storefront/customers"
      : "/storefront/customers/login";
  const payload =
    action === "registro"
      ? {
          email,
          password,
          name: text(body?.name),
          ...(text(body?.lastName) === ""
            ? {}
            : { lastName: text(body?.lastName) }),
          ...(text(body?.phone) === "" ? {} : { phone: text(body?.phone) }),
        }
      : { email, password };

  try {
    const session = await erpCustomer<{ token: string; customer: unknown }>(
      "POST",
      endpoint,
      { body: payload },
    );
    writeCustomerSession(session.token);
    return NextResponse.json({ customer: session.customer });
  } catch (error) {
    if (error instanceof ErpError) {
      // El canal ya dice qué pasó (401 credenciales, 409 correo repetido, 400 validacion): se
      // propaga su texto tal cual para que el comprador lea el motivo real.
      const status =
        error.status >= 400 && error.status <= 599 ? error.status : 502;
      return NextResponse.json({ error: error.message }, { status });
    }
    return NextResponse.json(
      { error: "No se pudo completar la operacion con el ERP." },
      { status: 502 },
    );
  }
}
