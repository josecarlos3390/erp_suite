import { Component, Input, Output, EventEmitter, HostListener, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

export interface CommandItem {
  id: string;
  title: string;
  subtitle?: string;
  icon: string;
  shortcut?: string;
  section?: string;
  keywords?: string[];
  action: () => void;
}

@Component({
  selector: 'luna-command-palette',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div *ngIf="isOpen" class="luna-cmd" role="dialog" aria-modal="true">
      <!-- Backdrop -->
      <div class="luna-cmd__backdrop" (click)="close()" [@fadeIn]></div>

      <!-- Panel -->
      <div class="luna-cmd__panel" [@scaleIn]>
        <!-- Search -->
        <div class="luna-cmd__search">
          <i class="fas fa-search luna-cmd__search-icon"></i>
          <input
            #searchInput
            type="text"
            class="luna-cmd__input"
            placeholder="Buscar comandos, páginas, registros..."
            [(ngModel)]="query"
            (input)="filter()"
            (keydown)="onKeydown($event)"
            autofocus
          />
          <kbd class="luna-cmd__shortcut">ESC</kbd>
        </div>

        <!-- Results -->
        <div class="luna-cmd__results" role="listbox">
          <!-- Empty state -->
          <div *ngIf="filteredItems.length === 0 && query" class="luna-cmd__empty">
            <i class="fas fa-search"></i>
            <p>No se encontraron resultados para "{{ query }}"</p>
          </div>

          <!-- Sections -->
          <div *ngFor="let section of sections" class="luna-cmd__section">
            <div class="luna-cmd__section-header">{{ section.name }}</div>

            <button
              *ngFor="let item of section.items; let i = index"
              class="luna-cmd__item"
              [class.luna-cmd__item--active]="activeItem === item"
              [attr.aria-selected]="activeItem === item"
              role="option"
              (click)="execute(item)"
              (mouseenter)="activeItem = item"
            >
              <div class="luna-cmd__item-icon">
                <i [class]="item.icon"></i>
              </div>
              <div class="luna-cmd__item-content">
                <div class="luna-cmd__item-title" [innerHTML]="highlightMatch(item.title)"></div>
                <div *ngIf="item.subtitle" class="luna-cmd__item-subtitle" [innerHTML]="highlightMatch(item.subtitle)"></div>
              </div>
              <div *ngIf="item.shortcut" class="luna-cmd__item-shortcut">
                <kbd>{{ item.shortcut }}</kbd>
              </div>
            </button>
          </div>
        </div>

        <!-- Footer -->
        <div class="luna-cmd__footer">
          <div class="luna-cmd__hints">
            <span><kbd>↑↓</kbd> Navegar</span>
            <span><kbd>↵</kbd> Seleccionar</span>
            <span><kbd>ESC</kbd> Cerrar</span>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .luna-cmd {
      position: fixed;
      inset: 0;
      z-index: var(--z-modal);
      display: flex;
      align-items: flex-start;
      justify-content: center;
      padding-top: 15vh;
    }

    .luna-cmd__backdrop {
      position: fixed;
      inset: 0;
      background: rgba(10, 10, 15, 0.5);
      backdrop-filter: blur(8px);
    }

    .luna-cmd__panel {
      position: relative;
      width: 100%;
      max-width: 640px;
      max-height: 70vh;
      display: flex;
      flex-direction: column;
      background: var(--glass-bg);
      backdrop-filter: var(--glass-backdrop);
      border: 1px solid var(--glass-border);
      border-radius: var(--radius-2xl);
      box-shadow: var(--shadow-xl);
      overflow: hidden;
    }

    /* Search */
    .luna-cmd__search {
      display: flex;
      align-items: center;
      gap: var(--space-3);
      padding: var(--space-4) var(--space-5);
      border-bottom: 1px solid var(--border-subtle);
      flex-shrink: 0;
    }

    .luna-cmd__search-icon {
      color: var(--text-tertiary);
      font-size: 18px;
    }

    .luna-cmd__input {
      flex: 1;
      background: none;
      border: none;
      font-family: var(--font-sans);
      font-size: var(--text-lg);
      font-weight: var(--fw-medium);
      color: var(--text-primary);
      outline: none;
    }

    .luna-cmd__input::placeholder {
      color: var(--text-tertiary);
    }

    .luna-cmd__shortcut {
      font-size: var(--text-2xs);
      padding: var(--space-1) var(--space-2);
      background: var(--bg-surface);
      border: 1px solid var(--border-default);
      border-radius: var(--radius-sm);
      color: var(--text-tertiary);
      font-family: var(--font-mono);
    }

    /* Results */
    .luna-cmd__results {
      flex: 1;
      overflow-y: auto;
      padding: var(--space-2);
    }

    .luna-cmd__section {
      margin-bottom: var(--space-2);
    }

    .luna-cmd__section-header {
      padding: var(--space-2) var(--space-4);
      font-size: var(--text-2xs);
      font-weight: var(--fw-semibold);
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--text-tertiary);
    }

    .luna-cmd__item {
      display: flex;
      align-items: center;
      gap: var(--space-3);
      width: 100%;
      padding: var(--space-3) var(--space-4);
      background: none;
      border: none;
      border-radius: var(--radius-lg);
      cursor: pointer;
      text-align: left;
      transition: all var(--transition-fast);
    }

    .luna-cmd__item:hover,
    .luna-cmd__item--active {
      background: var(--bg-hover);
    }

    .luna-cmd__item--active {
      background: var(--bg-selected);
    }

    .luna-cmd__item-icon {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 32px;
      height: 32px;
      border-radius: var(--radius-md);
      background: var(--bg-surface);
      color: var(--text-secondary);
      font-size: 14px;
      flex-shrink: 0;
    }

    .luna-cmd__item-content {
      flex: 1;
      min-width: 0;
    }

    .luna-cmd__item-title {
      font-size: var(--text-sm);
      font-weight: var(--fw-medium);
      color: var(--text-primary);
      line-height: var(--lh-sm);
    }

    .luna-cmd__item-title ::ng-deep mark {
      background: var(--accent-200);
      color: var(--accent-800);
      border-radius: var(--radius-sm);
      padding: 0 2px;
    }

    .luna-cmd__item-subtitle {
      font-size: var(--text-xs);
      color: var(--text-tertiary);
      margin-top: var(--space-0-5);
      line-height: var(--lh-xs);
    }

    .luna-cmd__item-shortcut kbd {
      font-size: var(--text-2xs);
      padding: var(--space-1) var(--space-2);
      background: var(--bg-surface);
      border: 1px solid var(--border-default);
      border-radius: var(--radius-sm);
      color: var(--text-tertiary);
      font-family: var(--font-mono);
    }

    /* Empty state */
    .luna-cmd__empty {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: var(--space-3);
      padding: var(--space-10) var(--space-6);
      color: var(--text-tertiary);
    }

    .luna-cmd__empty i {
      font-size: 32px;
    }

    .luna-cmd__empty p {
      font-size: var(--text-sm);
      margin: 0;
    }

    /* Footer */
    .luna-cmd__footer {
      padding: var(--space-3) var(--space-5);
      border-top: 1px solid var(--border-subtle);
      background: var(--bg-surface);
      flex-shrink: 0;
    }

    .luna-cmd__hints {
      display: flex;
      align-items: center;
      gap: var(--space-4);
      font-size: var(--text-xs);
      color: var(--text-tertiary);
    }

    .luna-cmd__hints kbd {
      font-size: var(--text-2xs);
      padding: var(--space-1) var(--space-2);
      background: var(--bg-base);
      border: 1px solid var(--border-default);
      border-radius: var(--radius-sm);
      font-family: var(--font-mono);
    }

    /* Mobile */
    @media (max-width: 640px) {
      .luna-cmd {
        padding: var(--space-4);
        align-items: center;
      }

      .luna-cmd__panel {
        max-height: 80vh;
      }
    }
  `]
})
export class LunaCommandPaletteComponent {
  @Input() items: CommandItem[] = [];
  @Input() placeholder = 'Buscar comandos, páginas, registros...';

  @Output() opened = new EventEmitter<void>();
  @Output() closed = new EventEmitter<void>();
  @Output() executed = new EventEmitter<CommandItem>();

  @ViewChild('searchInput') searchInput!: ElementRef<HTMLInputElement>;

  isOpen = false;
  query = '';
  filteredItems: CommandItem[] = [];
  activeItem: CommandItem | null = null;

  @HostListener('document:keydown', ['$event'])
  onDocumentKeydown(event: KeyboardEvent): void {
    if ((event.metaKey || event.ctrlKey) && event.key === 'k') {
      event.preventDefault();
      this.toggle();
    }
    if (event.key === 'Escape' && this.isOpen) {
      this.close();
    }
  }

  toggle(): void {
    this.isOpen ? this.close() : this.open();
  }

  open(): void {
    this.isOpen = true;
    this.query = '';
    this.filter();
    this.opened.emit();

    setTimeout(() => {
      this.searchInput?.nativeElement.focus();
    });
  }

  close(): void {
    this.isOpen = false;
    this.closed.emit();
  }

  filter(): void {
    if (!this.query.trim()) {
      this.filteredItems = this.items;
    } else {
      const q = this.query.toLowerCase();
      this.filteredItems = this.items.filter(item => {
        const text = `${item.title} ${item.subtitle || ''} ${item.keywords?.join(' ') || ''}`.toLowerCase();
        return text.includes(q);
      });
    }

    this.activeItem = this.filteredItems[0] || null;
  }

  get sections(): { name: string; items: CommandItem[] }[] {
    const grouped = new Map<string, CommandItem[]>();

    for (const item of this.filteredItems) {
      const section = item.section || 'General';
      if (!grouped.has(section)) {
        grouped.set(section, []);
      }
      grouped.get(section)!.push(item);
    }

    return Array.from(grouped.entries()).map(([name, items]) => ({ name, items }));
  }

  onKeydown(event: KeyboardEvent): void {
    if (!this.filteredItems.length) return;

    const currentIndex = this.activeItem ? this.filteredItems.indexOf(this.activeItem) : -1;

    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        this.activeItem = this.filteredItems[Math.min(currentIndex + 1, this.filteredItems.length - 1)];
        break;
      case 'ArrowUp':
        event.preventDefault();
        this.activeItem = this.filteredItems[Math.max(currentIndex - 1, 0)];
        break;
      case 'Enter':
        event.preventDefault();
        if (this.activeItem) {
          this.execute(this.activeItem);
        }
        break;
    }
  }

  execute(item: CommandItem): void {
    item.action();
    this.executed.emit(item);
    this.close();
  }

  highlightMatch(text: string): string {
    if (!this.query.trim()) return text;
    const regex = new RegExp(`(${this.query.replace(/[.*+?^${}()|[\]\]/g, '\$&')})`, 'gi');
    return text.replace(regex, '<mark>$1</mark>');
  }
}