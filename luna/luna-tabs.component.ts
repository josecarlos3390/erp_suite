import { Component, Input, Output, EventEmitter, ContentChildren, QueryList, AfterContentInit } from '@angular/core';
import { CommonModule } from '@angular/common';

export type TabsVariant = 'default' | 'pills' | 'underline' | 'vertical';

@Component({
  selector: 'luna-tab',
  standalone: true,
  imports: [CommonModule],
  template: `<ng-content></ng-content>`,
  styles: [`:host { display: contents; }`]
})
export class LunaTabComponent {
  @Input() label = '';
  @Input() icon?: string;
  @Input() disabled = false;
  @Input() badge?: string;
  @Input() id = '';
}

@Component({
  selector: 'luna-tabs',
  standalone: true,
  imports: [CommonModule, LunaTabComponent],
  template: `
    <div class="luna-tabs" [class]="tabsClasses">
      <!-- Tab List -->
      <div class="luna-tabs__list" role="tablist">
        <button
          *ngFor="let tab of tabs; let i = index"
          class="luna-tabs__tab"
          [class.luna-tabs__tab--active]="activeIndex === i"
          [class.luna-tabs__tab--disabled]="tab.disabled"
          [attr.aria-selected]="activeIndex === i"
          [attr.aria-disabled]="tab.disabled"
          role="tab"
          (click)="selectTab(i)"
        >
          <i *ngIf="tab.icon" [class]="tab.icon" class="luna-tabs__tab-icon"></i>
          <span class="luna-tabs__tab-label">{{ tab.label }}</span>
          <span *ngIf="tab.badge" class="luna-tabs__tab-badge">{{ tab.badge }}</span>
        </button>

        <!-- Animated indicator (underline variant) -->
        <span *ngIf="variant === 'underline'" class="luna-tabs__indicator" [style.left.px]="indicatorLeft" [style.width.px]="indicatorWidth"></span>
      </div>

      <!-- Tab Panels -->
      <div class="luna-tabs__panels">
        <ng-content></ng-content>
      </div>
    </div>
  `,
  styles: [`
    .luna-tabs {
      display: flex;
      flex-direction: column;
      width: 100%;
    }

    .luna-tabs--vertical {
      flex-direction: row;
      gap: var(--space-6);
    }

    .luna-tabs--vertical .luna-tabs__list {
      flex-direction: column;
      width: 200px;
      border-bottom: none;
      border-right: 1px solid var(--border-default);
      padding: var(--space-2) 0;
    }

    .luna-tabs--vertical .luna-tabs__tab {
      justify-content: flex-start;
      border-radius: var(--radius-md);
      margin: var(--space-0-5) var(--space-2);
    }

    .luna-tabs--vertical .luna-tabs__tab--active {
      background: var(--bg-selected);
      color: var(--text-accent);
    }

    /* Tab List */
    .luna-tabs__list {
      position: relative;
      display: flex;
      gap: var(--space-1);
      border-bottom: 1px solid var(--border-default);
      padding: 0 var(--space-2);
    }

    .luna-tabs--pills .luna-tabs__list {
      background: var(--bg-surface);
      border-radius: var(--radius-full);
      padding: var(--space-1);
      border-bottom: none;
    }

    .luna-tabs--underline .luna-tabs__list {
      gap: 0;
      padding: 0;
    }

    /* Tab */
    .luna-tabs__tab {
      position: relative;
      display: inline-flex;
      align-items: center;
      gap: var(--space-2);
      padding: var(--space-3) var(--space-4);
      font-family: var(--font-sans);
      font-size: var(--text-sm);
      font-weight: var(--fw-medium);
      color: var(--text-secondary);
      background: none;
      border: none;
      border-bottom: 2px solid transparent;
      cursor: pointer;
      transition: all var(--transition-fast);
      white-space: nowrap;
      margin-bottom: -1px;
    }

    .luna-tabs__tab:hover:not(:disabled) {
      color: var(--text-primary);
      background: var(--bg-hover);
    }

    .luna-tabs__tab--active {
      color: var(--text-primary);
      border-bottom-color: var(--accent-500);
    }

    .luna-tabs__tab--disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .luna-tabs__tab-icon {
      font-size: 14px;
    }

    .luna-tabs__tab-badge {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-width: 18px;
      height: 18px;
      padding: 0 5px;
      background: var(--error-500);
      color: var(--text-inverse);
      font-size: 10px;
      font-weight: var(--fw-bold);
      border-radius: var(--radius-full);
    }

    /* Pills variant */
    .luna-tabs--pills .luna-tabs__tab {
      border-radius: var(--radius-full);
      border-bottom: none;
      margin-bottom: 0;
      padding: var(--space-2) var(--space-4);
    }

    .luna-tabs--pills .luna-tabs__tab--active {
      background: var(--bg-base);
      color: var(--text-primary);
      box-shadow: var(--shadow-sm);
    }

    /* Underline indicator */
    .luna-tabs__indicator {
      position: absolute;
      bottom: -1px;
      height: 2px;
      background: var(--accent-500);
      border-radius: var(--radius-full) var(--radius-full) 0 0;
      transition: all var(--transition-spring);
    }

    /* Panels */
    .luna-tabs__panels {
      padding: var(--space-4) 0;
    }

    .luna-tabs--vertical .luna-tabs__panels {
      flex: 1;
      padding: 0;
    }
  `]
})
export class LunaTabsComponent implements AfterContentInit {
  @Input() variant: TabsVariant = 'default';
  @Input() activeIndex = 0;

  @Output() activeIndexChange = new EventEmitter<number>();
  @Output() tabChange = new EventEmitter<number>();

  @ContentChildren(LunaTabComponent) tabComponents!: QueryList<LunaTabComponent>;

  tabs: LunaTabComponent[] = [];
  indicatorLeft = 0;
  indicatorWidth = 0;

  ngAfterContentInit(): void {
    this.tabs = this.tabComponents.toArray();
    this.updateIndicator();
  }

  selectTab(index: number): void {
    if (this.tabs[index]?.disabled) return;

    this.activeIndex = index;
    this.activeIndexChange.emit(index);
    this.tabChange.emit(index);
    this.updateIndicator();
  }

  private updateIndicator(): void {
    // Simplified - in real implementation, measure DOM elements
    this.indicatorLeft = this.activeIndex * 100;
    this.indicatorWidth = 80;
  }

  get tabsClasses(): string {
    return `luna-tabs--${this.variant}`;
  }
}