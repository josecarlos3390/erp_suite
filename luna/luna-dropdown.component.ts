import { Component, Input, Output, EventEmitter, ElementRef, HostListener, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';

export interface DropdownItem {
  label: string;
  value: any;
  icon?: string;
  disabled?: boolean;
  divider?: boolean;
  danger?: boolean;
  shortcut?: string;
}

@Component({
  selector: 'luna-dropdown',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="luna-dropdown" #dropdownRef>
      <!-- Trigger -->
      <div class="luna-dropdown__trigger" (click)="toggle()">
        <ng-content select="[trigger]"></ng-content>
      </div>

      <!-- Menu -->
      <div
        *ngIf="isOpen"
        class="luna-dropdown__menu"
        [class.luna-dropdown__menu--right]="align === 'right'"
        [class.luna-dropdown__menu--center]="align === 'center'"
        [@menuAnimation]
      >
        <div *ngIf="header" class="luna-dropdown__header">{{ header }}</div>

        <div class="luna-dropdown__items">
          <ng-container *ngFor="let item of items; let last = last">
            <!-- Divider -->
            <div *ngIf="item.divider" class="luna-dropdown__divider"></div>

            <!-- Item -->
            <button
              *ngIf="!item.divider"
              class="luna-dropdown__item"
              [class.luna-dropdown__item--danger]="item.danger"
              [class.luna-dropdown__item--disabled]="item.disabled"
              [disabled]="item.disabled"
              (click)="selectItem(item)"
            >
              <i *ngIf="item.icon" [class]="item.icon" class="luna-dropdown__item-icon"></i>
              <span class="luna-dropdown__item-label">{{ item.label }}</span>
              <span *ngIf="item.shortcut" class="luna-dropdown__item-shortcut">{{ item.shortcut }}</span>
            </button>
          </ng-container>
        </div>

        <div *ngIf="footer" class="luna-dropdown__footer">{{ footer }}</div>
      </div>
    </div>
  `,
  styles: [`
    .luna-dropdown {
      position: relative;
      display: inline-block;
    }

    .luna-dropdown__trigger {
      cursor: pointer;
    }

    .luna-dropdown__menu {
      position: absolute;
      top: calc(100% + var(--space-2));
      left: 0;
      min-width: 200px;
      max-width: 320px;
      background: var(--glass-bg);
      backdrop-filter: var(--glass-backdrop);
      border: 1px solid var(--glass-border);
      border-radius: var(--radius-lg);
      box-shadow: var(--shadow-lg);
      z-index: var(--z-dropdown);
      overflow: hidden;
      animation: luna-dropdown-enter 150ms var(--ease-out-expo);
    }

    .luna-dropdown__menu--right {
      left: auto;
      right: 0;
    }

    .luna-dropdown__menu--center {
      left: 50%;
      transform: translateX(-50%);
    }

    @keyframes luna-dropdown-enter {
      from { opacity: 0; transform: scale(0.95) translateY(-4px); }
      to { opacity: 1; transform: scale(1) translateY(0); }
    }

    .luna-dropdown__header {
      padding: var(--space-3) var(--space-4);
      font-size: var(--text-xs);
      font-weight: var(--fw-semibold);
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--text-tertiary);
      border-bottom: 1px solid var(--border-subtle);
    }

    .luna-dropdown__items {
      padding: var(--space-2);
    }

    .luna-dropdown__item {
      display: flex;
      align-items: center;
      gap: var(--space-3);
      width: 100%;
      padding: var(--space-2) var(--space-3);
      font-family: var(--font-sans);
      font-size: var(--text-sm);
      color: var(--text-primary);
      background: none;
      border: none;
      border-radius: var(--radius-md);
      cursor: pointer;
      transition: all var(--transition-fast);
      text-align: left;
    }

    .luna-dropdown__item:hover:not(:disabled) {
      background: var(--bg-hover);
    }

    .luna-dropdown__item--danger {
      color: var(--text-error);
    }

    .luna-dropdown__item--danger:hover:not(:disabled) {
      background: var(--error-50);
    }

    .luna-dropdown__item--disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .luna-dropdown__item-icon {
      width: 16px;
      text-align: center;
      color: var(--text-tertiary);
      font-size: 14px;
    }

    .luna-dropdown__item--danger .luna-dropdown__item-icon {
      color: var(--text-error);
    }

    .luna-dropdown__item-label {
      flex: 1;
      min-width: 0;
    }

    .luna-dropdown__item-shortcut {
      font-size: var(--text-2xs);
      color: var(--text-tertiary);
      font-family: var(--font-mono);
      padding: var(--space-0-5) var(--space-1);
      background: var(--bg-surface);
      border-radius: var(--radius-sm);
    }

    .luna-dropdown__divider {
      height: 1px;
      margin: var(--space-2) var(--space-3);
      background: var(--border-subtle);
    }

    .luna-dropdown__footer {
      padding: var(--space-3) var(--space-4);
      font-size: var(--text-xs);
      color: var(--text-secondary);
      border-top: 1px solid var(--border-subtle);
      background: var(--bg-surface);
    }
  `]
})
export class LunaDropdownComponent {
  @Input() items: DropdownItem[] = [];
  @Input() header?: string;
  @Input() footer?: string;
  @Input() align: 'left' | 'right' | 'center' = 'left';
  @Input() closeOnSelect = true;

  @Output() itemSelected = new EventEmitter<DropdownItem>();
  @Output() opened = new EventEmitter<void>();
  @Output() closed = new EventEmitter<void>();

  @ViewChild('dropdownRef') dropdownRef!: ElementRef;

  isOpen = false;

  @HostListener('document:click', ['$event'])
  onClickOutside(event: Event): void {
    if (this.isOpen && !this.dropdownRef?.nativeElement.contains(event.target)) {
      this.close();
    }
  }

  @HostListener('document:keydown.escape', ['$event'])
  onEscape(event: KeyboardEvent): void {
    if (this.isOpen) {
      this.close();
    }
  }

  toggle(): void {
    this.isOpen ? this.close() : this.open();
  }

  open(): void {
    this.isOpen = true;
    this.opened.emit();
  }

  close(): void {
    this.isOpen = false;
    this.closed.emit();
  }

  selectItem(item: DropdownItem): void {
    if (item.disabled) return;

    this.itemSelected.emit(item);

    if (this.closeOnSelect) {
      this.close();
    }
  }
}