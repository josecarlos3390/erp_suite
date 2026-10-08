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
 * Uso:
 *   node scripts/audit-workflow-inputs.mjs                 # audita el árbol del repo (verde/rojo)
 *   node scripts/audit-workflow-inputs.mjs --root <dir>    # audita OTRO árbol con la misma forma
 *   node scripts/audit-workflow-inputs.mjs --strict        # las exenciones declaradas también fallan
 *   node scripts/audit-workflow-inputs.mjs --self-test     # 8 casos sintéticos (2 verdes + 6 rojos)
 *
 * Códigos de salida: 0 = verde · 1 = hallazgos · 2 = el gate no pudo ejecutarse (y por tanto NO pasa).
 *
 * Lector YAML: se resuelve `js-yaml` (y, si no está, `yaml`) del primer `node_modules` que lo tenga,
 * en este orden: raíz, `storefront/`, `erp-frontend/`, `backend-erp/`. El que se use **se imprime**
 * (la regla pide declararlo). En el CI de la raíz —que solo instala las dependencias de la tienda—
 * resuelve el de `storefront/node_modules`, que llega como dependencia de `eslint`/`postcss-load-config`;
 * si algún día desapareciera, el gate sale con **2** (ruidoso), nunca con un falso verde.
 */
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

function discoverWorkflows(root) {
  const found = [];
  for (const rel of WORKFLOW_DIRS) {
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

function auditTree({ root, yamlReader, declarations, strict }) {
  const files = discoverWorkflows(root);
  const findings = [];
  const stats = { setupNode: 0, jobs: 0, tzJobs: 0 };

  const push = (rule, file, where, message) => {
    const declaration = declarations.byKey.get(`${rule}|${file}`) || null;
    findings.push({ rule, file, where, message, declaration });
  };

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
    const expectedTz = TZ_INVARIANT[file.rel] || {};
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
  }

  // ---- los cinco workflows declarados tienen que estar -----------------------------------------
  const seen = new Set(files.map((f) => f.rel));
  for (const rel of DECLARED_WORKFLOWS) {
    if (!seen.has(rel)) {
      findings.push({
        rule: 'workflow-declarado-ausente',
        file: rel,
        where: rel,
        message: 'está en la lista declarada del gate y no aparece en el árbol (¿movido o borrado?)',
      });
    }
  }

  // ---- declaraciones: ninguna puede sobrar ni quedarse sin razón --------------------------------
  const declared = findings.filter((f) => f.declaration);
  const undeclared = findings.filter((f) => !f.declaration);
  const usedKeys = new Set(declared.map((d) => `${d.rule}|${d.file}`));
  const stale = declarations.entries.filter((d) => !usedKeys.has(`${d.rule}|${d.workflow}`));

  return { files, findings, declared, undeclared, stale, declarationProblems: declarations.problems, stats };
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
  const list = Array.isArray(doc.declared) ? doc.declared : [];
  if (list.length === 0) problems.push('el fichero no trae `declared` (ni una lista vacía explícita)');
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
  lines.push('audit-workflow-inputs — las tres reglas auditables del 2026-10-08 (AGENTS.md, 874d508)');
  lines.push(`  raiz        : ${root}`);
  lines.push(`  lector YAML : ${yamlReader.lib}@${yamlReader.version} (${yamlReader.where}) — declarado`);
  lines.push(`  declaraciones: ${path.relative(root, declarationsPath) || declarationsPath}`);
  lines.push(`  modo        : ${strict ? 'strict (las exenciones declaradas tambien fallan)' : 'normal'}`);
  lines.push('');
  lines.push(`Workflows encontrados (${result.files.length}):`);
  for (const f of result.files) lines.push(`  - ${f.rel}`);
  const missing = DECLARED_WORKFLOWS.filter((w) => !result.files.some((f) => f.rel === w));
  if (missing.length) for (const w of missing) lines.push(`  ! DECLARADO Y AUSENTE: ${w}`);
  lines.push('');

  lines.push('Lo que comprueba:');
  for (const [rule, text] of Object.entries(RULES)) lines.push(`  * [${rule}] ${text}`);
  lines.push('');

  lines.push('Lo que encuentra:');
  lines.push(
    `  regla 1 — pasos \`actions/setup-node\` revisados: ${result.stats.setupNode} (jobs en total: ${result.stats.jobs})`,
  );
  lines.push(
    `  regla 2 — jobs con TZ: ${result.stats.tzJobs} (invariante: ${Object.values(TZ_INVARIANT).reduce(
      (n, jobs) => n + Object.keys(jobs).length,
      0,
    )})`,
  );
  lines.push('');

  const byRule = new Map();
  for (const f of result.undeclared) {
    if (!byRule.has(f.rule)) byRule.set(f.rule, []);
    byRule.get(f.rule).push(f);
  }
  if (result.undeclared.length === 0) {
    lines.push('  ROJO (sin declarar): 0 hallazgos en las tres reglas.');
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
  if (result.declared.length > 0 || result.stale.length > 0) {
    lines.push(
      strict
        ? '  (modo strict: las exenciones declaradas y las obsoletas tambien fallan)'
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
    `RESUMEN: workflows=${result.files.length} jobs=${result.stats.jobs} setup-node=${result.stats.setupNode} ` +
      `hallazgos=${result.undeclared.length} declarados=${result.declared.length} ` +
      `declaraciones_obsoletas=${result.stale.length} problemas_de_declaracion=${result.declarationProblems.length}`,
  );
  lines.push(red ? 'VEREDICTO: ROJO' : 'VEREDICTO: VERDE');
  return { text: lines.join('\n'), red };
}

// ---------------------------------------------------------------------------------------------
// Autoprueba: 7 casos sobre árboles sintéticos (1 verde + 6 rojos)
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
  const run = (files, declarations, strict = false) => {
    const tree = writeFixtureTree(files, declarations);
    try {
      const declarationsLoaded = loadDeclarations(tree.declarationsPath, Object.keys(RULES));
      const result = auditTree({ root: tree.dir, yamlReader, declarations: declarationsLoaded, strict });
      // El ROJO se calcula con la MISMA funcion que decide el codigo de salida del CLI.
      return { ...result, red: isRed(result, strict) };
    } finally {
      fs.rmSync(tree.dir, { recursive: true, force: true });
    }
  };
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
  const opts = { root: SCRIPT_REPO_ROOT, strict: false, selfTest: false, declarations: null };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--root') opts.root = path.resolve(argv[++i] || '');
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
      'uso: node scripts/audit-workflow-inputs.mjs [--root <dir>] [--strict] [--self-test] [--declarations <fichero>]\n',
    );
    return opts.bad ? 2 : 0;
  }
  if (opts.bad) return 2;

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
  const result = auditTree({ root: opts.root, yamlReader, declarations, strict: opts.strict });
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
