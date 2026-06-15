import { Component, Input, Output, EventEmitter, forwardRef, HostListener, ElementRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, NG_VALUE_ACCESSOR, ControlValueAccessor } from '@angular/forms';

export interface SelectOption {
  label: string;
  value: any;
  icon?: string;
  disabled?: boolean;
  description?: string;
}

@Component({
  selector: 'luna-select',
  standalone: true,
  imports: [CommonModule, FormsModule],
  providers: [{
    provide: NG_VALUE_ACCESSOR,
    useExisting: forwardRef(() => LunaSelectComponent),
    multi: true
  }],
  template: `
    <div class="luna-select" #selectRef>
      <!-- Label -->
      <label *ngIf="label" class="luna-select__label">
        {{ label }}
        <span *ngIf="required" class="luna-select__required">*</span>
      </label>

      <!-- Trigger -->
      <div
        class="luna-select__trigger"
        [class.luna-select__trigger--open]="isOpen"
        [class.luna-select__trigger--error]="error"
        [class.luna-select__trigger--disabled]="disabled"
        (click)="toggle()"
      >
        <!-- Multiple selected tags -->
        <div *ngIf="multiple && selectedOptions.length > 0" class="luna-select__tags">
          <span
            *ngFor="let opt of selectedOptions.slice(0, maxTags); let i = index"
            class="luna-select__tag"
          >
            <i *ngIf="opt.icon" [class]="opt.icon" class="luna-select__tag-icon"></i>
            <span class="luna-select__tag-label">{{ opt.label }}</span>
            <button
              class="luna-select__tag-remove"
              (click)="removeOption(opt, $event)"
              aria-label="Remove"
            >
              <i class="fas fa-times"></i>
            </button>
          </span>
          <span *ngIf="selectedOptions.length > maxTags" class="luna-select__tag-more">
            +{{ selectedOptions.length - maxTags }}
          </span>
        </div>

        <!-- Single selected or placeholder -->
        <span
          *ngIf="!multiple || selectedOptions.length === 0"
          class="luna-select__value"
          [class.luna-select__value--placeholder]="!selectedOption"
        >
          <i *ngIf="selectedOption?.icon" [class]="selectedOption.icon" class="luna-select__value-icon"></i>
          {{ selectedOption?.label || placeholder }}
        </span>

        <!-- Clear button -->
        <button
          *ngIf="clearable && (selectedOption || selectedOptions.length > 0)"
          class="luna-select__clear"
          (click)="clear($event)"
          aria-label="Limpiar"
        >
          <i class="fas fa-times-circle"></i>
        </button>

        <!-- Chevron -->
        <i class="luna-select__chevron fas fa-chevron-down" [class.luna-select__chevron--open]="isOpen"></i>
      </div>

      <!-- Error message -->
      <div *ngIf="error" class="luna-select__error">
        <i class="fas fa-exclamation-circle"></i>
        {{ error }}
      </div>

      <!-- Dropdown Panel -->
      <div
        *ngIf="isOpen"
        class="luna-select__panel"
        [@dropdownAnimation]
      >
        <!-- Search -->
        <div *ngIf="searchable" class="luna-select__search">
          <i class="fas fa-search luna-select__search-icon"></i>
          <input
            type="text"
            class="luna-select__search-input"
            placeholder="Buscar..."
            [(ngModel)]="searchQuery"
            (input)="filterOptions()"
            (click)="$event.stopPropagation()"
            autofocus
          />
        </div>

        <!-- Options list -->
        <div class="luna-select__options">
          <ng-container *ngFor="let opt of filteredOptions; let i = index">
            <!-- Group header -->
            <div *ngIf="opt._isGroup" class="luna-select__group-header">
              {{ opt.label }}
            </div>

            <!-- Option -->
            <button
              *ngIf="!opt._isGroup"
              class="luna-select__option"
              [class.luna-select__option--selected]="isSelected(opt)"
              [class.luna-select__option--active]="activeIndex === i"
              [class.luna-select__option--disabled]="opt.disabled"
              [disabled]="opt.disabled"
              (click)="selectOption(opt)"
              (mouseenter)="activeIndex = i"
            >
              <!-- Checkbox for multiple -->
              <luna-checkbox
                *ngIf="multiple"
                [checked]="isSelected(opt)"
                [disabled]="opt.disabled"
                (changed)="toggleOption(opt, $event)"
                (click)="$event.stopPropagation()"
              ></luna-checkbox>

              <div class="luna-select__option-content">
                <div class="luna-select__option-main">
                  <i *ngIf="opt.icon" [class]="opt.icon" class="luna-select__option-icon"></i>
                  <span class="luna-select__option-label" [innerHTML]="highlightMatch(opt.label)"></span>
                </div>
                <div *ngIf="opt.description" class="luna-select__option-desc">
                  {{ opt.description }}
                </div>
              </div>

              <!-- Checkmark for single -->
              <i *ngIf="!multiple && isSelected(opt)" class="luna-select__option-check fas fa-check"></i>
            </button>
          </ng-container>

          <!-- Empty state -->
          <div *ngIf="filteredOptions.length === 0" class="luna-select__empty">
            <i class="fas fa-search"></i>
            <p>No se encontraron resultados</p>
          </div>

          <!-- Create option -->
          <button
            *ngIf="allowCreate && searchQuery && !exactMatch"
            class="luna-select__create"
            (click)="createOption()"
          >
            <i class="fas fa-plus"></i>
            Crear "{{ searchQuery }}"
          </button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .luna-select {
      position: relative;
      display: flex;
      flex-direction: column;
      gap: var(--space-1);
      width: 100%;
    }

    .luna-select__label {
      font-size: var(--text-xs);
      font-weight: var(--fw-medium);
      color: var(--text-secondary);
      letter-spacing: var(--ls-xs);
    }

    .luna-select__required {
      color: var(--text-error);
      margin-left: var(--space-0-5);
    }

    /* Trigger */
    .luna-select__trigger {
      display: flex;
      align-items: center;
      gap: var(--space-2);
      min-height: 36px;
      padding: var(--space-2) var(--space-3);
      background: var(--bg-base);
      border: 1px solid var(--border-default);
      border-radius: var(--radius-md);
      cursor: pointer;
      transition: all var(--transition-fast);
      overflow: hidden;
    }

    .luna-select__trigger:hover {
      border-color: var(--border-strong);
    }

    .luna-select__trigger--open {
      border-color: var(--border-focus);
      box-shadow: var(--glow-accent);
    }

    .luna-select__trigger--error {
      border-color: var(--border-error);
      box-shadow: var(--glow-error);
    }

    .luna-select__trigger--disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    /* Tags (multiple) */
    .luna-select__tags {
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      gap: var(--space-1);
      flex: 1;
    }

    .luna-select__tag {
      display: inline-flex;
      align-items: center;
      gap: var(--space-1);
      padding: var(--space-0-5) var(--space-2);
      background: var(--bg-selected);
      color: var(--text-accent);
      border-radius: var(--radius-md);
      font-size: var(--text-xs);
      font-weight: var(--fw-medium);
    }

    .luna-select__tag-icon {
      font-size: 10px;
    }

    .luna-select__tag-remove {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 14px;
      height: 14px;
      background: none;
      border: none;
      color: currentColor;
      opacity: 0.6;
      cursor: pointer;
      border-radius: var(--radius-sm);
      font-size: 10px;
      transition: opacity var(--transition-fast);
    }

    .luna-select__tag-remove:hover {
      opacity: 1;
      background: rgba(0,0,0,0.1);
    }

    .luna-select__tag-more {
      font-size: var(--text-xs);
      color: var(--text-secondary);
      padding: var(--space-0-5) var(--space-2);
    }

    /* Value (single) */
    .luna-select__value {
      display: flex;
      align-items: center;
      gap: var(--space-2);
      flex: 1;
      font-size: var(--text-sm);
      color: var(--text-primary);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .luna-select__value--placeholder {
      color: var(--text-tertiary);
    }

    .luna-select__value-icon {
      font-size: 14px;
      color: var(--text-tertiary);
    }

    /* Clear button */
    .luna-select__clear {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 20px;
      height: 20px;
      background: none;
      border: none;
      color: var(--text-tertiary);
      cursor: pointer;
      border-radius: var(--radius-sm);
      transition: all var(--transition-fast);
      flex-shrink: 0;
    }

    .luna-select__clear:hover {
      color: var(--text-primary);
      background: var(--bg-hover);
    }

    /* Chevron */
    .luna-select__chevron {
      font-size: 12px;
      color: var(--text-tertiary);
      transition: transform var(--transition-base);
      flex-shrink: 0;
    }

    .luna-select__chevron--open {
      transform: rotate(180deg);
    }

    /* Error */
    .luna-select__error {
      display: flex;
      align-items: center;
      gap: var(--space-1);
      font-size: var(--text-xs);
      color: var(--text-error);
    }

    .luna-select__error i {
      font-size: 12px;
    }

    /* Panel */
    .luna-select__panel {
      position: absolute;
      top: calc(100% + var(--space-2));
      left: 0;
      right: 0;
      background: var(--glass-bg);
      backdrop-filter: var(--glass-backdrop);
      border: 1px solid var(--glass-border);
      border-radius: var(--radius-lg);
      box-shadow: var(--shadow-lg);
      z-index: var(--z-dropdown);
      overflow: hidden;
      animation: luna-dropdown-enter 150ms var(--ease-out-expo);
    }

    /* Search */
    .luna-select__search {
      display: flex;
      align-items: center;
      gap: var(--space-2);
      padding: var(--space-3) var(--space-4);
      border-bottom: 1px solid var(--border-subtle);
    }

    .luna-select__search-icon {
      color: var(--text-tertiary);
      font-size: 14px;
    }

    .luna-select__search-input {
      flex: 1;
      background: none;
      border: none;
      font-family: var(--font-sans);
      font-size: var(--text-sm);
      color: var(--text-primary);
      outline: none;
    }

    .luna-select__search-input::placeholder {
      color: var(--text-tertiary);
    }

    /* Options */
    .luna-select__options {
      max-height: 280px;
      overflow-y: auto;
      padding: var(--space-2);
    }

    .luna-select__group-header {
      padding: var(--space-2) var(--space-3);
      font-size: var(--text-2xs);
      font-weight: var(--fw-semibold);
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--text-tertiary);
    }

    .luna-select__option {
      display: flex;
      align-items: center;
      gap: var(--space-3);
      width: 100%;
      padding: var(--space-2) var(--space-3);
      background: none;
      border: none;
      border-radius: var(--radius-md);
      cursor: pointer;
      text-align: left;
      transition: all var(--transition-fast);
    }

    .luna-select__option:hover:not(:disabled) {
      background: var(--bg-hover);
    }

    .luna-select__option--active {
      background: var(--bg-hover);
    }

    .luna-select__option--selected {
      background: var(--bg-selected);
      color: var(--text-accent);
    }

    .luna-select__option--disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .luna-select__option-content {
      flex: 1;
      min-width: 0;
    }

    .luna-select__option-main {
      display: flex;
      align-items: center;
      gap: var(--space-2);
    }

    .luna-select__option-icon {
      font-size: 14px;
      color: var(--text-tertiary);
    }

    .luna-select__option-label {
      font-size: var(--text-sm);
      color: var(--text-primary);
      font-weight: var(--fw-medium);
    }

    .luna-select__option-label ::ng-deep mark {
      background: var(--accent-200);
      color: var(--accent-800);
      border-radius: var(--radius-sm);
      padding: 0 2px;
    }

    .luna-select__option-desc {
      font-size: var(--text-xs);
      color: var(--text-tertiary);
      margin-top: var(--space-0-5);
    }

    .luna-select__option-check {
      font-size: 14px;
      color: var(--text-accent);
    }

    /* Empty state */
    .luna-select__empty {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: var(--space-2);
      padding: var(--space-8) var(--space-4);
      color: var(--text-tertiary);
    }

    .luna-select__empty i {
      font-size: 24px;
    }

    .luna-select__empty p {
      font-size: var(--text-sm);
      margin: 0;
    }

    /* Create option */
    .luna-select__create {
      display: flex;
      align-items: center;
      gap: var(--space-2);
      width: 100%;
      padding: var(--space-3) var(--space-4);
      background: none;
      border: none;
      border-top: 1px solid var(--border-subtle);
      font-size: var(--text-sm);
      color: var(--text-accent);
      cursor: pointer;
      transition: all var(--transition-fast);
    }

    .luna-select__create:hover {
      background: var(--bg-hover);
    }

    .luna-select__create i {
      font-size: 12px;
    }
  `]
})
export class LunaSelectComponent implements ControlValueAccessor {
  @Input() label?: string;
  @Input() placeholder = 'Seleccionar...';
  @Input() options: SelectOption[] = [];
  @Input() disabled = false;
  @Input() required = false;
  @Input() error?: string;
  @Input() clearable = true;
  @Input() searchable = false;
  @Input() multiple = false;
  @Input() allowCreate = false;
  @Input() maxTags = 3;

  @Output() optionSelected = new EventEmitter<SelectOption>();
  @Output() optionCreated = new EventEmitter<string>();

  @ViewChild('selectRef') selectRef!: ElementRef;

  isOpen = false;
  searchQuery = '';
  filteredOptions: SelectOption[] = [];
  activeIndex = -1;
  selectedOption?: SelectOption;
  selectedOptions: SelectOption[] = [];

  private onChange: (value: any) => void = () => {};
  private onTouched: () => void = () => {};

  @HostListener('document:click', ['$event'])
  onClickOutside(event: Event): void {
    if (this.isOpen && !this.selectRef?.nativeElement.contains(event.target)) {
      this.close();
    }
  }

  @HostListener('document:keydown.escape', ['$event'])
  onEscape(event: KeyboardEvent): void {
    if (this.isOpen) {
      this.close();
    }
  }

  ngOnInit(): void {
    this.filteredOptions = this.options;
  }

  ngOnChanges(): void {
    this.filteredOptions = this.filterOptionsList(this.options, this.searchQuery);
  }

  toggle(): void {
    if (this.disabled) return;
    this.isOpen ? this.close() : this.open();
  }

  open(): void {
    this.isOpen = true;
    this.searchQuery = '';
    this.filteredOptions = this.options;
    this.activeIndex = -1;
  }

  close(): void {
    this.isOpen = false;
    this.searchQuery = '';
    this.onTouched();
  }

  filterOptions(): void {
    this.filteredOptions = this.filterOptionsList(this.options, this.searchQuery);
    this.activeIndex = -1;
  }

  private filterOptionsList(options: SelectOption[], query: string): SelectOption[] {
    if (!query.trim()) return options;
    const q = query.toLowerCase();
    return options.filter(opt => 
      !opt._isGroup && (opt.label.toLowerCase().includes(q) || opt.description?.toLowerCase().includes(q))
    );
  }

  get exactMatch(): boolean {
    return this.options.some(opt => opt.label.toLowerCase() === this.searchQuery.toLowerCase());
  }

  isSelected(option: SelectOption): boolean {
    if (this.multiple) {
      return this.selectedOptions.some(o => o.value === option.value);
    }
    return this.selectedOption?.value === option.value;
  }

  selectOption(option: SelectOption): void {
    if (option.disabled) return;

    if (this.multiple) {
      this.toggleOption(option, !this.isSelected(option));
    } else {
      this.selectedOption = option;
      this.onChange(option.value);
      this.optionSelected.emit(option);
      this.close();
    }
  }

  toggleOption(option: SelectOption, selected: boolean): void {
    if (selected) {
      if (!this.selectedOptions.some(o => o.value === option.value)) {
        this.selectedOptions.push(option);
      }
    } else {
      this.selectedOptions = this.selectedOptions.filter(o => o.value !== option.value);
    }

    this.onChange(this.selectedOptions.map(o => o.value));
    this.optionSelected.emit(option);
  }

  removeOption(option: SelectOption, event: Event): void {
    event.stopPropagation();
    this.selectedOptions = this.selectedOptions.filter(o => o.value !== option.value);
    this.onChange(this.selectedOptions.map(o => o.value));
  }

  createOption(): void {
    if (!this.searchQuery.trim()) return;
    this.optionCreated.emit(this.searchQuery);
    this.searchQuery = '';
    this.close();
  }

  clear(event?: Event): void {
    event?.stopPropagation();
    this.selectedOption = undefined;
    this.selectedOptions = [];
    this.onChange(this.multiple ? [] : null);
    this.close();
  }

  highlightMatch(text: string): string {
    if (!this.searchQuery.trim()) return text;
    const regex = new RegExp(`(${this.searchQuery.replace(/[.*+?^${}()|[\]\]/g, '\$&')})`, 'gi');
    return text.replace(regex, '<mark>$1</mark>');
  }

  writeValue(value: any): void {
    if (this.multiple) {
      if (Array.isArray(value)) {
        this.selectedOptions = this.options.filter(o => value.includes(o.value));
      }
    } else {
      this.selectedOption = this.options.find(o => o.value === value);
    }
  }

  registerOnChange(fn: (value: any) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.disabled = isDisabled;
  }
}

// Extend SelectOption for internal use
declare module './luna-select.component' {
  interface SelectOption {
    _isGroup?: boolean;
  }
}