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

### P6 — hidratación: **medida y NO adoptada** (2026-10-05)

Se activó `provideClientHydration()` (una línea en `app.config.ts`), se midió y **se revirtió**. Lo que queda escrito es la medición, porque el plan la pedía «antes de proponerlo en serio»:

| Instrumento (contra el **servidor SSR** de producción, en un navegador) | Sin hidratación | Con hidratación | ¿Discrimina? |
|---|---|---|---|
| Nodos de elemento que el cliente **quita** (`MutationObserver` antes de los scripts) | **4** | **4** | **No** |
| Llamadas del cliente a la API (`/tenants/active`) | **1** | **1** | **No** |
| `<script id="ng-state">` en el DOM del cliente | **presente** | **presente** | **No** |
| `[ng-server-context]` en el DOM del cliente | **presente** | **presente** | **No** |
| Errores en consola · tarjetas de empresa · gate `npm run e2e:ssr` | 0 · 1 · **3/3** | 0 · 1 · **3/3** | — |

Es decir: **la aplicación funciona igual de las dos maneras** y **ningún instrumento que probé distingue** la hidratación de su ausencia. Mis dos hipótesis sobre señales observables (que la hidratación consume el `ng-state` y retira `ng-server-context`) resultaron **falsas al medirlas**. Sin un beneficio demostrable y con el arranque siendo justo el sitio que ese mismo día dejó la aplicación **en blanco**, se aplica la regla del plan —*si no se puede medir, no se adopta*—: **P6 no entra**.

**Lo que haría falta para decidirlo** (el bloqueo es el instrumento, no la función): los diagnósticos de desajuste de Angular son **solo de modo desarrollo** (`NG05xx`) y un build SSR en desarrollo **rompe el presupuesto del bundle** (medido: `--optimization=false` → **4,00 MB** frente al límite de error de **2,00 MB**, así que la generación **falla** y no hay servidor que medir). Desbloquearlo exige una configuración de build **con los presupuestos relajados para medir**, que es una decisión del usuario y no algo que se cuele de tapadillo.

### P3 — MCP del CLI: sigue **sin empezar**

Es el más difícil de **verificar** de la lista —levantar un servidor MCP por stdio y comprobar que expone herramientas no se mide bien desde aquí— y por eso, con la misma regla, está **congelado** hasta poder demostrar que funciona.

