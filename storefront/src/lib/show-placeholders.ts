import 'server-only';

import { SHOW_PLACEHOLDERS_ENV, showPlaceholdersFrom } from './media';

/**
 * **Modo demostracion de imagenes**: ¿se pintan las fotos de relleno del seed como fotos reales?
 *
 * Existe porque la decision **D24** («un marcador de posicion no es una foto del producto») sigue
 * siendo el comportamiento **por defecto** y no se toca: mientras la tienda es de prueba, quien la
 * enseña quiere ver el catalogo con fotos —aunque sean aleatorias y no representen el articulo— y
 * eso es una **configuracion**, no un cambio de regla.
 *
 * **Por que se lee aqui y no con `NEXT_PUBLIC_`** (medido antes de decidirlo):
 *
 *  - Los componentes que deciden el monograma (`product-image`, `product-gallery`) son de
 *    **cliente**, pero su HTML lo pinta el **servidor** en cada peticion: la bandera llega al
 *    navegador **por contexto** desde el layout (`ShowPlaceholdersProvider`), con el **mismo** valor
 *    en servidor y en cliente (sin desajuste de hidratacion). No hace falta que viaje por el bundle.
 *  - `next@14.2.32` **incrusta** `process.env.NEXT_PUBLIC_*` en el build —cliente y servidor— en
 *    `build/webpack/plugins/define-env-plugin.js`, asi que con el prefijo el interruptor quedaria
 *    cocido en `.next`: apagarlo exigiria **reconstruir**, y el `true` de `.env.local` (que
 *    `next start` **si** carga: `NextServer.loadEnvConfig({ dev: false })` + `@next/env`) entraria
 *    en el build que sirven los gates visual, de accesibilidad, de rendimiento y el funcional.
 *
 * Se lee **en cada llamada** (no al importar) para que el valor sea el del proceso que sirve la
 * peticion: el layout la resuelve una vez por render y el resto de la tienda la recibe por contexto.
 * Sin la variable (o con cualquier valor distinto de `true`) el resultado es el de siempre.
 */
export function showPlaceholderImages(): boolean {
  return showPlaceholdersFrom(process.env[SHOW_PLACEHOLDERS_ENV]);
}
