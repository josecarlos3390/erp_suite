import { Component, Input, Output, EventEmitter, forwardRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, NG_VALUE_ACCESSOR, ControlValueAccessor } from '@angular/forms';

@Component({
  selector: 'luna-toggle',
  standalone: true,
  imports: [CommonModule, FormsModule],
  providers: [{
    provide: NG_VALUE_ACCESSOR,
    useExisting: forwardRef(() => LunaToggleComponent),
    multi: true
  }],
  template: `
    <label class="luna-toggle" [class.luna-toggle--disabled]="disabled">
      <input
        type="checkbox"
        class="luna-toggle__input"
        [checked]="checked"
        [disabled]="disabled"
        (change)="onToggle($event)"
      />

      <span class="luna-toggle__track" [class.luna-toggle__track--checked]="checked">
        <span class="luna-toggle__thumb" [class.luna-toggle__thumb--checked]="checked">
          <i *ngIf="checked && checkIcon" [class]="checkIcon" class="luna-toggle__check"></i>
        </span>
      </span>

      <span *ngIf="label" class="luna-toggle__label">
        {{ label }}
        <span *ngIf="helper" class="luna-toggle__helper">{{ helper }}</span>
      </span>
    </label>
  `,
  styles: [`
    .luna-toggle {
      display: inline-flex;
      align-items: center;
      gap: var(--space-3);
      cursor: pointer;
      user-select: none;
    }

    .luna-toggle--disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .luna-toggle__input {
      position: absolute;
      opacity: 0;
      width: 0;
      height: 0;
    }

    .luna-toggle__input:focus-visible + .luna-toggle__track {
      box-shadow: var(--glow-accent);
    }

    .luna-toggle__track {
      position: relative;
      width: 44px;
      height: 24px;
      background: var(--neutral-200);
      border-radius: var(--radius-full);
      transition: all var(--transition-base);
      flex-shrink: 0;
    }

    .luna-toggle__track--checked {
      background: var(--accent-500);
    }

    [data-theme='dark'] .luna-toggle__track {
      background: var(--neutral-600);
    }

    .luna-toggle__thumb {
      position: absolute;
      top: 2px;
      left: 2px;
      width: 20px;
      height: 20px;
      background: var(--neutral-0);
      border-radius: var(--radius-full);
      box-shadow: var(--shadow-sm);
      transition: all var(--transition-spring);
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .luna-toggle__thumb--checked {
      transform: translateX(20px);
      background: var(--neutral-0);
    }

    .luna-toggle__check {
      font-size: 10px;
      color: var(--accent-500);
    }

    .luna-toggle__label {
      display: flex;
      flex-direction: column;
      font-size: var(--text-sm);
      font-weight: var(--fw-medium);
      color: var(--text-primary);
      line-height: var(--lh-sm);
    }

    .luna-toggle__helper {
      font-size: var(--text-xs);
      font-weight: var(--fw-normal);
      color: var(--text-secondary);
      margin-top: var(--space-0-5);
    }

    /* Sizes */
    .luna-toggle--sm .luna-toggle__track {
      width: 36px;
      height: 20px;
    }

    .luna-toggle--sm .luna-toggle__thumb {
      width: 16px;
      height: 16px;
    }

    .luna-toggle--sm .luna-toggle__thumb--checked {
      transform: translateX(16px);
    }

    .luna-toggle--lg .luna-toggle__track {
      width: 56px;
      height: 32px;
    }

    .luna-toggle--lg .luna-toggle__thumb {
      width: 28px;
      height: 28px;
    }

    .luna-toggle--lg .luna-toggle__thumb--checked {
      transform: translateX(24px);
    }
  `]
})
export class LunaToggleComponent implements ControlValueAccessor {
  @Input() label?: string;
  @Input() helper?: string;
  @Input() disabled = false;
  @Input() checkIcon = 'fas fa-check';
  @Input() size: 'sm' | 'md' | 'lg' = 'md';

  @Output() changed = new EventEmitter<boolean>();

  checked = false;

  private onChange: (value: boolean) => void = () => {};
  private onTouched: () => void = () => {};

  onToggle(event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;
    this.checked = checked;
    this.onChange(checked);
    this.onTouched();
    this.changed.emit(checked);
  }

  writeValue(value: boolean): void {
    this.checked = value;
  }

  registerOnChange(fn: (value: boolean) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.disabled = isDisabled;
  }
}