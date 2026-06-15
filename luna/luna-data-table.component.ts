import { Component, Input, Output, EventEmitter, ContentChildren, QueryList, TemplateRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

export interface TableColumn {
  key: string;
  header: string;
  width?: string;
  sortable?: boolean;
  editable?: boolean;
  type?: 'text' | 'number' | 'date' | 'select' | 'currency' | 'badge';
  align?: 'left' | 'center' | 'right';
  options?: { label: string; value: any }[];
  format?: (value: any) => string;
  frozen?: boolean;
}

export interface TableRow {
  [key: string]: any;
  _selected?: boolean;
  _editing?: boolean;
  _original?: any;
}

@Component({
  selector: 'luna-data-table',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="luna-table-wrapper">
      <!-- Batch Actions Bar -->
      <div *ngIf="selectedCount > 0" class="luna-table__batch-bar" [@slideDown]>
        <span class="luna-table__batch-count">{{ selectedCount }} seleccionados</span>
        <div class="luna-table__batch-actions">
          <ng-content select="[batchActions]"></ng-content>
        </div>
        <button class="luna-table__batch-clear" (click)="clearSelection()">
          <i class="fas fa-times"></i> Limpiar
        </button>
      </div>

      <!-- Table Container -->
      <div class="luna-table__container" [class.luna-table__container--loading]="loading">
        <table class="luna-table">
          <!-- Header -->
          <thead class="luna-table__head">
            <tr>
              <!-- Checkbox header -->
              <th *ngIf="selectable" class="luna-table__th luna-table__th--checkbox">
                <luna-checkbox
                  [checked]="allSelected"
                  [indeterminate]="someSelected"
                  (changed)="toggleAll($event)"
                ></luna-checkbox>
              </th>

              <!-- Column headers -->
              <th
                *ngFor="let col of columns"
                class="luna-table__th"
                [class.luna-table__th--sortable]="col.sortable"
                [class.luna-table__th--frozen]="col.frozen"
                [style.width]="col.width"
                [style.text-align]="col.align"
                (click)="col.sortable ? sort(col.key) : null"
              >
                <div class="luna-table__th-content">
                  <span>{{ col.header }}</span>
                  <span *ngIf="col.sortable" class="luna-table__sort-icon">
                    <i *ngIf="sortKey !== col.key" class="fas fa-sort text-tertiary"></i>
                    <i *ngIf="sortKey === col.key && sortDir === 'asc'" class="fas fa-sort-up text-accent"></i>
                    <i *ngIf="sortKey === col.key && sortDir === 'desc'" class="fas fa-sort-down text-accent"></i>
                  </span>
                </div>
              </th>

              <!-- Actions column -->
              <th *ngIf="hasRowActions" class="luna-table__th luna-table__th--actions"></th>
            </tr>
          </thead>

          <!-- Body -->
          <tbody class="luna-table__body">
            <!-- Loading skeleton -->
            <tr *ngIf="loading" class="luna-table__skeleton-row">
              <td [attr.colspan]="totalColumns" class="luna-table__skeleton-cell">
                <div *ngFor="let i of [1,2,3,4,5]" class="luna-table__skeleton-line">
                  <luna-skeleton variant="text" height="12px"></luna-skeleton>
                </div>
              </td>
            </tr>

            <!-- Empty state -->
            <tr *ngIf="!loading && data.length === 0" class="luna-table__empty-row">
              <td [attr.colspan]="totalColumns" class="luna-table__empty-cell">
                <div class="luna-table__empty-state">
                  <i class="fas fa-inbox"></i>
                  <p>No hay datos disponibles</p>
                </div>
              </td>
            </tr>

            <!-- Data rows -->
            <tr
              *ngFor="let row of data; let i = index"
              class="luna-table__row"
              [class.luna-table__row--selected]="row._selected"
              [class.luna-table__row--hover]="hoverRow === i"
              [class.luna-table__row--editing]="row._editing"
              (mouseenter)="hoverRow = i"
              (mouseleave)="hoverRow = -1"
            >
              <!-- Checkbox -->
              <td *ngIf="selectable" class="luna-table__td luna-table__td--checkbox">
                <luna-checkbox
                  [checked]="row._selected"
                  (changed)="toggleRow(row, $event)"
                ></luna-checkbox>
              </td>

              <!-- Cells -->
              <td
                *ngFor="let col of columns"
                class="luna-table__td"
                [class.luna-table__td--frozen]="col.frozen"
                [class.luna-table__td--editable]="col.editable"
                [class.luna-table__td--editing]="row._editing && col.editable"
                [style.text-align]="col.align"
                (click)="col.editable ? startEdit(row, col) : null"
              >
                <!-- View mode -->
                <ng-container *ngIf="!row._editing || !col.editable">
                  <span *ngIf="col.type === 'badge'" class="luna-table__badge">
                    <luna-badge [variant]="getBadgeVariant(row[col.key])">
                      {{ formatValue(row[col.key], col) }}
                    </luna-badge>
                  </span>
                  <span
                    *ngIf="col.type !== 'badge'"
                    class="luna-table__cell-value"
                    [class.luna-table__cell-value--numeric]="col.type === 'number' || col.type === 'currency'"
                  >
                    {{ formatValue(row[col.key], col) }}
                  </span>
                </ng-container>

                <!-- Edit mode -->
                <ng-container *ngIf="row._editing && col.editable">
                  <input
                    *ngIf="col.type === 'text' || col.type === 'number' || col.type === 'currency'"
                    class="luna-table__edit-input"
                    [type]="col.type === 'number' || col.type === 'currency' ? 'number' : 'text'"
                    [value]="row[col.key]"
                    (blur)="saveEdit(row, col, $event)"
                    (keydown.enter)="saveEdit(row, col, $event)"
                    (keydown.escape)="cancelEdit(row)"
                    #editInput
                    autofocus
                  />
                  <select
                    *ngIf="col.type === 'select'"
                    class="luna-table__edit-select"
                    [value]="row[col.key]"
                    (change)="saveEdit(row, col, $event)"
                  >
                    <option *ngFor="let opt of col.options" [value]="opt.value">{{ opt.label }}</option>
                  </select>
                </ng-container>
              </td>

              <!-- Row actions -->
              <td *ngIf="hasRowActions" class="luna-table__td luna-table__td--actions">
                <div class="luna-table__actions" [class.luna-table__actions--visible]="hoverRow === i || row._editing">
                  <ng-content select="[rowActions]"></ng-content>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Footer / Pagination -->
      <div *ngIf="showPagination" class="luna-table__footer">
        <span class="luna-table__info">
          Mostrando {{ startRow }} - {{ endRow }} de {{ totalRows }} resultados
        </span>
        <div class="luna-table__pagination">
          <button
            class="luna-table__page-btn"
            [disabled]="currentPage === 1"
            (click)="prevPage()"
          >
            <i class="fas fa-chevron-left"></i>
          </button>
          <span class="luna-table__page-info">Página {{ currentPage }} de {{ totalPages }}</span>
          <button
            class="luna-table__page-btn"
            [disabled]="currentPage === totalPages"
            (click)="nextPage()"
          >
            <i class="fas fa-chevron-right"></i>
          </button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .luna-table-wrapper {
      display: flex;
      flex-direction: column;
      width: 100%;
      background: var(--bg-base);
      border: 1px solid var(--border-default);
      border-radius: var(--radius-xl);
      overflow: hidden;
      box-shadow: var(--shadow-sm);
    }

    /* Batch Actions Bar */
    .luna-table__batch-bar {
      display: flex;
      align-items: center;
      gap: var(--space-4);
      padding: var(--space-3) var(--space-5);
      background: var(--neutral-800);
      color: var(--text-inverse);
      border-radius: var(--radius-lg);
      margin: var(--space-3);
    }

    .luna-table__batch-count {
      font-size: var(--text-sm);
      font-weight: var(--fw-medium);
    }

    .luna-table__batch-actions {
      display: flex;
      gap: var(--space-2);
      flex: 1;
    }

    .luna-table__batch-clear {
      display: flex;
      align-items: center;
      gap: var(--space-2);
      background: none;
      border: none;
      color: var(--text-inverse);
      font-size: var(--text-sm);
      cursor: pointer;
      opacity: 0.7;
      transition: opacity var(--transition-fast);
    }

    .luna-table__batch-clear:hover {
      opacity: 1;
    }

    /* Table Container */
    .luna-table__container {
      overflow-x: auto;
      overflow-y: hidden;
    }

    .luna-table__container--loading {
      pointer-events: none;
    }

    /* Table */
    .luna-table {
      width: 100%;
      border-collapse: separate;
      border-spacing: 0;
      font-family: var(--font-sans);
      font-size: var(--text-sm);
    }

    /* Header */
    .luna-table__head {
      position: sticky;
      top: 0;
      z-index: var(--z-sticky);
    }

    .luna-table__th {
      padding: var(--space-3) var(--space-4);
      font-size: var(--text-xs);
      font-weight: var(--fw-semibold);
      text-transform: uppercase;
      letter-spacing: 0.04em;
      color: var(--text-secondary);
      background: var(--bg-surface);
      border-bottom: 1px solid var(--border-default);
      white-space: nowrap;
      text-align: left;
      transition: background var(--transition-fast);
    }

    .luna-table__th--sortable {
      cursor: pointer;
      user-select: none;
    }

    .luna-table__th--sortable:hover {
      color: var(--text-primary);
      background: var(--bg-hover);
    }

    .luna-table__th-content {
      display: flex;
      align-items: center;
      gap: var(--space-2);
    }

    .luna-table__sort-icon {
      font-size: 12px;
      transition: color var(--transition-fast);
    }

    .luna-table__th--checkbox {
      width: 48px;
      text-align: center;
    }

    .luna-table__th--frozen {
      position: sticky;
      left: 0;
      z-index: calc(var(--z-sticky) + 1);
      box-shadow: 2px 0 4px rgba(0,0,0,0.05);
    }

    /* Body */
    .luna-table__body {
      background: var(--bg-base);
    }

    .luna-table__row {
      transition: all var(--transition-fast);
    }

    .luna-table__row:hover {
      background: var(--bg-hover);
    }

    .luna-table__row--selected {
      background: var(--bg-selected) !important;
    }

    .luna-table__row--editing {
      background: var(--accent-50) !important;
    }

    .luna-table__td {
      padding: var(--space-3) var(--space-4);
      border-bottom: 1px solid var(--border-subtle);
      color: var(--text-primary);
      transition: all var(--transition-fast);
      vertical-align: middle;
    }

    .luna-table__td--checkbox {
      width: 48px;
      text-align: center;
    }

    .luna-table__td--editable {
      cursor: pointer;
      border-bottom: 1px dashed var(--border-subtle);
    }

    .luna-table__td--editable:hover {
      border-bottom-color: var(--border-accent);
    }

    .luna-table__td--editing {
      padding: var(--space-1) var(--space-2);
      background: var(--bg-base);
    }

    .luna-table__td--frozen {
      position: sticky;
      left: 0;
      background: var(--bg-base);
      z-index: 1;
      box-shadow: 2px 0 4px rgba(0,0,0,0.05);
    }

    .luna-table__row--selected .luna-table__td--frozen {
      background: var(--bg-selected);
    }

    .luna-table__cell-value {
      display: block;
    }

    .luna-table__cell-value--numeric {
      font-family: var(--font-numeric);
      font-variant-numeric: var(--font-variant-numeric);
      text-align: right;
    }

    /* Edit inputs */
    .luna-table__edit-input,
    .luna-table__edit-select {
      width: 100%;
      padding: var(--space-2) var(--space-3);
      border: 1px solid var(--border-focus);
      border-radius: var(--radius-md);
      background: var(--bg-base);
      color: var(--text-primary);
      font-family: var(--font-sans);
      font-size: var(--text-sm);
      outline: none;
      box-shadow: var(--glow-accent);
    }

    .luna-table__edit-input:focus,
    .luna-table__edit-select:focus {
      border-color: var(--border-focus);
    }

    /* Row actions */
    .luna-table__td--actions {
      width: 1px;
      white-space: nowrap;
    }

    .luna-table__actions {
      display: flex;
      gap: var(--space-1);
      opacity: 0;
      transition: opacity var(--transition-fast);
    }

    .luna-table__actions--visible {
      opacity: 1;
    }

    .luna-table__row:hover .luna-table__actions {
      opacity: 1;
    }

    /* Skeleton */
    .luna-table__skeleton-cell {
      padding: var(--space-4);
    }

    .luna-table__skeleton-line {
      margin-bottom: var(--space-3);
    }

    .luna-table__skeleton-line:last-child {
      margin-bottom: 0;
    }

    /* Empty state */
    .luna-table__empty-cell {
      padding: var(--space-12) var(--space-6);
    }

    .luna-table__empty-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: var(--space-3);
      color: var(--text-tertiary);
    }

    .luna-table__empty-state i {
      font-size: 48px;
      opacity: 0.5;
    }

    .luna-table__empty-state p {
      font-size: var(--text-sm);
      margin: 0;
    }

    /* Footer */
    .luna-table__footer {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: var(--space-3) var(--space-5);
      border-top: 1px solid var(--border-default);
      background: var(--bg-surface);
    }

    .luna-table__info {
      font-size: var(--text-sm);
      color: var(--text-secondary);
    }

    .luna-table__pagination {
      display: flex;
      align-items: center;
      gap: var(--space-3);
    }

    .luna-table__page-btn {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 32px;
      height: 32px;
      background: var(--bg-base);
      border: 1px solid var(--border-default);
      border-radius: var(--radius-md);
      color: var(--text-secondary);
      cursor: pointer;
      transition: all var(--transition-fast);
    }

    .luna-table__page-btn:hover:not(:disabled) {
      background: var(--bg-hover);
      border-color: var(--border-strong);
      color: var(--text-primary);
    }

    .luna-table__page-btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .luna-table__page-info {
      font-size: var(--text-sm);
      color: var(--text-secondary);
      font-weight: var(--fw-medium);
    }

    /* Badge in cell */
    .luna-table__badge {
      display: inline-flex;
    }
  `]
})
export class LunaDataTableComponent {
  @Input() columns: TableColumn[] = [];
  @Input() data: TableRow[] = [];
  @Input() loading = false;
  @Input() selectable = true;
  @Input() hasRowActions = false;
  @Input() showPagination = true;
  @Input() pageSize = 10;
  @Input() currentPage = 1;
  @Input() totalRows = 0;

  @Output() sortChange = new EventEmitter<{ key: string; direction: 'asc' | 'desc' }>();
  @Output() selectionChange = new EventEmitter<TableRow[]>();
  @Output() editSave = new EventEmitter<{ row: TableRow; column: TableColumn; value: any }>();
  @Output() pageChange = new EventEmitter<number>();

  sortKey = '';
  sortDir: 'asc' | 'desc' = 'asc';
  hoverRow = -1;
  editingRow: TableRow | null = null;

  get allSelected(): boolean {
    return this.data.length > 0 && this.data.every(r => r._selected);
  }

  get someSelected(): boolean {
    return this.data.some(r => r._selected) && !this.allSelected;
  }

  get selectedCount(): number {
    return this.data.filter(r => r._selected).length;
  }

  get totalColumns(): number {
    let count = this.columns.length;
    if (this.selectable) count++;
    if (this.hasRowActions) count++;
    return count;
  }

  get startRow(): number {
    return (this.currentPage - 1) * this.pageSize + 1;
  }

  get endRow(): number {
    return Math.min(this.currentPage * this.pageSize, this.totalRows);
  }

  get totalPages(): number {
    return Math.ceil(this.totalRows / this.pageSize);
  }

  sort(key: string): void {
    if (this.sortKey === key) {
      this.sortDir = this.sortDir === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortKey = key;
      this.sortDir = 'asc';
    }
    this.sortChange.emit({ key: this.sortKey, direction: this.sortDir });
  }

  toggleAll(checked: boolean): void {
    this.data.forEach(row => row._selected = checked);
    this.emitSelection();
  }

  toggleRow(row: TableRow, checked: boolean): void {
    row._selected = checked;
    this.emitSelection();
  }

  clearSelection(): void {
    this.data.forEach(row => row._selected = false);
    this.emitSelection();
  }

  private emitSelection(): void {
    this.selectionChange.emit(this.data.filter(r => r._selected));
  }

  startEdit(row: TableRow, col: TableColumn): void {
    if (!col.editable || row._editing) return;

    // Cancel any other editing
    this.data.forEach(r => {
      if (r._editing) this.cancelEdit(r);
    });

    row._original = { ...row };
    row._editing = true;
    this.editingRow = row;
  }

  saveEdit(row: TableRow, col: TableColumn, event: Event): void {
    const target = event.target as HTMLInputElement | HTMLSelectElement;
    let value: any = target.value;

    if (col.type === 'number' || col.type === 'currency') {
      value = parseFloat(value);
    }

    row[col.key] = value;
    row._editing = false;
    this.editingRow = null;

    this.editSave.emit({ row, column: col, value });
  }

  cancelEdit(row: TableRow): void {
    if (row._original) {
      Object.assign(row, row._original);
      delete row._original;
    }
    row._editing = false;
    this.editingRow = null;
  }

  formatValue(value: any, col: TableColumn): string {
    if (value == null) return '-';
    if (col.format) return col.format(value);

    switch (col.type) {
      case 'currency':
        return new Intl.NumberFormat('es-PE', { style: 'currency', currency: 'PEN' }).format(value);
      case 'date':
        return new Date(value).toLocaleDateString('es-PE');
      default:
        return String(value);
    }
  }

  getBadgeVariant(value: any): string {
    const variants: Record<string, string> = {
      'active': 'success',
      'inactive': 'neutral',
      'pending': 'warning',
      'error': 'error',
      'completed': 'success'
    };
    return variants[String(value).toLowerCase()] || 'default';
  }

  prevPage(): void {
    if (this.currentPage > 1) {
      this.pageChange.emit(this.currentPage - 1);
    }
  }

  nextPage(): void {
    if (this.currentPage < this.totalPages) {
      this.pageChange.emit(this.currentPage + 1);
    }
  }
}