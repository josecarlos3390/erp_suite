/**
 * Acceso de solo lectura a la documentación canónica del monorepo.
 *
 * El MCP puede leer la documentación del proyecto para que un agente conozca las
 * reglas del ERP (protocolo de trabajo, guías canónicas, auditoría) sin depender de
 * que el humano las pegue en el prompt. Es lectura de archivos locales, con lista
 * blanca y límite de tamaño.
 */

import { readFile, stat } from 'node:fs/promises';
import * as path from 'node:path';

/** Documentos expuestos y su ruta relativa a la raíz del monorepo. */
export const DOCS = {
  agents: 'AGENTS.md',
  frontend_guide: 'FRONTEND_GUIDE.md',
  backend_guide: 'BACKEND_GUIDE.md',
  roadmap: 'ROADMAP.md',
  audit: 'AUDIT.md',
  readme: 'README.md',
  accounting_entries: 'docs/guides/ACCOUNTING_ENTRIES_GUIDE.md',
  document_lines_standard: 'docs/guides/ESTANDAR_LINEAS_DOCUMENTO.md',
  setup_guide: 'docs/guides/guia-implementacion-configuracion.md',
  css_architecture: 'erp-frontend/src/styles/CSS-ARCHITECTURE.md',
  go_live_runbook: 'docs/plans/runbook-go-live.md',
  frontend_skill: '.agents/skills/angular-solid-frontend/SKILL.md',
  backend_skill: '.agents/skills/nestjs-solid-backend/SKILL.md',
  frontend_changelog: 'erp-frontend/CHANGELOG.md',
  backend_changelog: 'backend-erp/CHANGELOG.md',
  sap_integration: 'docs/reference/SAP_B1_INTEGRATION.md',
} as const;

export type DocName = keyof typeof DOCS;

export interface DocSlice {
  doc: DocName;
  path: string;
  totalLines: number;
  fromLine: number;
  toLine: number;
  truncated: boolean;
  content: string;
}

/** Máximo de caracteres que se devuelven en una lectura (para no reventar el contexto). */
const MAX_CHARS = 40_000;

export async function readDoc(
  projectRoot: string,
  doc: DocName,
  options: { fromLine?: number; lines?: number; search?: string } = {},
): Promise<DocSlice> {
  const relative = DOCS[doc];
  if (!relative) throw new Error(`Documento no permitido: ${String(doc)}`);
  const absolute = path.resolve(projectRoot, relative);
  const rootResolved = path.resolve(projectRoot);
  if (!absolute.startsWith(rootResolved)) {
    throw new Error('Ruta fuera de la raíz del proyecto.');
  }

  const info = await stat(absolute).catch(() => null);
  if (!info?.isFile()) {
    throw new Error(
      `No se encontró ${relative} bajo ${rootResolved} (¿ERP_PROJECT_ROOT correcto?).`,
    );
  }

  const raw = await readFile(absolute, 'utf8');
  const allLines = raw.split(/\r?\n/);

  if (options.search) {
    const needle = options.search.toLowerCase();
    const hits: string[] = [];
    allLines.forEach((line, index) => {
      if (line.toLowerCase().includes(needle)) {
        hits.push(`${index + 1}: ${line}`);
      }
    });
    const content = hits.slice(0, 60).join('\n');
    return {
      doc,
      path: relative,
      totalLines: allLines.length,
      fromLine: 1,
      toLine: allLines.length,
      truncated: hits.length > 60,
      content:
        hits.length === 0
          ? `Sin coincidencias de "${options.search}" en ${relative}.`
          : `Coincidencias (${hits.length}${hits.length > 60 ? ', mostrando 60' : ''}):\n${content}`,
    };
  }

  const fromLine = Math.max(options.fromLine ?? 1, 1);
  const requested = options.lines ?? 200;
  const toLine = Math.min(fromLine + requested - 1, allLines.length);
  let content = allLines.slice(fromLine - 1, toLine).join('\n');
  let truncated = toLine < allLines.length;
  if (content.length > MAX_CHARS) {
    content = `${content.slice(0, MAX_CHARS)}\n… (recortado por tamaño)`;
    truncated = true;
  }
  return {
    doc,
    path: relative,
    totalLines: allLines.length,
    fromLine,
    toLine,
    truncated,
    content,
  };
}
