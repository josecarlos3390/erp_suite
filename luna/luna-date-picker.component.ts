import { Component, Input, Output, EventEmitter, forwardRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, NG_VALUE_ACCESSOR, ControlValueAccessor } from '@angular/forms';

@Component({
  selector: 'luna-date-picker',
  standalone: true,
  imports: [CommonModule, FormsModule],
  providers: [{
    provide: NG_VALUE_ACCESSOR,
    useExisting: forwardRef(() => LunaDatePickerComponent),
    multi: true
  }],
  template: `
    <div class="luna-datepicker" #pickerRef>
      <!-- Input Trigger -->
      <div class="luna-datepicker__trigger" (click)="toggle()">
        <luna-input
          [label]="label"
          [value]="displayValue"
          [placeholder]="placeholder"
          [disabled]="disabled"
          leadingIcon="fas fa-calendar"
          [readonly]="true"
        ></luna-input>
      </div>

      <!-- Calendar Panel -->
      <div *ngIf="isOpen" class="luna-datepicker__panel" [@dropdownAnimation]>
        <!-- Header -->
        <div class="luna-datepicker__header">
          <button class="luna-datepicker__nav" (click)="prevMonth()">
            <i class="fas fa-chevron-left"></i>
          </button>
          <div class="luna-datepicker__title">
            <span class="luna-datepicker__month">{{ monthNames[currentMonth] }}</span>
            <span class="luna-datepicker__year">{{ currentYear }}</span>
          </div>
          <button class="luna-datepicker__nav" (click)="nextMonth()">
            <i class="fas fa-chevron-right"></i>
          </button>
        </div>

        <!-- Day Names -->
        <div class="luna-datepicker__days-header">
          <span *ngFor="let day of dayNames">{{ day }}</span>
        </div>

        <!-- Calendar Grid -->
        <div class="luna-datepicker__grid">
          <button
            *ngFor="let day of calendarDays"
            class="luna-datepicker__day"
            [class.luna-datepicker__day--other]="day.otherMonth"
            [class.luna-datepicker__day--today]="day.isToday"
            [class.luna-datepicker__day--selected]="day.isSelected"
            [class.luna-datepicker__day--range-start]="day.isRangeStart"
            [class.luna-datepicker__day--range-end]="day.isRangeEnd"
            [class.luna-datepicker__day--in-range]="day.inRange"
            [class.luna-datepicker__day--disabled]="day.disabled"
            [disabled]="day.disabled"
            (click)="selectDay(day)"
          >
            {{ day.date }}
          </button>
        </div>

        <!-- Footer -->
        <div class="luna-datepicker__footer">
          <button class="luna-datepicker__today" (click)="goToToday()">Hoy</button>
          <button class="luna-datepicker__clear" (click)="clear()">Limpiar</button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .luna-datepicker {
      position: relative;
      display: inline-block;
      width: 100%;
    }

    .luna-datepicker__trigger {
      cursor: pointer;
    }

    .luna-datepicker__trigger ::ng-deep .luna-input__container {
      cursor: pointer;
    }

    .luna-datepicker__panel {
      position: absolute;
      top: calc(100% + var(--space-2));
      left: 0;
      width: 320px;
      background: var(--glass-bg);
      backdrop-filter: var(--glass-backdrop);
      border: 1px solid var(--glass-border);
      border-radius: var(--radius-xl);
      box-shadow: var(--shadow-xl);
      z-index: var(--z-dropdown);
      padding: var(--space-4);
      animation: luna-dropdown-enter 200ms var(--ease-out-expo);
    }

    /* Header */
    .luna-datepicker__header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: var(--space-4);
    }

    .luna-datepicker__nav {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 32px;
      height: 32px;
      background: none;
      border: none;
      color: var(--text-secondary);
      cursor: pointer;
      border-radius: var(--radius-md);
      transition: all var(--transition-fast);
    }

    .luna-datepicker__nav:hover {
      background: var(--bg-hover);
      color: var(--text-primary);
    }

    .luna-datepicker__title {
      display: flex;
      align-items: center;
      gap: var(--space-2);
      font-family: var(--font-sans);
    }

    .luna-datepicker__month {
      font-size: var(--text-base);
      font-weight: var(--fw-semibold);
      color: var(--text-primary);
    }

    .luna-datepicker__year {
      font-size: var(--text-base);
      color: var(--text-secondary);
    }

    /* Day Names */
    .luna-datepicker__days-header {
      display: grid;
      grid-template-columns: repeat(7, 1fr);
      gap: var(--space-1);
      margin-bottom: var(--space-2);
    }

    .luna-datepicker__days-header span {
      text-align: center;
      font-size: var(--text-xs);
      font-weight: var(--fw-semibold);
      color: var(--text-tertiary);
      padding: var(--space-2) 0;
    }

    /* Grid */
    .luna-datepicker__grid {
      display: grid;
      grid-template-columns: repeat(7, 1fr);
      gap: var(--space-1);
    }

    .luna-datepicker__day {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 36px;
      height: 36px;
      font-family: var(--font-sans);
      font-size: var(--text-sm);
      color: var(--text-primary);
      background: none;
      border: none;
      border-radius: var(--radius-md);
      cursor: pointer;
      transition: all var(--transition-fast);
      position: relative;
    }

    .luna-datepicker__day:hover:not(:disabled) {
      background: var(--bg-hover);
    }

    .luna-datepicker__day--other {
      color: var(--text-tertiary);
    }

    .luna-datepicker__day--today {
      color: var(--text-accent);
      font-weight: var(--fw-semibold);
    }

    .luna-datepicker__day--today::after {
      content: '';
      position: absolute;
      bottom: 4px;
      left: 50%;
      transform: translateX(-50%);
      width: 4px;
      height: 4px;
      border-radius: var(--radius-full);
      background: var(--accent-500);
    }

    .luna-datepicker__day--selected {
      background: var(--accent-500) !important;
      color: var(--text-inverse) !important;
      font-weight: var(--fw-semibold);
      box-shadow: var(--shadow-accent-lg);
    }

    .luna-datepicker__day--selected::after {
      display: none;
    }

    .luna-datepicker__day--in-range {
      background: var(--accent-50);
      color: var(--text-accent);
      border-radius: 0;
    }

    .luna-datepicker__day--range-start {
      background: var(--accent-500);
      color: var(--text-inverse);
      border-radius: var(--radius-md) 0 0 var(--radius-md);
    }

    .luna-datepicker__day--range-end {
      background: var(--accent-500);
      color: var(--text-inverse);
      border-radius: 0 var(--radius-md) var(--radius-md) 0;
    }

    .luna-datepicker__day--disabled {
      opacity: 0.4;
      cursor: not-allowed;
      text-decoration: line-through;
    }

    /* Footer */
    .luna-datepicker__footer {
      display: flex;
      justify-content: space-between;
      margin-top: var(--space-4);
      padding-top: var(--space-3);
      border-top: 1px solid var(--border-subtle);
    }

    .luna-datepicker__today,
    .luna-datepicker__clear {
      font-size: var(--text-sm);
      font-weight: var(--fw-medium);
      color: var(--text-accent);
      background: none;
      border: none;
      cursor: pointer;
      padding: var(--space-2) var(--space-3);
      border-radius: var(--radius-md);
      transition: all var(--transition-fast);
    }

    .luna-datepicker__today:hover,
    .luna-datepicker__clear:hover {
      background: var(--bg-hover);
    }

    .luna-datepicker__clear {
      color: var(--text-secondary);
    }
  `]
})
export class LunaDatePickerComponent implements ControlValueAccessor {
  @Input() label?: string;
  @Input() placeholder = 'Seleccionar fecha';
  @Input() disabled = false;
  @Input() minDate?: Date;
  @Input() maxDate?: Date;
  @Input() range = false;

  @Output() dateChange = new EventEmitter<Date | Date[]>();

  isOpen = false;
  currentMonth = new Date().getMonth();
  currentYear = new Date().getFullYear();
  selectedDate?: Date;
  selectedRange?: [Date, Date];

  displayValue = '';

  monthNames = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
  ];

  dayNames = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

  private onChange: (value: any) => void = () => {};
  private onTouched: () => void = () => {};

  get calendarDays(): CalendarDay[] {
    const days: CalendarDay[] = [];
    const firstDay = new Date(this.currentYear, this.currentMonth, 1);
    const lastDay = new Date(this.currentYear, this.currentMonth + 1, 0);
    const startOffset = firstDay.getDay();

    // Previous month days
    const prevMonth = new Date(this.currentYear, this.currentMonth, 0);
    for (let i = startOffset - 1; i >= 0; i--) {
      days.push({
        date: prevMonth.getDate() - i,
        otherMonth: true,
        isToday: false,
        isSelected: false,
        disabled: true
      });
    }

    // Current month days
    const today = new Date();
    for (let i = 1; i <= lastDay.getDate(); i++) {
      const date = new Date(this.currentYear, this.currentMonth, i);
      days.push({
        date: i,
        otherMonth: false,
        isToday: this.isSameDay(date, today),
        isSelected: this.selectedDate ? this.isSameDay(date, this.selectedDate) : false,
        isRangeStart: this.selectedRange ? this.isSameDay(date, this.selectedRange[0]) : false,
        isRangeEnd: this.selectedRange ? this.isSameDay(date, this.selectedRange[1]) : false,
        inRange: this.selectedRange ? this.isInRange(date) : false,
        disabled: this.isDisabled(date),
        fullDate: date
      });
    }

    // Next month days
    const remaining = 42 - days.length;
    for (let i = 1; i <= remaining; i++) {
      days.push({
        date: i,
        otherMonth: true,
        isToday: false,
        isSelected: false,
        disabled: true
      });
    }

    return days;
  }

  toggle(): void {
    if (this.disabled) return;
    this.isOpen = !this.isOpen;
    if (this.isOpen && this.selectedDate) {
      this.currentMonth = this.selectedDate.getMonth();
      this.currentYear = this.selectedDate.getFullYear();
    }
  }

  prevMonth(): void {
    if (this.currentMonth === 0) {
      this.currentMonth = 11;
      this.currentYear--;
    } else {
      this.currentMonth--;
    }
  }

  nextMonth(): void {
    if (this.currentMonth === 11) {
      this.currentMonth = 0;
      this.currentYear++;
    } else {
      this.currentMonth++;
    }
  }

  goToToday(): void {
    const today = new Date();
    this.currentMonth = today.getMonth();
    this.currentYear = today.getFullYear();
    this.selectDate(today);
  }

  selectDay(day: CalendarDay): void {
    if (day.disabled || !day.fullDate) return;
    this.selectDate(day.fullDate);
  }

  selectDate(date: Date): void {
    this.selectedDate = date;
    this.displayValue = this.formatDate(date);
    this.onChange(date);
    this.onTouched();
    this.dateChange.emit(date);
    this.isOpen = false;
  }

  clear(): void {
    this.selectedDate = undefined;
    this.displayValue = '';
    this.onChange(null);
    this.onTouched();
    this.dateChange.emit(undefined);
    this.isOpen = false;
  }

  private formatDate(date: Date): string {
    return date.toLocaleDateString('es-PE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  }

  private isSameDay(d1: Date, d2: Date): boolean {
    return d1.getDate() === d2.getDate() &&
           d1.getMonth() === d2.getMonth() &&
           d1.getFullYear() === d2.getFullYear();
  }

  private isInRange(date: Date): boolean {
    if (!this.selectedRange) return false;
    return date > this.selectedRange[0] && date < this.selectedRange[1];
  }

  private isDisabled(date: Date): boolean {
    if (this.minDate && date < this.minDate) return true;
    if (this.maxDate && date > this.maxDate) return true;
    return false;
  }

  writeValue(value: Date | null): void {
    if (value) {
      this.selectedDate = value;
      this.displayValue = this.formatDate(value);
    } else {
      this.selectedDate = undefined;
      this.displayValue = '';
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

interface CalendarDay {
  date: number;
  otherMonth: boolean;
  isToday: boolean;
  isSelected: boolean;
  isRangeStart?: boolean;
  isRangeEnd?: boolean;
  inRange?: boolean;
  disabled: boolean;
  fullDate?: Date;
}