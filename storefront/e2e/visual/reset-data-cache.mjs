#!/usr/bin/env node
/**
 * Vacía la **caché de datos** de Next antes de levantar el servidor del gate visual.
 *
 * **Por qué existe (T230, defecto medido).** La tienda pide el canal con ISR de datos
 * (`src/lib/erp.ts` → `REVALIDATE.product = 60`, catálogo 60 s, categorías 300 s…) y esa
 * caché **vive en disco** (`.next/cache/fetch-cache`), así que **sobrevive** al
 * `next start` de cada corrida. Con una entrada vieja, Next sirve la copia **caducada**
 * mientras revalida en segundo plano (`stale-while-revalidate`): la **primera** visita a
 * una ruta de cada corrida se pinta con los datos de la corrida **anterior** y la
 * **segunda** con los de ésta — y el fixture se grababa igual, porque la revalidación sí
 * sale a la red.
 *
 * Medido al regrabar el fixture de T230: con el fixture ya regrabado (la ficha con
 * `services` y `canRequestService`), `producto-claro` —la **primera** captura de la
 * ficha— siguió saliendo **sin** el bloque de servicios ni el formulario de servicio
 * técnico (idéntica al baseline viejo, así que el gate no la regeneró) mientras
 * `producto-oscuro` —la **segunda**— sí los pintaba. Es decir: el gate daba por buena una
 * pantalla con los datos de la corrida anterior, que es justo lo que el fixture existe
 * para evitar.
 *
 * Con la caché vaciada al arrancar, cada captura se renderiza con el fixture de **esta**
 * corrida. Dentro de la corrida la caché sigue funcionando —y no molesta: el fixture es
 * inmutable mientras dura—, así que el coste es un arranque en frío, no una corrida sin
 * caché.
 *
 * **Uso**: lo llama el `webServer` de `playwright.visual.config.ts`, antes de
 * `next start`. No toca nada más de `.next`.
 */
import { existsSync, readdirSync, rmSync } from "node:fs";
import { join } from "node:path";

const DIR = join(process.cwd(), ".next", "cache", "fetch-cache");

if (!existsSync(DIR)) {
  console.log(
    "[gate visual] sin caché de datos previa: cada captura se renderiza con el fixture de esta corrida.",
  );
  process.exit(0);
}

let entries = 0;
try {
  entries = readdirSync(DIR).length;
} catch {
  entries = 0;
}

rmSync(DIR, { recursive: true, force: true });
console.log(
  `[gate visual] caché de datos vaciada (${entries} entradas): cada captura se renderiza con el fixture de esta corrida.`,
);
