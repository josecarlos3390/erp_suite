#!/usr/bin/env node
/**
 * audit-workflow-inputs — gate de las TRES reglas auditables nacidas el 2026-10-08 (`AGENTS.md`,
 * commit `874d508`):
 *
 *   1. «Una puerta tiene que comprobar el VALOR, no solo que el texto sea válido.» (`AGENTS.md`,
 *      *Disciplina de medición y declaración*). El caso medido: `029f8447` dejó `node-version:` sin
 *      valor en los dos `setup-node` de `update-baselines.yml`; el YAML **parsea** (la clave existe y
 *      vale `null`), así que un gate que solo validara el documento dijo OK y el workflow **no fijaba
 *      Node alguno**. Aquí se lee el **valor**: `node-version` vacío/ausente **y** sin
 *      `node-version-file` ⇒ rojo. Además, si `node-version-file` es una ruta relativa, el fichero
 *      tiene que **existir** en el repo del workflow (una ruta mal escrita tampoco fija Node).
 *
 *   2. «La zona horaria del PROCESO se declara a propósito.» (`AGENTS.md`, *Reglas de entorno medidas
 *      (E2E)*, punto 7). El invariante es exacto: `TZ` **en los tres jobs donde la zona entra en el
 *      render** —`erp-frontend/.github/workflows/ci.yml`: `visual-regression` y `ssr-smoke`;
 *      `update-baselines.yml`: `baseline`— y **en ningún otro**. El job `e2e` se queda en **UTC a
 *      propósito**: es el único entorno donde el defecto de la doble conversión de zona se manifiesta
 *      (`4a7e5b5e`). Por eso el gate compara el **conjunto** de `(fichero, job)` con `TZ` contra el
 *      conjunto declarado: sobra tanto como falta es rojo, y el valor tiene que ser el declarado.
 *
 *   3. «Un workflow que nunca se ejecuta es un workflow que nadie sabe si funciona.» (`AGENTS.md`,
 *      *Disciplina de medición y declaración*). Todo workflow lleva `workflow_dispatch` **y** al menos
 *      un disparador automático, o lleva una **marca declarada** de «solo manual»
 *      (`# manual-only-ok: <razón>`) si de verdad es así. Una marca sin razón —o una marca en un
 *      workflow que sí se dispara solo— también es rojo: sería un texto válido con valor falso.
 *
 *   4. **Un árbol incompleto no se audita, y el gate no puede confundirlo con un árbol roto.**
 *      Medido en el run `958cd664` del CI de la **raíz** («Storefront CI»): ese workflow hace
 *      `checkout` del repo raíz **y nada más**, así que `erp-frontend/` y `backend-erp/` **no
 *      existen** en el árbol; el gate declaraba 5 workflows, encontraba 1 y salía **ROJO** con
 *      cuatro `workflow-declarado-ausente` que no eran defectos de nadie. Un gate que miente sobre
 *      el árbol se desactiva en una semana. Por eso:
 *
 *        - un workflow declarado cuyo **repositorio no está en este árbol** ⇒ línea **informativa**
 *          («se audita en el CI de su propio repo»), **no** un hallazgo, y **no** una exención
 *          obsoleta si tenía exención;
 *        - un workflow declarado que **desaparece de un repo que SÍ está presente** ⇒ sigue siendo
 *          **ROJO** (`workflow-declarado-ausente`): es el caso que la regla protege;
 *        - la salida dice **cuántos se auditaron de cuántos se esperaban** (`auditados=N/M`), para
 *          que un árbol incompleto se lea como lo que es y no como un árbol limpio.
 *
 *      Y como este gate **también se ejecuta dentro de cada repo anidado** (ver la regla 4.b), el
 *      modo `--repo <nombre>` audita un solo repo con su forma local (ver *Uso*).
 *
 *   4.b `--repo <nombre>` y las **copias**: el script vive en la raíz del monorepo y los repos
 *      anidados **no lo contienen**, así que en el CI de un repo anidado no existe salvo que se
 *      haga un `checkout` cruzado. Medido el 2026-10-08: el `checkout` del monorepo **no** sirve
 *      —el repo raíz no trackea `erp-frontend/` ni `backend-erp/`, así que traería `scripts/` pero
 *      **no** los workflows que hay que auditar— y duplicar el árbol entero es un «checkout raro».
 *      La decisión es **duplicar el script** (y su `declarations.json`) en cada repo anidado y
 *      auditar ahí con `--root . --repo <nombre>`; la copia tiene que ser **byte a byte** la
 *      canónica o el gate de la raíz lo dice (`gate-copia-desincronizada`), porque tres copias que
 *      divergen son tres gates distintos con el mismo nombre.
 *
 * Uso:
 *   node scripts/audit-workflow-inputs.mjs                        # audita el árbol del repo (verde/rojo)
 *   node scripts/audit-workflow-inputs.mjs --root <dir>           # audita OTRO árbol con la misma forma
 *   node scripts/audit-workflow-inputs.mjs --repo <nombre>        # audita un SOLO repo, forma local
 *   node scripts/audit-workflow-inputs.mjs --strict               # las exenciones declaradas también fallan
 *   node scripts/audit-workflow-inputs.mjs --self-test            # casos sintéticos (el informe dice cuántos)
 *
 *   `--root .` **no basta** dentro de un repo anidado: las rutas declaradas son del monorepo
 *   (`erp-frontend/.github/workflows/ci.yml`) y con la raíz en `erp-frontend/` no casan, así que el
 *   gate saldría ROJO por la FORMA del árbol y no por el contenido (medido: 8 hallazgos). Lo que
 *   rebasa `--repo erp-frontend` es precisamente esa traducción de rutas.
 *
 * Códigos de salida: 0 = verde · 1 = hallazgos · 2 = el gate no pudo ejecutarse (y por tanto NO pasa).
 *
 * Lector YAML: se resuelve `js-yaml` (y, si no está, `yaml`) del primer `node_modules` que lo tenga,
 * en este orden: raíz, `storefront/`, `erp-frontend/`, `backend-erp/`. El que se use **se imprime**
 * (la regla pide declararlo). En el CI de la raíz —que solo instala las dependencias de la tienda—
 * resuelve el de `storefront/node_modules`, que llega como dependencia de `eslint`/`postcss-load-config`;
 * si algún día desapareciera, el gate sale con **2** (ruidoso), nunca con un falso verde.
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SCRIPT_REPO_ROOT = path.resolve(HERE, '..');
const DECLARATIONS_NAME = 'audit-workflow-inputs.declarations.json';

/** Los cinco workflows del monorepo. Los tres repos: la raíz (la tienda), el ERP y el backend. */
const DECLARED_WORKFLOWS = [
  '.github/workflows/ci.yml',
  'erp-frontend/.github/workflows/ci.yml',
  'erp-frontend/.github/workflows/update-baselines.yml',
  'backend-erp/.github/workflows/ci.yml',
  'backend-erp/.github/workflows/load-tests-large.yml',
];

/** Dónde se buscan workflows (se auditan TODOS los que aparezcan, no solo los cinco declarados). */
const WORKFLOW_DIRS = [
  '.github/workflows',
  'storefront/.github/workflows',
  'erp-frontend/.github/workflows',
  'backend-erp/.github/workflows',
];

/** Invariante de la regla 2: `fichero → job → valor`. Todo lo que no esté aquí y tenga `TZ` es rojo. */
const TZ_INVARIANT = {
  'erp-frontend/.github/workflows/ci.yml': {
    'visual-regression': 'America/La_Paz',
    'ssr-smoke': 'America/La_Paz',
  },
  'erp-frontend/.github/workflows/update-baselines.yml': {
    baseline: 'America/La_Paz',
  },
};

/**
 * La carpeta (el `repo`) a la que pertenece una ruta declarada:
 * `<repo>/.github/workflows/<f>.yml` ⇒ `<repo>` · `.github/workflows/<f>.yml` ⇒ `.` (la raíz, que
 * es la que trackea `storefront/`). Es la traducción que permite distinguir lo que **falta**: si
 * falta el *workflow* de un repo que está (rojo) o si falta el *repo entero* (informativo, regla 4).
 * Declaración de función a propósito: `MONOREPO_REPOS` la usa antes de su línea y así se lee.
 */
function ownerRepo(rel) {
  const parts = String(rel).split('/');
  const at = parts.indexOf('.github');
  return at <= 0 ? '.' : parts.slice(0, at).join('/');
}

/** Los repos del monorepo, derivados de las rutas declaradas: no pueden desalinearse de ellas. */
const MONOREPO_REPOS = [...new Set(DECLARED_WORKFLOWS.map((rel) => ownerRepo(rel)))];

/** Las dos piezas que se duplican en cada repo anidado y que tienen que seguir siendo una sola. */
const GATE_FILES = ['scripts/audit-workflow-inputs.mjs', `scripts/${DECLARATIONS_NAME}`];

/** Disparadores que NO son un acto humano: el workflow se ejecuta solo. */
const AUTOMATIC_TRIGGERS = [
  'push',
  'pull_request',
  'pull_request_target',
  'schedule',
  'workflow_run',
  'workflow_call',
  'repository_dispatch',
  'merge_group',
  'release',
  'issues',
  'issue_comment',
];

/** Marca declarada de «solo manual»: `# manual-only-ok: <razón>` (misma familia que `!important-ok:`). */
const MANUAL_ONLY_MARK = /manual-only-ok:[ \t]*(\S[^\r\n]*)/;

const RULES = {
  'node-version-empty':
    'regla 1 (la puerta comprueba el VALOR): `setup-node` con `node-version` vacío/ausente y sin `node-version-file`',
  'node-version-file-missing':
    'regla 1 (ampliada): `node-version-file` apunta a una ruta relativa que no existe en el repo del workflow',
  'tz-missing': 'regla 2: falta `TZ` en un job donde la zona entra en el render',
  'tz-unexpected': 'regla 2: `TZ` declarado en un job donde la zona NO entra en el render',
  'tz-wrong-value': 'regla 2: el valor de `TZ` no es el declarado en `AGENTS.md`',
  'tz-step-level': 'regla 2: `TZ` a nivel de step (el invariante se declara a nivel de job)',
  'missing-workflow_dispatch': 'regla 3: el workflow no se puede lanzar a mano (sin `workflow_dispatch`)',
  'manual-only-sin-marca': 'regla 3: sin disparador automático y sin la marca `manual-only-ok: <razón>`',
  'manual-only-contradice-disparador':
    'regla 3: marca `manual-only-ok` en un workflow que SÍ tiene disparador automático',
  'workflow-declarado-ausente':
    'regla 4: un workflow declarado falta en un repo que SÍ está en el árbol (repos ausentes son informativos)',
  'workflow-ilegible': 'regla 4: el workflow no parsea o no es un mapa YAML (sin documento no hay valor que comprobar)',
  'gate-copia-desincronizada':
    'regla 4.b: la copia del gate en un repo anidado no es byte a byte la canónica (dos gates con el mismo nombre)',
  'gate-invocado-sin-script':
    'regla 4.b: el workflow invoca el gate y el script no está en su repo (un paso que no arranca)',
  'gate-copia-no-ejecutada':
    'regla 4.b: el repo tiene la copia del gate y su CI no lo ejecuta (un gate que no vigila nada)',
};

const DECLARATION_FIELDS = ['rule', 'workflow', 'reason', 'fix', 'owner', 'declaredIn'];

// ---------------------------------------------------------------------------------------------
// Lector YAML (declarado: js-yaml si está; si no, yaml)
// ---------------------------------------------------------------------------------------------

function packageVersionOf(entryFile, libName) {
  let dir = path.dirname(entryFile);
  for (let i = 0; i < 4; i += 1) {
    const pkgPath = path.join(dir, 'package.json');
    if (fs.existsSync(pkgPath)) {
      try {
        const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
        if (pkg.name === libName) return pkg.version || '?';
        return `${pkg.name}@${pkg.version || '?'} (inesperado)`;
      } catch {
        return '?';
      }
    }
    const up = path.dirname(dir);
    if (up === dir) break;
    dir = up;
  }
  return '?';
}

function loadYamlReader(repoRoot) {
  const requireFrom = createRequire(import.meta.url);
  const nodes = [
    path.join(repoRoot, 'node_modules'),
    path.join(repoRoot, 'storefront', 'node_modules'),
    path.join(repoRoot, 'erp-frontend', 'node_modules'),
    path.join(repoRoot, 'backend-erp', 'node_modules'),
  ];
  for (const lib of ['js-yaml', 'yaml']) {
    for (const nodeModules of nodes) {
      if (!fs.existsSync(nodeModules)) continue;
      let entry;
      try {
        entry = requireFrom.resolve(lib, { paths: [nodeModules] });
      } catch {
        continue;
      }
      const mod = requireFrom(entry);
      const parse = lib === 'js-yaml' ? mod.load : mod.parse;
      if (typeof parse !== 'function') continue;
      const rel = path.relative(repoRoot, nodeModules).split(path.sep).join('/') || 'node_modules';
      return { lib, version: packageVersionOf(entry, lib), where: rel, parse };
    }
  }
  return null;
}

// ---------------------------------------------------------------------------------------------
// Descubrimiento y lectura
// ---------------------------------------------------------------------------------------------

function discoverWorkflows(root, dirs = WORKFLOW_DIRS) {
  const found = [];
  for (const rel of dirs) {
    const abs = path.join(root, rel);
    if (!fs.existsSync(abs) || !fs.statSync(abs).isDirectory()) continue;
    for (const name of fs.readdirSync(abs).sort()) {
      if (!/\.ya?ml$/i.test(name)) continue;
      found.push({
        rel: `${rel}/${name}`,
        abs: path.join(abs, name),
        repoRoot: path.join(root, rel.split('/')[0] === '.github' ? '' : rel.split('/')[0]),
      });
    }
  }
  return found;
}

/**
 * Traduce el mapa `ruta del monorepo → …` al repo `nombre`: se queda con las entradas de ese repo
 * y les quita el prefijo, para que `--root .` dentro de `erp-frontend/` case con
 * `erp-frontend/.github/workflows/ci.yml`. Sin esta traducción, `--root .` en un repo anidado sale
 * ROJO por la FORMA del árbol (medido: 8 hallazgos) y el gate no vigila nada de verdad.
 */
function scopeToRepo(map, repo) {
  const out = {};
  const prefix = `${repo}/`;
  for (const [key, value] of Object.entries(map)) {
    if (!key.startsWith(prefix)) continue;
    out[key.slice(prefix.length)] = value;
  }
  return out;
}

/** Los tres conjuntos efectivos según el ámbito: todo el monorepo (ámbito `null`) o un solo repo. */
function resolveScope(scope) {
  if (!scope) {
    return {
      declaredWorkflows: DECLARED_WORKFLOWS,
      workflowDirs: WORKFLOW_DIRS,
      tzInvariant: TZ_INVARIANT,
      label: 'monorepo',
    };
  }
  return {
    declaredWorkflows: DECLARED_WORKFLOWS.filter((rel) => ownerRepo(rel) === scope).map((rel) =>
      rel.slice(scope.length + 1),
    ),
    workflowDirs: ['.github/workflows'],
    tzInvariant: scopeToRepo(TZ_INVARIANT, scope),
    label: `${scope} (modo --repo: forma local de ese repo)`,
  };
}

function triggerKeys(doc) {
  // `on` es una clave normal en YAML 1.2, pero si algún lector usara el esquema 1.1 quedaría en
  // `true`. Se aceptan las dos formas (y se declara cuál se usó) en vez de dar un falso verde.
  if (doc && typeof doc === 'object') {
    if (Object.prototype.hasOwnProperty.call(doc, 'on')) return { node: doc.on, key: 'on' };
    if (Object.prototype.hasOwnProperty.call(doc, true)) return { node: doc[true], key: 'true (esquema YAML 1.1)' };
  }
  return { node: undefined, key: 'ausente' };
}

function hasValue(value) {
  if (value === null || value === undefined) return false;
  if (typeof value === 'string') return value.trim() !== '';
  return true;
}

// ---------------------------------------------------------------------------------------------
// Auditoría
// ---------------------------------------------------------------------------------------------

/**
 * ¿Está el repo `repoRel` en ESTE árbol? `.` es siempre el propio árbol auditado (la raíz), así que
 * responde que sí: es la traducción de la regla 4 —lo que falta en la raíz es un workflow que
 * desapareció (rojo), lo que falta en un repo anidado ausente es un repo que aquí no se clonó
 * (informativo)—.
 */
function repoPresentInTree(root, repoRel) {
  if (repoRel === '.') return true;
  const abs = path.join(root, repoRel);
  try {
    return fs.existsSync(abs) && fs.statSync(abs).isDirectory();
  } catch {
    return false;
  }
}

/**
 * Huella del CONTENIDO con los finales de línea normalizados (CRLF → LF). El final de línea no
 * cambia lo que el gate ejecuta, y comparar bytes crudos haría un gate que se enciende según cómo
 * cada repo tenga `core.autocrlf`; eso es un falso positivo de máquina, no una copia divergente.
 */
function fingerprintOf(filePath) {
  const text = fs.readFileSync(filePath, 'utf8').split('\r\n').join('\n');
  return crypto.createHash('sha256').update(text, 'utf8').digest('hex').slice(0, 16);
}

/**
 * En modo `--repo <nombre>` las exenciones se declaran con la ruta LOCAL del repo (que es lo que el
 * gate ve en ese árbol), no con la del monorepo: sin esto, una exención escrita en la copia del
 * repo nunca casaría con su hallazgo y saldría como obsoleta para siempre.
 */
function rebaseDeclarations(declarations, scope) {
  if (!scope) return declarations;
  const entries = declarations.entries.map((entry) => {
    const workflow = String(entry.workflow || '');
    const prefix = `${scope}/`;
    return { ...entry, workflow: workflow.startsWith(prefix) ? workflow.slice(prefix.length) : workflow };
  });
  const byKey = new Map();
  for (const entry of entries) byKey.set(`${entry.rule}|${entry.workflow}`, entry);
  return { ...declarations, entries, byKey };
}

function auditTree({ root, yamlReader, declarations, strict, scope = null }) {
  const effective = resolveScope(scope);
  const declaredInThisShape = rebaseDeclarations(declarations, scope);
  const files = discoverWorkflows(root, effective.workflowDirs);
  const findings = [];
  const stats = { setupNode: 0, jobs: 0, tzJobs: 0, gateInvocations: 0 };

  const push = (rule, file, where, message) => {
    const declaration = declaredInThisShape.byKey.get(`${rule}|${file}`) || null;
    findings.push({ rule, file, where, message, declaration });
  };

  /** Cuántas INVOCACIONES del gate hace cada repo del árbol (regla 4.b: el que tiene copia, la usa). */
  const invocationsByRepo = new Map();

  for (const file of files) {
    const text = fs.readFileSync(file.abs, 'utf8');
    let doc;
    try {
      doc = yamlReader.parse(text);
    } catch (err) {
      push('workflow-ilegible', file.rel, file.rel, `no parsea: ${err.message}`);
      continue;
    }
    if (!doc || typeof doc !== 'object') {
      push('workflow-ilegible', file.rel, file.rel, 'el documento no es un mapa YAML');
      continue;
    }

    // ---- regla 3: disparadores -----------------------------------------------------------------
    const triggers = triggerKeys(doc);
    const onNode = triggers.node;
    const keys = new Set(
      typeof onNode === 'string'
        ? [onNode]
        : Array.isArray(onNode)
          ? onNode
          : onNode && typeof onNode === 'object'
            ? Object.keys(onNode)
            : [],
    );
    const dispatchable = keys.has('workflow_dispatch');
    const automatic = AUTOMATIC_TRIGGERS.filter((k) => keys.has(k));
    const mark = MANUAL_ONLY_MARK.exec(text);
    const markReason = mark ? mark[1].trim() : null;
    if (mark && markReason === '') {
      push('manual-only-sin-marca', file.rel, 'marca', 'la marca `manual-only-ok:` no lleva razón');
    }
    if (automatic.length > 0 && mark) {
      push(
        'manual-only-contradice-disparador',
        file.rel,
        'marca',
        `marca «solo manual» pero el workflow tiene disparador automático: ${automatic.join(', ')}`,
      );
    } else if (automatic.length === 0 && !mark) {
      push(
        'manual-only-sin-marca',
        file.rel,
        'on:',
        'sin disparador automático y sin la marca declarada `manual-only-ok: <razón>`',
      );
    }
    if (automatic.length > 0 && !dispatchable) {
      push('missing-workflow_dispatch', file.rel, 'on:', 'no tiene `workflow_dispatch`: no se puede lanzar a mano');
    }

    // ---- jobs: TZ (regla 2) y setup-node (regla 1) ---------------------------------------------
    const jobs = doc.jobs && typeof doc.jobs === 'object' ? doc.jobs : {};
    const expectedTz = effective.tzInvariant[file.rel] || {};
    for (const [jobName, job] of Object.entries(jobs)) {
      stats.jobs += 1;
      const env = job && typeof job.env === 'object' && job.env ? job.env : {};
      const hasTz = Object.prototype.hasOwnProperty.call(env, 'TZ');
      const expected = expectedTz[jobName];
      if (hasTz) stats.tzJobs += 1;
      if (expected !== undefined) {
        if (!hasTz) {
          push('tz-missing', file.rel, `jobs.${jobName}.env.TZ`, `falta \`TZ: ${expected}\``);
        } else if (String(env.TZ) !== expected) {
          push(
            'tz-wrong-value',
            file.rel,
            `jobs.${jobName}.env.TZ`,
            `vale \`${JSON.stringify(env.TZ)}\` y el invariante dice \`${expected}\``,
          );
        }
      } else if (hasTz) {
        push(
          'tz-unexpected',
          file.rel,
          `jobs.${jobName}.env.TZ`,
          `\`TZ: ${env.TZ}\` donde la zona NO entra en el render`,
        );
      }

      const steps = Array.isArray(job && job.steps) ? job.steps : [];
      steps.forEach((step, index) => {
        const where = `jobs.${jobName}.steps[${index}]`;
        const stepEnv = step && typeof step.env === 'object' && step.env ? step.env : {};
        if (Object.prototype.hasOwnProperty.call(stepEnv, 'TZ')) {
          push('tz-step-level', file.rel, `${where}.env.TZ`, `\`TZ: ${stepEnv.TZ}\` a nivel de step`);
        }
        const uses = typeof (step && step.uses) === 'string' ? step.uses : '';
        if (!/^actions\/setup-node(@|$)/.test(uses)) return;
        stats.setupNode += 1;
        const withNode = step.with && typeof step.with === 'object' ? step.with : {};
        const hasVersion = 'node-version' in withNode && hasValue(withNode['node-version']);
        const hasVersionFile = 'node-version-file' in withNode && hasValue(withNode['node-version-file']);
        if (!hasVersion && !hasVersionFile) {
          const raw = 'node-version' in withNode ? JSON.stringify(withNode['node-version']) : 'ausente';
          push(
            'node-version-empty',
            file.rel,
            `${where}.with`,
            `\`${uses}\` no fija Node: node-version=${raw} y sin \`node-version-file\``,
          );
        }
        if (hasVersionFile) {
          const fileRef = String(withNode['node-version-file']).trim();
          const isExpr = fileRef.includes('${{');
          const isAbsolute = path.isAbsolute(fileRef);
          if (!isExpr && !isAbsolute) {
            const target = path.resolve(file.repoRoot, fileRef);
            if (!fs.existsSync(target)) {
              push(
                'node-version-file-missing',
                file.rel,
                `${where}.with.node-version-file`,
                `\`${fileRef}\` no existe en \`${path.relative(root, file.repoRoot) || '.'}\``,
              );
            }
          }
        }
      });
    }

    // ---- regla 4.b: el gate que este workflow invoca tiene que existir en SU repo ----------------
    // Se resuelve contra la carpeta donde el `run` corre de verdad: el `working-directory` del step
    // o, si no lo hay, el del job. Es el mismo defecto que costo T244 (un paso que corre en otro
    // sitio del que se cree), aplicado a la ruta del script.
    for (const [jobName, job] of Object.entries(jobs)) {
      const jobWd =
        job && job.defaults && job.defaults.run && typeof job.defaults.run === 'object'
          ? job.defaults.run['working-directory']
          : undefined;
      const steps = Array.isArray(job && job.steps) ? job.steps : [];
      steps.forEach((step, index) => {
        const run = typeof (step && step.run) === 'string' ? step.run : '';
        if (!run.includes('audit-workflow-inputs.mjs')) return;
        const wd = step && step['working-directory'] !== undefined ? step['working-directory'] : jobWd;
        const base = wd === undefined ? file.repoRoot : path.resolve(file.repoRoot, String(wd));
        for (const token of run.match(/[^\s'"]*audit-workflow-inputs\.mjs/g) || []) {
          if (token.includes('${{')) continue;
          stats.gateInvocations += 1;
          const repoKey = path.resolve(file.repoRoot);
          invocationsByRepo.set(repoKey, (invocationsByRepo.get(repoKey) || 0) + 1);
          if (!fs.existsSync(path.resolve(base, token))) {
            push(
              'gate-invocado-sin-script',
              file.rel,
              `jobs.${jobName}.steps[${index}].run`,
              `invoca \`${token}\` y no existe en \`${path.relative(root, file.repoRoot) || '.'}\`: un paso que no arranca es un gate que no existe`,
            );
          }
        }
      });
    }
  }

  // ---- los workflows declarados: ausente el REPO es informativo; ausente el WORKFLOW es rojo -----
  const seen = new Set(files.map((f) => f.rel));
  const absentInTree = [];
  const vanished = [];
  for (const rel of effective.declaredWorkflows) {
    if (seen.has(rel)) continue;
    const repo = ownerRepo(rel);
    if (!repoPresentInTree(root, repo)) {
      absentInTree.push({ workflow: rel, repo });
      continue;
    }
    vanished.push(rel);
    findings.push({
      rule: 'workflow-declarado-ausente',
      file: rel,
      where: rel,
      message: `está en la lista declarada y el repo \`${repo === '.' ? '(raíz)' : repo}\` SÍ está en el árbol, pero el workflow no aparece (¿movido o borrado?)`,
    });
  }

  // ---- regla 4.b: las copias del gate en otros repos son la MISMA pieza, y se ejecutan -----------
  const canonical = new Map();
  for (const rel of GATE_FILES) {
    const abs = path.join(SCRIPT_REPO_ROOT, rel);
    canonical.set(rel, { exists: fs.existsSync(abs), fingerprint: fs.existsSync(abs) ? fingerprintOf(abs) : null });
  }
  const candidateRepos = new Set(files.map((f) => path.resolve(f.repoRoot)));
  for (const rel of effective.workflowDirs) candidateRepos.add(path.resolve(root, ownerRepo(`${rel}/_`)));
  for (const repoRoot of candidateRepos) {
    if (path.resolve(repoRoot) === path.resolve(SCRIPT_REPO_ROOT)) continue;
    const relRepo = path.relative(root, repoRoot).split(path.sep).join('/') || '.';
    for (const rel of GATE_FILES) {
      const here = path.join(repoRoot, rel);
      if (!fs.existsSync(here)) continue;
      const canon = canonical.get(rel);
      if (canon.exists && fingerprintOf(here) !== canon.fingerprint) {
        push(
          'gate-copia-desincronizada',
          `${relRepo}/${rel}`,
          `${relRepo}/${rel}`,
          `no es la misma pieza que \`${rel}\` de la raíz del monorepo: son dos gates distintos con el mismo nombre (copie la canónica)`,
        );
      }
    }
    if (fs.existsSync(path.join(repoRoot, GATE_FILES[0])) && !invocationsByRepo.get(path.resolve(repoRoot))) {
      push(
        'gate-copia-no-ejecutada',
        `${relRepo}/${GATE_FILES[0]}`,
        `${relRepo}/.github/workflows`,
        'el repo tiene la copia del gate y ninguno de sus workflows lo ejecuta: un gate que no se ejecuta no vigila nada',
      );
    }
  }

  // ---- declaraciones: ninguna puede sobrar ni quedarse sin razón --------------------------------
  const declared = findings.filter((f) => f.declaration);
  const undeclared = findings.filter((f) => !f.declaration);
  const usedKeys = new Set(declared.map((d) => `${d.rule}|${d.file}`));
  const notInTree = new Set(absentInTree.map((a) => a.workflow));
  // Una exención cuyo workflow no se auditó porque su REPO no está en el árbol no es obsoleta: es
  // no evaluable. Marcarla obsoleta sería el segundo modo en que este gate miente sobre un árbol
  // incompleto (el primero son los `workflow-declarado-ausente` de la regla 4).
  const stale = declaredInThisShape.entries.filter(
    (d) => !usedKeys.has(`${d.rule}|${d.workflow}`) && !notInTree.has(d.workflow),
  );
  const unverifiable = declaredInThisShape.entries.filter(
    (d) => !usedKeys.has(`${d.rule}|${d.workflow}`) && notInTree.has(d.workflow),
  );

  return {
    files,
    findings,
    declared,
    undeclared,
    stale,
    unverifiable,
    declarationProblems: declarations.problems,
    stats,
    scope,
    effective,
    expected: effective.declaredWorkflows,
    audited: effective.declaredWorkflows.filter((rel) => seen.has(rel)),
    absentInTree,
    vanished,
  };
}

// ---------------------------------------------------------------------------------------------
// Declaraciones (exenciones) — con razón, arreglo y responsable obligatorios
// ---------------------------------------------------------------------------------------------

function loadDeclarations(filePath, knownRules) {
  const problems = [];
  const entries = [];
  if (!fs.existsSync(filePath)) return { entries, problems, byKey: new Map(), path: filePath };
  let doc;
  try {
    doc = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (err) {
    problems.push(`no parsea como JSON: ${err.message}`);
    return { entries, problems, byKey: new Map(), path: filePath };
  }
  // `declared: []` es una lista vacía **explícita** y es el objetivo declarado del fichero («cero
  // entradas», dice su propio `$comment`). Lo que falta es la CLAVE, no la lista. Antes se exigía
  // `length > 0`, así que **borrar la última exención dejaba el gate ROJO** por «no trae `declared`»
  // —el mensaje ya decía que una lista vacía vale; el código no— y parecía pedir que se volviera a
  // declarar la exención que se acababa de cerrar. Medido el 2026-10-08 al retirar las dos últimas.
  if (!Array.isArray(doc.declared)) {
    problems.push('el fichero no trae `declared` (ni una lista vacía explícita)');
  }
  const list = Array.isArray(doc.declared) ? doc.declared : [];
  list.forEach((entry, index) => {
    const label = `declared[${index}]`;
    for (const field of DECLARATION_FIELDS) {
      if (!hasValue(entry[field])) problems.push(`${label}: falta \`${field}\` (una exención sin razón no es una exención)`);
    }
    if (hasValue(entry.rule) && !knownRules.includes(entry.rule)) {
      problems.push(`${label}: \`rule\` desconocida: ${entry.rule}`);
    }
    entries.push(entry);
  });
  const byKey = new Map();
  for (const entry of entries) {
    const key = `${entry.rule}|${entry.workflow}`;
    if (byKey.has(key)) problems.push(`exención duplicada: ${key}`);
    byKey.set(key, entry);
  }
  return { entries, problems, byKey, path: filePath };
}

// ---------------------------------------------------------------------------------------------
// Salida
// ---------------------------------------------------------------------------------------------

const ok = (s) => s;

/**
 * El rojo del gate, en un solo sitio, para que la autoprueba ejercite EXACTAMENTE el mismo juicio
 * que decide el código de salida (una autoprueba que reimplementa la regla pasa por casualidad).
 */
function isRed(result, strict) {
  return (
    result.undeclared.length > 0 ||
    result.declarationProblems.length > 0 ||
    (strict && (result.declared.length > 0 || result.stale.length > 0))
  );
}

function printReport(result, { root, yamlReader, strict, declarationsPath }) {
  const lines = [];
  const invarianteJobs = Object.values(result.effective.tzInvariant).reduce((n, jobs) => n + Object.keys(jobs).length, 0);
  lines.push('audit-workflow-inputs — las reglas auditables de los workflows (AGENTS.md, 874d508)');
  lines.push(`  raiz        : ${root}`);
  lines.push(`  ambito      : ${result.effective.label}`);
  lines.push(`  lector YAML : ${yamlReader.lib}@${yamlReader.version} (${yamlReader.where}) — declarado`);
  lines.push(`  declaraciones: ${path.relative(root, declarationsPath) || declarationsPath}`);
  lines.push(`  modo        : ${strict ? 'strict (las exenciones declaradas tambien fallan)' : 'normal'}`);
  lines.push('');
  lines.push(`Workflows encontrados (${result.files.length}):`);
  for (const f of result.files) lines.push(`  - ${f.rel}`);
  lines.push('');

  // ---- regla 4: cuántos se auditaron de cuántos se esperaban -------------------------------------
  // Sin esta cuenta, un árbol al que le falta un repo se lee igual que un árbol limpio.
  lines.push(
    `Workflows declarados: ${result.expected.length} · auditados: ${result.audited.length} de ${result.expected.length} · ` +
      `en repos ausentes de este arbol: ${result.absentInTree.length} · desaparecidos de un repo presente: ${result.vanished.length}`,
  );
  if (result.absentInTree.length) {
    lines.push('  no presente en este árbol: se audita en su propio CI. Un repo sin clonar NO es un hallazgo:');
    lines.push('  lo que no está no es lo mismo que lo que falta, y este gate solo puede juzgar lo segundo.');
    for (const a of result.absentInTree) {
      lines.push(`    · ${a.workflow} — repo \`${a.repo}\` ausente de este árbol`);
    }
  }
  if (result.vanished.length) {
    lines.push('  DESAPARECIDOS de un repo que SI esta en el arbol (esto si es ROJO):');
    for (const rel of result.vanished) lines.push(`    ! ${rel}`);
  }
  const extras = result.files.filter((f) => !result.expected.includes(f.rel));
  if (extras.length) {
    lines.push(`  auditados ademas de los declarados (${extras.length}): ${extras.map((f) => f.rel).join(', ')}`);
  }
  lines.push('');

  lines.push('Lo que comprueba:');
  for (const [rule, text] of Object.entries(RULES)) lines.push(`  * [${rule}] ${text}`);
  lines.push('');

  lines.push('Lo que encuentra:');
  lines.push(
    `  regla 1 — pasos \`actions/setup-node\` revisados: ${result.stats.setupNode} (jobs en total: ${result.stats.jobs})`,
  );
  lines.push(`  regla 2 — jobs con TZ: ${result.stats.tzJobs} (invariante: ${invarianteJobs})`);
  lines.push(
    `  regla 4.b — INVOCACIONES del gate vistas en los workflows de este arbol: ${result.stats.gateInvocations} ` +
      '(cada una tiene que encontrar su script; si no, sale `gate-invocado-sin-script`)',
  );
  lines.push('');

  const byRule = new Map();
  for (const f of result.undeclared) {
    if (!byRule.has(f.rule)) byRule.set(f.rule, []);
    byRule.get(f.rule).push(f);
  }
  if (result.undeclared.length === 0) {
    lines.push('  ROJO (sin declarar): 0 hallazgos en las reglas auditadas.');
  } else {
    lines.push(`  ROJO (sin declarar): ${result.undeclared.length} hallazgo(s):`);
    for (const [rule, list] of byRule) {
      lines.push(`    [${rule}] ${RULES[rule] || rule}`);
      for (const f of list) lines.push(`      - ${f.file} :: ${f.where} :: ${f.message}`);
    }
  }
  lines.push('');

  lines.push(`Declarado (exenciones activas): ${result.declared.length}`);
  for (const d of result.declared) {
    lines.push(`    [${ok(d.rule)}] ${d.file} :: ${d.where} :: ${d.message}`);
    lines.push(`      razon : ${d.declaration.reason}`);
    lines.push(`      arreglo: ${d.declaration.fix}`);
    lines.push(`      dueno : ${d.declaration.owner} (declarado en ${d.declaration.declaredIn})`);
  }
  for (const d of result.stale) {
    lines.push(`    [OBSOLETA] ${d.workflow} :: ${d.rule} :: la exencion ya no aplica: borrela`);
  }
  for (const d of result.unverifiable) {
    lines.push(
      `    [NO EVALUABLE] ${d.workflow} :: ${d.rule} :: su repo no esta en este arbol: no se puede saber si sigue aplicando`,
    );
  }
  if (result.declared.length > 0 || result.stale.length > 0 || result.unverifiable.length > 0) {
    lines.push(
      strict
        ? '  (modo strict: las exenciones declaradas y las obsoletas tambien fallan; las no evaluables no)'
        : '  (modo normal: las exenciones declaradas no fallan; --strict las hace fallar)',
    );
  }
  lines.push('');

  if (result.declarationProblems.length) {
    lines.push(`ROJO — el fichero de declaraciones no se sostiene (${result.declarationProblems.length}):`);
    for (const p of result.declarationProblems) lines.push(`    ! ${p}`);
    lines.push('');
  }

  const red = isRed(result, strict);
  lines.push(
    `RESUMEN: workflows=${result.files.length} esperados=${result.expected.length} auditados=${result.audited.length}/${
      result.expected.length
    } repos_ausentes=${result.absentInTree.length} desaparecidos=${result.vanished.length} ` +
      `jobs=${result.stats.jobs} setup-node=${result.stats.setupNode} ` +
      `hallazgos=${result.undeclared.length} declarados=${result.declared.length} ` +
      `declaraciones_obsoletas=${result.stale.length} no_evaluables=${result.unverifiable.length} ` +
      `problemas_de_declaracion=${result.declarationProblems.length}`,
  );
  lines.push(red ? 'VEREDICTO: ROJO' : 'VEREDICTO: VERDE');
  return { text: lines.join('\n'), red };
}

// ---------------------------------------------------------------------------------------------
// Autoprueba: casos sintéticos sobre árboles de verdad escritos en un directorio temporal. El
// informe declara cuántos y cuántos salen rojos: este comentario NO repite la cuenta, porque las
// cuentas escritas a mano en los comentarios son justo lo que se quedó desfasado (decía 8, el CI
// decía 10, y los casos eran 10).
// ---------------------------------------------------------------------------------------------

const FIXTURE_HEAD = 'name: fixture\n';

function fixtureWorkflows(overrides = {}) {
  const base = {
    'erp-frontend/.github/workflows/ci.yml': `name: Frontend CI
on:
  push:
    branches: [main]
  pull_request:
    branches: [main]
  workflow_dispatch:
jobs:
  lint-test-build:
    runs-on: ubuntu-latest
    steps:
      - name: Setup Node.js
        uses: actions/setup-node@v5
        with:
          node-version: '24'
  e2e:
    runs-on: ubuntu-latest
    steps:
      - name: Setup Node.js
        uses: actions/setup-node@v5
        with:
          node-version: '24'
  visual-regression:
    runs-on: ubuntu-latest
    env:
      TZ: America/La_Paz
    steps:
      - name: Setup Node.js
        uses: actions/setup-node@v5
        with:
          node-version: '24'
  ssr-smoke:
    runs-on: ubuntu-latest
    env:
      TZ: America/La_Paz
    steps:
      - name: Setup Node.js
        uses: actions/setup-node@v5
        with:
          node-version: '24'
`,
    'erp-frontend/.github/workflows/update-baselines.yml': `name: Update Visual Baselines
# manual-only-ok: fixture — es solo workflow_dispatch a proposito
on:
  workflow_dispatch:
jobs:
  baseline:
    runs-on: ubuntu-latest
    env:
      TZ: America/La_Paz
    steps:
      - name: Setup Node.js
        uses: actions/setup-node@v5
        with:
          node-version: '24'
      - name: Setup Node.js for backend
        uses: actions/setup-node@v5
        with:
          node-version: '24'
`,
    'backend-erp/.github/workflows/ci.yml': `name: Backend CI
on:
  push:
    branches: [main]
  pull_request:
    branches: [main]
  workflow_dispatch:
jobs:
  lint-and-test:
    runs-on: ubuntu-latest
    steps:
      - name: Setup Node.js
        uses: actions/setup-node@v5
        with:
          node-version: '24'
`,
    'backend-erp/.github/workflows/load-tests-large.yml': `name: Backend load tests (perfil large)
on:
  schedule:
    - cron: '0 3 * * 0'
  workflow_dispatch:
jobs:
  load-tests-large:
    runs-on: ubuntu-latest
    steps:
      - name: Setup Node.js
        uses: actions/setup-node@v5
        with:
          node-version: '24'
`,
    '.github/workflows/ci.yml': `name: Storefront CI
on:
  push:
    branches: [master]
  pull_request:
    branches: [master]
  workflow_dispatch:
jobs:
  typecheck-lint-build:
    runs-on: ubuntu-latest
    steps:
      - name: Setup Node.js
        uses: actions/setup-node@v5
        with:
          node-version: '24'
`,
  };
  for (const [file, replacement] of Object.entries(overrides)) {
    if (replacement === null) delete base[file];
    else base[file] = replacement;
  }
  return base;
}

function writeFixtureTree(files, declarations) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'audit-workflow-inputs-'));
  for (const [rel, text] of Object.entries(files)) {
    const abs = path.join(dir, rel);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, text, 'utf8');
  }
  let declarationsPath = path.join(dir, DECLARATIONS_NAME);
  if (declarations) fs.writeFileSync(declarationsPath, JSON.stringify(declarations, null, 2), 'utf8');
  else declarationsPath = path.join(dir, 'no-declarations.json');
  return { dir, declarationsPath };
}

function runSelfTest(yamlReader) {
  const cases = [];
  const run = (files, declarations, strict = false, scope = null) => {
    const tree = writeFixtureTree(files, declarations);
    try {
      const declarationsLoaded = loadDeclarations(tree.declarationsPath, Object.keys(RULES));
      const result = auditTree({ root: tree.dir, yamlReader, declarations: declarationsLoaded, strict, scope });
      // El ROJO se calcula con la MISMA funcion que decide el codigo de salida del CLI.
      return { ...result, red: isRed(result, strict) };
    } finally {
      fs.rmSync(tree.dir, { recursive: true, force: true });
    }
  };
  /** El contenido EXACTO del gate que se está ejecutando: es lo que tiene que llevar cada copia. */
  const CANONICAL_GATE = fs.readFileSync(path.join(HERE, 'audit-workflow-inputs.mjs'), 'utf8');
  const check = (name, expectation, result) => {
    const rules = [...new Set(result.undeclared.map((f) => f.rule))].sort();
    const problems = result.declarationProblems.length;
    const okCase = expectation(rules, result);
    cases.push({ name, ok: okCase, rules, problems, red: result.red });
    return okCase;
  };

  // 1 — verde
  check(
    'base-verde (sin hallazgos)',
    (rules, result) => rules.length === 0 && result.undeclared.length === 0 && result.red === false,
    run(fixtureWorkflows()),
  );

  // 2 — regla 1: `node-version:` sin valor (el bug real de `029f8447`)
  const emptyVersion = fixtureWorkflows({
    'erp-frontend/.github/workflows/update-baselines.yml': fixtureWorkflows()[
      'erp-frontend/.github/workflows/update-baselines.yml'
    ]
      .split("          node-version: '24'\n")
      .join('          node-version:\n'),
  });
  {
    const result = run(emptyVersion);
    check(
      'node-version-vacio (2 setup-node sin valor)',
      (rules) => rules.length === 1 && rules[0] === 'node-version-empty' && result.undeclared.length === 2,
      result,
    );
  }

  // 3 — regla 2: la zona se mueve (falta en ssr-smoke y sobra en e2e)
  const movedTz = fixtureWorkflows({
    'erp-frontend/.github/workflows/ci.yml': fixtureWorkflows()['erp-frontend/.github/workflows/ci.yml']
      .replace('  ssr-smoke:\n    runs-on: ubuntu-latest\n    env:\n      TZ: America/La_Paz\n', '  ssr-smoke:\n    runs-on: ubuntu-latest\n')
      .replace('  e2e:\n    runs-on: ubuntu-latest\n', '  e2e:\n    runs-on: ubuntu-latest\n    env:\n      TZ: America/La_Paz\n'),
  });
  {
    const result = run(movedTz);
    check(
      'tz-movida (falta en ssr-smoke, sobra en e2e)',
      (rules) => rules.length === 2 && rules.includes('tz-missing') && rules.includes('tz-unexpected'),
      result,
    );
  }

  // 4 — regla 3: se quita `workflow_dispatch`
  const noDispatch = fixtureWorkflows({
    'erp-frontend/.github/workflows/ci.yml': fixtureWorkflows()['erp-frontend/.github/workflows/ci.yml'].replace(
      '  workflow_dispatch:\n',
      '',
    ),
  });
  {
    const result = run(noDispatch);
    check(
      'sin-workflow_dispatch (regla 3)',
      (rules) => rules.length === 1 && rules[0] === 'missing-workflow_dispatch',
      result,
    );
  }

  // 5 — regla 3: el workflow solo-manual pierde la marca / la recupera
  const unmarked = fixtureWorkflows({
    'erp-frontend/.github/workflows/update-baselines.yml': fixtureWorkflows()[
      'erp-frontend/.github/workflows/update-baselines.yml'
    ].replace('# manual-only-ok: fixture — es solo workflow_dispatch a proposito\n', ''),
  });
  {
    const result = run(unmarked);
    check('manual-only-sin-marca (regla 3)', (rules) => rules.length === 1 && rules[0] === 'manual-only-sin-marca', result);
    const back = run(fixtureWorkflows());
    check(
      'manual-only-con-marca (vuelve a verde)',
      (rules, r) => rules.length === 0 && r.undeclared.length === 0 && r.red === false,
      back,
    );
  }

  // 6 — exención declarada sin razón: el gate falla por su propio fichero
  {
    const result = run(fixtureWorkflows(), {
      declared: [
        {
          rule: 'manual-only-sin-marca',
          workflow: 'erp-frontend/.github/workflows/update-baselines.yml',
          reason: '',
          fix: 'x',
          owner: 'x',
          declaredIn: 'x',
        },
      ],
    });
    check('declaracion-sin-razon (gate invalido)', (rules, r) => r.declarationProblems.length === 1, result);
  }

  // 7 — `node-version-file` que apunta a un fichero que no existe
  const badPointer = fixtureWorkflows({
    '.github/workflows/ci.yml': fixtureWorkflows()['.github/workflows/ci.yml'].replace(
      "          node-version: '24'\n",
      "          node-version-file: '.nvmrc'\n",
    ),
  });
  {
    const result = run(badPointer);
    check(
      'node-version-file-inexistente (regla 1 ampliada)',
      (rules) => rules.length === 1 && rules[0] === 'node-version-file-missing',
      result,
    );
  }

  // 8 — la exención declarada: verde en modo normal y ROJA con `--strict` (el ratchet es real)
  {
    const noDispatchBackend = fixtureWorkflows({
      'backend-erp/.github/workflows/ci.yml': fixtureWorkflows()['backend-erp/.github/workflows/ci.yml'].replace(
        '  workflow_dispatch:\n',
        '',
      ),
    });
    const declaration = {
      declared: [
        {
          rule: 'missing-workflow_dispatch',
          workflow: 'backend-erp/.github/workflows/ci.yml',
          reason: 'fixture: repo de solo lectura en esta sesion',
          fix: 'anadir `workflow_dispatch:` al `on:`',
          owner: 'fixture',
          declaredIn: 'fixture',
        },
      ],
    };
    const normal = run(noDispatchBackend, declaration, false);
    check(
      'exencion-declarada-normal (verde, con la exencion a la vista)',
      (rules, r) => rules.length === 0 && r.declared.length === 1 && isRed(r, false) === false,
      normal,
    );
    const strict = run(noDispatchBackend, declaration, true);
    check(
      'exencion-declarada-strict (ROJO: la deuda declarada cuenta)',
      (rules, r) => rules.length === 0 && r.declared.length === 1 && isRed(r, true) === true,
      strict,
    );
  }

  // 9 — regla 4: al árbol le FALTAN REPOS (el CI de la raíz solo clona la raíz, medido en `958cd664`)
  //     ⇒ informativo, NO rojo. Es el caso que estaba en rojo en el CI y el motivo de todo esto.
  {
    const soloRaiz = fixtureWorkflows({
      'erp-frontend/.github/workflows/ci.yml': null,
      'erp-frontend/.github/workflows/update-baselines.yml': null,
      'backend-erp/.github/workflows/ci.yml': null,
      'backend-erp/.github/workflows/load-tests-large.yml': null,
    });
    const result = run(soloRaiz, { declared: [] });
    check(
      'arbol-sin-repos (solo la raiz: informativo, VERDE)',
      (rules, r) =>
        rules.length === 0 &&
        r.undeclared.length === 0 &&
        r.expected.length === 5 &&
        r.audited.length === 1 &&
        r.absentInTree.length === 4 &&
        r.vanished.length === 0 &&
        r.red === false,
      result,
    );
    // Y la cuenta tiene que ser LEGIBLE: es lo que distingue «árbol incompleto» de «árbol limpio».
    const { text } = printReport(result, {
      root: '<fixture>',
      yamlReader,
      strict: false,
      declarationsPath: '<fixture>/declarations.json',
    });
    const legible = /auditados: 1 de 5/.test(text) && /no presente en este árbol: se audita en su propio CI/.test(text);
    cases.push({ name: 'arbol-sin-repos-legible (auditados=N/M y la linea informativa)', ok: legible, rules: [], problems: 0, red: result.red });
  }

  // 10 — regla 4: el repo SÍ está y el workflow desaparece ⇒ ROJO (el caso que la regla protege)
  {
    const borrado = fixtureWorkflows({ 'erp-frontend/.github/workflows/update-baselines.yml': null });
    const result = run(borrado, { declared: [] });
    check(
      'repo-presente-workflow-borrado (ROJO)',
      (rules, r) =>
        rules.length === 1 &&
        rules[0] === 'workflow-declarado-ausente' &&
        r.undeclared.length === 1 &&
        r.undeclared[0].file === 'erp-frontend/.github/workflows/update-baselines.yml' &&
        r.vanished.length === 1 &&
        r.absentInTree.length === 0 &&
        r.red === true,
      result,
    );
  }

  // 11 — la lista de exenciones VACÍA es el objetivo del fichero, no un defecto del fichero
  {
    const vacia = run(fixtureWorkflows(), { declared: [] });
    check(
      'declared-vacio (cero exenciones: VERDE)',
      (rules, r) => r.declarationProblems.length === 0 && r.undeclared.length === 0 && r.red === false,
      vacia,
    );
    const sinClave = run(fixtureWorkflows(), { otra: 1 });
    check(
      'declared-sin-clave (falta la CLAVE: ROJO del fichero)',
      (rules, r) => r.declarationProblems.length === 1,
      sinClave,
    );
  }

  // 12 — regla 4.b: la copia del gate en un repo anidado tiene que ser LA MISMA pieza
  {
    const desincronizada = fixtureWorkflows({
      'erp-frontend/scripts/audit-workflow-inputs.mjs': '// copia vieja del gate: le falta la regla 4\n',
    });
    const result = run(desincronizada, { declared: [] });
    check(
      'gate-copia-desincronizada (ROJO: dos gates con el mismo nombre)',
      (rules, r) => rules.includes('gate-copia-desincronizada') && r.red === true,
      result,
    );
  }

  // 13 — la copia canónica Y ejecutada por su CI es la forma buena (verde, y demuestra el paso)
  {
    const conPasoDeGate = (rel) =>
      fixtureWorkflows()[rel].replace(
        '    steps:\n',
        '    steps:\n      - name: Gate de los workflows (valor de Node, TZ y disparadores)\n' +
          '        run: node scripts/audit-workflow-inputs.mjs --root .\n',
      );
    const sincronizada = fixtureWorkflows({
      'erp-frontend/scripts/audit-workflow-inputs.mjs': CANONICAL_GATE,
      'erp-frontend/.github/workflows/ci.yml': conPasoDeGate('erp-frontend/.github/workflows/ci.yml'),
    });
    const result = run(sincronizada, { declared: [] });
    check(
      'gate-copia-canonica-y-ejecutada (VERDE)',
      (rules, r) => rules.length === 0 && r.undeclared.length === 0 && r.stats.gateInvocations === 1 && r.red === false,
      result,
    );
  }

  // 14 — un workflow invoca el gate y el script no está en SU repo ⇒ ROJO (un paso que no arranca)
  {
    const invocaSinScript = fixtureWorkflows({
      'backend-erp/.github/workflows/ci.yml': fixtureWorkflows()['backend-erp/.github/workflows/ci.yml'].replace(
        '    steps:\n',
        '    steps:\n      - name: Gate de los workflows\n        run: node scripts/audit-workflow-inputs.mjs --root .\n',
      ),
    });
    const result = run(invocaSinScript, { declared: [] });
    check(
      'gate-invocado-sin-script (ROJO)',
      (rules, r) => rules.length === 1 && rules[0] === 'gate-invocado-sin-script' && r.red === true,
      result,
    );
  }

  // 15 — el repo tiene la copia y ningún workflow la ejecuta ⇒ ROJO (un gate que no vigila nada)
  {
    const noEjecutada = fixtureWorkflows({ 'backend-erp/scripts/audit-workflow-inputs.mjs': CANONICAL_GATE });
    const result = run(noEjecutada, { declared: [] });
    check(
      'gate-copia-no-ejecutada (ROJO)',
      (rules, r) => rules.length === 1 && rules[0] === 'gate-copia-no-ejecutada' && r.red === true,
      result,
    );
  }

  // 16 — `--repo`: la MISMA forma del repo anidado, con las rutas traducidas, sale verde
  {
    const base = fixtureWorkflows();
    const formaLocal = {
      '.github/workflows/ci.yml': base['erp-frontend/.github/workflows/ci.yml'],
      '.github/workflows/update-baselines.yml': base['erp-frontend/.github/workflows/update-baselines.yml'],
    };
    const conScope = run(formaLocal, { declared: [] }, false, 'erp-frontend');
    check(
      'repo-scope (--repo erp-frontend sobre su forma local: VERDE)',
      (rules, r) => rules.length === 0 && r.audited.length === 2 && r.expected.length === 2 && r.red === false,
      conScope,
    );
    // Y sin `--repo` esa MISMA forma sale ROJA —por la forma del árbol, no por su contenido—: es la
    // medición que justifica el flag (y que impide creer que `--root .` a secas ya auditaba).
    const sinScope = run(formaLocal, { declared: [] });
    check(
      'repo-sin-scope (misma forma SIN --repo: ROJO por la forma)',
      (rules, r) => r.undeclared.length > 0 && r.red === true,
      sinScope,
    );
  }

  const failed = cases.filter((c) => !c.ok);
  const redCases = cases.filter((c) => c.red);
  const lines = ['Autoprueba de audit-workflow-inputs — el gate tiene que poder estar en ROJO', ''];
  for (const c of cases) {
    lines.push(
      `  ${c.ok ? 'OK  ' : 'FALLO'} ${c.name} :: veredicto=${c.red ? 'ROJO' : 'VERDE'}${
        c.ok ? '' : ` (esperado distinto; reglas vistas = [${c.rules.join(', ')}])`
      }`,
    );
  }
  lines.push('');
  lines.push(
    `RESUMEN: casos=${cases.length} verdes=${cases.length - redCases.length} rojos=${redCases.length} fallos=${failed.length}`,
  );
  lines.push(
    failed.length === 0
      ? `VEREDICTO: VERDE (los ${redCases.length} casos rotos salen ROJOS y los ${cases.length - redCases.length} verdes siguen verdes)`
      : 'VEREDICTO: ROJO',
  );
  return { text: lines.join('\n'), red: failed.length > 0, cases };
}

// ---------------------------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------------------------

function parseArgs(argv) {
  const opts = { root: SCRIPT_REPO_ROOT, strict: false, selfTest: false, declarations: null, repo: null };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--root') opts.root = path.resolve(argv[++i] || '');
    else if (arg === '--repo') opts.repo = String(argv[++i] || '').replace(/\/+$/, '');
    else if (arg === '--strict') opts.strict = true;
    else if (arg === '--self-test') opts.selfTest = true;
    else if (arg === '--declarations') opts.declarations = path.resolve(argv[++i] || '');
    else if (arg === '--help' || arg === '-h') opts.help = true;
    else {
      process.stderr.write(`argumento no reconocido: ${arg}\n`);
      opts.bad = true;
    }
  }
  return opts;
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.help) {
    process.stdout.write(
      'uso: node scripts/audit-workflow-inputs.mjs [--root <dir>] [--repo <erp-frontend|backend-erp>]\n' +
        '     [--strict] [--self-test] [--declarations <fichero>]\n',
    );
    return opts.bad ? 2 : 0;
  }
  if (opts.bad) return 2;

  if (opts.repo && !MONOREPO_REPOS.includes(opts.repo)) {
    process.stderr.write(
      `audit-workflow-inputs: \`--repo ${opts.repo}\` no es un repo del monorepo. Conocidos: ` +
        `${MONOREPO_REPOS.filter((r) => r !== '.').join(', ')}. Un repo que el gate no conoce no se ` +
        'puede auditar: seria un verde por no mirar (mejor el 2 ruidoso).\n',
    );
    return 2;
  }

  const yamlReader = loadYamlReader(SCRIPT_REPO_ROOT);
  if (!yamlReader) {
    process.stderr.write(
      'audit-workflow-inputs: no se pudo resolver `js-yaml` ni `yaml` en ningun node_modules conocido ' +
        `(raiz, storefront, erp-frontend, backend-erp). Sin lector YAML este gate NO pasa: ejecute ` +
        '`npm ci` en la raiz o en storefront/ (o instale js-yaml).\n',
    );
    return 2;
  }

  if (opts.selfTest) {
    const { text, red } = runSelfTest(yamlReader);
    process.stdout.write(`${text}\n`);
    return red ? 1 : 0;
  }

  const declarationsPath = opts.declarations || path.join(SCRIPT_REPO_ROOT, 'scripts', DECLARATIONS_NAME);
  const declarations = loadDeclarations(declarationsPath, Object.keys(RULES));
  const result = auditTree({ root: opts.root, yamlReader, declarations, strict: opts.strict, scope: opts.repo });
  const { text, red } = printReport(result, {
    root: opts.root,
    yamlReader,
    strict: opts.strict,
    declarationsPath,
  });
  process.stdout.write(`${text}\n`);
  return red ? 1 : 0;
}

process.exit(main());
