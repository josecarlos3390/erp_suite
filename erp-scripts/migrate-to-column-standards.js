#!/usr/bin/env node

/**
 * Script de migración a sistema centralizado de columnas
 * Mueve documentos de anchos hardcodeados a factory functions centralizadas
 *
 * Uso: node scripts/migrate-to-column-standards.js
 */

const fs = require('fs');
const path = require('path');

const BASE_PATH = path.join(__dirname, '../erp-frontend/src/app/pages');

// Mapeo de archivos a migrar
const FILES_TO_MIGRATE = {
  // Ventas - LunaDocumentLineDetailColumn
  sales: [
    'sales-quotations/sales-quotations-form.component.ts',
    'delivery-orders/delivery-orders-form.component.ts',
    'sales-credit-notes/sales-credit-notes-form.component.ts',
    'sales-returns/sales-returns-form.component.ts',
  ],
  // Compras - LunaColumn
  purchases: [
    'purchase-receipts/purchase-receipts-form.component.ts',
    'purchase-reserve-invoices/purchase-reserve-invoices-form.component.ts',
    'purchase-credit-notes/purchase-credit-notes-form.component.ts',
    'purchase-returns/purchase-returns-form.component.ts',
  ],
};

// Patrones de reemplazo para ventas (lineDetailColumns)
const SALES_PATTERNS = [
  {
    description: 'Importar funciones de column-standards',
    pattern: /import \{ uomCodeForItem \} from '@shared\/document-form\/document-form\.utils';/,
    replacement: `import { uomCodeForItem } from '@shared/document-form/document-form.utils';
import {
  createItemDetailColumn,
  createWarehouseDetailColumn,
  createBatchDetailColumn,
  createSerialDetailColumn,
  LINE_WIDTHS,
} from '@shared/document-line/column-standards';`,
  },
  {
    description: 'Reemplazar item column con función',
    pattern: /\{ key: 'item', label: 'Artículo', cell: 'item', mobileFullWidth: true, minWidth: '380px' \}/,
    replacement: 'createItemDetailColumn(),',
  },
  {
    description: 'Reemplazar warehouse column con función',
    pattern: /\{[\s\S]*?key: 'warehouse',[\s\S]*?label: 'Almacén',[\s\S]*?cell: 'warehouse',[\s\S]*?minWidth: '320px',[\s\S]*?mobileFullWidth: true,[\s\S]*?\}/,
    replacement: 'createWarehouseDetailColumn(),',
  },
  {
    description: 'Reemplazar batch column con función',
    pattern: /\{[\s\S]*?key: 'batch',[\s\S]*?label: 'Lote',[\s\S]*?cell: 'batch',[\s\S]*?mobileFullWidth: true[\s\S]*?\}/,
    replacement: 'createBatchDetailColumn(),',
  },
  {
    description: 'Reemplazar serial column con función',
    pattern: /\{[\s\S]*?key: 'serial',[\s\S]*?label: 'Serie',[\s\S]*?cell: 'serial',[\s\S]*?mobileFullWidth: true[\s\S]*?\}/,
    replacement: 'createSerialDetailColumn(),',
  },
];

// Patrones de reemplazo para compras (detailColumns)
const PURCHASE_PATTERNS = [
  {
    description: 'Importar funciones de column-standards',
    pattern: /import \{ uomCodeForItem \} from '@shared\/document-form\/document-form\.utils';/,
    replacement: `import { uomCodeForItem } from '@shared/document-form/document-form.utils';
import {
  createItemColumn,
  createWarehouseColumn,
  createBatchColumn,
  createSerialColumn,
  createQuantityColumn,
  createUomColumn,
  createProjectColumn,
  LINE_WIDTHS,
} from '@shared/document-line/column-standards';`,
  },
  {
    description: 'Reemplazar item column con función',
    pattern: /\{[\s\S]*?key: 'item',[\s\S]*?label: 'Artículo',[\s\S]*?type: 'custom',[\s\S]*?mobileFullWidth: true,[\s\S]*?minWidth: '380px'[\s\S]*?\}/,
    replacement: 'createItemColumn(),',
  },
  {
    description: 'Reemplazar warehouse column con función',
    pattern: /\{[\s\S]*?key: 'warehouse',[\s\S]*?label: 'Almacén',[\s\S]*?type: 'custom',[\s\S]*?minWidth: '320px',[\s\S]*?mobileFullWidth: true,[\s\S]*?\}/,
    replacement: 'createWarehouseColumn(),',
  },
  {
    description: 'Reemplazar batch column con función',
    pattern: /\{[\s\S]*?key: 'batch',[\s\S]*?label: 'Lote',[\s\S]*?type: 'custom',[\s\S]*?mobileFullWidth: true,[\s\S]*?minWidth: '160px'[\s\S]*?\}/,
    replacement: 'createBatchColumn(),',
  },
  {
    description: 'Reemplazar serial column con función',
    pattern: /\{[\s\S]*?key: 'serial',[\s\S]*?label: 'Serie',[\s\S]*?type: 'custom',[\s\S]*?mobileFullWidth: true,[\s\S]*?minWidth: '160px'[\s\S]*?\}/,
    replacement: 'createSerialColumn(),',
  },
  {
    description: 'Reemplazar quantity column con función',
    pattern: /\{[\s\S]*?key: 'quantity',[\s\S]*?label: '[\w\s.]+',[\s\S]*?type: 'custom',[\s\S]*?minWidth: '100px'[\s\S]*?\}/,
    replacement: 'createQuantityColumn({ label: \'$1\' }),',
  },
  {
    description: 'Reemplazar uom column con función',
    pattern: /\{[\s\S]*?key: 'uom',[\s\S]*?label: 'UOM',[\s\S]*?type: 'custom',[\s\S]*?minWidth: '80px'[\s\S]*?\}/,
    replacement: 'createUomColumn(),',
  },
];

/**
 * Aplica patrones de reemplazo a un archivo
 */
function migrateFile(filePath, patterns) {
  let content = fs.readFileSync(filePath, 'utf8');
  let modified = false;

  for (const { description, pattern, replacement } of patterns) {
    if (pattern.test(content)) {
      console.log(`  ✓ ${description}`);
      content = content.replace(pattern, replacement);
      modified = true;
    }
  }

  if (modified) {
    fs.writeFileSync(filePath, content, 'utf8');
    return true;
  }
  return false;
}

/**
 * Función principal
 */
function main() {
  console.log('🔄 Migración a sistema centralizado de columnas');
  console.log('=====================================\n');

  let totalModified = 0;

  // Migrar ventas
  console.log('📦 Migrando documentos de VENTAS...');
  for (const file of FILES_TO_MIGRATE.sales) {
    const filePath = path.join(BASE_PATH, file);
    if (fs.existsSync(filePath)) {
      console.log(`  ${file}`);
      if (migrateFile(filePath, SALES_PATTERNS)) {
        totalModified++;
        console.log(`    ✅ Migrado\n`);
      } else {
        console.log(`    ⚠️  No requirió cambios\n`);
      }
    } else {
      console.log(`    ❌ Archivo no encontrado\n`);
    }
  }

  // Migrar compras
  console.log('\n📦 Migrando documentos de COMPRAS...');
  for (const file of FILES_TO_MIGRATE.purchases) {
    const filePath = path.join(BASE_PATH, file);
    if (fs.existsSync(filePath)) {
      console.log(`  ${file}`);
      if (migrateFile(filePath, PURCHASE_PATTERNS)) {
        totalModified++;
        console.log(`    ✅ Migrado\n`);
      } else {
        console.log(`    ⚠️  No requirió cambios\n`);
      }
    } else {
      console.log(`    ❌ Archivo no encontrado\n`);
    }
  }

  console.log('\n=====================================');
  console.log(`📊 Resumen:`);
  console.log(`   Archivos modificados: ${totalModified}`);
  console.log(`   Archivos procesados: ${FILES_TO_MIGRATE.sales.length + FILES_TO_MIGRATE.purchases.length}`);
  console.log('\n✅ Migración completada - Sistema centralizado aplicado');
}

// Ejecutar si se llama directamente
if (require.main === module) {
  main();
}

module.exports = { migrateFile, main };
