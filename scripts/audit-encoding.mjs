#!/usr/bin/env node
/**
 * audit-encoding.mjs — **gate de CODIFICACIÓN de la documentación y del código**.
 *
 * QUÉ IMPIDE. Un fichero escrito por PowerShell queda con caracteres mudos que
 * ninguna otra puerta ve: su backtick es **carácter de escape**, así que
 * `` `t `` → TAB, `` `r `` → CR, `` `b `` → backspace, `` `0 `` → NUL,
 * `` `a `` → BEL, `` `f `` → form-feed… y ante un carácter que no es escapable
 * **se pierde**. Y un fichero que pasa por una herramienta que confunde UTF-8 con
 * Windows-1252 queda **doble-codificado** (`Ã³` por `ó`, `â€”` por `—`).
 *
 * LO QUE ESTE GATE ENCONTRÓ AL NACER (2026-10-29), y por eso existe:
 *   · `AUDIT.md` y `docs/plans/historial-sesiones.md`: **61** caracteres de
 *     control y **115** secuencias (reparados; las 4 que quedan son **citas
 *     deliberadas** del defecto).
 *   · `backend-erp/src/sales-orders/sales-orders.service.ts`: **2 363**
 *     secuencias, **42 de ellas en mensajes que el usuario lee** —un 400 decía
 *     «CotizaciÃ³n invÃ¡lida»—; más `reports.service.spec.ts` (430) y
 *     `web-promotions.service.spec.ts` (5).
 *   · `erp-frontend`: **48** en dos plantillas (comentarios `═══`).
 *   · `landed-costs.service.ts`: un **TAB** donde iba el backtick de `` `tx` ``.
 * Ninguna de esas cosas la veía ningún otro gate: `tsc`, `eslint`, Karma y Jest
 * pasan con los acentos roto porque son texto, no tipos.
 *
 * LAS TRES REGLAS.
 *   R1 · **carácter de control**: cualquier byte `0x00–0x08`, `0x09` (TAB),
 *        `0x0B`, `0x0C`, `0x0E–0x1F` o `0x7F` dentro de una línea. `CR`/`LF` no
 *        cuentan: son el fin de línea. El **TAB** se incluye a propósito —el
 *        árbol tenía **0** en 3 000+ ficheros—: un TAB nuevo es el escape de
 *        PowerShell, no indentación.
 *   R2 · **secuencia doble-codificada**: un arranque de UTF-8 leído como
 *        Windows-1252 (`Â`, `Ã`, `â`) seguido de un carácter del rango alto de
 *        cp1252. Es la firma exacta de «UTF-8 → cp1252 → UTF-8», y esas tres
 *        letras no aparecen en castellano.
 *   R3 · **U+FFFD** (el carácter de reemplazo): **informa, no bloquea**. Es lo
 *        que escribe un decodificador cuando **pierde** un byte, así que suele
 *        ser daño —los 38 acentos perdidos de un plan—; pero también puede ser
 *        **legítimo**: el `SanitizeInterceptor` documenta el carácter que
 *        limpia. Un gate que no distingue las dos cosas obligaría a declarar el
 *        mundo, así que R3 se publica con su cuenta y **no** fija veredicto.
 *
 * LAS DECLARACIONES. Algunos sitios **citan el defecto a propósito** (T97 lo usa
 * como ejemplo, §9 documenta el artefacto de PowerShell, la autoprueba de este
 * gate lleva su propio caso) y repararlos **borraría la documentación de la
 * clase de defecto**. `scripts/encoding-declarations.json` los declara con su
 * `fragmento` (el texto exacto que los rodea) y su `motivo`. El índice es por
 * **contenido**, no por `fichero:línea`: las líneas se mueven y un índice por
 * número convertiría cada inserción en un falso «declaración huérfana».
 * Y si una declaración **deja de casar** con ningún hallazgo, el gate **falla y
 * la lista**: una exención que ya no cubre nada no se queda viva por olvido.
 *
 * ALCANCE, Y SU LÍMITE. Tres árboles, cada uno por su `git ls-files`:
 *   · **raíz**: `.md .ts .tsx .html .scss .css .mjs .js` (incluye `storefront/`,
 *     que este repo trackea, y `docs/`).
 *   · **backend-erp** y **erp-frontend**: su código, cuando el árbol está —en el
 *     CI de la raíz no está (repos anidados) y se declara **NO MEDIDO** con su
 *     motivo, como hace `audit:agents-figures`.
 * Quedan fuera `src/generated/`, `api-types/` (generados) y los `.json` (el de
 * declaraciones contiene los ejemplos **a propósito** y se auto-marcaría).
 *
 * USO
 *   node scripts/audit-encoding.mjs                # informe + veredicto (--check implícito)
 *   node scripts/audit-encoding.mjs --check        # la forma que usan las puertas
 *   node scripts/audit-encoding.mjs --all          # lista también los declarados
 *   node scripts/audit-encoding.mjs --self-test    # A/B del detector, sin repo
 *
 * CÓDIGOS DE SALIDA. `0` verde · `1` hallazgos sin declarar o declaraciones
 * huérfanas · `2` **ruidoso**: fichero ilegible, JSON de declaraciones mal, `git`
 * falló o argumento desconocido. Nunca degrada a verde por un fallo de lectura.
 *
 * LA RAÍZ Y LAS DECLARACIONES SE RESUELVEN POR LA UBICACIÓN DEL SCRIPT
 * (`__dirname/..` y `__dirname/…json`), nunca por el `cwd`, una variable de
 * entorno ni un argumento: un gate que se puede apuntar a otro sitio se puede
 * burlar.
 */

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..');
const DECLARACIONES = path.join(HERE, 'encoding-declarations.json');

const ALLOWED = new Set(['--check', '--all', '--self-test']);

/** R1 — controles. `CR`/`LF` fuera: son el fin de línea. TAB **dentro**, a propósito. */
const CONTROL = /[\u0000-\u0008\u0009\u000b\u000c\u000e-\u001f\u007f]/;
/** R2 — firma de «UTF-8 leído como cp1252»: lead + carácter alto. */
const MOJIBAKE =
  /[\u00c2\u00c3\u00e2][\u0080-\u00bf\u0152\u0153\u0160\u0161\u0178\u017d\u017e\u0192\u02c6\u02dc\u2013\u2014\u2018\u2019\u201a\u201c\u201d\u201e\u2020\u2021\u2022\u2026\u2030\u2039\u203a\u20ac\u2122]/g;
/** R3 — carácter de reemplazo: informa (un decodificador lo escribe al PERDER bytes). */
const REEMPLAZO = /\uFFFD/g;

const NOMBRE_CONTROL = (cp) =>
  ({
    0x00: 'NUL', 0x07: 'BEL', 0x08: 'backspace', 0x09: 'TAB', 0x0b: 'VT',
    0x0c: 'form-feed', 0x0d: 'CR', 0x1b: 'ESC', 0x7f: 'DEL',
  })[cp] ?? 'control';

/** Contexto legible alrededor de un rango, sin saltos de línea. */
function contexto(linea, desde, hasta) {
  const a = Math.max(0, desde - 42);
  const b = Math.min(linea.length, hasta + 42);
  return (a > 0 ? '…' : '') + linea.slice(a, b) + (b < linea.length ? '…' : '');
}

/**
 * El detector. Recibe `arboles` = `[{ etiqueta, raiz, ficheros }]` y las
 * declaraciones; devuelve los hallazgos (con su árbol), los cubiertos, las
 * declaraciones huérfanas, los ficheros ilegibles y la cuenta de U+FFFD.
 *
 * Es puro respecto del disco de entrada: el `--self-test` le pasa su propio árbol.
 */
export function auditar(arboles, declaraciones) {
  const hallazgos = [];
  const sinLeer = [];
  const reemplazos = [];
  const usadas = new Set();

  for (const { etiqueta, raiz, ficheros } of arboles) {
    for (const rel of ficheros) {
      let texto;
      try {
        texto = fs.readFileSync(path.join(raiz, rel), 'utf8');
      } catch (error) {
        sinLeer.push({ fichero: etiqueta + '/' + rel, motivo: error instanceof Error ? error.message : String(error) });
        continue;
      }
      const lineas = texto.split(/\r?\n/);
      for (let i = 0; i < lineas.length; i++) {
        const linea = lineas[i];

        for (let k = 0; k < linea.length; k++) {
          const cp = linea.charCodeAt(k);
          if (cp > 0x1f && cp !== 0x7f) continue;
          if (cp === 0x0d) continue;
          hallazgos.push({
            arbol: etiqueta,
            fichero: rel,
            linea: i + 1,
            tipo: 'control',
            detalle: '0x' + cp.toString(16).padStart(2, '0') + ' (' + NOMBRE_CONTROL(cp) + ')',
            contexto: contexto(linea, k, k + 1),
            textoLinea: linea,
          });
        }

        MOJIBAKE.lastIndex = 0;
        let m;
        while ((m = MOJIBAKE.exec(linea)) !== null) {
          hallazgos.push({
            arbol: etiqueta,
            fichero: rel,
            linea: i + 1,
            tipo: 'doble-codificacion',
            detalle: JSON.stringify(m[0]),
            contexto: contexto(linea, m.index, m.index + m[0].length),
            textoLinea: linea,
          });
        }

        REEMPLAZO.lastIndex = 0;
        let r;
        while ((r = REEMPLAZO.exec(linea)) !== null) {
          reemplazos.push({ arbol: etiqueta, fichero: rel, linea: i + 1, contexto: contexto(linea, r.index, r.index + 1) });
        }
      }
    }
  }

  // Una declaración cubre TODOS los hallazgos de su fichero cuyo texto de línea
  // contiene su `fragmento`. Índice por contenido, no por `fichero:línea`.
  for (const h of hallazgos) {
    const d = declaraciones.findIndex(
      (x) => x.fichero === h.fichero && h.textoLinea.includes(x.fragmento),
    );
    if (d >= 0) {
      h.cubiertoPor = declaraciones[d];
      usadas.add(d);
    }
  }
  const huerfanas = declaraciones
    .map((d, i) => ({ ...d, i }))
    .filter((d) => !usadas.has(d.i));

  for (const h of hallazgos) delete h.textoLinea;
  return { hallazgos, sinLeer, huerfanas, reemplazos, declaracionesUsadas: usadas.size };
}

function leerDeclaraciones() {
  let crudo;
  try {
    crudo = fs.readFileSync(DECLARACIONES, 'utf8');
  } catch (error) {
    throw new Error('no se pudo leer ' + path.relative(REPO, DECLARACIONES) + ': ' + error.message);
  }
  let json;
  try {
    json = JSON.parse(crudo);
  } catch (error) {
    throw new Error('el JSON de declaraciones no parsea: ' + error.message);
  }
  const lista = json?.permitidos;
  if (!Array.isArray(lista)) {
    throw new Error('el JSON de declaraciones no tiene un array `permitidos`');
  }
  for (const [i, d] of lista.entries()) {
    if (typeof d?.fichero !== 'string' || !d.fichero) throw new Error('declaración ' + i + ': falta `fichero`');
    if (typeof d?.fragmento !== 'string' || d.fragmento.length < 8) {
      throw new Error('declaración ' + i + ': `fragmento` ausente o demasiado corto (mínimo 8 caracteres, para que identifique un sitio)');
    }
    if (typeof d?.motivo !== 'string' || d.motivo.length < 12) throw new Error('declaración ' + i + ': falta `motivo` (por escrito)');
  }
  return lista;
}

function ficherosDe(raiz, patrones) {
  let bruto;
  try {
    bruto = execFileSync('git', ['ls-files', '-z', '--', ...patrones], {
      cwd: raiz,
      encoding: 'utf8',
      maxBuffer: 1 << 28,
    });
  } catch (error) {
    throw new Error('`git ls-files` falló en ' + raiz + ': ' + error.message);
  }
  return bruto
    .split('\u0000')
    .filter(Boolean)
    .filter((f) => !f.includes('/generated/') && !f.includes('api-types/') && !f.includes('node_modules/') && !f.includes('.next/'))
    .sort();
}

/** Los tres árboles. Los anidados se declaran NO MEDIDOS si no están (CI de la raíz). */
function arboles() {
  const lista = [
    {
      etiqueta: 'raíz',
      raiz: REPO,
      patrones: ['*.md', '*.ts', '*.tsx', '*.html', '*.scss', '*.css', '*.mjs', '*.js'],
    },
    {
      etiqueta: 'backend-erp',
      raiz: path.join(REPO, 'backend-erp'),
      patrones: ['*.ts'],
    },
    {
      etiqueta: 'erp-frontend',
      raiz: path.join(REPO, 'erp-frontend'),
      patrones: ['*.ts', '*.html', '*.scss'],
    },
  ];
  return lista.map((a) => {
    if (!fs.existsSync(a.raiz)) return { ...a, medido: false, ficheros: [] };
    return { ...a, medido: true, ficheros: ficherosDe(a.raiz, a.patrones) };
  });
}

// ── A/B del propio detector ─────────────────────────────────────────────────
function selfTest() {
  const casos = [];
  const check = (nombre, ok, detalle) => casos.push({ nombre, ok, detalle });
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'audit-encoding-'));
  const arbol = (etiqueta, raiz, ficheros) => ({ etiqueta, raiz, ficheros });

  try {
    const txt = (n, c) => fs.writeFileSync(path.join(base, n), c, 'utf8');

    txt('sano.md', '# Sano\n\nAcentos correctos: importación, año, «comillas», día.\nUn TAB no aparece; los acentos están en NFC.\n');
    const rSano = auditar([arbol('t', base, ['sano.md'])], [], base);
    check('un fichero limpio no da hallazgos', rSano.hallazgos.length === 0, JSON.stringify(rSano.hallazgos));

    txt('control.md', 'linea uno\nel arreglo de \u000ciscal-years se estrechó\nlinea tres\n');
    const rControl = auditar([arbol('t', base, ['control.md'])], [], base);
    check(
      'R1 detecta el form-feed y nombra su línea',
      rControl.hallazgos.length === 1 &&
        rControl.hallazgos[0].tipo === 'control' &&
        rControl.hallazgos[0].linea === 2 &&
        rControl.hallazgos[0].detalle.includes('form-feed'),
      JSON.stringify(rControl.hallazgos),
    );

    txt('tab.ts', 'const x = leer con \u0009x dentro;\n');
    const rTab = auditar([arbol('t', base, ['tab.ts'])], [], base);
    check('R1 detecta el TAB en un .ts (el `` `t `` de PowerShell)', rTab.hallazgos.length === 1 && rTab.hallazgos[0].detalle.includes('TAB'), JSON.stringify(rTab.hallazgos));

    txt('crlf.md', 'una\r\ndos\r\ntres\r\n');
    const rCrlf = auditar([arbol('t', base, ['crlf.md'])], [], base);
    check('el CR/LF del fin de línea NO es un hallazgo', rCrlf.hallazgos.length === 0, JSON.stringify(rCrlf.hallazgos));

    txt('moji.ts', "throw new BadRequestException('CotizaciÃ³n invÃ¡lida');\n");
    const rMoji = auditar([arbol('t', base, ['moji.ts'])], [], base);
    check('R2 detecta la secuencia doble-codificada en CÓDIGO', rMoji.hallazgos.length === 2 && rMoji.hallazgos.every((h) => h.tipo === 'doble-codificacion'), JSON.stringify(rMoji.hallazgos));

    txt('reemplazo.scss', '// Bloqueo por l\uFFFDMmite de cr\uFFFDdito\n');
    const rReemplazo = auditar([arbol('t', base, ['reemplazo.scss'])], [], base);
    check(
      'R3 cuenta los U+FFFD y NO los convierte en hallazgo que bloquee',
      rReemplazo.reemplazos.length === 2 && rReemplazo.hallazgos.length === 0,
      JSON.stringify({ r: rReemplazo.reemplazos.length, h: rReemplazo.hallazgos.length }),
    );

    txt('cita.md', 'La nota dice: (`importación` → `importaciÃ³n`). No se repara.\n');
    const decl = [{ fichero: 'cita.md', fragmento: '`importaciÃ³n`', motivo: 'cita deliberada del defecto' }];
    const rCita = auditar([arbol('t', base, ['cita.md'])], decl, base);
    check(
      'una declaración cubre el hallazgo y no queda huérfana',
      rCita.hallazgos.length === 1 && !!rCita.hallazgos[0].cubiertoPor && rCita.huerfanas.length === 0,
      JSON.stringify({ h: rCita.hallazgos, hu: rCita.huerfanas }),
    );

    const rHuerfana = auditar([arbol('t', base, ['cita.md'])], [{ fichero: 'cita.md', fragmento: 'esto no está en el fichero', motivo: 'exención que ya no cubre nada' }], base);
    check('una declaración que no casa con nada es HUÉRFANA (se lista, no se calla)', rHuerfana.huerfanas.length === 1, JSON.stringify(rHuerfana.huerfanas));

    const rOtraRuta = auditar([], [{ fichero: 'otro.md', fragmento: '`importaciÃ³n`', motivo: 'la declaración es de otro fichero' }], base);
    check('una declaración de OTRO fichero no cubre nada', rOtraRuta.huerfanas.length === 1, JSON.stringify(rOtraRuta.huerfanas));

    const rSinLeer = auditar([arbol('t', base, ['no-existe.md'])], [], base);
    check('un fichero ilegible se reporta y NO se ignora', rSinLeer.sinLeer.length === 1, JSON.stringify(rSinLeer.sinLeer));

    const rDosArboles = auditar(
      [arbol('uno', base, ['tab.ts']), arbol('dos', base, ['moji.ts'])],
      [],
      base,
    );
    check(
      'los hallazgos llevan su ÁRBOL: no se confunden las procedencias',
      rDosArboles.hallazgos.length === 3 && new Set(rDosArboles.hallazgos.map((h) => h.arbol)).size === 2,
      JSON.stringify(rDosArboles.hallazgos.map((h) => h.arbol + ':' + h.linea)),
    );

    // R14 — el gate no se puede apuntar a otro sitio: un argumento desconocido es código 2.
    // Se mide ejecutando el script de verdad (no leyendo el texto): es su forma de invocación.
    const codigoDe = (args) => {
      try {
        execFileSync(process.execPath, [fileURLToPath(import.meta.url), ...args], {
          encoding: 'utf8',
          stdio: ['ignore', 'pipe', 'pipe'],
        });
        return 0;
      } catch (error) {
        return typeof error?.status === 'number' ? error.status : -1;
      }
    };
    const conRoot = codigoDe(['--root=/tmp']);
    check('un argumento desconocido NO se ignora (se rechaza con 2)', conRoot === 2, 'código obtenido: ' + conRoot);
  } finally {
    fs.rmSync(base, { recursive: true, force: true });
  }

  let fallos = 0;
  for (const c of casos) {
    if (c.ok) console.log('  [OK]   ' + c.nombre);
    else {
      fallos++;
      console.log('  [ROJO] ' + c.nombre + ' → ' + (c.detalle ?? ''));
    }
  }
  console.log('');
  if (fallos) {
    console.error('AUTOPRUEBA EN ROJO: ' + fallos + ' de ' + casos.length + ' casos');
    return 1;
  }
  console.log('Autoprueba OK: ' + casos.length + '/' + casos.length + ' — las dos reglas que bloquean y la que informa, el falso positivo del CR/LF, la cita declarada, la huérfana, el árbol ausente y el rechazo de argumentos.');
  return 0;
}

// ── CLI ─────────────────────────────────────────────────────────────────────
function main(argv) {
  const args = argv.slice(2);
  const raros = args.filter((a) => !ALLOWED.has(a));
  if (raros.length) {
    console.error('audit:encoding — argumento(s) no reconocido(s): ' + raros.join(' ') + '. Solo: ' + [...ALLOWED].join(' '));
    console.error('(La raíz y las declaraciones se resuelven por la ubicación del script: no hay `--root`. Un gate que se puede apuntar a otro sitio se puede burlar.)');
    return 2;
  }
  if (args.includes('--self-test')) return selfTest();

  const verTodo = args.includes('--all');

  let declaraciones;
  let lista;
  try {
    declaraciones = leerDeclaraciones();
    lista = arboles();
  } catch (error) {
    console.error('audit:encoding — ABORTA: ' + error.message);
    return 2;
  }

  const medidos = lista.filter((a) => a.medido);
  const noMedidos = lista.filter((a) => !a.medido);
  const { hallazgos, sinLeer, huerfanas, reemplazos, declaracionesUsadas } = auditar(medidos, declaraciones);

  if (sinLeer.length) {
    console.error('audit:encoding — ABORTA: ' + sinLeer.length + ' fichero(s) que no se pudieron leer:');
    for (const s of sinLeer) console.error('  ✗ ' + s.fichero + ' — ' + s.motivo);
    return 2;
  }

  const sinDeclarar = hallazgos.filter((h) => !h.cubiertoPor);
  const totalFicheros = medidos.reduce((a, x) => a + x.ficheros.length, 0);
  const porTipo = (tipo) => {
    const l = hallazgos.filter((h) => h.tipo === tipo);
    const cubiertos = l.filter((h) => h.cubiertoPor).length;
    return { total: l.length, cubiertos, sin: l.length - cubiertos };
  };
  const r1 = porTipo('control');
  const r2 = porTipo('doble-codificacion');

  console.log('audit:encoding — codificación de la documentación y del código');
  for (const a of medidos) console.log('  · ' + a.etiqueta.padEnd(13) + a.ficheros.length + ' ficheros (' + a.patrones.join(' ') + ')');
  for (const a of noMedidos) {
    console.log('  · ' + a.etiqueta.padEnd(13) + 'NO MEDIDO (el árbol no está: el CI de la raíz no clona los repos anidados)');
  }
  console.log('  total: ' + totalFicheros + ' ficheros · ' + medidos.length + ' árbol(es) medido(s)');
  console.log('  · R1 caracteres de control: ' + r1.total + ' (' + r1.cubiertos + ' cubiertos por declaración, ' + r1.sin + ' sin declarar)');
  console.log('  · R2 secuencias doble-codificadas: ' + r2.total + ' (' + r2.cubiertos + ' cubiertas por declaración, ' + r2.sin + ' sin declarar)');
  console.log('  · R3 U+FFFD (INFORMA, no bloquea): ' + reemplazos.length + ' en ' + new Set(reemplazos.map((r) => r.fichero)).size + ' fichero(s) — es lo que escribe un decodificador al PERDER bytes, pero también puede ser deliberado (el interceptor que limpia ese carácter)');
  console.log('  declaraciones: ' + declaraciones.length + ' (' + declaracionesUsadas + ' usadas, ' + huerfanas.length + ' huérfanas)');

  const listar = (titulo, listaH) => {
    if (!listaH.length) return;
    console.log('  ' + titulo + ':');
    for (const h of listaH) {
      console.log('     ✗ ' + h.arbol + '/' + h.fichero + ':' + h.linea + '  ' + h.tipo + ' ' + h.detalle);
      console.log('       ' + h.contexto);
    }
  };
  listar('HALLAZGOS SIN DECLARAR', sinDeclarar);
  if (verTodo) listar('HALLAZGOS DECLARADOS (a propósito)', hallazgos.filter((h) => h.cubiertoPor));
  if (huerfanas.length) {
    console.log('  DECLARACIONES HUÉRFANAS (ya no cubren nada; quítelas del JSON o repare el sitio):');
    for (const d of huerfanas) console.log('     · ' + d.fichero + '  «' + d.fragmento + '»  (' + d.motivo + ')');
  }
  console.log('');
  console.log('LÍMITE DECLARADO: los tres árboles se resuelven por su `git ls-files`; en el CI de la');
  console.log('raíz los anidados no están y se declaran NO MEDIDOS. Quedan fuera los generados');
  console.log('(src/generated/, api-types/) y los .json. R3 no fija veredicto: un U+FFFD puede ser');
  console.log('un byte perdido o una cita del propio carácter.');

  if (sinDeclarar.length || huerfanas.length) {
    console.log('');
    console.log('VEREDICTO: ROJO — ' + sinDeclarar.length + ' hallazgo(s) sin declarar y ' + huerfanas.length + ' declaración(es) huérfana(s).');
    console.log('Arreglo: reparar el sitio (o, si es una CITA del defecto, declararla en scripts/encoding-declarations.json con su motivo).');
    return 1;
  }
  console.log('');
  console.log('VEREDICTO: VERDE — 0 hallazgos sin declarar, 0 declaraciones huérfanas.');
  return 0;
}

// Solo cuando se EJECUTA (no cuando se importa): `--self-test` ejecuta el script
// como hijo para medir el rechazo de argumentos.
const esEntrada =
  process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (esEntrada) {
  process.exitCode = main(process.argv);
}
