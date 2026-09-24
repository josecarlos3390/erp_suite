# Plan — Design system LUNA: contraste y accesibilidad como gates (T210)

> Creado el 2026-09-23 a partir del cierre del ecommerce (`docs/plans/plan-ecommerce-storefront.md`
> §14). El usuario preguntó si lo aprendido en la tienda se puede aplicar al design system propio;
> se midió y se decidió el alcance: **primero medir, después gates de verificación**, sin tocar
> componentes (opción elegida por el usuario).

## §1 Por qué (medido antes de tocar)

| # | Hecho medido | Número |
|---|---|---|
| 1 | `e2e/a11y-audit.spec.ts` corría axe sobre 8 pantallas autenticadas pero **no afirmaba nada** | **0 `expect()`**; su encabezado lo decía: «no falla el pipeline: es una herramienta de auditoría» |
| 2 | `npm run a11y:check` | script **estático** de plantillas (botones de icono, `alt`, campos de filtro); no mide el DOM |
| 3 | `audit:tokens` | prohíbe **literales** de color/breakpoint; **no** mide contraste |
| 4 | Única medición de contraste existente | la escrita **a mano** en los comentarios de `tokens/_02-semantic.scss` (auditoría 2026-07), contra **4** fondos |
| 5 | Usos de primitivas de estado donde existe token semántico auditado | **116** en SCSS |
| 6 | Paleta **legacy en paralelo**: `src/styles.scss` define `--color-danger: #ef4444` | y `.item-danger` (`_buttons.scss`, `_lists.scss`) pintaba con ella |
| 7 | Modo oscuro en la app | **0** archivos usan `data-theme` (el bloque oscuro de LUNA está sin usar) |

**Punto de partida honesto**: en lo visual LUNA está por delante de la tienda (7 módulos de tokens,
83 componentes, ~20 gates en CI, marca por tenant con `ensureContrast`). Lo que faltaba no era
estilo: eran **dos verificaciones**.

## §2 Lo entregado

### §2.1 `npm run audit:contrast` (nuevo gate)

- Compila **los mismos siete módulos** de tokens que consume la app (`sass`, la misma entrada que
  `src/styles/tokens/_index.scss`) y resuelve la cascada real: `:root` → bloque `[data-theme='dark']`.
- **Compone** las superficies translúcidas antes de medir (`--bg-selected` en oscuro es
  `rgba(30,27,75,0.2)`: se compone sobre `--bg-base`, como hace el navegador) y resuelve `var()`
  encadenados, incluidos los que la fuente escribe en varias líneas.
- Los pares salen **del código**: texto sobre las cuatro superficies semánticas, los **tonos de
  `luna-badge`** (que la auditoría a mano no cubría: `--success-700` sobre `--success-50`, etc.), los
  puntos de estado (mínimo de interfaz, 3:1) y los rellenos de acción.
- `--self-test` (7 casos + sonda de un par roto), `--verbose` (la tabla completa) y **`--strict`**,
  que falla también con la deuda declarada: es el interruptor para cuando se decidan los arreglos.

**Medido**: **82 pares** cumplen su mínimo en claro y oscuro, **16 con deuda declarada** (medida y
con piso: si empeora, el gate falla).

### §2.2 `e2e/a11y-audit.spec.ts` de informe a gate

- **Falla** por violación de impacto `serious` o `critical`; las `moderate`/`minor` se listan.
- Reglas ampliadas de `wcag2a/2aa` a **`wcag21a`, `wcag21aa` y `best-practice`**.
- **Estado abierto**: el menú `⋯` de una fila, con el patrón de disparador que ya verifica
  `accessibility-focus.spec.ts`. Es el contenedor que ningún scan de página cerrada mira.
- Imprime el resumen por pantalla (evidencia y lectura rápida del log de CI).

### §2.3 Defecto real medido y cerrado

En la **primera** corrida del caso nuevo, axe marcó **`color-contrast` grave** en
`#luna-menu-dropdown-1 > .item-danger.luna-menu__item.row-item`: el ítem de peligro del menú de fila
pintaba con el legacy `--color-danger` (**#ef4444**, **3,76:1** sobre la superficie del menú).
Corregido a `var(--text-error)` (el token semántico, `--error-700`, que la propia
`_02-semantic.scss` documenta como AA en los cuatro fondos).

**Medido después**: `e2e:a11y-audit` **10/10** (8 pantallas + menú abierto) con 2 avisos `moderate`
declarados (`heading-order` en el Balance General y `region` en el menú abierto).

## §3 Deuda medida (estado tras T211)

**Cerrado en T211** (con gate propio): los **74 usos de primitivas como texto** (migrados a los tokens
semánticos con script + `migrate:state-text:check` en CI; se añadió el `--text-info` que faltaba), el
**punto de estado** de `luna-badge` (3,29/3,19:1) y **`--text-purple` en oscuro** (6,5–7,5:1).

| Deuda pendiente | Medición | Arreglo propuesto |
|---|---|---|
| Relleno con texto inverso (`--text-inverse` sobre `--success-600`/`--warning-600`) | **3,30:1** y **3,19:1** | ningún botón LUNA tiene variante de éxito/aviso: lo pinta algún componente suelto (`.btn-warning` de `document-action-bar`) |
| `--text-tertiary` en oscuro | **3,56–4,08:1** (ya declarado en la fuente) | el escalón `--neutral-450` que la propia fuente propone; latente mientras no haya modo oscuro |
| `--text-disabled` | 2,32–4,08:1 | **exento** por WCAG 1.4.3 (documentado) |
| Usos de primitivas como **fondo o borde** | 22 fondos + bordes | **no** son deuda por defecto (interfaz: mínimo 3:1); se revisan solo donde lleven texto encima |

`npm run audit:contrast:strict` es el gate que las hará fallar todas cuando se decidan los arreglos.

## §4 Lo que NO se porta de la tienda

La capa de retail (hero de campaña, banda promocional, precio protagonista, paleta `promo`/`deal`,
tipografía display grande) no pertenece a un back office; y la **densidad aireada** de la tienda
chocaría con `audit:density` y `migrate:heights`, que existen justo porque el ERP necesita lo
contrario. El tema por tenant de la tienda es, además, una versión simplificada de lo que el ERP ya
hace mejor con `ensureContrast`.

**El fixture grabado del gate visual de la tienda tampoco se porta (T213).** La tienda mide contra un
proxy que **graba** las respuestas del canal y las repite (`e2e/visual/channel-fixture.mjs`), lo que
allí funciona porque las pantallas de compra son de **lectura** y su contrato son ~30 respuestas. Los
formularios del ERP son de **escritura**, dependen de maestros vivos (un `select` de cuentas con
**313** opciones, medido) y son **53** pantallas: congelarlas contra respuestas grabadas exigiría
grabar y mantener cientos de respuestas por formulario y el baseline dejaría de probar el formulario
real. Se porta el **principio** —que un baseline no dependa del seed sin decirlo— con la pieza que sí
es determinista y barata: la **huella de conteos del seed** sellada junto a los baselines (§5.3).

## §5 Tramos (estado medido)

1. **Arreglar la deuda medida** (tabla de §3), empezando por el punto de estado y los usos de
   primitivas: **pendiente de decisión del usuario**; `audit:contrast:strict` es el interruptor que
   las hará fallar todas.
2. ~~**Aserción de recorte de overlays**~~ — **HECHO en T212** (`e2e/overlay-clipping.spec.ts`, 2 casos): recorre los ancestros del panel abierto, intersecta sus cajas de recorte, exige que la caja esté dentro de la ventana y que su centro sea lo que se pinta. **Alcance corregido con la medición** (el de este plan era incorrecto): los overlays reales son **`luna-menu`** y **`luna-modal`**; **`luna-select`** usa el desplegable **nativo** (nada que recortar) y **`luna-dropdown`/`luna-date-picker`/`luna-command-palette` no existen** en la app (espejo de la raíz, 0 referencias). Los 2 casos **pasan**: el ERP no tenía el defecto de la tienda; quedan como guardia.
3. ~~**Baselines visuales deterministas**~~ — **HECHO en T213** (`e2e/helpers/seed-fingerprint.ts` + `beforeAll` de `e2e/forms-visual-regression.spec.ts`): de las dos alternativas que este plan proponía se eligió **sellar el baseline con el estado del seed y fallar con «el seed cambió: regenerar»** (la del fixture grabado se descarta en §4), medida sobre **17** colecciones maestras con **una petición por colección** y la forma de respuesta de cada una declarada —**13** paginadas y **4** que devuelven array pelado—; la huella se versiona junto a los baselines y se **re-sella** al regenerarlos (`--update-snapshots`, modo `changed` medido). **Medido (A/B)**: sella `83ac2bf0-213`; la corrida de control **compara** y pasa; con el sello saboteado (`items 138→139`) el gate **falla nombrando `items 139→138`**; `e2e:visual` **53/53**. La verificación destapó **tres defectos del propio gate**, cerrados: la regeneración se disparaba con **cualquier** corrida (el default de Playwright es `missing`, no `none`: la rama de comparación era código muerto), `readStamp()` confundía «archivo ilegible» con «falta la huella», y **cuatro** colecciones quedaban fuera de la huella en silencio por una forma de respuesta no soportada.
4. ~~**Presupuesto de rendimiento**~~ — **HECHO en T214** (`e2e/perf-budget.spec.ts`, `npm run e2e:perf`): LCP y CLS con `PerformanceObserver` inyectado antes de cargar y peso real transferido (`encodedBodySize`) en **4** pantallas, con el presupuesto como **ratchet** y los números medidos al lado (**LCP 4.500 ms**, **CLS 0,1**, **JS 10.500 kB**, **CSS 260 kB**, fuentes **320 kB**). **Medido**: **5/5**. **Declarado**: es un techo de `localhost` contra el servidor de **desarrollo** —el JS medido (6,6–9,2 MB) incluye el runtime de dev, contra los **87,1 kB** de *First Load JS compartido* del `build`—, así que sirve para **detectar crecimiento**; y el CLS de `/dashboard` (**0,12**) es **deuda declarada con suelo**, impresa en cada corrida.

**Pendiente declarado de este plan**: el presupuesto de rendimiento de **producción** por la vía SSR
(el gate de hoy es de desarrollo); el scan de axe de **modales abiertos** (T210 lo dejó declarado); el
escalón **`--neutral-450`** que la propia fuente de tokens propone para `--text-tertiary` en oscuro; y
las **2** deudas de relleno con texto inverso (`--text-inverse` sobre `--success-600`/`--warning-600`,
3,30/3,19:1).
