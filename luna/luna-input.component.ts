import { Component, Input, Output, EventEmitter, forwardRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, NG_VALUE_ACCESSOR, ControlValueAccessor } from '@angular/forms';

export type InputVariant = 'default' | 'filled' | 'glass';
export type InputSize = 'sm' | 'md' | 'lg';

@Component({
  selector: 'luna-input',
  standalone: true,
  imports: [CommonModule, FormsModule],
  providers: [{
    provide: NG_VALUE_ACCESSOR,
    useExisting: forwardRef(() => LunaInputComponent),
    multi: true
  }],
  template: `
    <div class="luna-input-wrapper" [class.luna-input-wrapper--error]="error">
      <label *ngIf="label" class="luna-input__label" [attr.for]="inputId">
        {{ label }}
        <span *ngIf="required" class="luna-input__required">*</span>
      </label>

      <div class="luna-input__container" [class.luna-input__container--focused]="focused">
        <!-- Leading icon -->
        <span *ngIf="leadingIcon" class="luna-input__leading">
          <i [class]="leadingIcon"></i>
        </span>

        <!-- Prefix -->
        <span *ngIf="prefix" class="luna-input__prefix">{{ prefix }}</span>

        <input
          [id]="inputId"
          [type]="type"
          [placeholder]="placeholder"
          [disabled]="disabled"
          [readonly]="readonly"
          [value]="value"
          (input)="onInput($event)"
          (focus)="onFocus()"
          (blur)="onBlur()"
          class="luna-input"
          [class.luna-input--with-leading]="leadingIcon"
          [class.luna-input--with-trailing]="trailingIcon || clearable"
        />

        <!-- Suffix -->
        <span *ngIf="suffix" class="luna-input__suffix">{{ suffix }}</span>

        <!-- Clear button -->
        <button
          *ngIf="clearable && value"
          type="button"
          class="luna-input__clear"
          (click)="clear()"
          aria-label="Limpiar"
        >
          <i class="fas fa-times-circle"></i>
        </button>

        <!-- Trailing icon -->
        <span *ngIf="trailingIcon && !clearable" class="luna-input__trailing">
          <i [class]="trailingIcon"></i>
        </span>
      </div>

      <!-- Helper text -->
      <div *ngIf="helperText || error" class="luna-input__helper">
        <span *ngIf="error" class="luna-input__error">
          <i class="fas fa-exclamation-circle"></i>
          {{ error }}
        </span>
        <span *ngIf="!error && helperText" class="luna-input__hint">{{ helperText }}</span>
      </div>
    </div>
  `,
  styles: [`
    .luna-input-wrapper {
      display: flex;
      flex-direction: column;
      gap: var(--space-1);
      width: 100%;
    }

    .luna-input__label {
      font-size: var(--text-xs);
      font-weight: var(--fw-medium);
      color: var(--text-secondary);
      letter-spacing: var(--ls-xs);
    }

    .luna-input__required {
      color: var(--text-error);
      margin-left: var(--space-0-5);
    }

    .luna-input__container {
      position: relative;
      display: flex;
      align-items: center;
      background: var(--bg-base);
      border: 1px solid var(--border-default);
      border-radius: var(--radius-md);
      transition: all var(--transition-fast);
      overflow: hidden;
    }

    .luna-input__container:hover {
      border-color: var(--border-strong);
    }

    .luna-input__container--focused {
      border-color: var(--border-focus);
      box-shadow: var(--glow-accent);
    }

    .luna-input-wrapper--error .luna-input__container {
      border-color: var(--border-error);
      box-shadow: var(--glow-error);
    }

    .luna-input-wrapper--error .luna-input__container--focused {
      box-shadow: var(--glow-error);
    }

    .luna-input {
      flex: 1;
      min-width: 0;
      background: transparent;
      border: none;
      outline: none;
      font-family: var(--font-sans);
      font-size: var(--text-sm);
      color: var(--text-primary);
      padding: 0 var(--space-3);
    }

    .luna-input::placeholder {
      color: var(--text-tertiary);
    }

    .luna-input:disabled {
      cursor: not-allowed;
      color: var(--text-disabled);
    }

    .luna-input--with-leading { padding-left: 0; }
    .luna-input--with-trailing { padding-right: 0; }

    /* Sizes */
    .luna-input-wrapper--sm .luna-input__container { height: 32px; }
    .luna-input-wrapper--md .luna-input__container { height: 36px; }
    .luna-input-wrapper--lg .luna-input__container { height: 40px; }

    .luna-input-wrapper--sm .luna-input { font-size: var(--text-xs); }
    .luna-input-wrapper--lg .luna-input { font-size: var(--text-base); }

    /* Icons */
    .luna-input__leading,
    .luna-input__trailing {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 36px;
      color: var(--text-tertiary);
      font-size: 14px;
    }

    .luna-input__prefix,
    .luna-input__suffix {
      font-size: var(--text-sm);
      color: var(--text-secondary);
      padding: 0 var(--space-2);
      font-weight: var(--fw-medium);
    }

    .luna-input__clear {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 28px;
      height: 28px;
      background: none;
      border: none;
      color: var(--text-tertiary);
      cursor: pointer;
      border-radius: var(--radius-sm);
      transition: all var(--transition-fast);
    }

    .luna-input__clear:hover {
      background: var(--bg-hover);
      color: var(--text-primary);
    }

    /* Helper */
    .luna-input__helper {
      display: flex;
      align-items: center;
      gap: var(--space-1);
      font-size: var(--text-xs);
      min-height: 18px;
    }

    .luna-input__hint {
      color: var(--text-tertiary);
    }

    .luna-input__error {
      color: var(--text-error);
      display: flex;
      align-items: center;
      gap: var(--space-1);
    }

    .luna-input__error i {
      font-size: 12px;
    }

    /* Glass variant */
    .luna-input-wrapper--glass .luna-input__container {
      background: var(--glass-bg);
      backdrop-filter: var(--glass-backdrop);
      border-color: var(--glass-border);
    }

    .luna-input-wrapper--glass .luna-input__container:hover {
      border-color: var(--glass-border-strong);
    }

    .luna-input-wrapper--glass .luna-input__container--focused {
      background: var(--glass-bg-elevated);
      border-color: var(--border-accent);
    }

    /* Filled variant */
    .luna-input-wrapper--filled .luna-input__container {
      background: var(--bg-surface);
      border-color: transparent;
    }

    .luna-input-wrapper--filled .luna-input__container:hover {
      background: var(--bg-hover);
    }

    .luna-input-wrapper--filled .luna-input__container--focused {
      background: var(--bg-base);
      border-color: var(--border-focus);
    }
  `]
})
export class LunaInputComponent implements ControlValueAccessor {
  @Input() label?: string;
  @Input() type = 'text';
  @Input() placeholder = '';
  @Input() helperText?: string;
  @Input() error?: string;
  @Input() disabled = false;
  @Input() readonly = false;
  @Input() required = false;
  @Input() clearable = false;
  @Input() leadingIcon?: string;
  @Input() trailingIcon?: string;
  @Input() prefix?: string;
  @Input() suffix?: string;
  @Input() variant: InputVariant = 'default';
  @Input() size: InputSize = 'md';

  @Output() focused = new EventEmitter<boolean>();
  @Output() cleared = new EventEmitter<void>();

  value = '';
  focused = false;
  inputId = 'luna-input-' + Math.random().toString(36).substr(2, 9);

  private onChange: (value: string) => void = () => {};
  private onTouched: () => void = () => {};

  onInput(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.value = value;
    this.onChange(value);
  }

  onFocus(): void {
    this.focused = true;
    this.focused.emit(true);
  }

  onBlur(): void {
    this.focused = false;
    this.focused.emit(false);
    this.onTouched();
  }

  clear(): void {
    this.value = '';
    this.onChange('');
    this.cleared.emit();
  }

  writeValue(value: string): void {
    this.value = value || '';
  }

  registerOnChange(fn: (value: string) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.disabled = isDisabled;
  }
}