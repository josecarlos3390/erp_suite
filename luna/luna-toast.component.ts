import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LunaToastService, Toast } from './luna-toast.service';

@Component({
  selector: 'luna-toast-container',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="luna-toast-container" role="region" aria-label="Notificaciones">
      <div
        *ngFor="let toast of toastService.toasts$ | async; trackBy: trackById"
        class="luna-toast"
        [class]="'luna-toast--' + toast.type"
        [@toastAnimation]
        (mouseenter)="toastService.pause(toast.id)"
        (mouseleave)="toastService.resume(toast.id)"
      >
        <!-- Icon -->
        <div class="luna-toast__icon">
          <i [class]="getIcon(toast.type)"></i>
        </div>

        <!-- Content -->
        <div class="luna-toast__content">
          <div class="luna-toast__title">{{ toast.title }}</div>
          <div *ngIf="toast.message" class="luna-toast__message">{{ toast.message }}</div>
        </div>

        <!-- Action -->
        <button
          *ngIf="toast.action"
          class="luna-toast__action"
          (click)="toast.action.callback(); dismiss(toast.id)"
        >
          {{ toast.action.label }}
        </button>

        <!-- Close -->
        <button
          class="luna-toast__close"
          (click)="dismiss(toast.id)"
          aria-label="Cerrar notificación"
        >
          <i class="fas fa-times"></i>
        </button>

        <!-- Progress bar -->
        <div class="luna-toast__progress">
          <div
            class="luna-toast__progress-bar"
            [style.animation-duration.ms]="toast.duration"
          ></div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .luna-toast-container {
      position: fixed;
      bottom: var(--space-6);
      right: var(--space-6);
      z-index: var(--z-toast);
      display: flex;
      flex-direction: column;
      gap: var(--space-3);
      pointer-events: none;
      max-width: 480px;
    }

    .luna-toast {
      position: relative;
      display: flex;
      align-items: flex-start;
      gap: var(--space-3);
      padding: var(--space-4);
      background: var(--glass-bg);
      backdrop-filter: var(--glass-backdrop);
      border: 1px solid var(--glass-border);
      border-radius: var(--radius-xl);
      box-shadow: var(--shadow-xl);
      pointer-events: all;
      overflow: hidden;
      min-width: 360px;
    }

    .luna-toast--success { border-left: 3px solid var(--success-500); }
    .luna-toast--error { border-left: 3px solid var(--error-500); }
    .luna-toast--warning { border-left: 3px solid var(--warning-500); }
    .luna-toast--info { border-left: 3px solid var(--info-500); }

    .luna-toast__icon {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 20px;
      height: 20px;
      border-radius: var(--radius-full);
      flex-shrink: 0;
      margin-top: 2px;
      font-size: 20px;
    }

    .luna-toast--success .luna-toast__icon { color: var(--success-500); }
    .luna-toast--error .luna-toast__icon { color: var(--error-500); }
    .luna-toast--warning .luna-toast__icon { color: var(--warning-500); }
    .luna-toast--info .luna-toast__icon { color: var(--info-500); }

    .luna-toast__content {
      flex: 1;
      min-width: 0;
    }

    .luna-toast__title {
      font-size: var(--text-sm);
      font-weight: var(--fw-semibold);
      color: var(--text-primary);
      line-height: var(--lh-sm);
    }

    .luna-toast__message {
      font-size: var(--text-xs);
      color: var(--text-secondary);
      margin-top: var(--space-0-5);
      line-height: var(--lh-xs);
    }

    .luna-toast__action {
      font-size: var(--text-xs);
      font-weight: var(--fw-medium);
      color: var(--text-accent);
      background: none;
      border: none;
      cursor: pointer;
      padding: var(--space-1) var(--space-2);
      border-radius: var(--radius-sm);
      white-space: nowrap;
      transition: all var(--transition-fast);
      flex-shrink: 0;
    }

    .luna-toast__action:hover {
      background: var(--bg-hover);
      text-decoration: underline;
    }

    .luna-toast__close {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 24px;
      height: 24px;
      background: none;
      border: none;
      color: var(--text-tertiary);
      cursor: pointer;
      border-radius: var(--radius-sm);
      transition: all var(--transition-fast);
      flex-shrink: 0;
      margin-top: -2px;
    }

    .luna-toast__close:hover {
      background: var(--bg-hover);
      color: var(--text-primary);
    }

    .luna-toast__progress {
      position: absolute;
      bottom: 0;
      left: 0;
      right: 0;
      height: 2px;
      background: var(--border-subtle);
    }

    .luna-toast__progress-bar {
      height: 100%;
      background: var(--text-accent);
      animation: toast-progress linear forwards;
    }

    .luna-toast:hover .luna-toast__progress-bar {
      animation-play-state: paused;
    }

    @keyframes toast-progress {
      from { width: 100%; }
      to { width: 0%; }
    }

    /* Mobile */
    @media (max-width: 640px) {
      .luna-toast-container {
        left: var(--space-4);
        right: var(--space-4);
        bottom: var(--space-4);
      }

      .luna-toast {
        min-width: 0;
        width: 100%;
      }
    }
  `]
})
export class LunaToastContainerComponent {
  constructor(public toastService: LunaToastService) {}

  trackById(index: number, toast: Toast): string {
    return toast.id;
  }

  getIcon(type: string): string {
    const icons = {
      success: 'fas fa-check-circle',
      error: 'fas fa-exclamation-circle',
      warning: 'fas fa-exclamation-triangle',
      info: 'fas fa-info-circle'
    };
    return icons[type as keyof typeof icons] || icons.info;
  }

  dismiss(id: string): void {
    this.toastService.dismiss(id);
  }
}