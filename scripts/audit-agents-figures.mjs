#!/usr/bin/env node
/**
 * audit-agents-figures — **el gate de las CIFRAS de `AGENTS.md`**.
 *
 * POR QUÉ EXISTE. `AGENTS.md` es el manual que todo agente lee antes de trabajar, y sus cifras
 * derivan solas: el 2026-10-11 tenía el `!` en **1601** cuando su instrumento decía **1502**, y
 * `explicit-any` en **229** cuando decía **1** (`3027c4a`, que las corrigió a mano). El manual lo
 * escribe para las reglas —*«una regla sin gate es un deseo»*— y esa misma lección no estaba
 * aplicada al manual. `scripts/audit-workflow-inputs.mjs` vigila los **workflows**, no `AGENTS.md`:
 * no había nada que leyera el manual. Esto lo lee.
 *
 * QUÉ HACE, EN ORDEN (`--check`):
 *
 *   1. **AUTOPRUEBA primero** (ver abajo). Si está roja, el gate **no sigue al ratchet**: un gate
 *      que no sabe ponerse rojo no puede decir nada del manual.
 *   2. **Corre los instrumentos de verdad** —`npm run audit:…:check` en `backend-erp`, los `git`
 *      de la raíz, `npm run audit:ng-deep` en `erp-frontend`— y saca la cifra de **su salida**, no
 *      de su documentación.
 *   3. Compara **a tres bandas**: `valorEsperado` (el fichero de declaraciones, al lado de este
 *      script) contra lo que el patrón captura en `AGENTS.md` **y** contra lo que el extractor saca
 *      de la salida real. Por eso el informe puede decir **quién** miente: el manual o el
 *      instrumento, con las dos cifras y el comando delante.
 *
 * LO QUE **NO** HACE, DICHO EN SU SALIDA (no tapado):
 *
 *   · **Base de datos.** `audit:tracking` y `audit:reconcile` la necesitan: no se corren, y sus
 *     cifras van declaradas como **no medidas** con su motivo en el fichero de declaraciones.
 *   · **Árbol incompleto.** El CI de la raíz clona **solo la raíz**, así que `backend-erp/` y
 *     `erp-frontend/` **no existen** ahí: toda cifra cuyo comando necesite uno de esos repos sale
 *     **NO MEDIDA** con su motivo y se cuenta (`NO MEDIDAS en este arbol: N de M`). Un árbol
 *     incompleto no es un árbol limpio —pero tampoco es un defecto de nadie—: es la regla 4 de
 *     `audit-workflow-inputs.mjs`, que costó un rojo falso (`958cd664`). Lo que **sí** se comprueba
 *     siempre, aunque falte el repo, es la cifra del **manual** contra su valor declarado.
 *   · **Cifras del manual sin instrumento** (o instrumentos sin cifra): van en `noVigiladas`, con
 *     motivo, y se imprimen. Vigilar una cifra que no se puede medir es un gate que se ignora.
 *   · **Lo que NO puede vigilar este gate, por construcción:** que el manual mencione una cifra
 *     que **nadie declaró**. Eso no es automatizable (no se sabe qué número del manual es un dato
 *     y cuál es prosa). Lo que **sí** se detecta es lo contrario, y es rojo: una declaración cuyo
 *     patrón **no encuentra** su cifra (`ancla-ausente-en-el-manual`) vigila algo que no existe.
 *
 * LA AUTOPRUEBA (corre **antes** del ratchet, y sobre copias **fuera** del repositorio). Escribe
 * árboles de verdad en `%TEMP%`/`os.tmpdir()` —no rompe el repositorio: un gate que solo se puede
 * probar rompiendo el árbol no se prueba— con el manual copiado y **dobles** de los instrumentos,
 * y comprueba que el gate se pone ROJO en cada rotura:
 *
 *   · una cifra del **manual** cambiada ⇒ ROJO; y también si cambia **en uno solo** de sus sitios;
 *   · **un señuelo de OTRA familia** («congelado en N» hablando de otro ratchet) ⇒ **NO cuenta** para
 *     esta figura y el gate sale **VERDE**: un gate que grita donde no hay defecto se acaba ignorando,
 *     y esta figura nació con un patrón sin anclar a su familia (`congelad[oa] en (\d+)`) que hacía
 *     justo eso. El caso se monta mutando el manual real, así que si el señuelo no se puede insertar
 *     el caso FALLA en vez de pasar por no haber probado nada (R10);
 *   · una cifra del **instrumento** cambiada ⇒ ROJO (con extractor `regex` y con la tabla de
 *     familias, que es un extractor distinto);
 *   · una cifra que **el manual no menciona** ⇒ ROJO (`ancla-ausente-en-el-manual`), decidido y
 *     justificado: una declaración que no encuentra su ancla vigila algo que no existe, y callarlo
 *     sería el «no sé» que la skill prohíbe;
 *   · un **comando que no existe** ⇒ ROJO (no un «no sé» silencioso);
 *   · un comando que sale 0 y **no dice la cifra** ⇒ ROJO; una salida con **dos valores distintos**
 *     ⇒ ROJO (un extractor que no es único no mide);
 *   · un **árbol sin `backend-erp`** ⇒ VERDE **informativo**, con la cuenta legible;
 *   · **declaraciones inválidas** (falta `valorEsperado`, patrón que no compila, cifra no vigilada
 *     sin motivo) ⇒ ROJO por el propio fichero: el gate no se sostiene y **no pasa**.
 *
 * La autoprueba **normaliza** la copia del manual a los valores declarados antes de usarla, pero
 * exige que **cada patrón encuentre su cifra en el manual de verdad**: así se prueba que el ancla
 * puede encontrar algo (R9) sin que la autoprueba sea rehén de la deriva del día. El gate que corre
 * de verdad **nunca** lee `muestra` (el campo que describe la salida del instrumento): lee la salida
 * real, y en verde solo se ve si el extractor la encuentra.
 *
 * LA RAÍZ LA RESUELVE EL PROPIO SCRIPT (`__dirname/..`), nunca el `cwd`, ni una variable de entorno,
 * ni un argumento, y **no hay** `--root` ni `--declaraciones`: un gate que se puede apuntar a otro
 * sitio es un gate que se puede burlar (`fe929d9f`, R14). Sin argumentos de escape, la autoprueba es
 * la única forma de mirar otro árbol, y lo hace **dentro** del proceso.
 *
 * Uso:
 *   node scripts/audit-agents-figures.mjs             # autoprueba + ratchet (igual que --check)
 *   node scripts/audit-agents-figures.mjs --check     # íd.
 *   node scripts/audit-agents-figures.mjs --self-test # solo la autoprueba (los señuelos)
 *   node scripts/audit-agents-figures.mjs --help
 *
 * Código de salida: 0 = verde · 1 = hallazgos (o autoprueba roja) · 2 = el gate **no pudo
 * ejecutarse** (declaraciones que no se sostienen, manual ilegible) y por tanto NO pasa.
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
/** La raíz: por la ubicación del propio script. Nunca `cwd`, nunca el entorno, nunca un argumento. */
const REPO = path.resolve(HERE, '..');
const DECLARATIONS_PATH = path.join(HERE, 'audit-agents-figures.declarations.json');
const MANUAL_FILE = 'AGENTS.md';
/**
 * La única ancla FUERA del manual: el comentario de `backend-erp/scripts/audit-explicit-any.mjs`, del
 * que cuelga la figura `comentario-generados-207`. Se nombra una vez porque hay tres sitios que
 * tienen que hablar del MISMO fichero (la declaración, el señuelo y el «no evaluable si su repo no
 * está»), y tres literales sueltos divergen.
 */
const ANCLA_BACKEND = 'backend-erp/scripts/audit-explicit-any.mjs';

/** Un instrumento colgado no puede colgar el gate: 5 min por comando y el comando se declara fallido. */
const TIMEOUT_MS = 300000;

/** Los cuatro extractores. Cada uno con su regla de «no sé» (que es ROJO, nunca un verde callado). */
const TIPOS_EXTRACTOR = ['regex', 'suma', 'lineas', 'familia'];

const RULES = {
  'ancla-ausente-en-el-manual':
    'el patrón declarado no casa ninguna vez en el manual: la declaración vigila una cifra que el manual no menciona',
  'ancla-sin-grupo': 'el patrón del manual no tiene grupo de captura: no hay cifra que extraer',
  'ancla-no-numerica': 'el patrón casa, pero el grupo capturado no es un entero',
  'manual-divergente': 'el manual dice una cifra distinta de `valorEsperado` (en uno o en varios de sus sitios)',
  'comando-fallido':
    'el instrumento no se pudo ejecutar o salió distinto de 0: un instrumento que no arranca no mide nada',
  'cifra-ausente-en-la-salida':
    'el extractor no encontró su cifra en la salida REAL del instrumento: la salida cambió, o el extractor dejó de casar',
  'salida-ambigua': 'el extractor `regex` encontró dos valores distintos: un extractor que no es único no mide',
  'instrumento-divergente': 'el instrumento dice una cifra distinta de `valorEsperado`',
  'declaracion-invalida': 'el fichero de declaraciones no se sostiene (campo que falta, patrón que no compila, id repetido)',
  'manual-ilegible': 'el manual declarado no se puede leer: sin documento no hay valor que comprobar',
};

const esEntero = (v) => /^-?\d+$/.test(String(v).trim());

function tieneValor(v) {
  if (v === null || v === undefined) return false;
  if (typeof v === 'string') return v.trim() !== '';
  return true;
}

function leerTexto(abs) {
  try {
    return { text: fs.readFileSync(abs, 'utf8') };
  } catch (err) {
    return { error: err.message };
  }
}

function compilar(patron, flags) {
  try {
    return { re: new RegExp(patron, flags || '') };
  } catch (err) {
    return { error: err.message };
  }
}

function conGlobal(flags) {
  const f = flags || '';
  return f.includes('g') ? f : `${f}g`;
}

function lineaDe(text, index) {
  return text.slice(0, index).split('\n').length;
}

/** Todas las coincidencias de `patron` (con `g`), con su línea y el grupo capturado. */
function coincidencias(text, patron, flags, grupo = 1) {
  const { re, error } = compilar(patron, conGlobal(flags));
  if (error) return { error: `el patrón no compila: ${error}` };
  const out = [];
  let m;
  while ((m = re.exec(text)) !== null) {
    out.push({ valor: m[grupo], texto: m[0], linea: lineaDe(text, m.index) });
    if (m.index === re.lastIndex) re.lastIndex += 1;
  }
  return { matches: out };
}

/**
 * Reescribe el grupo capturado (por su rango exacto, con el flag `d`) de las coincidencias
 * indicadas. Lo usan la autoprueba y su normalización: nunca el gate que corre de verdad.
 */
function reescribirCapturas(text, patron, flags, valor, opciones = {}) {
  const { indice = null, soloPrimera = false } = opciones;
  const f = `${flags || ''}${(flags || '').includes('d') ? '' : 'd'}`;
  const re = new RegExp(patron, conGlobal(f));
  const rangos = [];
  let ordinal = 0;
  let m;
  while ((m = re.exec(text)) !== null) {
    const rango = m.indices && m.indices[1];
    if (rango && (indice === null || ordinal === indice)) rangos.push(rango);
    ordinal += 1;
    if (soloPrimera && rangos.length > 0) break;
    if (m.index === re.lastIndex) re.lastIndex += 1;
  }
  if (rangos.length === 0) return { error: 'el patrón no casa (o no tiene grupo de captura)' };
  let out = text;
  for (const [a, b] of [...rangos].reverse()) out = out.slice(0, a) + String(valor) + out.slice(b);
  return { text: out, cambios: rangos.length };
}

// ---------------------------------------------------------------------------------------------
// Declaraciones
// ---------------------------------------------------------------------------------------------

function cargarDeclaraciones(filePath) {
  const problems = [];
  const vacio = { figuras: [], noVigiladas: [], problems, path: filePath };
  if (!fs.existsSync(filePath)) {
    problems.push(`no existe el fichero de declaraciones: \`${filePath}\``);
    return vacio;
  }
  const raw = leerTexto(filePath);
  if (raw.error) {
    problems.push(`no se puede leer \`${filePath}\`: ${raw.error}`);
    return vacio;
  }
  let doc;
  try {
    doc = JSON.parse(raw.text);
  } catch (err) {
    problems.push(`no parsea como JSON: ${err.message}`);
    return vacio;
  }
  if (!Array.isArray(doc.figuras)) problems.push('el fichero no trae `figuras` (ni una lista vacía explícita)');
  const figuras = Array.isArray(doc.figuras) ? doc.figuras : [];
  const ids = new Set();
  figuras.forEach((fig, i) => {
    const label = `figuras[${i}]${fig && fig.id ? ` (${fig.id})` : ''}`;
    for (const campo of ['id', 'fichero', 'patron', 'muestra']) {
      if (!tieneValor(fig && fig[campo])) problems.push(`${label}: falta \`${campo}\``);
    }
    if (!Number.isInteger(fig && fig.valorEsperado)) problems.push(`${label}: \`valorEsperado\` tiene que ser un entero`);
    if (tieneValor(fig && fig.id)) {
      if (ids.has(fig.id)) problems.push(`id repetido: \`${fig.id}\` (dos figuras con el mismo nombre son la misma cifra contada dos veces)`);
      ids.add(fig.id);
    }
    const c = fig && fig.comando;
    if (!c || !tieneValor(c.cmd) || !tieneValor(c.cwd)) problems.push(`${label}: \`comando\` necesita \`cmd\` y \`cwd\``);
    const e = fig && fig.extractor;
    if (!e || !TIPOS_EXTRACTOR.includes(e.tipo)) {
      problems.push(`${label}: \`extractor.tipo\` tiene que ser uno de ${TIPOS_EXTRACTOR.join(', ')}`);
    } else if (e.tipo === 'regex' || e.tipo === 'suma') {
      if (!tieneValor(e.patron)) problems.push(`${label}: el extractor \`${e.tipo}\` necesita \`patron\``);
    } else if (e.tipo === 'familia') {
      if (!tieneValor(e.seccion) || !tieneValor(e.familia)) {
        problems.push(`${label}: el extractor \`familia\` necesita \`seccion\` y \`familia\``);
      }
    }
    if (tieneValor(fig && fig.patron)) {
      const r = compilar(fig.patron, fig.flags);
      if (r.error) problems.push(`${label}: \`patron\` no compila: ${r.error}`);
    }
    if (e && tieneValor(e.patron)) {
      const r = compilar(e.patron, e.flags);
      if (r.error) problems.push(`${label}: \`extractor.patron\` no compila: ${r.error}`);
    }
  });
  if (!Array.isArray(doc.noVigiladas)) problems.push('el fichero no trae `noVigiladas` (ni una lista vacía explícita)');
  const noVigiladas = Array.isArray(doc.noVigiladas) ? doc.noVigiladas : [];
  noVigiladas.forEach((n, i) => {
    for (const campo of ['id', 'cifra', 'donde', 'motivo']) {
      if (!tieneValor(n && n[campo])) {
        problems.push(`noVigiladas[${i}]: falta \`${campo}\` (una cifra no vigilada sin motivo es una cifra tapada)`);
      }
    }
  });
  return { figuras, noVigiladas, problems, path: filePath };
}

// ---------------------------------------------------------------------------------------------
// El instrumento: se ejecuta de verdad y se extrae la cifra de SU salida
// ---------------------------------------------------------------------------------------------

function extraer(extractor, salida) {
  if (extractor.tipo === 'regex') {
    const r = coincidencias(salida, extractor.patron, extractor.flags, extractor.grupo || 1);
    if (r.error) return { error: { tipo: 'cifra-ausente-en-la-salida', detalle: r.error } };
    if (r.matches.length === 0) {
      return { error: { tipo: 'cifra-ausente-en-la-salida', detalle: `el extractor /${extractor.patron}/ no casa en la salida` } };
    }
    const distintos = [...new Set(r.matches.map((m) => String(m.valor).trim()))];
    if (distintos.length > 1) {
      return {
        error: {
          tipo: 'salida-ambigua',
          detalle: `el extractor /${extractor.patron}/ da ${distintos.length} valores distintos: ${distintos.join(', ')}`,
        },
      };
    }
    if (!esEntero(distintos[0])) {
      return { error: { tipo: 'cifra-ausente-en-la-salida', detalle: `el extractor capturó «${distintos[0]}», que no es un entero` } };
    }
    return { valor: Number(distintos[0]), nota: `${r.matches.length} coincidencia(s), todas con el mismo valor` };
  }
  if (extractor.tipo === 'suma') {
    const r = coincidencias(salida, extractor.patron, extractor.flags, extractor.grupo || 1);
    if (r.error) return { error: { tipo: 'cifra-ausente-en-la-salida', detalle: r.error } };
    if (r.matches.length === 0) {
      return { error: { tipo: 'cifra-ausente-en-la-salida', detalle: `el extractor /${extractor.patron}/ no casa en la salida` } };
    }
    const malo = r.matches.find((m) => !esEntero(m.valor));
    if (malo) return { error: { tipo: 'cifra-ausente-en-la-salida', detalle: `capturó «${malo.valor}», que no es un entero` } };
    const suma = r.matches.reduce((n, m) => n + Number(m.valor), 0);
    return { valor: suma, nota: `suma de ${r.matches.length} coincidencia(s)` };
  }
  if (extractor.tipo === 'lineas') {
    const n = salida.split(/\r?\n/).filter((l) => l.trim() !== '').length;
    return { valor: n, nota: `${n} línea(s) no vacías` };
  }
  if (extractor.tipo === 'familia') {
    const at = salida.indexOf(extractor.seccion);
    if (at < 0) {
      return {
        error: {
          tipo: 'cifra-ausente-en-la-salida',
          detalle: `la salida no trae la sección «${extractor.seccion}»: no es la salida del instrumento`,
        },
      };
    }
    const cuerpo = salida.slice(at + extractor.seccion.length);
    const escapada = String(extractor.familia).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const m = new RegExp(`^\\s+(\\d+)\\s+${escapada}\\s*$`, 'm').exec(cuerpo);
    if (!m) return { valor: 0, nota: `la familia «${extractor.familia}» no aparece en la tabla: cuenta 0` };
    return { valor: Number(m[1]), nota: `la familia «${extractor.familia}» aparece con ${m[1]}` };
  }
  return { error: { tipo: 'cifra-ausente-en-la-salida', detalle: `extractor desconocido: ${extractor.tipo}` } };
}

// ---------------------------------------------------------------------------------------------
// La auditoría
// ---------------------------------------------------------------------------------------------

const claveComando = (c) => `${c.cwd}|${c.cmd}`;

function ejecutarComandos(figuras, root) {
  const cache = new Map();
  for (const fig of figuras) {
    const c = fig.comando;
    const key = claveComando(c);
    if (cache.has(key)) continue;
    const base = { cmd: c.cmd, cwd: c.cwd, requiere: c.requiere || null };
    const cwdAbs = path.resolve(root, c.cwd);
    if (tieneValor(c.requiere) && !fs.existsSync(path.resolve(root, c.requiere))) {
      cache.set(key, { ...base, estado: 'no-ejecutable', motivo: `«${c.requiere}» no está en este árbol` });
      continue;
    }
    if (!fs.existsSync(cwdAbs)) {
      cache.set(key, { ...base, estado: 'no-ejecutable', motivo: `el directorio de trabajo «${c.cwd}» no está en este árbol` });
      continue;
    }
    const res = spawnSync(c.cmd, { cwd: cwdAbs, shell: true, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, timeout: TIMEOUT_MS });
    const salida = `${res.stdout || ''}${res.stderr || ''}`;
    if (res.error) {
      cache.set(key, { ...base, estado: 'fallido', motivo: `no se pudo ejecutar: ${res.error.message}`, salida });
    } else if (res.status !== 0) {
      const como = res.status === null ? `murió por ${res.signal || 'el tope de tiempo'}` : `salió con código ${res.status}`;
      cache.set(key, { ...base, estado: 'fallido', motivo: como, salida });
    } else {
      cache.set(key, { ...base, estado: 'ok', salida });
    }
  }
  return cache;
}

function auditar({ root, declarationsPath }) {
  const declarations = cargarDeclaraciones(declarationsPath);
  const problems = [...declarations.problems];
  const findings = [];
  const figures = [];
  /** Anclas cuyo REPO no está en este árbol: no evaluables, ni defecto ni verde (ver `auditar`). */
  const anclasNoEvaluables = [];
  const declararAnclaNoEvaluable = (figId, fichero) => {
    if (anclasNoEvaluables.some((a) => a.fig === figId && a.fichero === fichero)) return;
    anclasNoEvaluables.push({ fig: figId, fichero, repo: repoDelAncla(fichero) });
  };
  const manuales = new Map();

  const manualDe = (fichero) => {
    if (!manuales.has(fichero)) {
      const abs = path.resolve(root, fichero);
      const r = leerTexto(abs);
      manuales.set(fichero, r.error ? { error: `no se puede leer \`${abs}\`: ${r.error}` } : { text: r.text, abs });
    }
    return manuales.get(fichero);
  };

  const comandos = ejecutarComandos(declarations.figuras, root);

  for (const fig of declarations.figuras) {
    const registro = { fig, ancla: null, instrumento: null, rojo: false };
    const ficheros = archivosDe(fig);
    // El PRIMER ancla es el «manual» de la figura (`manualDeFigura`). Si cuelga de un repo AUSENTE de
    // este árbol, la figura NO ES EVALUABLE aquí: el fichero no falta, falta el repo entero. Se
    // declara, no se denuncia, y se sigue hasta el instrumento — que sale NO MEDIDA por su `requiere`.
    const anclaFueraDeArbol = !repoDelAnclaPresente(fig.fichero, root);
    if (anclaFueraDeArbol) declararAnclaNoEvaluable(fig.id, fig.fichero);
    const manual = anclaFueraDeArbol ? null : manualDe(fig.fichero);
    if (manual && manual.error) {
      problems.push(`figura \`${fig.id}\`: ${manual.error}`);
      registro.rojo = true;
      figures.push(registro);
      continue;
    }

    // ---- el ancla: TODOS sus ficheros (el manual y, si los declara, los demás) ----
    const sitios = [];
    for (const fichero of ficheros) {
      // Un ancla que cuelga de un repo AUSENTE de este árbol NO es un defecto: el fichero no falta,
      // falta el repo entero (el CI de la raíz clona solo la raíz). Se declara y se sigue; la figura
      // sale NO MEDIDA por el `requiere` de su comando, que es donde eso se decide. Antes esto se
      // denunciaba como `declaracion-invalida` y ponia el gate ROJO en el CI (medido: runs 11-13).
      if (!repoDelAnclaPresente(fichero, root)) {
        declararAnclaNoEvaluable(fig.id, fichero);
        continue;
      }
      const doc = manualDe(fichero);
      if (doc.error) {
        problems.push(`figura \`${fig.id}\`: ${doc.error}`);
        registro.rojo = true;
        continue;
      }
      const mm = coincidencias(doc.text, fig.patron, fig.flags, fig.grupo || 1);
      if (mm.error) {
        problems.push(`figura \`${fig.id}\`: ${mm.error}`);
        registro.rojo = true;
        continue;
      }
      if (mm.matches.length === 0) {
        findings.push({
          tipo: 'ancla-ausente-en-el-manual',
          fig,
          detalle: `el patrón /${fig.patron}/ no casa ninguna vez en \`${fichero}\``,
        });
        registro.rojo = true;
        continue;
      }
      if (mm.matches.some((m) => m.valor === undefined)) {
        findings.push({ tipo: 'ancla-sin-grupo', fig, detalle: `el patrón /${fig.patron}/ no captura ninguna cifra` });
        registro.rojo = true;
        continue;
      }
      if (mm.matches.some((m) => !esEntero(m.valor))) {
        const malo = mm.matches.find((m) => !esEntero(m.valor));
        findings.push({
          tipo: 'ancla-no-numerica',
          fig,
          detalle: `el patrón /${fig.patron}/ capturó «${malo.valor}» en \`${fichero}:${malo.linea}\`, que no es un entero`,
        });
        registro.rojo = true;
        continue;
      }
      for (const m of mm.matches) sitios.push({ fichero, linea: m.linea, valor: Number(m.valor) });
    }
    const porFichero = (fichero) => sitios.filter((s) => s.fichero === fichero).map((s) => s.valor);
    registro.ancla = {
      sitios,
      valores: [...new Set(sitios.map((s) => s.valor))],
      porFichero,
    };
    const malos = sitios.filter((s) => s.valor !== fig.valorEsperado);
    if (malos.length > 0) {
      findings.push({
        tipo: 'manual-divergente',
        fig,
        detalle:
          `${malos.length} de ${sitios.length} sitio(s) del manual no dicen ${fig.valorEsperado}: ` +
          malos.map((s) => `«${s.fichero}:${s.linea}» dice ${s.valor}`).join(', '),
      });
      registro.rojo = true;
    }

    // ---- el instrumento: se corre de verdad ----
    const cmd = comandos.get(claveComando(fig.comando));
    if (!cmd) {
      problems.push(`figura \`${fig.id}\`: su comando no llegó a considerarse (¿declaración incompleta?)`);
      registro.rojo = true;
    } else if (cmd.estado === 'no-ejecutable') {
      registro.instrumento = { estado: 'no-medida', motivo: cmd.motivo, cmd: cmd.cmd };
    } else if (cmd.estado === 'fallido') {
      findings.push({
        tipo: 'comando-fallido',
        fig,
        detalle: `\`${cmd.cmd}\` (en \`${cmd.cwd}\`) ${cmd.motivo}`,
        salida: cmd.salida,
      });
      registro.rojo = true;
      registro.instrumento = { estado: 'fallido', cmd: cmd.cmd, motivo: cmd.motivo };
    } else {
      const ex = extraer(fig.extractor, cmd.salida);
      if (ex.error) {
        findings.push({ tipo: ex.error.tipo, fig, detalle: ex.error.detalle, salida: cmd.salida });
        registro.rojo = true;
        registro.instrumento = { estado: 'no-leida', cmd: cmd.cmd, motivo: ex.error.detalle };
      } else {
        registro.instrumento = { estado: 'medida', valor: ex.valor, nota: ex.nota, cmd: cmd.cmd };
        if (ex.valor !== fig.valorEsperado) {
          findings.push({
            tipo: 'instrumento-divergente',
            fig,
            detalle: `\`${cmd.cmd}\` (en \`${cmd.cwd}\`) dice ${ex.valor} (${ex.nota}) y el valor declarado es ${fig.valorEsperado}`,
          });
          registro.rojo = true;
        }
      }
    }
    figures.push(registro);
  }

  const noMedidas = figures.filter((f) => f.instrumento && f.instrumento.estado === 'no-medida');
  return {
    root,
    declarationsPath,
    figuras: declarations.figuras,
    noVigiladas: declarations.noVigiladas,
    problems,
    findings,
    figures,
    noMedidas,
    anclasNoEvaluables,
    comandos: [...comandos.values()],
  };
}

/**
 * El rojo, en UN solo sitio, para que la autoprueba ejercite exactamente el mismo juicio que decide
 * el código de salida (una autoprueba que reimplementa la regla pasa por casualidad).
 */
function esRojo(result) {
  return result.problems.length > 0 || result.findings.length > 0;
}

function codigoDeSalida(result) {
  if (result.problems.length > 0) return 2;
  if (result.findings.length > 0) return 1;
  return 0;
}

// ---------------------------------------------------------------------------------------------
// Informe
// ---------------------------------------------------------------------------------------------

function cola(texto, lineas = 3) {
  return String(texto)
    .split(/\r?\n/)
    .filter((x) => x.trim() !== '')
    .slice(-lineas);
}

function printReport(result) {
  const lines = [];
  const { figures, findings, problems, noMedidas } = result;
  /** Anclas no evaluables en este árbol (su repo no está clonado): ni defecto ni verde. */
  const anclasNoEvaluables = result.anclasNoEvaluables || [];
  const verdes = figures.filter((f) => !f.rojo && f.instrumento && f.instrumento.estado === 'medida').length;
  const rojas = figures.filter((f) => f.rojo).length;

  lines.push('audit-agents-figures — las cifras de `AGENTS.md` contra sus instrumentos');
  lines.push(`  raiz          : ${result.root}  (resuelta por el propio script, no por cwd ni por argumento)`);
  lines.push(`  manual        : ${path.join(result.root, MANUAL_FILE)}`);
  lines.push(`  declaraciones : ${result.declarationsPath}`);
  lines.push(`  node          : ${process.version} · ${process.platform}/${process.arch}`);
  lines.push('');
  lines.push(
    `Cifras declaradas: ${figures.length} · verificadas contra el instrumento: ${verdes} · en rojo: ${rojas} · ` +
      `NO MEDIDAS en este arbol: ${noMedidas.length} de ${figures.length}`,
  );
  lines.push('');

  lines.push('Las cifras (ancla / instrumento / declarado):');
  for (const f of figures) {
    // `ancla=` son los sitios de TODAS las fichas declaradas. Cuando el ancla vive FUERA del manual
    // (el comentario de un script), se rotula con su ruta en vez de dejar un hueco mudo que se
    // leeria como «una cifra del manual comprobada y correcta», que no es lo que se midio.
    const sitiosAncla = f.ancla ? f.ancla.sitios : [];
    // Una figura cuyo ancla cuelga de un repo ausente de este árbol no tiene sitios que leer: se
    // rotula `NO EVALUABLE` en vez de `(sin ancla)`, que se leeria como una cifra comprobada.
    const anclaNoEvaluable = anclasNoEvaluables.some((a) => a.fig === f.fig.id);
    let ancla = anclaNoEvaluable ? 'NO EVALUABLE' : '(sin ancla)';
    if (f.ancla && !anclaNoEvaluable) {
      const fichas = [...new Set(sitiosAncla.map((s) => s.fichero))];
      ancla =
        fichas.length === 0
          ? '(sin ancla)'
          : fichas
              .map((x) => {
                const valores = f.ancla.porFichero(x).join(',');
                return x === MANUAL_FILE ? valores : `${x}=${valores}`;
              })
              .join(' ');
    }
    let inst = '(no ejecutado)';
    if (f.instrumento) {
      if (f.instrumento.estado === 'medida') inst = String(f.instrumento.valor);
      else if (f.instrumento.estado === 'no-medida') inst = 'NO MEDIDA';
      else inst = 'no leida';
    }
    const marca = f.rojo ? 'ROJO' : f.instrumento && f.instrumento.estado === 'medida' ? 'OK  ' : 'INFO';
    lines.push(
      `  ${marca} ${String(f.fig.id).padEnd(30)} ancla=${ancla.padEnd(12)} instrumento=${inst.padEnd(10)} esperado=${f.fig.valorEsperado}`,
    );
  }
  lines.push('');

  if (findings.length === 0 && problems.length === 0) {
    lines.push('ROJO: 0 hallazgos. Cada cifra del manual coincide con su valor declarado y con la salida de su instrumento.');
  } else {
    lines.push(`ROJO — ${findings.length} hallazgo(s) y ${problems.length} problema(s) del propio gate:`);
    for (const f of findings) {
      const fig = f.fig;
      lines.push(`    [${f.tipo}] ${RULES[f.tipo] || ''}`);
      lines.push(`      cifra       : ${fig.id}`);
      lines.push(`      manual      : ${fig.fichero} · patron /${fig.patron}/ · esperado ${fig.valorEsperado}`);
      lines.push(`      instrumento : \`${fig.comando.cmd}\` (en \`${fig.comando.cwd}\`)`);
      lines.push(`      extractor   : ${JSON.stringify(fig.extractor)}`);
      lines.push(`      que pasa    : ${f.detalle}`);
      if (f.salida) for (const l of cola(f.salida)) lines.push(`      salida      : ${l}`);
      lines.push(
        `      arreglo     : mueva el manual o el instrumento -- y este fichero de declaraciones ` +
          `(\`${fig.id}\` -> ${fig.valorEsperado}) -- EN EL MISMO COMMIT`,
      );
    }
    for (const p of problems) lines.push(`    [declaracion-invalida] ${p}`);
    lines.push('');
  }

  if (noMedidas.length > 0) {
    lines.push(`NO MEDIDAS en este arbol (${noMedidas.length} de ${figures.length}) — no es un defecto de nadie, y NO es un verde:`);
    for (const f of noMedidas) lines.push(`    · ${f.fig.id} — \`${f.instrumento.cmd}\` no se corre: ${f.instrumento.motivo}`);
    lines.push('  La cifra del MANUAL sí se ha comprobado contra su valor declarado; lo que falta es la medida del instrumento.');
    lines.push('  En el CI de la raiz esto es lo normal (ese arbol clona solo la raiz): quien mide de verdad es el gate local.');
    lines.push('');
  }

  if (anclasNoEvaluables.length > 0) {
    lines.push(
      `Anclas NO EVALUABLES en este arbol (${anclasNoEvaluables.length}) — no es un defecto de nadie, y NO es un verde:`,
    );
    for (const a of anclasNoEvaluables) {
      lines.push(`    · ${a.fig} — su ancla \`${a.fichero}\` cuelga de \`${a.repo}/\`, que no está en este árbol`);
    }
    lines.push('  El fichero no falta: falta el repo entero (el CI de la raiz clona solo la raiz). Lo que sí');
    lines.push('  se comprueba aquí es la cifra del MANUAL; el ancla del comentario se mide donde su repo está.');
    lines.push('');
  }

  lines.push(`Cifras declaradas como NO VIGILADAS (${result.noVigiladas.length}) — sin instrumento que las produzca, o sin cifra que comparar:`);
  for (const n of result.noVigiladas) {
    lines.push(`    · [${n.id}] ${n.cifra} (${n.donde})`);
    lines.push(`      motivo: ${n.motivo}`);
  }
  lines.push('');

  lines.push(
    `RESUMEN: figuras=${figures.length} verdes=${verdes} rojas=${rojas} no_medidas=${noMedidas.length} ` +
      `anclas_no_evaluables=${anclasNoEvaluables.length} ` +
      `hallazgos=${findings.length} problemas=${problems.length} no_vigiladas=${result.noVigiladas.length} ` +
      `comandos=${result.comandos.length}`,
  );
  lines.push(esRojo(result) ? 'VEREDICTO: ROJO' : 'VEREDICTO: VERDE');
  return { text: lines.join('\n'), red: esRojo(result) };
}

// ---------------------------------------------------------------------------------------------
// Autoprueba: árboles de verdad, fuera del repositorio, con DOBLES de los instrumentos.
// ---------------------------------------------------------------------------------------------

/**
 * TODOS los ficheros que una figura ancla: `fichero` (el primero) más `archivos` (las demás fichas).
 * POR QUE EXISTE: una cifra puede vivir en un fichero distinto del manual -- el caso medido es el
 * comentario de `backend-erp/scripts/audit-explicit-any.mjs` -- y el gate no puede fingir que lo
 * vigila anclándolo a `AGENTS.md`, que no lo contiene. Sin esto la autoprueba exigía que TODO patrón
 * casara en `AGENTS.md`, y el gate no podía vigilar un fichero que no fuera el manual.
 *
 * CADA ficha declarada tiene que contener el patrón (si no: `ancla-ausente-en-el-manual`): declarar
 * un fichero que no lleva la cifra sería un ancla que no ancla.
 */
function archivosDe(fig) {
  return [fig.fichero, ...(Array.isArray(fig.archivos) ? fig.archivos : [])];
}

/**
 * El «repo» de una ruta anclada: `backend-erp/…` ⇒ `backend-erp` · `AGENTS.md` ⇒ `.` (la raíz, que
 * es SIEMPRE el propio árbol auditado). Es la misma traducción que usa el gate hermano
 * (`audit-workflow-inputs.mjs`, `ownerRepo`) y la razón por la que la regla de abajo se puede
 * escribir sin heurísticas: el primer segmento de la ruta ES el repo.
 */
function repoDelAncla(rel) {
  const partes = String(rel).split('/');
  return partes.length > 1 ? partes[0] : '.';
}

/**
 * ¿Está el REPO del que cuelga un fichero ancla en ESTE árbol? `AGENTS.md` siempre (la raíz es el
 * árbol auditado); `backend-erp/scripts/…` solo si `backend-erp/` existe.
 *
 * POR QUÉ EXISTE (medido el 2026-10-12). Este gate se corre en dos árboles distintos: el local, con
 * los tres repos, y el del CI de la raíz, que **clona solo la raíz** (`erp-frontend/` y
 * `backend-erp/` están en el `.gitignore` del monorepo como repos anidados). El invariante del gate
 * es que **un repo ausente no es un hallazgo**: lo que no está no es lo mismo que lo que falta
 * (`audit-workflow-inputs.mjs`, regla 4) — y el ratchet ya lo cumple por su cuenta, porque una cifra
 * cuyo `requiere` no está sale **NO MEDIDA con su motivo**, y su propio caso de autoprueba
 * `arbol-sin-repos-anidados (NO MEDIDAS, VERDE informativo)` lo fija.
 *
 * Lo que NO lo cumplía era la PRECONDICIÓN de la autoprueba: leía los ficheros ancla de las
 * declaraciones REALES y, si alguno no se dejaba leer, abortaba con `anclas-reales-ilegibles` y
 * código **2**. Eso era correcto mientras el único ancla era `AGENTS.md`, y dejó de serlo cuando
 * `a61a8ff7` añadió la figura `comentario-generados-207`, anclada a
 * `backend-erp/scripts/audit-explicit-any.mjs`: en el CI de la raíz ese fichero no existe, así que
 * **el job moría en el paso de las cifras y `typecheck`, `lint` y `build` de la tienda salían
 * `skipped`**. Medido en GitHub: los runs **11, 12 y 13** (`a61a8ff7`, `50a0f384`, `322f701`) rojos
 * en ese paso, con los tres pasos de la tienda sin correr; el último verde fue el run **10**
 * (`a493c304`).
 *
 * La regla, por tanto, distingue los DOS modos de fallo distintos que antes se trataban igual:
 *   · el **repo** no está en el árbol ⇒ no evaluable (informativo, se cuenta y se imprime);
 *   · el repo ESTÁ y el fichero no ⇒ **ROJO** (`anclas-reales-ilegibles`): ahí el ancla sí falta.
 */
function repoDelAnclaPresente(rel, root) {
  const repo = repoDelAncla(rel);
  if (repo === '.') return true;
  try {
    return fs.existsSync(path.join(root, repo));
  } catch {
    return false;
  }
}

/**
 * El «manual» de la figura: el fichero que se NORMALIZA en la copia que la autoprueba usa para sus
 * señuelos del manual. Es `manual` si se declara y, si no, la PRIMERA ficha (`fichero`) -- que es lo
 * que valía antes de que existieran las fichas extra, y lo que valen las 24 figuras que solo anclan
 * `AGENTS.md`. Una figura anclada a un comentario de `backend-erp/` NO declara `manual`: su patrón no
 * está en el manual, y normalizar `AGENTS.md` con él sería un fallo de la autoprueba, no una medida.
 */
function manualDeFigura(fig) {
  return fig.manual || fig.fichero;
}

/**
 * Normaliza, en cada fichero ancla, SOLO el patrón de las figuras cuyo «manual» es ese fichero -- y
 * comprueba de paso que cada figura ENCUENTRA su cifra en CADA ficha que declara: una declaración cuyo
 * patrón no casa no vigila nada, y un fichero declarado que no lleva la cifra es un ancla que no ancla
 * (R9/R10; si algo de esto falla, la autoprueba es ROJA, no un verde callado).
 *
 * POR QUE SOLO EL «manual» SE NORMALIZA: la copia normalizada del manual es la base de los señuelos
 * del manual (las mutaciones de la autoprueba), y una figura anclada a un comentario de `backend-erp/`
 * no pinta nada en `AGENTS.md`. Las demás fichas se comprueban (el patrón tiene que casar) y luego el
 * árbol de pruebas las escribe tal cual, sin normalizar: así un señuelo del manual no las toca.
 *
 * `ausentes` son los ficheros ancla cuyo REPO no está en este árbol (ver `repoDelAnclaPresente`): se
 * saltan en vez de denunciarse, porque ahí el ancla no falta — falta el repo entero, y eso el gate ya
 * lo sabe leer (`NO MEDIDA`). Todo lo demás sigue siendo ROJO.
 */
function normalizarAnclas(textos, figuras, ausentes = new Set()) {
  const fallos = [];
  const out = new Map();
  for (const [fichero, texto] of textos) out.set(fichero, texto);
  for (const fig of figuras) {
    if (!tieneValor(fig.patron)) continue;
    const manual = manualDeFigura(fig);
    for (const fichero of archivosDe(fig)) {
      if (!out.has(fichero)) {
        // Un ancla que cuelga de un repo AUSENTE de este árbol no es un fallo: no se puede leer
        // porque su repo no se clonó (ver `repoDelAnclaPresente`), y el ratchet ya la declara
        // NO MEDIDA por su `requiere`. Solo es fallo que falte un ancla de un repo PRESENTE.
        if (ausentes.has(fichero)) continue;
        fallos.push(`la figura \`${fig.id}\` ancla \`${fichero}\`, que no se pudo leer`);
        continue;
      }
      if (fichero !== manual) {
        const v = coincidencias(out.get(fichero), fig.patron, fig.flags, fig.grupo || 1);
        if (v.error || v.matches.length === 0) {
          fallos.push(
            `la figura \`${fig.id}\` no encuentra su cifra en \`${fichero}\` con /${fig.patron}/ ` +
              '(una declaración cuyo patrón no casa no vigila nada)',
          );
        }
        continue;
      }
      const r = reescribirCapturas(out.get(fichero), fig.patron, fig.flags, fig.valorEsperado);
      if (r.error) {
        fallos.push(
          `la figura \`${fig.id}\` no encuentra su cifra en \`${fichero}\` con /${fig.patron}/: ${r.error} ` +
            '(una declaración cuyo patrón no casa no vigila nada)',
        );
        continue;
      }
      out.set(fichero, r.text);
    }
  }
  return { textos: out, fallos };
}

/** La salida que el doble de un instrumento tiene que imprimir para una figura y un valor dados. */
function salidaDelDoble(fig, valor, opciones = {}) {
  const v = valor === undefined ? fig.valorEsperado : valor;
  if (opciones.rota) return `${fig.id}: el instrumento existe y no dice ninguna cifra`;
  const e = fig.extractor;
  if (e.tipo === 'lineas') {
    const lineas = [];
    for (let i = 0; i < v; i += 1) lineas.push(String(fig.muestra).replace('{i}', String(i)));
    return lineas.join('\n');
  }
  if (e.tipo === 'familia' && v === 0) {
    return String(fig.muestra)
      .split('\n')
      .filter((l) => !l.includes('{v}'))
      .join('\n');
  }
  const base = String(fig.muestra).replace('{v}', String(v));
  if (opciones.ambigua) return `${base}\n${String(fig.muestra).replace('{v}', String(Number(v) + 1))}`;
  return base;
}

/**
 * Monta un árbol de pruebas en el directorio temporal del sistema: el manual (normalizado o mutado),
 * los directorios que los comandos declaran necesitar y un **doble** por comando. Devuelve la ruta
 * del árbol y la de sus declaraciones. Nada de esto toca el repositorio.
 */
function montarArbol(declaraciones, opciones = {}) {
  const {
    valores = {},
    sinRequiere = [],
    sinManual = false,
    mutarManual = null,
    mutarAncla = null,
    sinDoble = [],
    rotas = [],
    ambiguas = [],
    extraFiguras = [],
    quitarCampos = [],
    sinMotivo = false,
  } = opciones;
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'audit-agents-figures-'));

  let texto = declaraciones.manualNormalizado;
  if (mutarManual) texto = mutarManual(texto);
  if (!sinManual) fs.writeFileSync(path.join(dir, MANUAL_FILE), texto, 'utf8');

  // Las fichas EXTRA de las figuras (fuera del manual): el árbol de pruebas las escribe para que la
  // autoprueba pueda anclar en ellas igual que en el manual. `mutarAncla(texto, fichero)` puede
  // mover la cifra de UNA de ellas -- es el señuelo de una figura que ancla fuera del manual, y va
  // aparte de `mutarManual` para no robarle su tercer argumento (las `opciones` del señuelo). No las
  // escribe `sinManual` (ese señuelo es «el manual no está», no «no está ningún fichero»), así que
  // siguen denunciándose por su vía.
  if (!sinManual) {
    for (const [fichero, textoNormalizado] of declaraciones.anclasNormalizadas || []) {
      if (fichero === MANUAL_FILE) continue;
      const abs = path.join(dir, fichero);
      fs.mkdirSync(path.dirname(abs), { recursive: true });
      fs.writeFileSync(abs, mutarAncla ? mutarAncla(textoNormalizado, fichero) : textoNormalizado, 'utf8');
    }
  }

  for (const r of new Set(declaraciones.figuras.map((f) => f.comando && f.comando.requiere).filter(tieneValor))) {
    if (sinRequiere.includes(r)) continue;
    fs.mkdirSync(path.join(dir, r), { recursive: true });
  }

  const figuras = [];
  const dobleDeFigura = new Map();
  const dobles = new Map();
  let n = 0;
  for (const fig of declaraciones.figuras) {
    if (sinDoble.includes(fig.id)) {
      figuras.push({ ...fig });
      continue;
    }
    const key = claveComando(fig.comando);
    if (!dobles.has(key)) dobles.set(key, `doble-${n++}.mjs`);
    const nombre = dobles.get(key);
    dobleDeFigura.set(fig.id, nombre);
    figuras.push({ ...fig, comando: { ...fig.comando, cmd: `"${process.execPath}" ${nombre}`, cwd: '.' } });
  }
  for (const [key, nombre] of dobles) {
    const salida = figuras
      .filter((f) => dobleDeFigura.get(f.id) === nombre)
      .map((f) => salidaDelDoble(f, valores[f.id], { rota: rotas.includes(f.id), ambigua: ambiguas.includes(f.id) }))
      .join('\n');
    fs.writeFileSync(path.join(dir, nombre), `process.stdout.write(${JSON.stringify(`${salida}\n`)});\n`, 'utf8');
    void key;
  }

  const figurasFinales = figuras.concat(extraFiguras).map((f) => {
    const copia = { ...f };
    for (const q of quitarCampos) if (copia.id === q.id) delete copia[q.campo];
    return copia;
  });
  const doc = {
    $comment: 'arbol de pruebas de la autoprueba de scripts/audit-agents-figures.mjs',
    figuras: figurasFinales,
    noVigiladas: declaraciones.noVigiladas.map((x) => (sinMotivo ? { ...x, motivo: '' } : x)),
  };
  const declarationsPath = path.join(dir, 'declaraciones.json');
  fs.writeFileSync(declarationsPath, JSON.stringify(doc, null, 2), 'utf8');
  return { dir, declarationsPath };
}

function renderAutoprueba(casos, { noEjecutable = false, noEvaluables = [] } = {}) {
  const fallos = casos.filter((c) => !c.ok);
  const rojos = casos.filter((c) => c.rojo);
  const lines = ['Autoprueba de audit-agents-figures — el gate tiene que poder estar en ROJO', ''];
  for (const c of casos) {
    lines.push(
      `  ${c.ok ? 'OK  ' : 'FALLO'} ${c.nombre} :: veredicto=${c.rojo ? 'ROJO' : 'VERDE'}${c.tipos.length ? ` :: ${c.tipos.join(', ')}` : ''}`,
    );
    if (!c.ok && c.detalle) lines.push(`        ${c.detalle}`);
  }
  lines.push('');
  if (noEvaluables.length > 0) {
    // NO EVALUABLE no es verde (ni un fallo del gate): es que ESTE árbol no puede correr el caso
    // porque el repo de su ancla no está clonado. Se cuenta y se imprime para que un árbol
    // incompleto —el del CI de la raíz— no se lea como un árbol con la autoprueba completa.
    lines.push(`Casos NO EVALUABLES en este árbol (${noEvaluables.length}): no es un verde ni un fallo:`);
    for (const c of noEvaluables) lines.push(`  -- ${c.nombre} :: ${c.motivo}`);
    lines.push('');
  }
  lines.push(
    `RESUMEN: casos=${casos.length} verdes=${casos.length - rojos.length} rojos=${rojos.length} fallos=${fallos.length} no_evaluables=${noEvaluables.length}`,
  );
  lines.push(
    fallos.length === 0
      ? `VEREDICTO: VERDE (los ${rojos.length} casos rotos salen ROJOS y los ${casos.length - rojos.length} verdes siguen verdes)`
      : 'VEREDICTO: ROJO (la autoprueba no se sostiene: el ratchet NO se evalúa)',
  );
  if (noEjecutable) {
    lines.push('  (y NO PUDO EJECUTARSE: falta el manual de verdad o las declaraciones no se sostienen: código 2)');
  }
  return { text: lines.join('\n'), red: fallos.length > 0, cases: casos, noEvaluables, noEjecutable };
}

function runSelfTest() {
  const casos = [];
  /** Los que este árbol no puede correr (su ancla cuelga de un repo ausente): ni verdes ni fallos. */
  const noEvaluables = [];
  const manualReal = leerTexto(path.join(REPO, MANUAL_FILE));
  const declaraciones = cargarDeclaraciones(DECLARATIONS_PATH);

  if (manualReal.error) {
    return renderAutoprueba(
      [
        {
          nombre: 'manual-real-ilegible',
          ok: false,
          rojo: true,
          tipos: [],
          detalle: `no se puede leer \`${path.join(REPO, MANUAL_FILE)}\`: ${manualReal.error}`,
        },
      ],
      { noEjecutable: true },
    );
  }
  if (declaraciones.problems.length > 0) {
    return renderAutoprueba(
      [
        {
          nombre: 'declaraciones-reales-invalidas',
          ok: false,
          rojo: true,
          tipos: [],
          detalle: declaraciones.problems.join(' | '),
        },
      ],
      { noEjecutable: true },
    );
  }

  // TODOS los ficheros ancla de las declaraciones reales (el manual y, si los hay, los demás).
  //
  // DOS modos de fallo que NO son lo mismo (medido el 2026-10-12; ver `repoDelAnclaPresente`):
  //   · el REPO del ancla no está en este árbol ⇒ el ancla NO ES EVALUABLE aquí. No es un defecto de
  //     nadie: es el CI de la raíz, que clona solo la raíz. Se cuenta, se imprime y no aborta.
  //   · el repo ESTÁ y el fichero no ⇒ es el mismo caso que «el manual no está»: el gate NO PUDO
  //     EJECUTARSE (código 2). Antes los dos modos caían en el segundo, y por eso el job del CI
  //     moría aquí y `typecheck`, `lint` y `build` de la tienda salían `skipped`.
  const textosAncla = new Map();
  const ilegibles = [];
  const anclasNoEvaluables = new Set();
  for (const fichero of new Set(declaraciones.figuras.flatMap((f) => archivosDe(f)))) {
    if (!repoDelAnclaPresente(fichero, REPO)) {
      anclasNoEvaluables.add(fichero);
      continue;
    }
    const r = leerTexto(path.join(REPO, fichero));
    if (r.error) ilegibles.push(`\`${fichero}\`: ${r.error}`);
    else textosAncla.set(fichero, r.text);
  }
  if (ilegibles.length > 0) {
    return renderAutoprueba(
      [
        {
          nombre: 'anclas-reales-ilegibles',
          ok: false,
          rojo: true,
          tipos: [],
          detalle: `hay ${ilegibles.length} fichero(s) ancla que no se pueden leer: ${ilegibles.join(' | ')}`,
        },
      ],
      { noEjecutable: true },
    );
  }

  const norm = normalizarAnclas(textosAncla, declaraciones.figuras, anclasNoEvaluables);
  if (norm.fallos.length > 0) {
    return renderAutoprueba(
      [
        {
          nombre: 'anclas-de-las-declaraciones-reales',
          ok: false,
          rojo: true,
          tipos: [],
          detalle: `hay ${norm.fallos.length} patrón(es) que NO encuentran su cifra en el fichero de verdad: ${norm.fallos.join(' | ')}`,
        },
      ],
      { noEjecutable: true },
    );
  }
  // Una figura cuyo ancla no se puede montar (su repo no está en este árbol) NO entra en la copia de
  // pruebas: `montarArbol` escribe las anclas desde `anclasNormalizadas`, así que sin el fichero real
  // la figura saldría `ancla-ausente-en-el-manual` y la autoprueba sería ROJA por una razón que no es
  // un defecto de nadie — el mismo «ancla que no se puede montar» que el caso 3c documenta. NO se
  // finge su contenido: se aparta, se cuenta y se imprime. El ratchet NO la pierde: mide las 25
  // figuras de las declaraciones, y esta sale **NO MEDIDA** con su motivo (su `requiere` no está).
  const figurasMontables = declaraciones.figuras.filter(
    (f) => archivosDe(f).every((a) => !anclasNoEvaluables.has(a)),
  );
  for (const f of declaraciones.figuras) {
    if (figurasMontables.includes(f)) continue;
    noEvaluables.push({
      nombre: `figura \`${f.id}\` (fuera de la copia de pruebas de este árbol)`,
      motivo: `su ancla \`${archivosDe(f).find((a) => anclasNoEvaluables.has(a))}\` cuelga de un repo ausente: el ratchet la mide y la declara NO MEDIDA`,
    });
  }

  const base = {
    ...declaraciones,
    figuras: figurasMontables,
    manualNormalizado: norm.textos.get(MANUAL_FILE),
    anclasNormalizadas: [...norm.textos],
  };

  /**
   * Un señuelo que no se puede montar NO puede parecer un caso verde (R10): si el patrón del
   * señuelo no casa, esto lo dice y el caso sale FALLO en vez de no probar nada.
   */
  const mutar = (txt, patron, valor, opciones) => {
    const r = reescribirCapturas(txt, patron, '', valor, opciones);
    if (r.error) throw new Error(`el señuelo no pudo mutar /${patron}/: ${r.error}`);
    return r.text;
  };

  const correr = (opciones) => {
    let arbol;
    try {
      arbol = montarArbol(base, opciones);
    } catch (err) {
      return {
        montajeFallido: err.message,
        findings: [],
        problems: [err.message],
        figures: [],
        noMedidas: [],
        noVigiladas: [],
        comandos: [],
        red: true,
        exit: 2,
      };
    }
    try {
      const result = auditar({ root: arbol.dir, declarationsPath: arbol.declarationsPath });
      return { ...result, red: esRojo(result), exit: codigoDeSalida(result) };
    } finally {
      fs.rmSync(arbol.dir, { recursive: true, force: true });
    }
  };

  /**
   * Un caso que necesita un ancla de un repo AUSENTE de este árbol no se puede correr: no es un
   * verde (no probó nada) ni un fallo (no hay defecto). Se aparta, se cuenta y se imprime — la
   * misma doctrina que las cifras `NO MEDIDA` del ratchet. `anclaRequerida` lo declara el caso.
   */
  const check = (nombre, expectativa, result, detalle = '', anclaRequerida = null) => {
    if (anclaRequerida && anclasNoEvaluables.has(anclaRequerida)) {
      noEvaluables.push({
        nombre,
        motivo: `su ancla \`${anclaRequerida}\` cuelga de un repo que no está en este árbol (${repoDelAncla(anclaRequerida)}/)`,
      });
      return true;
    }
    const tipos = [...new Set(result.findings.map((f) => f.tipo))].sort();
    const ok = !result.montajeFallido && expectativa(tipos, result);
    casos.push({
      nombre,
      ok,
      rojo: result.red,
      tipos,
      detalle: result.montajeFallido ? `el señuelo no se pudo montar: ${result.montajeFallido}` : detalle,
    });
    return ok;
  };

  // 1 — la base: el manual normalizado y los dobles diciendo lo declarado ⇒ VERDE
  check(
    'base-verde (manual normalizado + dobles con el valor declarado)',
    (tipos, r) => tipos.length === 0 && r.problems.length === 0 && r.findings.length === 0 && r.red === false && r.noMedidas.length === 0,
    correr({}),
  );

  // 2 — una cifra del MANUAL cambiada ⇒ ROJO
  check(
    'manual-cambiado (1501 -> 1601 en el total del `!`)',
    (tipos, r) => tipos.includes('manual-divergente') && r.findings.some((f) => f.fig.id === 'no-nulo-total') && r.red === true,
    correr({
      mutarManual: (txt) => mutar(txt, 'congelad[oa] en (\\d+)', 1601, { soloPrimera: true }),
    }),
  );

  // 3 — cambia UN SOLO sitio del manual y el otro sigue bien ⇒ ROJO (todos los sitios cuentan)
  check(
    'manual-cambiado-en-un-solo-sitio (2º sitio del total a 1601)',
    (tipos, r) =>
      tipos.includes('manual-divergente') &&
      r.findings.some((f) => f.fig.id === 'no-nulo-total' && /de 2 sitio/.test(f.detalle)) &&
      r.red === true,
    correr({
      mutarManual: (txt) => mutar(txt, 'congelad[oa] en (\\d+)', 1601, { indice: 1 }),
    }),
  );

  // 3c — EL ANCLA FUERA DEL MANUAL SE MONTA Y SU PATRÓN CASA: el árbol de pruebas tiene que escribir
  //      el comentario de `backend-erp/scripts/audit-explicit-any.mjs`, donde ancla la figura
  //      `comentario-generados-207`. Sin esta ficha, el patrón no casaría en el árbol temporal y la
  //      autoprueba sería ROJA por una razón falsa (un ancla que no se puede montar).
  check(
    'ancla-fuera-del-manual-montada (el comentario del script se escribe y su patrón casa: VERDE)',
    (tipos, r) =>
      tipos.length === 0 &&
      r.problems.length === 0 &&
      r.findings.length === 0 &&
      r.red === false &&
      r.figures.some((f) => f.fig.id === 'comentario-generados-207' && f.ancla && f.ancla.valores[0] === 207),
    correr({}),
    'la figura anclada fuera del manual no encontró su cifra en el árbol de pruebas',
    ANCLA_BACKEND,
  );

  // 3d — EL SEÑUELO DEL ENCARGO, LITERAL: cambiar la CIFRA del ancla a otro número ⇒ ROJO nombrando
  //      ESA figura. El señuelo NO toca `AGENTS.md`, así que la figura del manual (`eslint-disable-generados`,
  //      la MISMA cifra 207) tiene que seguir VERDE: son DOS anclas distintas de la misma cifra, y
  //      pueden divergir por separado -- que es justo lo que la figura del comentario viene a cubrir.
  check(
    'ancla-fuera-del-manual-cambiada (el comentario del script: 207 -> 208)',
    (tipos, r) =>
      tipos.includes('manual-divergente') &&
      r.findings.some((f) => f.fig.id === 'comentario-generados-207') &&
      !r.findings.some((f) => f.fig.id === 'eslint-disable-generados') &&
      r.red === true,
    correr({
      mutarAncla: (txt, fichero) =>
        fichero === ANCLA_BACKEND ? mutar(txt, 'son (\\d+) ficheros de', 208) : txt,
    }),
    '',
    ANCLA_BACKEND,
  );

  // 3b — EL SEÑUELO DE OTRA FAMILIA: una frase «congelado en 1521» que habla del ratchet de
  //      `--update-baseline` (que el manual ya cuenta unas líneas más abajo) ⇒ NO es la cifra del `!`
  //      y el gate tiene que seguir VERDE. Es la mitad que R10 exige: un gate que grita donde no hay
  //      defecto se ignora. Y el mutar() de dentro LANZA si el señuelo no se puede montar, así que este
  //      caso no puede pasar por no haber probado nada.
  check(
    'senuelo-de-otra-familia-no-dispara (congelada en 1521 del ratchet de `--update-baseline`: VERDE)',
    (tipos, r) => tipos.length === 0 && r.problems.length === 0 && r.findings.length === 0 && r.red === false,
    correr({
      // El señuelo se INSERTA (no se muta una captura): la comprobación de que de verdad entró es un
      // `throw`, para que un señuelo que no se puede montar FALLE el caso en vez de no probar nada.
      mutarManual: (txt) => {
        const senuelo = '- **Ejemplo de señuelo (OTRA familia).** La base quedó congelada en 1521 y nadie lo dijo.\n';
        const conSenuelo = txt.replace(
          '- **`--check` y `--update-baseline` son DOS pasos',
          `${senuelo}- **\`--check\` y \`--update-baseline\` son DOS pasos`,
        );
        if (conSenuelo === txt) throw new Error('el señuelo «congelada en 1521» NO se pudo insertar en el manual');
        return conSenuelo;
      },
    }),
    'el señuelo «congelada en 1521» de otra familia no puede contar como cifra del `!`',
  );

  // 4 — una cifra del INSTRUMENTO cambiada (extractor `regex`) ⇒ ROJO
  check(
    'instrumento-cambiado (el dinero dice 3 y el manual 0)',
    (tipos, r) => tipos.includes('instrumento-divergente') && r.findings.some((f) => f.fig.id === 'money-total') && r.red === true,
    correr({ valores: { 'money-total': 3 } }),
  );

  // 5 — una cifra del INSTRUMENTO cambiada con el extractor de FAMILIA ⇒ ROJO
  check(
    'instrumento-cambiado-familia (`as any` pasa de 0 a 3)',
    (tipos, r) => tipos.includes('instrumento-divergente') && r.findings.some((f) => f.fig.id === 'as-any-cero') && r.red === true,
    correr({ valores: { 'as-any-cero': 3 } }),
  );

  // 6 — una cifra que el manual NO menciona ⇒ ROJO (decisión: una declaración sin ancla vigila algo
  //     que no existe, y callarlo sería el «no sé» silencioso que la skill prohíbe)
  check(
    'cifra-que-el-manual-no-menciona (patrón que no casa: ROJO)',
    (tipos, r) =>
      tipos.includes('ancla-ausente-en-el-manual') &&
      r.findings.some((f) => f.fig.id === 'figura-inventada') &&
      r.red === true,
    correr({
      extraFiguras: [
        {
          id: 'figura-inventada',
          fichero: MANUAL_FILE,
          patron: 'esta cifra no esta en el manual jamas (\\d+)',
          comando: { cmd: 'node --version', cwd: '.', requiere: 'repo-que-no-existe' },
          extractor: { tipo: 'regex', patron: 'v(\\d+)' },
          valorEsperado: 7,
          muestra: 'v{v}',
        },
      ],
    }),
  );

  // 7 — un comando que NO existe ⇒ ROJO (no «no sé» silencioso)
  check(
    'comando-que-no-existe (ROJO, no un «no sé»)',
    (tipos, r) => tipos.includes('comando-fallido') && r.findings.some((f) => f.fig.id === 'comando-fantasma') && r.red === true,
    correr({
      extraFiguras: [
        {
          id: 'comando-fantasma',
          fichero: MANUAL_FILE,
          patron: 'congelad[oa] en (\\d+)',
          comando: { cmd: 'esto-no-existe-jamas-12345 --check', cwd: '.', requiere: null },
          extractor: { tipo: 'regex', patron: 'Aserciones[^\\n]*?(\\d+)' },
          valorEsperado: 1502,
          muestra: 'Aserciones de «no nulo» (`!`) en TypeScript: {v}',
        },
      ],
    }),
  );

  // 8 — el comando existe, sale 0 y NO dice la cifra ⇒ ROJO
  check(
    'comando-existe-y-no-dice-la-cifra (ROJO)',
    (tipos, r) => tipos.includes('cifra-ausente-en-la-salida') && r.findings.some((f) => f.fig.id === 'money-total') && r.red === true,
    correr({ rotas: ['money-total'] }),
  );

  // 9 — la salida trae DOS valores distintos para el mismo extractor ⇒ ROJO (no es una medida)
  check(
    'salida-ambigua (dos `TOTAL:` distintos: ROJO)',
    (tipos, r) => tipos.includes('salida-ambigua') && r.red === true,
    correr({ ambiguas: ['money-total'] }),
  );

  // 10 — un árbol sin los repos anidados (lo que ve el CI de la raíz): esas cifras salen NO MEDIDAS,
  //      la cuenta se lee, y NO hay hallazgos. Es la regla 4 del gate hermano.
  {
    const result = correr({ sinRequiere: ['backend-erp', 'backend-erp/src/generated', 'erp-frontend'] });
    check(
      'arbol-sin-repos-anidados (NO MEDIDAS, VERDE informativo)',
      (tipos, r) => tipos.length === 0 && r.red === false && r.noMedidas.length > 0 && r.problems.length === 0,
      result,
    );
    const { text } = printReport(result);
    const legible =
      text.includes(`NO MEDIDAS en este arbol (${result.noMedidas.length} de ${result.figures.length})`) &&
      /no es un defecto de nadie, y NO es un verde/.test(text);
    casos.push({
      nombre: 'arbol-sin-repos-legible (la cuenta y el motivo, en el informe)',
      ok: legible,
      rojo: result.red,
      tipos: [],
      detalle: legible ? '' : 'el informe no declara cuántas cifras quedaron sin medir',
    });
  }

  // 11 — el manual no está ⇒ el gate NO PUDO EJECUTARSE (código 2), que no es un verde
  check(
    'manual-ausente (el gate no puede ejecutarse: exit 2)',
    (tipos, r) => r.problems.length > 0 && r.exit === 2 && r.red === true,
    correr({ sinManual: true }),
  );

  // 12 — declaraciones inválidas (falta `valorEsperado` y un patrón que no compila) ⇒ ROJO del fichero
  check(
    'declaraciones-invalidas (falta `valorEsperado`, patrón roto)',
    (tipos, r) =>
      r.problems.length >= 2 &&
      r.problems.some((p) => /valorEsperado/.test(p)) &&
      r.problems.some((p) => /no compila/.test(p)) &&
      r.exit === 2,
    correr({
      quitarCampos: [{ id: 'money-total', campo: 'valorEsperado' }],
      extraFiguras: [
        {
          id: 'patron-roto',
          fichero: MANUAL_FILE,
          patron: 'congelad[oa] en (\\d+',
          comando: { cmd: 'node --version', cwd: '.', requiere: 'repo-que-no-existe' },
          extractor: { tipo: 'regex', patron: '(\\d+)' },
          valorEsperado: 1,
          muestra: 'x {v}',
        },
      ],
    }),
  );

  // 13 — una cifra declarada como NO VIGILADA sin motivo ⇒ ROJO (una cifra tapada no se declara sola)
  check(
    'no-vigilada-sin-motivo (ROJO del fichero)',
    (tipos, r) => r.problems.some((p) => /noVigiladas/.test(p)) && r.exit === 2,
    correr({ sinMotivo: true }),
  );

  return renderAutoprueba(casos, { noEvaluables });
}

// ---------------------------------------------------------------------------------------------
// CLI — sin `--root` ni `--declaraciones`: la raíz es la del script (R14)
// ---------------------------------------------------------------------------------------------

const AYUDA = [
  'uso: node scripts/audit-agents-figures.mjs [--check | --self-test | --help]',
  '',
  '  --check      (por defecto) autoprueba y, si sale verde, el ratchet de las cifras del manual',
  '  --self-test  solo la autoprueba (los señuelos, en árboles temporales)',
  '  --help       esto',
  '',
  'No hay `--root` ni `--declaraciones`: la raíz y las declaraciones se resuelven por la ubicación',
  'del propio script, para que el gate no se pueda apuntar a otro sitio.',
].join('\n');

function main() {
  const argv = process.argv.slice(2);
  const desconocidos = argv.filter((a) => !['--check', '--self-test', '--help', '-h'].includes(a));
  if (desconocidos.length > 0) {
    process.stderr.write(
      `audit-agents-figures: argumento no reconocido: ${desconocidos.join(', ')}\n` +
        'No hay `--root` ni `--declaraciones`: un gate que se puede apuntar a otro sitio es un gate\n' +
        'que se puede burlar. La raíz la resuelve el propio script.\n',
    );
    return 2;
  }
  if (argv.includes('--help') || argv.includes('-h')) {
    process.stdout.write(`${AYUDA}\n`);
    return 0;
  }
  if (argv.includes('--self-test')) {
    const st = runSelfTest();
    process.stdout.write(`${st.text}\n`);
    return st.red ? (st.noEjecutable ? 2 : 1) : 0;
  }

  // `--check` (y también sin argumentos): la autoprueba PRIMERO.
  const st = runSelfTest();
  process.stdout.write(`${st.text}\n\n`);
  if (st.red) {
    process.stdout.write(
      'El gate NO sigue al ratchet: la autoprueba está roja, así que no consta que este gate sepa\n' +
        'ponerse rojo. Arregle la autoprueba antes de creerse cualquier otro veredicto.\n',
    );
    return st.noEjecutable ? 2 : 1;
  }

  const result = auditar({ root: REPO, declarationsPath: DECLARATIONS_PATH });
  const { text } = printReport(result);
  process.stdout.write(`${text}\n`);
  return codigoDeSalida(result);
}

process.exit(main());
