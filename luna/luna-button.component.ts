import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'destructive' | 'glass' | 'link';
export type ButtonSize = 'sm' | 'md' | 'lg';

@Component({
  selector: 'luna-button',
  standalone: true,
  imports: [CommonModule],
  template: `
    <button
      [class]="buttonClasses"
      [disabled]="disabled || loading"
      [attr.aria-label]="ariaLabel"
      (click)="onClick($event)"
      [style.width]="block ? '100%' : undefined"
    >
      <!-- Loading Spinner -->
      <span *ngIf="loading" class="luna-btn__spinner">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10" stroke-opacity="0.25"/>
          <path d="M12 2a10 10 0 0 1 10 10" stroke-linecap="round"/>
        </svg>
      </span>

      <!-- Icon left -->
      <span *ngIf="icon && iconPosition === 'left' && !loading" class="luna-btn__icon">
        <i [class]="icon"></i>
      </span>

      <!-- Content -->
      <span class="luna-btn__content" [class.luna-btn__content--hidden]="loading">
        <ng-content></ng-content>
      </span>

      <!-- Icon right -->
      <span *ngIf="icon && iconPosition === 'right' && !loading" class="luna-btn__icon">
        <i [class]="icon"></i>
      </span>

      <!-- Ripple -->
      <span class="luna-btn__ripple" [style.--ripple-x]="rippleX" [style.--ripple-y]="rippleY"></span>
    </button>
  `,
  styles: [`
    :host { display: inline-flex; }

    .luna-btn {
      position: relative;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: var(--space-2);
      font-family: var(--font-sans);
      font-weight: var(--fw-medium);
      border: none;
      cursor: pointer;
      overflow: hidden;
      white-space: nowrap;
      user-select: none;
      isolation: isolate;
      transition: all var(--transition-base);
    }

    .luna-btn__ripple {
      position: absolute;
      inset: 0;
      background: radial-gradient(circle at var(--ripple-x, 50%) var(--ripple-y, 50%), 
                  rgba(255,255,255,0.3) 0%, transparent 60%);
      opacity: 0;
      transition: opacity 0.3s;
      pointer-events: none;
      z-index: 0;
    }

    .luna-btn:active .luna-btn__ripple {
      opacity: 1;
      transition: opacity 0s;
    }

    /* Sizes */
    .luna-btn--sm {
      height: 28px;
      padding: 0 var(--space-3);
      font-size: var(--text-xs);
      border-radius: var(--radius-md);
    }
    .luna-btn--md {
      height: 36px;
      padding: 0 var(--space-4);
      font-size: var(--text-sm);
      border-radius: var(--radius-md);
    }
    .luna-btn--lg {
      height: 44px;
      padding: 0 var(--space-6);
      font-size: var(--text-base);
      border-radius: var(--radius-md);
    }

    /* Primary */
    .luna-btn--primary {
      background: var(--gradient-accent);
      color: var(--text-inverse);
      box-shadow: var(--shadow-md), var(--shadow-accent-lg);
    }
    .luna-btn--primary:hover:not(:disabled) {
      transform: var(--transform-hover-lift);
      background: var(--gradient-accent-hover);
      box-shadow: var(--shadow-lg), var(--shadow-accent-lg);
    }
    .luna-btn--primary:active:not(:disabled) {
      transform: var(--transform-active-press);
      box-shadow: var(--shadow-sm);
    }

    /* Secondary */
    .luna-btn--secondary {
      background: var(--bg-surface);
      color: var(--text-primary);
      border: 1px solid var(--border-default);
      box-shadow: var(--shadow-sm);
    }
    .luna-btn--secondary:hover:not(:disabled) {
      transform: var(--transform-hover-lift);
      background: var(--bg-hover);
      border-color: var(--border-strong);
      box-shadow: var(--shadow-md);
    }
    .luna-btn--secondary:active:not(:disabled) {
      transform: var(--transform-active-press);
      background: var(--bg-active);
    }

    /* Ghost */
    .luna-btn--ghost {
      background: transparent;
      color: var(--text-secondary);
    }
    .luna-btn--ghost:hover:not(:disabled) {
      background: var(--bg-hover);
      color: var(--text-primary);
    }
    .luna-btn--ghost:active:not(:disabled) {
      transform: var(--transform-active-press);
      background: var(--bg-active);
    }

    /* Destructive */
    .luna-btn--destructive {
      background: linear-gradient(180deg, var(--error-500), var(--error-600));
      color: var(--text-inverse);
      box-shadow: 0 4px 12px rgba(239, 68, 68, 0.25);
    }
    .luna-btn--destructive:hover:not(:disabled) {
      transform: var(--transform-hover-lift);
      box-shadow: 0 8px 24px rgba(239, 68, 68, 0.35);
    }
    .luna-btn--destructive:active:not(:disabled) {
      transform: var(--transform-active-press);
    }

    /* Glass */
    .luna-btn--glass {
      background: var(--glass-bg);
      backdrop-filter: var(--glass-backdrop);
      border: 1px solid var(--glass-border);
      color: var(--text-primary);
      box-shadow: var(--shadow-md);
    }
    .luna-btn--glass:hover:not(:disabled) {
      transform: var(--transform-hover-lift);
      background: var(--glass-bg-elevated);
    }
    .luna-btn--glass:active:not(:disabled) {
      transform: var(--transform-active-press);
    }

    /* Link */
    .luna-btn--link {
      background: transparent;
      color: var(--text-accent);
      text-decoration: none;
      padding: 0;
      height: auto;
    }
    .luna-btn--link:hover:not(:disabled) {
      text-decoration: underline;
      color: var(--accent-700);
    }

    /* States */
    .luna-btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
      transform: none !important;
      box-shadow: none !important;
    }
    .luna-btn--loading { cursor: wait; }

    .luna-btn:focus-visible {
      outline: none;
      box-shadow: var(--glow-focus);
    }
    .luna-btn--primary:focus-visible,
    .luna-btn--destructive:focus-visible {
      box-shadow: 0 0 0 2px var(--bg-base), 0 0 0 4px var(--accent-500);
    }

    /* Spinner */
    .luna-btn__spinner {
      position: absolute;
      width: 16px;
      height: 16px;
      animation: luna-spin 1s linear infinite;
    }
    .luna-btn__spinner svg { width: 100%; height: 100%; }

    .luna-btn__content--hidden { opacity: 0; }
    .luna-btn__icon { display: inline-flex; font-size: 0.875em; z-index: 1; }
    .luna-btn__content { z-index: 1; }
  `]
})
export class LunaButtonComponent {
  @Input() variant: ButtonVariant = 'primary';
  @Input() size: ButtonSize = 'md';
  @Input() disabled = false;
  @Input() loading = false;
  @Input() block = false;
  @Input() icon?: string;
  @Input() iconPosition: 'left' | 'right' = 'left';
  @Input() ariaLabel?: string;
  @Output() clicked = new EventEmitter<MouseEvent>();

  rippleX = '50%';
  rippleY = '50%';

  get buttonClasses(): string {
    return [
      'luna-btn',
      `luna-btn--${this.variant}`,
      `luna-btn--${this.size}`,
      this.loading ? 'luna-btn--loading' : '',
      this.block ? 'luna-btn--block' : ''
    ].filter(Boolean).join(' ');
  }

  onClick(event: MouseEvent): void {
    if (!this.disabled && !this.loading) {
      const btn = event.currentTarget as HTMLElement;
      const rect = btn.getBoundingClientRect();
      this.rippleX = `${((event.clientX - rect.left) / rect.width) * 100}%`;
      this.rippleY = `${((event.clientY - rect.top) / rect.height) * 100}%`;
      this.clicked.emit(event);
    }
  }
}