/**
 * Enlace al mapa de un punto de la empresa (sucursal o tienda de retiro) — **un solo sitio**.
 *
 * El canal publica el mapa **ya armado** por el ERP (`mapUrl`) y, cuando el maestro tiene
 * ubicacion pero nadie escribio el enlace, las coordenadas (`latitude`/`longitude`). La tienda
 * no puede inventar un enlace a partir de una direccion en texto (Google no resolveria la
 * direccion boliviana de forma fiable), asi que la regla es:
 *
 *  1. `mapUrl` si viene (se respeta el enlace del maestro tal cual, sin reconstruirlo);
 *  2. si no, `https://www.google.com/maps?q=<lat>,<lng>` cuando hay **las dos** coordenadas;
 *  3. si no hay ni enlace ni coordenadas validas → `null`, y **quien pinta no pinta el enlace**
 *     (nada de enlaces vacios ni `href="#"`, que anuncian un mapa que no existe).
 *
 * Vive aqui —y no en cada componente— porque la misma regla la usan la pagina publica de
 * sucursales y el checkout (paso 2 y resumen del paso 3), y una copia por componente es
 * exactamente como se acaba pintando un enlace roto en una pantalla y no en la otra.
 *
 * Es **pura** (sin `fetch`, sin `next/*`, sin estado): se puede probar directamente.
 */
export interface MapPoint {
  /** Enlace al mapa publicado por el ERP; puede faltar o venir vacio. */
  mapUrl?: string | null;
  latitude?: number | null;
  longitude?: number | null;
}

/** Coordenada usable: numero finito **dentro** de su rango geografico (0 es valido). */
function isCoordinate(value: number, min: number, max: number): boolean {
  return Number.isFinite(value) && value >= min && value <= max;
}

/**
 * Devuelve la URL del mapa del punto, o `null` cuando no hay nada honesto que pintar.
 *
 * Ojo con el `0`: `0,0` es una coordenada real (golfo de Guinea), asi que las comprobaciones
 * son explicitas (`null`/`undefined`) y no por veracidad — un `if (latitude)` silenciaria
 * cualquier punto que caiga en el meridiano o en el ecuador.
 */
export function buildMapLink(point: MapPoint): string | null {
  const mapUrl = point.mapUrl?.trim() ?? '';
  if (mapUrl !== '') return mapUrl;

  const { latitude, longitude } = point;
  if (latitude === null || latitude === undefined) return null;
  if (longitude === null || longitude === undefined) return null;
  if (!isCoordinate(latitude, -90, 90)) return null;
  if (!isCoordinate(longitude, -180, 180)) return null;

  return `https://www.google.com/maps?q=${latitude},${longitude}`;
}
