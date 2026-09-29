import 'server-only';

import { cache } from 'react';
import { headers } from 'next/headers';

import { findChannelEntry, readChannelMap } from './channel-map';
import { SITE_DESCRIPTION, SITE_NAME, siteUrl } from './site';

/**
 * **Canal de la petición: la clave, la ciudad y la identidad, por host** (T216-ter).
 *
 * El tenant del canal sale de la **clave** (`x-storefront-key` → `WebApiKey` → `tenantId`). Lo que
 * añade este módulo es **elegir la clave por dominio**, para que un solo despliegue sirva N tiendas
 * sin `NEXT_PUBLIC_SITE_URL` ni ciudad globales (que serían los de otra empresa), y para que la
 * identidad y la canónica sean las del host que atiende la petición.
 *
 * **Reparto de responsabilidades** (medido, no preferencia):
 *
 *  - **`src/middleware.ts`** decide el **enrutado**: un dominio que no está en `STOREFRONT_CHANNELS`
 *    (y sin comodín `"*"`) responde **404** antes de renderizar. Vive ahí y no aquí porque la capa
 *    de datos **no puede** cambiar el código de estado ni cortar el render: lanzar `notFound()` desde
 *    el cliente del canal provocaba un **bucle** (el pie de página vuelve a leer el canal al pintar
 *    la propia página de 404 — medido al implementarlo).
 *  - **Aquí** (runtime Node, `server-only`) se decide **qué datos**: la clave de esa empresa, su
 *    ciudad por defecto y su identidad. La clave **nunca** sale al navegador (D10).
 *
 * La regla del mapa (normalización, `www.`, comodín) vive en `./channel-map`, compartida con el
 * middleware para que no haya dos interpretaciones del mismo JSON.
 *
 * **Sin `STOREFRONT_CHANNELS`** el comportamiento es el de siempre (una empresa por despliegue):
 * `STOREFRONT_API_KEY`, `STOREFRONT_CITY` y `NEXT_PUBLIC_SITE_*`.
 */

/** Canal resuelto para la petición en curso. */
export interface Channel {
  /** Patrón del mapa que casó (`*` cuando es el comodín). */
  host: string;
  /** Clave del canal. **Server-only**: no debe salir nunca al navegador (D10). */
  key: string;
  /** Ciudad por defecto de esta tienda (código del ERP, p. ej. `SCZ`). */
  city: string;
  /** Nombre de la empresa en la tienda. */
  name: string;
  /** Descripción para buscadores y redes. */
  description: string;
  /** URL publica de ESTE host (canonicos, Open Graph, sitemap y JSON-LD). */
  url: string;
}

/**
 * El dominio no está declarado en `STOREFRONT_CHANNELS` y no hay comodín `"*"`.
 *
 * Con el middleware en su sitio esta excepción **no** debería alcanzar al comprador (el 404 corta
 * antes); se mantiene como red de seguridad: si alguien llega aquí, ve un error accionable en vez
 * del catálogo de otra empresa.
 */
export class UnknownHostError extends Error {
  constructor(readonly host: string) {
    super(
      `No hay tienda configurada para el dominio "${host}". Añádelo a STOREFRONT_CHANNELS ` +
        '(o declara un canal "*" por defecto) y vuelve a desplegar.',
    );
    this.name = 'UnknownHostError';
  }
}

/** Host de la petición, mirando primero la cabecera del proxy (Vercel). */
function requestHost(): string | null {
  const store = headers();
  return store.get('x-forwarded-host') ?? store.get('host');
}

/**
 * Host **tal cual** viene en la petición, sin el puerto por defecto del esquema.
 *
 * Una canónica no debe llevar `:443`/`:80` (van implícitos), pero **sí** un puerto no estándar: en
 * desarrollo la tienda vive en `:3000`/`:3100` y en las previsualizaciones de Vercel el host es el
 * suyo. Medido al implementarlo: quitar el puerto siempre dejaba la canónica apuntando al 80.
 */
function canonicalHost(raw: string | null): string | null {
  if (raw === null) return null;
  const first = raw.split(',')[0]?.trim() ?? '';
  if (first === '') return null;
  const withoutDefaultPort = first
    .replace(/:80$/, '')
    .replace(/:443$/, '')
    .replace(/\.+$/, '')
    .toLowerCase();
  return withoutDefaultPort === '' ? null : withoutDefaultPort;
}

/** Esquema real de la petición (Vercel pone `x-forwarded-proto`; en local, http). */
function requestProtocol(): string {
  const proto = headers().get('x-forwarded-proto');
  const first = proto?.split(',')[0]?.trim().toLowerCase();
  return first === 'http' || first === 'https' ? first : 'http';
}

/** Canal de un despliegue de una sola empresa (sin `STOREFRONT_CHANNELS`). */
function legacyChannel(host: string | null): Channel {
  const normalized = host?.replace(/:\d+$/, '').replace(/\.+$/, '').toLowerCase() ?? '';
  return {
    host: normalized !== '' ? normalized : '*',
    key: process.env.STOREFRONT_API_KEY?.trim() ?? '',
    city: (process.env.STOREFRONT_CITY?.trim() ?? 'SCZ').toUpperCase(),
    name: SITE_NAME,
    description: SITE_DESCRIPTION,
    url:
      normalized !== '' ? `${requestProtocol()}://${normalized}` : siteUrl(),
  };
}

/**
 * Canal de la petición en curso: `Host` → mapa → canal. **Memoizado por petición** (`cache` de
 * React), así que el layout, el pie, el JSON-LD y el cliente del canal comparten una sola lectura.
 */
export const currentChannel = cache(async (): Promise<Channel> => {
  const host = requestHost();
  const map = readChannelMap(process.env.STOREFRONT_CHANNELS);

  if (map.size === 0) return legacyChannel(host);

  const matched = findChannelEntry(map, host);
  if (matched === null) throw new UnknownHostError(host ?? '(sin host)');

  const canonical = canonicalHost(host);
  // La canónica sale del host **real de la petición** (o de la declarada en el mapa): con N
  // dominios, un `NEXT_PUBLIC_SITE_URL` fijo sería la canónica de otra tienda.
  const url =
    matched.entry.url ??
    (canonical !== null ? `${requestProtocol()}://${canonical}` : siteUrl());

  return {
    host: matched.pattern,
    key: matched.entry.key,
    city: (matched.entry.city ?? process.env.STOREFRONT_CITY ?? 'SCZ').toUpperCase(),
    name: matched.entry.name ?? SITE_NAME,
    description: matched.entry.description ?? SITE_DESCRIPTION,
    url: url.replace(/\/+$/, ''),
  };
});

/**
 * Igual que `currentChannel()`, pero **no lanza** cuando el dominio no está declarado: devuelve la
 * identidad de respaldo (nombre/descripción del despliegue y URL del host) con la clave vacía.
 *
 * Existe para el **cascarón** (cabecera, pie, `robots`, `sitemap`): esas piezas tienen que poder
 * pintarse en cualquier respuesta, incluida la que el middleware devuelve a un dominio no
 * declarado. La clave **no** sale de aquí: quien pide datos usa `currentChannel()`.
 */
export const currentChannelOrDefault = cache(async (): Promise<Channel> => {
  try {
    return await currentChannel();
  } catch (error) {
    if (!(error instanceof UnknownHostError)) throw error;
    return legacyChannel(requestHost());
  }
});
