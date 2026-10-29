#!/usr/bin/env node
/**
 * audit-encoding.mjs — **gate de CODIFICACIÓN de la documentación versionada**.
 *
 * QUÉ IMPIDE. Un documento escrito por PowerShell queda con caracteres mudos que
 * ninguna otra puerta ve: su backtick es **carácter de escape**, así que
 * `` `t `` → TAB, `` `r `` → CR, `` `b `` → backspace, `` `0 `` → NUL, `` `a `` →
 * BEL, `` `f `` → form-feed… y ante un carácter que no es escapable **se pierde**.
 * Eso dejó, medido el 2026-10-29, **61 caracteres de control** y **115 secuencias
 * doble-codificadas** repartidas entre `AUDIT.md` y
 * `docs/plans/historial-sesiones.md`: el ledger decía «confundÃ­an el DÃA» y en
 * una fila el `1` de la cuenta del WIP era un `0x01`. Se reparó a mano, y esto
 * existe para que **no vuelva a colarse**: sin gate, la única defensa era que
 * alguien lo leyera.
 *
 * LAS DOS REGLAS.
 *   R1 · **carácter de control**: cualquier byte `0x00–0x08`, `0x09` (TAB),
 *        `0x0B`, `0x0C`, `0x0E–0x1F` o `0x7F` dentro de una línea. `CR`/`LF` no
 *        cuentan: son el fin de línea. Se incluye el **TAB** a propósito —el
 *        árbol tenía **0** en 121 ficheros cuando se escribió el gate, así que
 *        cualquier TAB nuevo es un escape de PowerShell, no indentación—.
 *   R2 · **secuencia doble-codificada**: un arranque de UTF-8 leído como
 *        Windows-1252 (`Â`, `Ã`, `â`) seguido de un carácter del rango alto de
 *        cp1252. Es la firma exacta de «UTF-8 → cp1252 → UTF-8», y esas tres
 *        letras no aparecen en castellano.
 *
 * LAS DECLARACIONES. Algunos sitios **citan el defecto a propósito** —T97 lo usa
 * como ejemplo y §9 del histórico documenta el artefacto de visualización de
 * PowerShell—; repararlos **borraría la documentación de la clase de defecto**.
 * `scripts/encoding-declarations.json` los declara con su `fragmento` (el texto
 * exacto que los rodea) y su `motivo`. El índice es por **contenido**, no por
 * `fichero:línea`: las líneas se mueven y un índice por número convertiría cada
 * inserción en un falso «declaración huérfana».
 *
 * Y si una declaración **deja de casar** con ningún hallazgo, el gate **falla y
 * la lista**: una declaración que ya no cubre nada es una exención que quedó
 * viva porque nadie la miró (el mismo criterio que el resto de ratchets: lo que
 * desaparece también se lista).
 *
 * ALCANCE, Y SU LÍMITE. `git ls-files "*.md"` **del repo de la raíz**: 121
 * ficheros, incluidos `storefront/` y `docs/`. **No** ve los `.md` de
 * `backend-erp/` ni de `erp-frontend/`: son repos anidados y aquí aparecen como
 * un solo objeto, no como ficheros. Se declara en la salida; si algún día uno de
 * esos árboles quiere esta puerta, la pone en su propio `pre-push` (el CI de la
 * raíz no los clona).
 *
 * USO
 *   node scripts/audit-encoding.mjs                # informe + veredicto (--check implícito)
 *   node scripts/audit-encoding.mjs --check        # lo mismo (la forma que usan las puertas)
 *   node scripts/audit-encoding.mjs --all          # lista también los hallazgos declarados
 *   node scripts/audit-encoding.mjs --self-test    # A/B del propio detector, sin repo
 *
 * CÓDIGOS DE SALIDA. `0` verde · `1` hallazgos sin declarar o declaraciones
 * huérfanas · `2` **ruidoso**: no se pudo leer un fichero, el JSON de
 * declaraciones está mal, `git` falló o llegó un argumento que no existe. Nunca
 * degrada a verde por un fallo de lectura: un gate que no puede mirar **grita**.
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

const NOMBRE_CONTROL = (cp) =>
  ({
    0x00: 'NUL', 0x07: 'BEL', 0x08: 'backspace', 0x09: 'TAB', 0x0b: 'VT',
    0x0c: 'form-feed', 0x0d: 'CR', 0x1b: 'ESC', 0x7f: 'DEL',
  })[cp] ?? 'control';

/** Contexto legible alrededor de un índice, sin saltos de línea. */
function contexto(linea, desde, hasta) {
  const a = Math.max(0, desde - 42);
  const b = Math.min(linea.length, hasta + 42);
  return (a > 0 ? '…' : '') + linea.slice(a, b) + (b < linea.length ? '…' : '');
}

/**
 * El detector. Recibe la lista de ficheros **relativos** a `raiz` y las
 * declaraciones; devuelve los hallazgos, los que quedan cubiertos, las
 * declaraciones huérfanas y los ficheros que no se pudieron leer.
 *
 * Puro respecto del disco de entrada: el `--self-test` le pasa su propio árbol.
 */
export function auditar(ficheros, declaraciones, raiz) {
  const hallazgos = [];
  const sinLeer = [];
  const usadas = new Set();

  for (const rel of ficheros) {
    let texto;
    try {
      texto = fs.readFileSync(path.join(raiz, rel), 'utf8');
    } catch (error) {
      sinLeer.push({ fichero: rel, motivo: error instanceof Error ? error.message : String(error) });
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
          fichero: rel,
          linea: i + 1,
          tipo: 'doble-codificacion',
          detalle: JSON.stringify(m[0]),
          contexto: contexto(linea, m.index, m.index + m[0].length),
          textoLinea: linea,
        });
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
  return { hallazgos, sinLeer, huerfanas, declaracionesUsadas: usadas.size };
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

function ficherosVersionados() {
  let bruto;
  try {
    bruto = execFileSync('git', ['ls-files', '-z', '--', '*.md'], {
      cwd: REPO,
      encoding: 'utf8',
      maxBuffer: 1 << 28,
    });
  } catch (error) {
    throw new Error('`git ls-files` falló en ' + REPO + ': ' + error.message);
  }
  return bruto.split('\u0000').filter(Boolean).sort();
}

// ── A/B del propio detector ─────────────────────────────────────────────────
function selfTest() {
  const casos = [];
  const check = (nombre, ok, detalle) => casos.push({ nombre, ok, detalle });
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'audit-encoding-'));

  try {
    const txt = (n, c) => fs.writeFileSync(path.join(base, n), c, 'utf8');

    txt('sano.md', '# Sano\n\nAcentos correctos: importación, año, «comillas», día.\nUn TAB no aparece; los acentos están en NFC.\n');
    const rSano = auditar(['sano.md'], [], base);
    check('un fichero limpio no da hallazgos', rSano.hallazgos.length === 0, JSON.stringify(rSano.hallazgos));

    txt('control.md', 'linea uno\nel arreglo de \u000ciscal-years se estrechó\nlinea tres\n');
    const rControl = auditar(['control.md'], [], base);
    check(
      'R1 detecta el form-feed y nombra su línea',
      rControl.hallazgos.length === 1 &&
        rControl.hallazgos[0].tipo === 'control' &&
        rControl.hallazgos[0].linea === 2 &&
        rControl.hallazgos[0].detalle.includes('form-feed'),
      JSON.stringify(rControl.hallazgos),
    );

    txt('tab.md', 'columna\tvalor\n');
    const rTab = auditar(['tab.md'], [], base);
    check('R1 detecta el TAB (el escape `` `t `` de PowerShell)', rTab.hallazgos.length === 1 && rTab.hallazgos[0].detalle.includes('TAB'), JSON.stringify(rTab.hallazgos));

    txt('crlf.md', 'una\r\ndos\r\ntres\r\n');
    const rCrlf = auditar(['crlf.md'], [], base);
    check('el CR/LF del fin de línea NO es un hallazgo', rCrlf.hallazgos.length === 0, JSON.stringify(rCrlf.hallazgos));

    txt('moji.md', 'quedaron sin uso: ningún otro validador â€”el PATCH hereda por Parti\n');
    const rMoji = auditar(['moji.md'], [], base);
    check('R2 detecta la secuencia doble-codificada', rMoji.hallazgos.length === 1 && rMoji.hallazgos[0].tipo === 'doble-codificacion', JSON.stringify(rMoji.hallazgos));

    txt('cita.md', 'La nota dice: (`importación` → `importaciÃ³n`). No se repara.\n');
    const decl = [{ fichero: 'cita.md', fragmento: '`importaciÃ³n`', motivo: 'cita deliberada del defecto' }];
    const rCita = auditar(['cita.md'], decl, base);
    check(
      'una declaración cubre el hallazgo y no queda huérfana',
      rCita.hallazgos.length === 1 && !!rCita.hallazgos[0].cubiertoPor && rCita.huerfanas.length === 0,
      JSON.stringify({ h: rCita.hallazgos, hu: rCita.huerfanas }),
    );

    const rHuerfana = auditar(['cita.md'], [{ fichero: 'cita.md', fragmento: 'esto no está en el fichero', motivo: 'exención que ya no cubre nada' }], base);
    check('una declaración que no casa con nada es HUÉRFANA (se lista, no se calla)', rHuerfana.huerfanas.length === 1, JSON.stringify(rHuerfana.huerfanas));

    const rOtraRuta = auditar([], [{ fichero: 'otro.md', fragmento: '`importaciÃ³n`', motivo: 'la declaración es de otro fichero' }], base);
    check('una declaración de OTRO fichero no cubre nada', rOtraRuta.huerfanas.length === 1, JSON.stringify(rOtraRuta.huerfanas));

    const rSinLeer = auditar(['no-existe.md'], [], base);
    check('un fichero ilegible se reporta y NO se ignora', rSinLeer.sinLeer.length === 1, JSON.stringify(rSinLeer.sinLeer));

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
  console.log('Autoprueba OK: ' + casos.length + '/' + casos.length + ' — las dos reglas, el falso positivo del CR/LF y de la cita declarada, la huérfana y el rechazo de argumentos.');
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
  let ficheros;
  try {
    declaraciones = leerDeclaraciones();
    ficheros = ficherosVersionados();
  } catch (error) {
    console.error('audit:encoding — ABORTA: ' + error.message);
    return 2;
  }

  const { hallazgos, sinLeer, huerfanas, declaracionesUsadas } = auditar(ficheros, declaraciones, REPO);

  if (sinLeer.length) {
    console.error('audit:encoding — ABORTA: ' + sinLeer.length + ' fichero(s) que no se pudieron leer:');
    for (const s of sinLeer) console.error('  ✗ ' + s.fichero + ' — ' + s.motivo);
    return 2;
  }

  const sinDeclarar = hallazgos.filter((h) => !h.cubiertoPor);
  const declarados = hallazgos.length - sinDeclarar.length;
  // Las cuentas se publican POR REGLA: un total mezclado hacía que la línea de R2
  // dijera «5 secuencias · 5 cubiertas · 1 sin declarar» cuando el hallazgo suelto
  // era de R1. Un número que no cuadra es un número que engaña.
  const porTipo = (tipo) => {
    const lista = hallazgos.filter((h) => h.tipo === tipo);
    const cubiertos = lista.filter((h) => h.cubiertoPor).length;
    return { total: lista.length, cubiertos, sin: lista.length - cubiertos };
  };
  const r1 = porTipo('control');
  const r2 = porTipo('doble-codificacion');

  console.log('audit:encoding — codificación de la documentación versionada');
  console.log('  alcance: ' + ficheros.length + ' ficheros .md (git ls-files "*.md", raíz del repo)');
  console.log('  · R1 caracteres de control: ' + r1.total + ' (' + r1.cubiertos + ' cubiertos por declaración, ' + r1.sin + ' sin declarar)');
  console.log('  · R2 secuencias doble-codificadas: ' + r2.total + ' (' + r2.cubiertos + ' cubiertas por declaración, ' + r2.sin + ' sin declarar)');
  console.log('  declaraciones: ' + declaraciones.length + ' (' + declaracionesUsadas + ' usadas, ' + huerfanas.length + ' huérfanas)');

  const listar = (titulo, lista) => {
    if (!lista.length) return;
    console.log('  ' + titulo + ':');
    for (const h of lista) {
      console.log('     ✗ ' + h.fichero + ':' + h.linea + '  ' + h.tipo + ' ' + h.detalle);
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
  console.log('LÍMITE DECLARADO: el alcance son los .md del repo de la RAÍZ; los de backend-erp/ y');
  console.log('erp-frontend/ son repos anidados y aquí no se ven. El gate comprueba la CODIFICACIÓN,');
  console.log('no la prosa: un documento mal escrito pero bien codificado pasa.');

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
