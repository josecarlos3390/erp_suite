# Plan — Ortodoxia Angular: qué copiamos de las *skills* oficiales y qué no

> **Fecha:** 2026-10-04 · **Estado:** evaluación hecha, adopciones priorizadas, **nada aplicado aún**
> **Fuente externa:** `github.com/angular/skills` (`main` @ `cfb0e360`), leída de verdad (2 skills, 43 ficheros).
> **Nuestro stack medido:** `erp-frontend` con Angular **19.2.25** (`package.json:73`), Karma + Jasmine + `zone.js`, design system propio (Luna) y docs en español.

## 1. Por qué este documento

El usuario preguntó si podemos apoyarnos en las *skills* oficiales de Angular para «mejorar sin romper» el código. El material externo es real y de calidad, pero está escrito para **Angular ≥ v21/v22** y **sin** design system propio, así que la respuesta no es «adoptar» ni «ignorar»: es **separar lo que es deuda nuestra de lo que es una moda inaplicable**. Aquí queda la medición, para no volver a discutirlo de memoria.

## 2. Cumplimiento medido (con evidencia, no impresiones)

| Referencia externa | Veredicto | Evidencia |
|---|---|---|
| Analizar la versión antes de aconsejar | **Cumplimos** | `package.json:73` → `^19.2.25`; `FRONTEND_GUIDE.md:463` ya razona por versión |
| `ng build` (AOT) tras generar código | **Cumplimos** | es gate real y obligatorio (`package.json:7`, y AGENTS lo mide como «AOT 0») |
| Interceptores **funcionales**, `provideHttpClient` | **Cumplimos** | `app.config.ts:85-92`; **0** `implements HttpInterceptor`, 6 `HttpInterceptorFn` |
| Guards funcionales (`CanActivateFn`) | **Cumplimos** | 6 ficheros (`auth.guard.ts:5`, `permission.guard.ts:14`, …) |
| Lazy loading, control flow moderno, self-closing tags | **Cumplimos** | 370 `loadComponent`; `*ngIf` = **0**; cientos de `<luna-*/app-* … />` |
| `http-client.md` — «prefer `toSignal` para lecturas» | **NO cumplimos (y nuestra guía lo exige)** | `toSignal` = **0** usos; `FRONTEND_GUIDE.md:465` («Regla: en componentes nuevos… preferir `toSignal()`») y el checklist `:1201` |
| `inputs.md` / `outputs.md` (señales) | **NO cumplimos** | **745 `@Input(`** y **161 `@Output(`** frente a **6 `input()`** y **3 `output()`** (producción; conteo mío, sin specs) |
| `rendering-strategies.md` — hidratación | **NO cumplimos (hueco real)** | hay SSR (`app.config.server.ts:8` → `provideServerRendering()`) y **0** `provideClientHydration` en `src/` |
| `effects.md` — no usar `effect` para propagar estado | **Cumplimos por ausencia** | 3 `effect(` en todo `src/app` |
| `define-routes.md` — `title:` de ruta | **NO cumplimos** | `provideRouter(routes)` sin títulos; el `h1` por página se pone con `[formTitle]` |
| `component-styling.md` — `::ng-deep` desaconsejado | **Divergencia consciente** | 64 usos, **todos auditados** por `audit:ng-deep` (exige justificación o falla): «auditado, no prohibido» |
| `testing-fundamentals.md` — Vitest, zoneless, sin `detectChanges()` | **CONFLICTO** | Karma+zone.js (`angular.json:119-138`), 263 specs, **954** `fixture.detectChanges()`; nuestro `detectChanges` es **consecuencia medida** de `withFetch()` (`FRONTEND_GUIDE.md:412-424`), no deuda |
| `tailwind-css.md` — Tailwind v4 | **CONFLICTO** | no está en `package.json`; rompería `audit:tokens`, `audit:density` y `audit:contrast`, y choca con Luna |
| `angular-aria.md` — `@angular/aria` | **CONFLICTO** | no está instalado; prohíbe los elementos nativos que nuestros primitivos encapsulan |
| `signal-forms.md` — Signal Forms | **No aplica** | requiere v21+/v22+; prohíbe `FormControl/FormGroup/FormArray/FormBuilder` → choca con **1 117** usos y con `ESTANDAR_LINEAS_DOCUMENTO.md` |
| `di-fundamentals.md` — `@Service()` | **No aplica** | **API que no existe** en Angular: 0 usos, 150 `@Injectable` |
| `angular-animations.md` — `animate.enter/leave` | **No aplica** | v20.2+ |
| `migrations.md` — migrar 745+161 decoradores | **Descartado a propósito** | `FRONTEND_GUIDE.md:524` («no es una migración… el código existente no se toca») y `:507` clasifica el refactor como riesgo alto |

## 3. Adopciones priorizadas

| # | Qué | Por qué | Verificación | Riesgo |
|---|---|---|---|---|
| **P1** | **`toSignal()` en componentes NUEVOS** (no migrar) | es **deuda nuestra documentada**: la guía lo pide y nunca se hizo; coincide con la skill | Karma del spec + `tsc` + `ng build`; ojo con `injector` cuando el observable nace fuera del *field initializer* | **bajo** (localizado) |
| **P2** | **`input()`/`output()` en primitivos Luna NUEVOS** | precedente ya verde: `luna-tooltip.component.ts:54-55` | Karma del primitivo + **AOT** (es el que caza los consumidores que no llaman a la señal) + `e2e:visual` si entra en capturas | **medio** — de uno en uno |
| **P3** | **MCP del CLI en modo lectura** (`npx @angular/cli mcp --read-only`) | ~6 líneas, sin instalar nada; `@angular/cli` ya está | que arranque y exponga `get_best_practices`; **ningún** gate cambia | **muy bajo** |
| **P4** | **`title:` en las rutas** | accesibilidad de la pestaña; complementa el `h1` por página | añadir la aserción de `document.title` a un spec de Playwright para que sea gate | **bajo** |
| **P5** | **`canDeactivate` en formularios de documento** | protección de cambios sin guardar (`hasChanges` ya existe) | Karma del guard (3 casos) + `e2e:functional` | **medio-alto**: 73 formularios comparten base ⇒ empezar por **uno** |
| **P6** | **`provideClientHydration()`** | hueco real: SSR sin hidratar | **primero** `e2e:ssr`, luego `e2e:functional` + `e2e:visual` | **alto** (zonado, 343 `OnPush`, `localStorage` y branding pre-render ⇒ *hydration mismatch*). **Medir antes de proponerlo en serio** |

P5 es una **idea derivada** de la referencia, no una regla que el material imponga.

## 4. Reglas de adopción

1. **Nada se importa tal cual**: el material está en inglés y nuestra fuente de verdad es `FRONTEND_GUIDE.md` (español). Se traduce y se aterriza, o no entra.
2. **Cada adopción necesita gate**: si no se puede medir, no se adopta. (La lección de esta misma sesión: `FRONTEND_GUIDE.md:465` pedía `toSignal()` desde hace rondas y **0 usos** — una regla sin gate es un deseo.)
3. **Los conflictos son decisiones ya tomadas**, no olvidos: Luna, tokens/densidad y Karma+zone se quedan. Lo que se adopte **no** puede romper `audit:tokens`, `audit:density`, `audit:contrast`, `audit:ng-deep`, `audit:important` ni el gate visual.

## 5. Estado y correcciones (2026-10-04)

Al ejecutar la lista, **medir cambió tres de las propuestas** —y una de ellas estaba directamente **mal**—. Queda escrito aquí porque el plan se leyó como recomendación y ya no lo es del todo:

| # | Lo que decía el plan | Lo que se midió al ejecutarlo | Estado |
|---|---|---|---|
| **P5** | «implementar `canDeactivate` en formularios de documento» | **YA ESTABA HECHO**: `dirtyCheckGuard` (`core/guards/dirty-check.guard.ts`, funcional, con el `ConfirmDialog` del ERP) cableado en **135** rutas. Lo que faltaba era **comprobar la cobertura**: una sonda por los ficheros de rutas encontró **128 de 131** rutas de formulario con el guard, y las **3** sin él eran el formulario de **roles** — que además **no** era «dirty-checkable» (`hasChanges`/`isDirty` no existían), así que añadirlo a secas habría sido **decorativo** | **CERRADO**: `RolesFormComponent` expone `hasChanges` (campos **y** permisos), el guard va en sus 3 rutas y la medición da **131/131**; spec nuevo **3/3** |
| **P2** | «`input()`/`output()` en primitivos Luna **nuevos**» | **NO HACE FALTA UN PRIMITIVO NUEVO**: el design system ya tiene `luna-button-group` (usado en **25+** pantallas) y `luna-button` documenta `@Input() active` como «segmented control / toggle». Lo que había era una **migración a medias**: `_tables.scss:613` ya estilizaba `luna-button` dentro del grupo del descuento mientras la **plantilla** seguía con `<button>` hechos a mano | **REENFOCADO**: terminar esa migración (no escribir un primitivo). P2 sigue pendiente para el **próximo** primitivo que se cree |
| **P4** | «`title:` en las rutas» con una aserción E2E | Cierto y **real**: **274** cargas de ruta, **0** con `title:` y un `<title>ERP Suite</title>` estático ⇒ las **233** pantallas se titulaban igual y **WCAG 2.4.2** no se cumplía. Pero editar 274 rutas no era la única vía: el menú lateral ya tiene la **etiqueta de cada pantalla** | **HECHO por la fuente única**: `page-title.util.ts` + `PageTitleService` (una pieza, cubre las 233 pantallas y **no puede desincronizarse** del menú), spec unitario **6/6** y gate E2E del cableado |

### P6 — hidratación: **adoptada** con el instrumento que faltaba (2026-10-05)

Se activó `provideClientHydration()`, **se revirtió** por no poder demostrar nada, y **se volvió a adoptar** cuando se construyó el instrumento correcto. La historia importa porque el bloqueo era de **medición**, no de la función:

| Intento | Instrumento | Resultado |
|---|---|---|
| 1 | Build SSR de **producción** + 4 sondas (nodos quitados, llamadas a la API, `script#ng-state`, `ng-server-context`) | **Ninguna distingue** con hidratación de sin ella ⇒ **revertida** |
| 2 | Build SSR en **modo desarrollo** (`--optimization=false`) | **Rompe el presupuesto** (`4,00 MB` vs `2,00 MB`) ⇒ no hay servidor que medir |
| 3 | **`smoke-dev`** (configuración nueva: modo desarrollo + SSR + presupuestos holgados) | **0 desajustes** (`NG05xx`) y **0 errores**: el cliente **reutiliza** el DOM del servidor ⇒ **adoptada** |

**Medido además**: el **dev server** (SSR apagado) pasa el gate de arranque **3/3** sin un solo `NG0xx`, y el gate de SSR de producción sigue **3/3**. **Corroboración débil declarada**: en el intento 1 el cliente creaba **87** nodos con hidratación y **100** sin ella (conteos sucios: incluyen el parseo del HTML). **No se mide** el tamaño de la ganancia: el ERP no tiene harness de rendimiento.

### P3 — MCP del CLI: **no disponible en nuestra versión** (2026-10-05)

Dejó de ser «difícil de verificar»: el CLI **19.2.27** lista **17** comandos y **`mcp` no está entre ellos** ⇒ el servidor MCP oficial de Angular **no existe** en v19 y la propuesta queda **bloqueada por la versión**, no por la falta de un instrumento. Es, además, una de las razones **concretas** para subir de major (el material oficial lo asume).

## 6. *Spike* Angular 19 → 20 (2026-10-05) — medido, **sin muro**

Rama **`spike/angular-20`** (1 commit `eda39f12`, **sin empujar**) desde `09f6e15c`; `main` intacto y limpio. **Veredicto: sale con trabajo acotado** — y el único trabajo de código que quedaba **ya está cerrado en `main`**.

| | Antes | Después |
|---|---|---|
| core / common / forms / router | 19.2.25 | **20.3.33** |
| CLI / devkit / ssr | 19.2.27 | **20.3.38** |
| cdk | 19.2.19 | 20.2.14 |
| TypeScript / typescript-eslint | 5.7.2 / 8.33.1 | 5.9.3 / 8.71.0 |

**El `ng update` falló dos veces y ninguna por Angular**: (1) `typescript-eslint@8.33.1` no admite TS 5.9 (el CLI 20 exige `>=5.8`) y (2) el repo tenía que estar limpio para actualizar. Resuelto con esos dos bumps mínimos.
**Schematics que corrieron**: solo `provideServerRendering(withRoutes(serverRoutes))` (**5** líneas) y defaults en `angular.json` (**+26**). La migración **opcional** al `application` builder **no** se hizo (el builder de Karma sigue existiendo en devkit 20).
**Código propio tocado: 0** (`git diff --shortstat`: 4 ficheros, y casi todo es `package-lock.json`).
**Gates**: `tsc` **0/0/0** · `lint` **0** · **AOT 0 errores y 0 avisos de plantilla** · Karma **2580/2581** · `audit:ci` **12/12** · Playwright **15/15** · `e2e:ssr` **3/3** · **visual 53/53 SIN MOVER UN PÍXEL** (comparación estricta con `CI=1`, sin re-grabar ninguna baseline).

**El único rojo, con causa medida y A/B**: un spec leía `getAttribute('ng-reflect-loading')`, un atributo de **depuración** que **Angular 20 hace *opt-in*** (`provideNgReflectAttributes()`, API nueva de v20; la cadena `ng-reflect` no aparece en el bundle de core 20). Aislado en un *worktree* limpio: **5/5 con 19** y **4/5 con 20**. **Cerrado en `main`** comprobando el **input del hijo** (`By.directive(...).componentInstance.loading`) ⇒ el salto queda en **cambio de dependencias**.

**Trampa del schematic**: `ng update` escribe **CRLF dentro de ficheros LF** (`package.json`, `app.config.server.ts`) ⇒ el ratchet de prettier (`format:check:touched`) **se pone rojo**; hay que normalizar a LF.

**Hallazgo colateral**: `patches/angular-core-patch.js` es **huérfano** —102 B, **0** referencias, **sin** `postinstall` y con un nombre que **no** encaja con la convención que lee `patch-package` (`patches/<pkg>+<version>.patch`)— ⇒ candidato a borrar (declarado, no tocado).

**Pendiente antes de un merge real** (declarado por el *spike*): correr la **funcional completa (259)** y el **móvil (86)**; verificar el **piso de cobertura** de `karma.conf.js` (36/23/27/37, que el `pre-push` sí aplica) con 20; cross-browser, `e2e:perf` y Storybook; y decidir la migración **opcional** al `application` builder. **No** se probó **21** ni **22** (un major por vez).

