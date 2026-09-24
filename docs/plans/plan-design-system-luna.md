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

## §3 Deuda medida (decisión pendiente del usuario)

| Deuda | Medición | Arreglo propuesto |
|---|---|---|
| Punto de estado de `luna-badge` (`--success-500`/`--warning-500` sobre su superficie suave) | **2,16:1** y **2,07:1** (mínimo de interfaz 3:1) | punto más oscuro (tono 600/700) **o** declararlo decorativo: siempre acompaña a la etiqueta |
| Relleno con texto inverso (`--text-inverse` sobre `--success-600`/`--warning-600`) | **3,30:1** y **3,19:1** | ningún botón LUNA tiene variante de éxito/aviso: el relleno lo pinta algún componente suelto (`.btn-warning` de `document-action-bar`) |
| `--text-purple` en oscuro | **3,20–3,67:1** | no está en la auditoría de `_02-semantic.scss`; subir a `purple-300` |
| `--text-tertiary` en oscuro | **3,56–4,08:1** (ya declarado en la fuente) | el escalón `--neutral-450` que la propia fuente propone |
| `--text-disabled` | 2,32–4,08:1 | **exento** por WCAG 1.4.3 (documentado) |
| **116 usos de primitivas de estado** donde existe el token semántico | muestra: `kardex` pinta `--success-500` como **texto** sobre fondo claro (2,24:1) | cambiar la primitiva por el token semántico (`--text-success`, `--text-warning`, `--text-error`); es la deuda más grande y la más mecánica |

`npm run audit:contrast:strict` es el gate que las hará fallar todas cuando se decidan los arreglos.

## §4 Lo que NO se porta de la tienda

La capa de retail (hero de campaña, banda promocional, precio protagonista, paleta `promo`/`deal`,
tipografía display grande) no pertenece a un back office; y la **densidad aireada** de la tienda
chocaría con `audit:density` y `migrate:heights`, que existen justo porque el ERP necesita lo
contrario. El tema por tenant de la tienda es, además, una versión simplificada de lo que el ERP ya
hace mejor con `ensureContrast`.

## §5 Siguientes tramos propuestos (sin aprobar)

1. **Arreglar la deuda medida** (tabla de §3), empezando por los 116 usos de primitivas y el punto de
   estado: es la mayor ganancia de contraste real.
2. **Aserción de recorte de overlays** (el defecto del menú de la tienda, T209): intersectar las cajas
   de recorte de los ancestros sobre `luna-dropdown`, `luna-select`, `luna-modal`, `luna-date-picker`
   y `luna-command-palette`; hoy ningún gate detecta un panel recortado.
3. **Baselines visuales deterministas**: el ERP tiene **85** capturas contra la BD sembrada y ya sufrió
   el fallo (T195: el baseline del formulario de usuario quedó obsoleto porque el seed añadió un
   almacén). Alternativas: fixture grabado como el de la tienda o sellar el baseline con la versión
   del seed y fallar con «el seed cambió: regenerar».
4. **Presupuesto de rendimiento** (LCP/CLS + peso del arranque), que hoy no existe: el ERP es SSR
   (`ssr-smoke`), así que el CLS de hidratación es riesgo real.
