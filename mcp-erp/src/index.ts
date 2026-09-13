#!/usr/bin/env node
/**
 * MCP del ERP (erp_suite) — servidor stdio de **solo lectura**.
 *
 * Expone consultas de negocio contra la API del ERP y la documentación canónica del
 * monorepo, para que cualquier cliente MCP (DSH, Claude, etc.) pueda auditar el estado
 * del ERP sin acceso directo a la base de datos.
 *
 * Configuración por variables de entorno: ver `README.md` y `src/config.ts`.
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';

import { loadConfig, hasApiCredentials } from './config.js';
import { ErpClient } from './erp-client.js';
import { buildTools } from './tools.js';
import { DOCS, readDoc, type DocName } from './docs.js';

const VERSION = '0.1.0';

async function main(): Promise<void> {
  const config = loadConfig();
  const client = new ErpClient({ config });

  const server = new McpServer({
    name: 'erp-mcp',
    version: VERSION,
  });

  const withApi = hasApiCredentials(config);

  for (const tool of buildTools(client, config.maxRows)) {
    const guarded = async (args: Record<string, unknown>) => {
      if (!withApi) {
        return {
          content: [
            {
              type: 'text' as const,
              text: `Faltan credenciales de la API: define ERP_USERNAME y ERP_PASSWORD para usar «${tool.name}». (La herramienta erp_project_docs funciona sin credenciales.)`,
            },
          ],
          isError: true,
        };
      }
      try {
        return await tool.handler(args);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return {
          content: [{ type: 'text' as const, text: `Error: ${message}` }],
          isError: true,
        };
      }
    };

    server.tool(
      tool.name,
      tool.description,
      tool.inputSchema as z.ZodRawShape,
      guarded as never,
    );
  }

  // Documentación del proyecto (sin credenciales: lee archivos locales).
  server.tool(
    'erp_project_docs',
    'Lee la documentación canónica del monorepo (protocolo, guías de frontend/backend, auditoría, roadmap, estándar de líneas de documento, guía de asientos contables, runbook de go-live, skills del proyecto). Permite paginar por líneas o buscar texto.',
    {
      doc: z
        .enum(Object.keys(DOCS) as [DocName, ...DocName[]])
        .describe('Documento a leer'),
      fromLine: z.number().int().min(1).optional().describe('Línea inicial (default 1)'),
      lines: z.number().int().min(1).max(2000).optional().describe('Cuántas líneas (default 200)'),
      search: z
        .string()
        .optional()
        .describe('Busca este texto y devuelve las líneas que lo contienen (hasta 60)'),
    },
    async (args: { doc: DocName; fromLine?: number; lines?: number; search?: string }) => {
      try {
        const slice = await readDoc(config.projectRoot, args.doc, {
          fromLine: args.fromLine,
          lines: args.lines,
          search: args.search,
        });
        const header = `# ${slice.path} (líneas ${slice.fromLine}-${slice.toLine} de ${slice.totalLines}${slice.truncated ? ', recortado' : ''})\n`;
        return { content: [{ type: 'text' as const, text: header + slice.content }] };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return {
          content: [{ type: 'text' as const, text: `Error: ${message}` }],
          isError: true,
        };
      }
    },
  );

  const transport = new StdioServerTransport();
  await server.connect(transport);
  // El transporte stdio mantiene el proceso vivo; no cerramos nada aquí.
  process.stderr.write(
    `erp-mcp ${VERSION} listo — API ${config.baseUrl} (tenant ${config.tenantSlug}), credenciales ${withApi ? 'configuradas' : 'AUSENTES'}\n`,
  );
}

main().catch((err) => {
  process.stderr.write(
    `erp-mcp no pudo arrancar: ${err instanceof Error ? err.message : String(err)}\n`,
  );
  process.exit(1);
});
