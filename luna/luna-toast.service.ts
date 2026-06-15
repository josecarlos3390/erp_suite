import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

export interface Toast {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message?: string;
  duration?: number;
  action?: {
    label: string;
    callback: () => void;
  };
}

@Injectable({ providedIn: 'root' })
export class LunaToastService {
  private toasts = new BehaviorSubject<Toast[]>([]);
  toasts$ = this.toasts.asObservable();

  private timers = new Map<string, ReturnType<typeof setTimeout>>();
  private paused = new Set<string>();
  private remaining = new Map<string, number>();
  private startTimes = new Map<string, number>();

  show(toast: Omit<Toast, 'id'>): string {
    const id = Math.random().toString(36).substring(2, 9);
    const newToast: Toast = {
      ...toast,
      id,
      duration: toast.duration ?? 5000
    };

    this.toasts.next([...this.toasts.value, newToast]);
    this.startTimer(id, newToast.duration);

    return id;
  }

  success(title: string, message?: string): string {
    return this.show({ type: 'success', title, message });
  }

  error(title: string, message?: string): string {
    return this.show({ type: 'error', title, message, duration: 8000 });
  }

  warning(title: string, message?: string): string {
    return this.show({ type: 'warning', title, message });
  }

  info(title: string, message?: string): string {
    return this.show({ type: 'info', title, message });
  }

  dismiss(id: string): void {
    this.clearTimer(id);
    this.toasts.next(this.toasts.value.filter(t => t.id !== id));
  }

  dismissAll(): void {
    this.timers.forEach((_, id) => this.clearTimer(id));
    this.toasts.next([]);
  }

  pause(id: string): void {
    if (this.paused.has(id)) return;

    const timer = this.timers.get(id);
    if (timer) {
      clearTimeout(timer);
      this.timers.delete(id);

      const startTime = this.startTimes.get(id) || Date.now();
      const duration = this.toasts.value.find(t => t.id === id)?.duration || 5000;
      const elapsed = Date.now() - startTime;
      this.remaining.set(id, duration - elapsed);
      this.paused.add(id);
    }
  }

  resume(id: string): void {
    if (!this.paused.has(id)) return;

    const remaining = this.remaining.get(id) || 5000;
    this.startTimer(id, remaining);
    this.paused.delete(id);
    this.remaining.delete(id);
  }

  private startTimer(id: string, duration: number): void {
    this.clearTimer(id);
    this.startTimes.set(id, Date.now());

    const timer = setTimeout(() => {
      this.dismiss(id);
    }, duration);

    this.timers.set(id, timer);
  }

  private clearTimer(id: string): void {
    const timer = this.timers.get(id);
    if (timer) {
      clearTimeout(timer);
      this.timers.delete(id);
    }
    this.startTimes.delete(id);
  }
}