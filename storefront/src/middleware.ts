import { NextResponse, type NextRequest } from 'next/server';

import { findChannelEntry, readChannelMap } from '@/lib/channel-map';

/**
 * **Enrutado por host** (T216-ter): un dominio que no tiene tienda configurada responde **404**
 * antes de renderizar.
 *
 * Qué hace y qué **no** hace, medido:
 *
 *  - **Sí**: leer el `Host`, consultar el mapa (`STOREFRONT_CHANNELS`) y cortar con 404 + una página
 *    mínima cuando el dominio no está declarado y no hay comodín `"*"`. Es lo que la capa de datos
 *    **no** puede hacer: cambiar el código de estado ni evitar que se renderice la página. Medido al
 *    no tenerlo: lanzar `notFound()` desde el cliente del canal provocaba un bucle, porque el pie de
 *    página vuelve a leer el canal al pintar la propia página de 404.
 *  - **No**: no toca la clave del canal ni pide datos al ERP. La elección de canal (clave, ciudad,
 *    identidad) vive en `@/lib/channels`, en el servidor, donde la clave no puede filtrarse al
 *    navegador (D10).
 *
 * Si `STOREFRONT_CHANNELS` está vacío (una empresa por despliegue) el middleware **no interviene**:
 * deja pasar todo, como antes.
 *
 * **Medido** (con `next start` y la variable en el entorno del proceso): el middleware la lee en
 * **runtime**, así que un despliegue puede cambiar el mapa sin reconstruir la imagen; en Vercel,
 * cambiar una variable de entorno exige **redesplegar** para que el despliegue la tome. El mapa que
 * decide el 404 es el mismo JSON que lee el servidor: una sola regla, en `@/lib/channel-map`.
 */
export function middleware(request: NextRequest): NextResponse {
  const map = readChannelMap(process.env.STOREFRONT_CHANNELS);
  if (map.size === 0) return NextResponse.next();

  const host = request.headers.get('x-forwarded-host') ?? request.headers.get('host');
  if (findChannelEntry(map, host) !== null) return NextResponse.next();

  const shown = (host ?? '(sin host)').replace(/:\d+$/, '');
  return new NextResponse(
    `<!doctype html><html lang="es"><head><meta charset="utf-8">` +
      `<meta name="robots" content="noindex"><title>Sin tienda en este dominio</title></head>` +
      `<body style="font-family:system-ui;max-width:44rem;margin:4rem auto;padding:0 1.5rem;line-height:1.6">` +
      `<h1 style="font-size:1.4rem">Este dominio no tiene tienda configurada</h1>` +
      `<p>No hay una tienda publicada para <strong>${shown}</strong>. Si eres el administrador, ` +
      `añade el dominio a la variable <code>STOREFRONT_CHANNELS</code> del despliegue (con la clave ` +
      `de esa empresa) o declara un canal <code>"*"</code> por defecto, y vuelve a desplegar.</p>` +
      `</body></html>`,
    { status: 404, headers: { 'content-type': 'text/html; charset=utf-8' } },
  );
}

/**
 * El middleware no mira assets ni fuentes: no pueden depender del dominio y ahorran el salto.
 */
export const config = {
  matcher: ['/((?!_next/static|_next/image|fonts|favicon.ico).*)'],
};
