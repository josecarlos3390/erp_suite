import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

export type SkeletonVariant = 'text' | 'circular' | 'rectangular' | 'rounded' | 'card' | 'table';

@Component({
  selector: 'luna-skeleton',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div
      class="luna-skeleton"
      [class.luna-skeleton--animated]="animated"
      [class.luna-skeleton--shimmer]="shimmer"
      [class.luna-skeleton--pulse]="pulse && !shimmer"
      [class.luna-skeleton--wave]="wave && !shimmer"
      [style.width]="width"
      [style.height]="height"
      [style.border-radius]="getBorderRadius()"
    >
      <div *ngIf="shimmer" class="luna-skeleton__shimmer"></div>
    </div>
  `,
  styles: [`
    .luna-skeleton {
      position: relative;
      background: var(--bg-surface);
      overflow: hidden;
      display: inline-block;
    }

    .luna-skeleton--animated {
      background: linear-gradient(
        90deg,
        var(--bg-surface) 25%,
        var(--bg-hover) 50%,
        var(--bg-surface) 75%
      );
      background-size: 200% 100%;
    }

    .luna-skeleton--pulse {
      animation: luna-pulse 1.5s ease-in-out infinite;
    }

    .luna-skeleton--wave {
      animation: luna-shimmer 1.5s linear infinite;
    }

    .luna-skeleton__shimmer {
      position: absolute;
      inset: 0;
      background: var(--gradient-shimmer);
      animation: luna-shimmer 1.5s linear infinite;
    }

    /* Variants */
    .luna-skeleton--text {
      border-radius: var(--radius-sm);
    }

    .luna-skeleton--circular {
      border-radius: var(--radius-full);
    }

    .luna-skeleton--rectangular {
      border-radius: var(--radius-none);
    }

    .luna-skeleton--rounded {
      border-radius: var(--radius-md);
    }

    .luna-skeleton--card {
      border-radius: var(--radius-xl);
    }

    .luna-skeleton--table {
      border-radius: var(--radius-sm);
    }
  `]
})
export class LunaSkeletonComponent {
  @Input() variant: SkeletonVariant = 'text';
  @Input() width = '100%';
  @Input() height = '16px';
  @Input() animated = true;
  @Input() shimmer = true;
  @Input() pulse = false;
  @Input() wave = false;
  @Input() radius?: string;

  getBorderRadius(): string {
    if (this.radius) return this.radius;

    const radii: Record<SkeletonVariant, string> = {
      text: 'var(--radius-sm)',
      circular: 'var(--radius-full)',
      rectangular: 'var(--radius-none)',
      rounded: 'var(--radius-md)',
      card: 'var(--radius-xl)',
      table: 'var(--radius-sm)'
    };

    return radii[this.variant];
  }
}