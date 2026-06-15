import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';

export interface SummaryItem {
  label: string;
  value: number | string;
  prefix?: string;
  suffix?: string;
  format?: 'currency' | 'percent' | 'number';
  highlight?: boolean;
  animated?: boolean;
}

@Component({
  selector: 'luna-sticky-summary',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="luna-summary" [class.luna-summary--visible]="visible">
      <div class="luna-summary__content">
        <!-- Items -->
        <div class="luna-summary__items">
          <div
            *ngFor="let item of items; let i = index"
            class="luna-summary__item"
            [class.luna-summary__item--highlight]="item.highlight"
          >
            <span class="luna-summary__item-label">{{ item.label }}</span>
            <span class="luna-summary__item-value" [class.luna-summary__item-value--animated]="item.animated">
              <span *ngIf="item.prefix" class="luna-summary__item-prefix">{{ item.prefix }}</span>
              <span class="luna-summary__item-number">{{ formatValue(item) }}</span>
              <span *ngIf="item.suffix" class="luna-summary__item-suffix">{{ item.suffix }}</span>
            </span>
          </div>
        </div>

        <!-- Actions -->
        <div class="luna-summary__actions">
          <ng-content select="[actions]"></ng-content>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .luna-summary {
      position: fixed;
      bottom: 0;
      left: 0;
      right: 0;
      z-index: var(--z-floating);
      background: var(--glass-bg);
      backdrop-filter: var(--glass-backdrop);
      border-top: 1px solid var(--glass-border);
      box-shadow: 0 -4px 20px rgba(0, 0, 0, 0.08);
      transform: translateY(100%);
      transition: transform var(--transition-slow);
    }

    .luna-summary--visible {
      transform: translateY(0);
    }

    .luna-summary__content {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: var(--space-6);
      max-width: 1440px;
      margin: 0 auto;
      padding: var(--space-4) var(--space-6);
    }

    .luna-summary__items {
      display: flex;
      align-items: center;
      gap: var(--space-6);
      flex: 1;
      overflow-x: auto;
    }

    .luna-summary__item {
      display: flex;
      flex-direction: column;
      gap: var(--space-0-5);
      min-width: 0;
    }

    .luna-summary__item-label {
      font-size: var(--text-xs);
      color: var(--text-secondary);
      font-weight: var(--fw-medium);
      white-space: nowrap;
    }

    .luna-summary__item-value {
      display: flex;
      align-items: baseline;
      gap: var(--space-1);
      font-family: var(--font-numeric);
      font-variant-numeric: var(--font-variant-numeric);
    }

    .luna-summary__item-number {
      font-size: var(--text-lg);
      font-weight: var(--fw-semibold);
      color: var(--text-primary);
      line-height: var(--lh-lg);
    }

    .luna-summary__item-prefix,
    .luna-summary__item-suffix {
      font-size: var(--text-sm);
      color: var(--text-secondary);
    }

    .luna-summary__item--highlight .luna-summary__item-number {
      font-size: var(--text-xl);
      font-weight: var(--fw-bold);
      color: var(--text-accent);
    }

    .luna-summary__item-value--animated {
      animation: luna-count-up 300ms var(--ease-out-expo);
    }

    .luna-summary__actions {
      display: flex;
      align-items: center;
      gap: var(--space-3);
      flex-shrink: 0;
    }

    /* Divider between items */
    .luna-summary__item:not(:last-child)::after {
      content: '';
      position: absolute;
      right: calc(var(--space-3) * -1);
      top: 50%;
      transform: translateY(-50%);
      width: 1px;
      height: 24px;
      background: var(--border-default);
    }

    .luna-summary__item {
      position: relative;
    }

    /* Mobile */
    @media (max-width: 768px) {
      .luna-summary__content {
        flex-direction: column;
        gap: var(--space-3);
        padding: var(--space-3) var(--space-4);
      }

      .luna-summary__items {
        gap: var(--space-4);
        width: 100%;
        justify-content: space-between;
      }

      .luna-summary__actions {
        width: 100%;
        justify-content: stretch;
      }

      .luna-summary__actions ::ng-deep luna-button {
        flex: 1;
      }
    }
  `]
})
export class LunaStickySummaryComponent {
  @Input() items: SummaryItem[] = [];
  @Input() visible = true;

  @Output() actionClick = new EventEmitter<string>();

  formatValue(item: SummaryItem): string {
    const value = item.value;

    switch (item.format) {
      case 'currency':
        return new Intl.NumberFormat('es-PE', { 
          minimumFractionDigits: 2, 
          maximumFractionDigits: 2 
        }).format(Number(value));
      case 'percent':
        return new Intl.NumberFormat('es-PE', { 
          style: 'percent',
          minimumFractionDigits: 1 
        }).format(Number(value) / 100);
      case 'number':
        return new Intl.NumberFormat('es-PE').format(Number(value));
      default:
        return String(value);
    }
  }
}