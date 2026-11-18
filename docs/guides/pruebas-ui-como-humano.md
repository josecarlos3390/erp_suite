# Pruebas de interfaz «como un humano» — el patrón de este repo

> Para una sesión nueva: **no hace falta inventar nada**. El repo ya tiene **75 recorridos** en
> `erp-frontend/scripts/recorridos/` y una librería compartida, `lib.mjs`, que **hace el login**.
> Este documento explica **cuál usar en cada caso** y **las trampas que ya pagamos**.

---

## 1. Tres niveles, y cuál toca

| Nivel | Para qué | Dónde |
|---|---|---|
| **Suite E2E** (Playwright formal) | regresión, gates de CI | `erp-frontend/e2e/` (`*.spec.ts`), `npm run e2e:functional` |
| **Recorridos** (scripts ad-hoc) | **probar un flujo completo como un humano**, sin ensuciar la suite | `erp-frontend/scripts/recorridos/*.mjs` |
| **Sonda puntual** | **verificar UNA cosa** (que un campo viaja, que una pantalla pinta algo) | un `.mjs` de 20 líneas en `%TEMP%` |

**Para «recorrer un flujo como si fuera humano», el nivel es el RECORRIDO.** Hay **75 ejemplos**
(`e0-configuracion.mjs`, `e1-maestros.mjs`, `barrido-inventario.mjs`…): **se copia el patrón del más
parecido**, no se escribe de cero.

---

## 2. El arranque: `abrir()` ya hace el login

```js
import { abrir, BASE } from 'file:///D:/ProyectosPython/erp_suite/erp-frontend/scripts/recorridos/lib.mjs';
const { browser, page } = await abrir();   // hace el login y devuelve una página lista
await page.goto(BASE + '/sales-orders', { waitUntil: 'domcontentloaded' });
```

`abrir()` **hace el login por ti** (`lib.mjs:19`): entra a `/login`, **elige la primera tarjeta de
empresa** (el nombre cambia con la parametrización, **no** está fijo), rellena `admin` / `admin123`
y espera a salir de `/login`. **`BASE`** es `http://localhost:4200` salvo que pongas `ERP_BASE`.

**Requisito**: **el dev server de :4200 tiene que estar vivo** (`npm run start` en `erp-frontend`).
Si la sonda falla con `ERR_CONNECTION_REFUSED`, **no es el producto: es el servidor**.

---

## 3. La sonda puntual: `page.evaluate` + el token

Para **verificar una cosa concreta** (lo que más se usa) **no hace falta clicar**: dentro de la
página ya hay sesión, y el token está en `sessionStorage`.

```js
const r = await page.evaluate(async () => {
  const t = sessionStorage.getItem('auth_token');
  const h = { Authorization: 'Bearer ' + t, 'Content-Type': 'application/json' };
  const c = await fetch('http://localhost:3000/sales-orders/manual', {
    method: 'POST', headers: h,
    body: JSON.stringify({ partnerId: 18, date: '2026-10-15', postingDate: '2026-10-15',
                           warehouseId: 1, items: [{ itemId: 132, quantity: 1, price: 100 }] }),
  });
  return { status: c.status, body: (await c.text()).slice(0, 200) };
});
console.log(JSON.stringify(r));
```

**Por qué esto es «como un humano»**: usa **la misma sesión y el mismo token que el navegador**, y
**comprueba lo que la pantalla vería**. **Y es lo único que detecta lo que `tsc` no ve** (§6).

---

## 4. Trampas que ya nos costaron una sesión cada una

1. **El backend no recarga**: `npm run start` es `nest build && nest start`, **sin watch**. **Tras
   cambiar DTOs o servicios hay que REINICIARLO** (5 min). Un `property X should not exist` es casi
   siempre **esto**, no un bug.
2. **El login exige `tenantSlug`** si se llama por API: `{ tenantSlug: 'default', username, password }`.
   Sin él, el 400 habla del **slug**, no de credenciales, y despista.
3. **5 intentos de login por minuto**: si se encadenan sondas, esperar **~1 min** entre corridas.
4. **Medir por la RUTA, no por el nombre supuesto**: `sale-returns` **no** existe; la buena es
   **`sales-returns`** (con «s»). Un `Test-Path` con el nombre inventado da un **falso negativo** y
   se concluye «no existe» — pasó, y era falso.
5. **El puerto 3000 es el backend y el 4200 el frontend**; comprobar ambos antes de diagnosticar.

---

## 5. Encontrar un documento sin adivinar el id

**Nunca usar un id fijo** (los autoincrementos cambian). **Buscar por código** en la lista:

```js
const arr = await (await fetch('http://localhost:3000/sale-reserve-invoices?limit=200', { headers: h })).json();
const doc = (Array.isArray(arr) ? arr : arr.data ?? []).find((x) => x.code === 'FRV-8');
```

**Y para las pantallas**: `page.goto(BASE + '/sales-returns')` y leer `document.body.innerText`
o `document.querySelectorAll('tbody tr').length` — **sin clics** basta para saber si la pantalla
carga y pinta datos.

---

## 6. La regla que resume el resto

**Un campo «existe» cuando la PETICIÓN lo devuelve, no cuando `tsc` compila.** `tsc` no mira
el whitelist de `class-validator` ni las plantillas de Angular; **un `[text]` en un componente no
importado compila y revienta el bundle**. Si una pantalla **redirige a `/dashboard`**, lo primero
que hay que mirar es **el log del dev server**: puede ser un error de plantilla que impide compilar.

**Ver también**: `AUDIT.md` **T888–T901** (las trampas, con su medición) y
`erp-frontend/scripts/recorridos/lib.mjs` (el patrón completo).
