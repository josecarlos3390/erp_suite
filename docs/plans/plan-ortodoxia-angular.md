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
