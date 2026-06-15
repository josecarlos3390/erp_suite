import { Component, Input, Output, EventEmitter, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';

export type ModalSize = 'sm' | 'md' | 'lg' | 'xl' | 'full';

@Component({
  selector: 'luna-modal',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div *ngIf="visible" class="luna-modal" role="dialog" [attr.aria-modal]="true" [attr.aria-labelledby]="titleId">
      <!-- Backdrop -->
      <div class="luna-modal__backdrop" (click)="onBackdropClick()" [@backdropAnimation]></div>

      <!-- Panel -->
      <div class="luna-modal__panel" [class]="panelClasses" [@panelAnimation]>
        <!-- Header -->
        <div *ngIf="hasHeader" class="luna-modal__header">
          <div class="luna-modal__header-content">
            <div *ngIf="icon" class="luna-modal__icon" [class]="'luna-modal__icon--' + iconColor">
              <i [class]="icon"></i>
            </div>
            <div class="luna-modal__titles">
              <h2 [id]="titleId" class="luna-modal__title">{{ title }}</h2>
              <p *ngIf="subtitle" class="luna-modal__subtitle">{{ subtitle }}</p>
            </div>
          </div>
          <button
            *ngIf="closable"
            type="button"
            class="luna-modal__close"
            (click)="close()"
            aria-label="Cerrar"
          >
            <i class="fas fa-times"></i>
          </button>
        </div>

        <!-- Body -->
        <div class="luna-modal__body" [class.luna-modal__body--no-padding]="noPadding">
          <ng-content></ng-content>
        </div>

        <!-- Footer -->
        <div *ngIf="hasFooter" class="luna-modal__footer">
          <ng-content select="[footer]"></ng-content>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .luna-modal {
      position: fixed;
      inset: 0;
      z-index: var(--z-modal);
      display: flex;
      align-items: center;
      justify-content: center;
      padding: var(--space-6);
    }

    .luna-modal__backdrop {
      position: fixed;
      inset: 0;
      background: rgba(10, 10, 15, 0.5);
      backdrop-filter: blur(4px);
    }

    .luna-modal__panel {
      position: relative;
      display: flex;
      flex-direction: column;
      max-height: calc(100vh - var(--space-12));
      background: var(--glass-bg);
      backdrop-filter: var(--glass-backdrop);
      border: 1px solid var(--glass-border);
      border-radius: var(--radius-2xl);
      box-shadow: var(--shadow-xl);
      overflow: hidden;
      z-index: 1;
    }

    /* Sizes */
    .luna-modal--sm { width: 100%; max-width: 448px; }
    .luna-modal--md { width: 100%; max-width: 560px; }
    .luna-modal--lg { width: 100%; max-width: 720px; }
    .luna-modal--xl { width: 100%; max-width: 1024px; }
    .luna-modal--full {
      width: 100%;
      max-width: calc(100vw - var(--space-12));
      height: calc(100vh - var(--space-12));
      max-height: calc(100vh - var(--space-12));
    }

    /* Header */
    .luna-modal__header {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: var(--space-4);
      padding: var(--space-5) var(--space-6);
      border-bottom: 1px solid var(--border-subtle);
      flex-shrink: 0;
    }

    .luna-modal__header-content {
      display: flex;
      align-items: flex-start;
      gap: var(--space-3);
      min-width: 0;
    }

    .luna-modal__icon {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 48px;
      height: 48px;
      border-radius: var(--radius-lg);
      background: var(--bg-surface);
      font-size: 24px;
      flex-shrink: 0;
    }

    .luna-modal__icon--primary {
      color: var(--text-accent);
      background: var(--bg-selected);
    }

    .luna-modal__icon--warning {
      color: var(--text-warning);
      background: var(--warning-50);
    }

    .luna-modal__icon--error {
      color: var(--text-error);
      background: var(--error-50);
    }

    .luna-modal__icon--success {
      color: var(--text-success);
      background: var(--success-50);
    }

    .luna-modal__titles {
      min-width: 0;
      padding-top: var(--space-1);
    }

    .luna-modal__title {
      font-size: var(--text-xl);
      font-weight: var(--fw-semibold);
      color: var(--text-primary);
      margin: 0;
      line-height: var(--lh-xl);
    }

    .luna-modal__subtitle {
      font-size: var(--text-sm);
      color: var(--text-secondary);
      margin: var(--space-1) 0 0;
      line-height: var(--lh-sm);
    }

    .luna-modal__close {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 32px;
      height: 32px;
      background: none;
      border: none;
      color: var(--text-tertiary);
      cursor: pointer;
      border-radius: var(--radius-md);
      transition: all var(--transition-fast);
      flex-shrink: 0;
    }

    .luna-modal__close:hover {
      background: var(--bg-hover);
      color: var(--text-primary);
    }

    /* Body */
    .luna-modal__body {
      flex: 1;
      overflow-y: auto;
      padding: var(--space-6);
    }

    .luna-modal__body--no-padding {
      padding: 0;
    }

    /* Footer */
    .luna-modal__footer {
      display: flex;
      align-items: center;
      justify-content: flex-end;
      gap: var(--space-3);
      padding: var(--space-4) var(--space-6);
      border-top: 1px solid var(--border-subtle);
      background: var(--bg-base);
      flex-shrink: 0;
    }

    /* Mobile */
    @media (max-width: 640px) {
      .luna-modal {
        padding: 0;
        align-items: flex-end;
      }

      .luna-modal__panel {
        border-radius: var(--radius-2xl) var(--radius-2xl) 0 0;
        max-height: 90vh;
        animation: luna-modal-slide-up 300ms var(--ease-out-expo);
      }

      .luna-modal__backdrop {
        animation: luna-fade-in 200ms ease-out;
      }
    }

    @keyframes luna-modal-slide-up {
      from { transform: translateY(100%); }
      to { transform: translateY(0); }
    }
  `]
})
export class LunaModalComponent {
  @Input() visible = false;
  @Input() title = '';
  @Input() subtitle?: string;
  @Input() icon?: string;
  @Input() iconColor: 'primary' | 'warning' | 'error' | 'success' = 'primary';
  @Input() size: ModalSize = 'md';
  @Input() closable = true;
  @Input() noPadding = false;
  @Input() dismissOnBackdrop = true;

  @Output() visibleChange = new EventEmitter<boolean>();
  @Output() closed = new EventEmitter<void>();

  titleId = 'luna-modal-title-' + Math.random().toString(36).substr(2, 9);

  get hasHeader(): boolean {
    return !!(this.title || this.icon || this.closable);
  }

  get hasFooter(): boolean {
    return true; // Simplified - check for projected content
  }

  get panelClasses(): string {
    return `luna-modal--${this.size}`;
  }

  @HostListener('document:keydown.escape', ['$event'])
  onEscape(event: KeyboardEvent): void {
    if (this.visible && this.closable) {
      this.close();
    }
  }

  onBackdropClick(): void {
    if (this.dismissOnBackdrop && this.closable) {
      this.close();
    }
  }

  close(): void {
    this.visible = false;
    this.visibleChange.emit(false);
    this.closed.emit();
  }

  open(): void {
    this.visible = true;
    this.visibleChange.emit(true);
  }
}