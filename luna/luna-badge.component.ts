import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

export type BadgeVariant = 'default' | 'primary' | 'success' | 'warning' | 'error' | 'info' | 'neutral';
export type BadgeSize = 'sm' | 'md';

@Component({
  selector: 'luna-badge',
  standalone: true,
  imports: [CommonModule],
  template: `
    <span [class]="badgeClasses">
      <!-- Dot -->
      <span *ngIf="dot" class="luna-badge__dot" [class.luna-badge__dot--pulse]="pulse"></span>

      <!-- Icon -->
      <i *ngIf="icon" [class]="icon" class="luna-badge__icon"></i>

      <!-- Content -->
      <span class="luna-badge__text">
        <ng-content></ng-content>
      </span>

      <!-- Remove button -->
      <button
        *ngIf="removable"
        type="button"
        class="luna-badge__remove"
        (click)="onRemove($event)"
        aria-label="Remove"
      >
        <i class="fas fa-times"></i>
      </button>
    </span>
  `,
  styles: [`
    .luna-badge {
      display: inline-flex;
      align-items: center;
      gap: var(--space-1);
      font-family: var(--font-sans);
      font-weight: var(--fw-semibold);
      white-space: nowrap;
      transition: all var(--transition-fast);
    }

    /* Sizes */
    .luna-badge--sm {
      height: 20px;
      padding: 0 var(--space-2);
      font-size: var(--text-2xs);
      border-radius: var(--radius-full);
    }

    .luna-badge--md {
      height: 24px;
      padding: 0 var(--space-3);
      font-size: var(--text-xs);
      border-radius: var(--radius-full);
    }

    /* Variants */
    .luna-badge--default {
      background: var(--bg-surface);
      color: var(--text-secondary);
      border: 1px solid var(--border-default);
    }

    .luna-badge--primary {
      background: var(--accent-50);
      color: var(--accent-700);
      border: 1px solid var(--accent-200);
    }

    .luna-badge--success {
      background: var(--success-50);
      color: var(--success-700);
      border: 1px solid var(--success-200);
    }

    .luna-badge--warning {
      background: var(--warning-50);
      color: var(--warning-700);
      border: 1px solid var(--warning-200);
    }

    .luna-badge--error {
      background: var(--error-50);
      color: var(--error-700);
      border: 1px solid var(--error-200);
    }

    .luna-badge--info {
      background: var(--info-50);
      color: var(--info-700);
      border: 1px solid var(--info-200);
    }

    .luna-badge--neutral {
      background: var(--neutral-100);
      color: var(--neutral-700);
      border: 1px solid var(--neutral-200);
    }

    /* Dark mode adjustments */
    [data-theme='dark'] .luna-badge--primary {
      background: rgba(99, 102, 241, 0.15);
      border-color: rgba(99, 102, 241, 0.25);
    }

    [data-theme='dark'] .luna-badge--success {
      background: rgba(34, 197, 94, 0.15);
      border-color: rgba(34, 197, 94, 0.25);
    }

    [data-theme='dark'] .luna-badge--error {
      background: rgba(239, 68, 68, 0.15);
      border-color: rgba(239, 68, 68, 0.25);
    }

    /* Dot */
    .luna-badge__dot {
      width: 8px;
      height: 8px;
      border-radius: var(--radius-full);
      background: currentColor;
      flex-shrink: 0;
    }

    .luna-badge__dot--pulse {
      position: relative;
    }

    .luna-badge__dot--pulse::after {
      content: '';
      position: absolute;
      inset: -2px;
      border-radius: var(--radius-full);
      background: currentColor;
      opacity: 0.4;
      animation: luna-pulse-ring 1.5s ease-out infinite;
    }

    /* Icon */
    .luna-badge__icon {
      font-size: 0.75em;
    }

    /* Remove button */
    .luna-badge__remove {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 14px;
      height: 14px;
      margin-left: var(--space-0-5);
      background: none;
      border: none;
      color: currentColor;
      opacity: 0.6;
      cursor: pointer;
      border-radius: var(--radius-sm);
      font-size: 10px;
      transition: all var(--transition-fast);
    }

    .luna-badge__remove:hover {
      opacity: 1;
      background: rgba(0, 0, 0, 0.1);
    }

    /* Pill style (outlined) */
    .luna-badge--pill {
      background: transparent;
      border-width: 1.5px;
    }

    /* Ghost style */
    .luna-badge--ghost {
      background: transparent;
      border: none;
      padding: 0;
    }

    .luna-badge--ghost .luna-badge__text {
      text-decoration: underline;
      text-underline-offset: 2px;
    }
  `]
})
export class LunaBadgeComponent {
  @Input() variant: BadgeVariant = 'default';
  @Input() size: BadgeSize = 'md';
  @Input() dot = false;
  @Input() pulse = false;
  @Input() icon?: string;
  @Input() removable = false;
  @Input() pill = false;
  @Input() ghost = false;

  @Output() removed = new EventEmitter<void>();

  get badgeClasses(): string {
    return [
      'luna-badge',
      `luna-badge--${this.variant}`,
      `luna-badge--${this.size}`,
      this.pill ? 'luna-badge--pill' : '',
      this.ghost ? 'luna-badge--ghost' : ''
    ].filter(Boolean).join(' ');
  }

  onRemove(event: Event): void {
    event.stopPropagation();
    this.removed.emit();
  }
}