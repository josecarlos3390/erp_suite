import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

export type CardVariant = 'default' | 'elevated' | 'glass' | 'outlined';

@Component({
  selector: 'luna-card',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div
      [class]="cardClasses"
      [class.luna-card--hoverable]="hoverable"
      [class.luna-card--clickable]="clickable"
    >
      <!-- Header -->
      <div *ngIf="hasHeader" class="luna-card__header">
        <div class="luna-card__header-content">
          <div *ngIf="icon" class="luna-card__icon">
            <i [class]="icon"></i>
          </div>
          <div class="luna-card__titles">
            <h3 *ngIf="title" class="luna-card__title">{{ title }}</h3>
            <p *ngIf="subtitle" class="luna-card__subtitle">{{ subtitle }}</p>
          </div>
        </div>
        <div *ngIf="hasHeaderActions" class="luna-card__header-actions">
          <ng-content select="[headerActions]"></ng-content>
        </div>
      </div>

      <!-- Media -->
      <div *ngIf="hasMedia" class="luna-card__media">
        <ng-content select="[media]"></ng-content>
      </div>

      <!-- Body -->
      <div class="luna-card__body" [class.luna-card__body--no-padding]="noPadding">
        <ng-content></ng-content>
      </div>

      <!-- Footer -->
      <div *ngIf="hasFooter" class="luna-card__footer">
        <ng-content select="[footer]"></ng-content>
      </div>
    </div>
  `,
  styles: [`
    .luna-card {
      position: relative;
      background: var(--bg-surface);
      border: 1px solid var(--border-default);
      border-radius: var(--radius-xl);
      overflow: hidden;
      transition: all var(--transition-base);
    }

    .luna-card--default {
      box-shadow: var(--shadow-sm);
    }

    .luna-card--elevated {
      background: var(--bg-elevated);
      box-shadow: var(--shadow-md);
      border-color: transparent;
    }

    .luna-card--glass {
      background: var(--glass-bg);
      backdrop-filter: var(--glass-backdrop);
      border-color: var(--glass-border);
      box-shadow: var(--shadow-lg);
    }

    .luna-card--outlined {
      background: transparent;
      border-color: var(--border-default);
      box-shadow: none;
    }

    .luna-card--hoverable:hover {
      transform: var(--transform-hover-lift);
      box-shadow: var(--shadow-lg);
    }

    .luna-card--glass.luna-card--hoverable:hover {
      background: var(--glass-bg-elevated);
    }

    .luna-card--clickable {
      cursor: pointer;
    }

    .luna-card--clickable:active {
      transform: var(--transform-active-press);
    }

    /* Header */
    .luna-card__header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: var(--space-4) var(--space-5);
      border-bottom: 1px solid var(--border-subtle);
      gap: var(--space-3);
    }

    .luna-card__header-content {
      display: flex;
      align-items: center;
      gap: var(--space-3);
      min-width: 0;
    }

    .luna-card__icon {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 40px;
      height: 40px;
      border-radius: var(--radius-lg);
      background: var(--bg-selected);
      color: var(--text-accent);
      font-size: 18px;
      flex-shrink: 0;
    }

    .luna-card__titles {
      min-width: 0;
    }

    .luna-card__title {
      font-size: var(--text-base);
      font-weight: var(--fw-semibold);
      color: var(--text-primary);
      margin: 0;
      line-height: var(--lh-base);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .luna-card__subtitle {
      font-size: var(--text-xs);
      color: var(--text-secondary);
      margin: var(--space-0-5) 0 0;
      line-height: var(--lh-xs);
    }

    .luna-card__header-actions {
      display: flex;
      align-items: center;
      gap: var(--space-2);
      flex-shrink: 0;
    }

    /* Media */
    .luna-card__media {
      position: relative;
      overflow: hidden;
    }

    .luna-card__media ::ng-deep img,
    .luna-card__media ::ng-deep video {
      width: 100%;
      height: auto;
      display: block;
      object-fit: cover;
    }

    /* Body */
    .luna-card__body {
      padding: var(--space-5);
    }

    .luna-card__body--no-padding {
      padding: 0;
    }

    /* Footer */
    .luna-card__footer {
      display: flex;
      align-items: center;
      justify-content: flex-end;
      gap: var(--space-3);
      padding: var(--space-3) var(--space-5);
      border-top: 1px solid var(--border-subtle);
      background: var(--bg-base);
    }

    /* Compact mode */
    .luna-card--compact .luna-card__header {
      padding: var(--space-3) var(--space-4);
    }

    .luna-card--compact .luna-card__body {
      padding: var(--space-4);
    }

    .luna-card--compact .luna-card__footer {
      padding: var(--space-2) var(--space-4);
    }

    /* Stats variant */
    .luna-card--stats .luna-card__body {
      display: flex;
      flex-direction: column;
      gap: var(--space-2);
    }

    .luna-card--stats .luna-card__value {
      font-size: var(--text-3xl);
      font-weight: var(--fw-bold);
      color: var(--text-primary);
      line-height: var(--lh-3xl);
      font-variant-numeric: var(--font-variant-numeric);
    }

    .luna-card--stats .luna-card__trend {
      display: inline-flex;
      align-items: center;
      gap: var(--space-1);
      font-size: var(--text-xs);
      font-weight: var(--fw-medium);
    }

    .luna-card--stats .luna-card__trend--up {
      color: var(--text-success);
    }

    .luna-card--stats .luna-card__trend--down {
      color: var(--text-error);
    }
  `]
})
export class LunaCardComponent {
  @Input() variant: CardVariant = 'default';
  @Input() title?: string;
  @Input() subtitle?: string;
  @Input() icon?: string;
  @Input() hoverable = false;
  @Input() clickable = false;
  @Input() noPadding = false;
  @Input() compact = false;
  @Input() stats = false;

  get hasHeader(): boolean {
    return !!(this.title || this.subtitle || this.icon || this.hasHeaderActions);
  }

  get hasHeaderActions(): boolean {
    // Check if headerActions slot is used
    return true; // Simplified - would need ContentChild in real impl
  }

  get hasMedia(): boolean {
    return true; // Simplified
  }

  get hasFooter(): boolean {
    return true; // Simplified
  }

  get cardClasses(): string {
    return [
      'luna-card',
      `luna-card--${this.variant}`,
      this.compact ? 'luna-card--compact' : '',
      this.stats ? 'luna-card--stats' : ''
    ].filter(Boolean).join(' ');
  }
}