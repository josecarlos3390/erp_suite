/**
 * Herramientas del MCP del ERP (todas de solo lectura).
 *
 * Cada herramienta devuelve JSON compacto y **recortado** (los listados se proyectan
 * a las columnas útiles y se limitan a `ERP_MAX_ROWS`): el objetivo es que un agente
 * consulte el estado del ERP sin arrastrar payloads completos a su contexto.
 */

import { z } from 'zod';
import { ErpClient } from './erp-client.js';

/** Recursos de listado permitidos y su ruta en la API. */
const LIST_RESOURCES = {
  'sale-invoices': '/sale-invoices',
  'purchase-invoices': '/purchase-invoices',
  'sales-orders': '/sales-orders',
  'purchase-orders': '/purchase-orders',
  'delivery-orders': '/delivery-orders',
  'purchase-receipts': '/purchase-receipts',
  'incoming-payments': '/incoming-payments',
  'outgoing-payments': '/outgoing-payments',
  'sales-credit-notes': '/sales-credit-notes',
  'purchase-credit-notes': '/purchase-credit-notes',
  'stock-entries': '/stock-entries',
  'stock-exits': '/stock-exits',
  'stock-transfers': '/stock-transfers',
  'stock-adjustments': '/stock-adjustments',
  'journal-entries': '/journal-entries',
  items: '/items',
  partners: '/partners',
  accounts: '/accounts',
  batches: '/batches',
  'serial-numbers': '/serial-numbers',
} as const;

export type ListResource = keyof typeof LIST_RESOURCES;

const PROJECTED_KEYS = [
  'id',
  'code',
  'documentSeries',
  'date',
  'postingDate',
  'dueDate',
  'status',
  'currency',
  'exchangeRate',
  'total',
  'subtotal',
  'taxAmount',
  'paidAmount',
  'balanceDue',
  'partnerId',
  'partnerCode',
  'partnerName',
  'cardCode',
  'cardName',
  'accountId',
  'accountCode',
  'accountName',
  'debit',
  'credit',
  'description',
  'name',
  'itemId',
  'itemCode',
  'itemName',
  'quantity',
  'warehouseId',
  'transactionId',
  'sourceTransactionType',
  'sourceTransactionId',
  'sourceDocumentType',
  'sourceDocumentId',
  'referenceNo',
  'notes',
  'withholdingAmount',
  'withholdingTaxTypeId',
  'isAdvance',
  'type',
];

/** Deja solo las claves útiles y recorta valores largos. */
export function projectRow(row: unknown): Record<string, unknown> {
  if (row == null || typeof row !== 'object') return { value: row };
  const source = row as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const key of PROJECTED_KEYS) {
    const value = source[key];
    if (value === undefined || value === null) continue;
    out[key] =
      typeof value === 'string' && value.length > 160
        ? `${value.slice(0, 157)}...`
        : value;
  }
  // Si el proyecto no encontró nada, devolvemos las claves propias recortadas.
  if (Object.keys(out).length === 0) {
    for (const [key, value] of Object.entries(source).slice(0, 20)) {
      out[key] =
        typeof value === 'string' && value.length > 160
          ? `${value.slice(0, 157)}...`
          : value;
    }
  }
  return out;
}

interface Paged<T> {
  data?: T[];
  items?: T[];
  total?: number;
  meta?: { total?: number };
}

/** Normaliza las respuestas paginadas del backend (`data`, `items` o array). */
export function unwrapList<T>(payload: unknown): { rows: T[]; total?: number } {
  if (Array.isArray(payload)) return { rows: payload as T[] };
  const paged = (payload ?? {}) as Paged<T>;
  const rows = paged.data ?? paged.items ?? [];
  return { rows, total: paged.total ?? paged.meta?.total };
}

export interface ToolTextResult {
  content: Array<{ type: 'text'; text: string }>;
  isError?: boolean;
}

function json(value: unknown): ToolTextResult {
  return {
    content: [{ type: 'text', text: JSON.stringify(value, null, 2) }],
  };
}

function fail(message: string): ToolTextResult {
  return { content: [{ type: 'text', text: message }], isError: true };
}

export interface ToolDefinition {
  name: string;
  title: string;
  description: string;
  inputSchema: z.ZodRawShape;
  handler: (args: Record<string, unknown>) => Promise<ToolTextResult>;
}

export function buildTools(
  client: ErpClient,
  maxRowsDefault: number,
): ToolDefinition[] {
  const clamp = (limit?: number): number =>
    Math.min(Math.max(limit ?? maxRowsDefault, 1), maxRowsDefault);

  return [
    {
      name: 'erp_health',
      title: 'Salud y sesión del ERP',
      description:
        'Estado del backend (Prisma/memoria/disco), versión de la API y usuario/tenant de la sesión. Úsalo primero para saber contra qué entorno estás hablando.',
      inputSchema: {},
      handler: async () => {
        const health = await client.get<Record<string, unknown>>('/health');
        let me: unknown = null;
        try {
          me = await client.get<Record<string, unknown>>('/auth/me');
        } catch {
          me = '(sin sesión)';
        }
        return json({ api: client.config.baseUrl, health, session: me });
      },
    },

    {
      name: 'erp_list_documents',
      title: 'Listar documentos del ERP',
      description:
        'Lista documentos o maestros por tipo, con filtros de texto/estado/fecha. Devuelve solo las columnas útiles (código, fecha, estado, total, saldo, socio).',
      inputSchema: {
        resource: z
          .enum(Object.keys(LIST_RESOURCES) as [ListResource, ...ListResource[]])
          .describe('Tipo de documento o maestro a listar'),
        search: z.string().optional().describe('Texto libre (código, nombre…)'),
        status: z.string().optional().describe('Estado exacto, p. ej. OPEN'),
        from: z.string().optional().describe('Fecha desde (YYYY-MM-DD)'),
        to: z.string().optional().describe('Fecha hasta (YYYY-MM-DD)'),
        partnerId: z.number().int().optional(),
        warehouseId: z.number().int().optional(),
        limit: z.number().int().min(1).optional(),
        page: z.number().int().min(1).optional(),
      },
      handler: async (args) => {
        const resource = args.resource as ListResource;
        const path = LIST_RESOURCES[resource];
        const limit = clamp(args.limit as number | undefined);
        const payload = await client.get<unknown>(path, {
          search: args.search,
          status: args.status,
          dateFrom: args.from,
          dateTo: args.to,
          partnerId: args.partnerId,
          warehouseId: args.warehouseId,
          limit,
          page: args.page,
        });
        const { rows, total } = unwrapList<Record<string, unknown>>(payload);
        const page = rows.slice(0, limit);
        return json({
          resource,
          returned: page.length,
          total: total ?? rows.length,
          rows: page.map(projectRow),
        });
      },
    },

    {
      name: 'erp_get_document',
      title: 'Detalle de un documento (con su asiento)',
      description:
        'Devuelve un documento por id y, si tiene asiento contable, el asiento con sus líneas (débito/crédito por cuenta). Es la herramienta para verificar si algo quedó bien contabilizado.',
      inputSchema: {
        resource: z
          .enum(Object.keys(LIST_RESOURCES) as [ListResource, ...ListResource[]])
          .describe('Tipo de documento o maestro'),
        id: z.number().int().describe('Id del documento'),
        includeJournalEntry: z
          .boolean()
          .optional()
          .describe('Incluir el asiento contable enlazado (default true)'),
      },
      handler: async (args) => {
        const resource = args.resource as ListResource;
        const id = args.id as number;
        const doc = await client.get<Record<string, unknown>>(
          `${LIST_RESOURCES[resource]}/${id}`,
        );
        const includeJe = args.includeJournalEntry !== false;
        const transactionId = doc['transactionId'];
        if (!includeJe || transactionId == null) {
          return json({ resource, id, document: doc });
        }
        const journalEntry = await client.get<Record<string, unknown>>(
          `/journal-entries/${String(transactionId)}`,
        );
        const lines = (journalEntry['lines'] ?? []) as Array<
          Record<string, unknown>
        >;
        const totalDebit = lines.reduce(
          (sum, l) => sum + Number(l['debit'] ?? 0),
          0,
        );
        const totalCredit = lines.reduce(
          (sum, l) => sum + Number(l['credit'] ?? 0),
          0,
        );
        return json({
          resource,
          id,
          document: doc,
          journalEntry: {
            id: journalEntry['id'],
            code: journalEntry['code'],
            status: journalEntry['status'],
            date: journalEntry['date'],
            totalDebit: Math.round(totalDebit * 100) / 100,
            totalCredit: Math.round(totalCredit * 100) / 100,
            isBalanced: Math.abs(totalDebit - totalCredit) < 0.005,
            lines: lines.map((l) => ({
              accountId: l['accountId'],
              accountCode: l['accountCode'] ?? l['accountCode'] ?? null,
              partnerCode: l['partnerCode'] ?? null,
              debit: Number(l['debit'] ?? 0),
              credit: Number(l['credit'] ?? 0),
              description: l['description'] ?? null,
            })),
          },
        });
      },
    },

    {
      name: 'erp_item_stock',
      title: 'Stock de un artículo',
      description:
        'Stock por almacén de un artículo (por id o por código) y, opcionalmente, su kardex de movimientos en un rango de fechas.',
      inputSchema: {
        itemId: z.number().int().optional(),
        code: z.string().optional().describe('Código del artículo (alternativa a itemId)'),
        includeKardex: z.boolean().optional(),
        from: z.string().optional(),
        to: z.string().optional(),
      },
      handler: async (args) => {
        const itemId = await resolveItemId(client, args);
        if (itemId == null) {
          return fail('No se encontró el artículo: indica un itemId o un code válido.');
        }
        const stock = await client.get<unknown>(`/items/${itemId}/stock`);
        const out: Record<string, unknown> = { itemId, stock };
        if (args.includeKardex) {
          out['kardex'] = await client.get<unknown>(
            `/items/${itemId}/kardex`,
            { dateFrom: args.from, dateTo: args.to, limit: maxRowsDefault },
          );
        }
        return json(out);
      },
    },

    {
      name: 'erp_low_stock',
      title: 'Artículos bajo mínimo',
      description:
        'Lista de artículos cuyo stock está por debajo del mínimo configurado (por almacén).',
      inputSchema: {},
      handler: async () => {
        const payload = await client.get<unknown>('/items/low-stock');
        const { rows } = unwrapList<Record<string, unknown>>(payload);
        return json({ returned: rows.length, rows: rows.map(projectRow) });
      },
    },

    {
      name: 'erp_trial_balance',
      title: 'Balance de comprobación',
      description:
        'Balance de sumas y saldos por cuenta en un rango de fechas (saldo inicial, débitos, créditos, saldo final).',
      inputSchema: {
        from: z.string().describe('Fecha desde (YYYY-MM-DD)'),
        to: z.string().describe('Fecha hasta (YYYY-MM-DD)'),
        accountId: z.number().int().optional(),
      },
      handler: async (args) =>
        json(
          await client.get<unknown>('/reports/trial-balance', {
            from: args.from,
            to: args.to,
            accountId: args.accountId,
          }),
        ),
    },

    {
      name: 'erp_account_ledger',
      title: 'Mayor de una cuenta',
      description:
        'Movimientos (libro mayor) de una cuenta contable, por id o por código, con filtro de fechas. Incluye el socio (ShortName) cuando la línea lo tiene.',
      inputSchema: {
        accountId: z.number().int().optional(),
        code: z.string().optional().describe('Código de cuenta, p. ej. 1.1.2.01.001'),
        from: z.string().optional(),
        to: z.string().optional(),
      },
      handler: async (args) => {
        const accountId = await resolveAccountId(client, args);
        if (accountId == null) {
          return fail('No se encontró la cuenta: indica accountId o code.');
        }
        return json({
          accountId,
          ledger: await client.get<unknown>(`/accounts/${accountId}/ledger`, {
            dateFrom: args.from,
            dateTo: args.to,
            limit: maxRowsDefault,
          }),
        });
      },
    },

    {
      name: 'erp_partner_statement',
      title: 'Estado de cuenta de un socio',
      description:
        'Saldo y transacciones de un cliente/proveedor (por id o por código), con paginación completa para que el saldo cuadre.',
      inputSchema: {
        partnerId: z.number().int().optional(),
        code: z.string().optional().describe('Código del socio, p. ej. CLI-00001'),
        limit: z.number().int().min(1).optional(),
      },
      handler: async (args) => {
        const partnerId = await resolvePartnerId(client, args);
        if (partnerId == null) {
          return fail('No se encontró el socio: indica partnerId o code.');
        }
        const limit = clamp(args.limit as number | undefined);
        const [balance, transactions] = await Promise.all([
          client.get<unknown>(`/partners/${partnerId}/balance`),
          client.get<unknown>(`/partners/${partnerId}/transactions`, {
            limit,
          }),
        ]);
        const { rows, total } = unwrapList<Record<string, unknown>>(transactions);
        const page = rows.slice(0, limit);
        return json({
          partnerId,
          balance,
          returned: page.length,
          total: total ?? rows.length,
          transactions: page.map(projectRow),
        });
      },
    },

    {
      name: 'erp_document_series',
      title: 'Series de numeración',
      description:
        'Series configuradas con su prefijo y próximo correlativo, más la vista previa del próximo número por tipo de documento. Sirve para diagnosticar correlativos repetidos.',
      inputSchema: {
        docType: z.string().optional().describe('Tipo de documento para la vista previa'),
      },
      handler: async (args) => {
        const series = await client.get<unknown>('/document-series');
        const out: Record<string, unknown> = { series };
        if (args.docType) {
          out['nextPreview'] = await client.get<unknown>(
            '/document-series/next-preview',
            { docType: args.docType },
          );
        }
        return json(out);
      },
    },

    {
      name: 'erp_withholding_taxes',
      title: 'Tipos de retención configurados',
      description:
        'Tipos de retención (IT/IUE/RC-IVA) con su tasa y sus cuentas contables: `accountId` es el pasivo de cuando retenemos y `receivableAccountId` el activo de cuando nos retienen (retención sufrida en cobros).',
      inputSchema: {},
      handler: async () =>
        json(await client.get<unknown>('/withholding-taxes')),
    },

    {
      name: 'erp_journal_entry',
      title: 'Asiento contable por id',
      description:
        'Asiento contable completo con sus líneas, más el chequeo de cuadre (débitos = créditos).',
      inputSchema: { id: z.number().int() },
      handler: async (args) => {
        const je = await client.get<Record<string, unknown>>(
          `/journal-entries/${String(args.id)}`,
        );
        const lines = (je['lines'] ?? []) as Array<Record<string, unknown>>;
        const totalDebit = lines.reduce(
          (sum, l) => sum + Number(l['debit'] ?? 0),
          0,
        );
        const totalCredit = lines.reduce(
          (sum, l) => sum + Number(l['credit'] ?? 0),
          0,
        );
        return json({
          id: je['id'],
          code: je['code'],
          status: je['status'],
          date: je['date'],
          sourceDocumentType: je['sourceDocumentType'],
          sourceDocumentId: je['sourceDocumentId'],
          totalDebit: Math.round(totalDebit * 100) / 100,
          totalCredit: Math.round(totalCredit * 100) / 100,
          isBalanced: Math.abs(totalDebit - totalCredit) < 0.005,
          lines: lines.map(projectRow),
        });
      },
    },

    {
      name: 'erp_report',
      title: 'Reporte del ERP por nombre',
      description:
        'Ejecuta un reporte de solo lectura por su nombre técnico (trial-balance, general-ledger, journal, sales, purchases, stock-valuation, partner-balance, aging, item-profitability, stock-rotation, batch-expiry, early-payment-discounts, sales-ledger, purchase-ledger).',
      inputSchema: {
        report: z.string().describe('Nombre técnico del reporte'),
        from: z.string().optional(),
        to: z.string().optional(),
        partnerId: z.number().int().optional(),
        itemId: z.number().int().optional(),
        accountId: z.number().int().optional(),
      },
      handler: async (args) => {
        const report = String(args.report);
        if (!/^[a-z][a-z-]{2,40}$/.test(report)) {
          return fail('Nombre de reporte inválido.');
        }
        const payload = await client.get<unknown>(`/reports/${report}`, {
          from: args.from,
          to: args.to,
          partnerId: args.partnerId,
          itemId: args.itemId,
          accountId: args.accountId,
          limit: maxRowsDefault,
        });
        const { rows } = unwrapList<Record<string, unknown>>(payload);
        if (rows.length > 0) {
          const page = rows.slice(0, maxRowsDefault);
          return json({
            report,
            returned: page.length,
            rows: page.map(projectRow),
          });
        }
        return json({ report, result: payload });
      },
    },
  ];
}

async function resolveItemId(
  client: ErpClient,
  args: Record<string, unknown>,
): Promise<number | null> {
  if (typeof args.itemId === 'number') return args.itemId;
  if (typeof args.code !== 'string') return null;
  const payload = await client.get<unknown>('/items', {
    search: args.code,
    limit: 5,
  });
  const { rows } = unwrapList<Record<string, unknown>>(payload);
  const exact = rows.find(
    (r) => String(r['code']).toLowerCase() === args.code!.toString().toLowerCase(),
  );
  const found = exact ?? rows[0];
  return found ? Number(found['id']) : null;
}

async function resolveAccountId(
  client: ErpClient,
  args: Record<string, unknown>,
): Promise<number | null> {
  if (typeof args.accountId === 'number') return args.accountId;
  if (typeof args.code !== 'string') return null;
  const payload = await client.get<unknown>('/accounts', {
    search: args.code,
    limit: 20,
  });
  const { rows } = unwrapList<Record<string, unknown>>(payload);
  const exact = rows.find((r) => String(r['code']) === args.code);
  const found = exact ?? rows[0];
  return found ? Number(found['id']) : null;
}

async function resolvePartnerId(
  client: ErpClient,
  args: Record<string, unknown>,
): Promise<number | null> {
  if (typeof args.partnerId === 'number') return args.partnerId;
  if (typeof args.code !== 'string') return null;
  const payload = await client.get<unknown>('/partners', {
    search: args.code,
    limit: 5,
  });
  const { rows } = unwrapList<Record<string, unknown>>(payload);
  const exact = rows.find(
    (r) => String(r['code']).toLowerCase() === args.code!.toString().toLowerCase(),
  );
  const found = exact ?? rows[0];
  return found ? Number(found['id']) : null;
}
