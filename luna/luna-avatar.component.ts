import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

export type AvatarSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';
export type AvatarShape = 'circle' | 'square' | 'rounded';

@Component({
  selector: 'luna-avatar',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div [class]="avatarClasses" [style.width]="sizePx" [style.height]="sizePx">
      <!-- Image -->
      <img
        *ngIf="src && !imageError"
        [src]="src"
        [alt]="alt"
        class="luna-avatar__image"
        (error)="imageError = true"
        loading="lazy"
      />

      <!-- Fallback: Initials -->
      <span *ngIf="!src || imageError" class="luna-avatar__fallback" [style.fontSize]="fontSize">
        {{ initials }}
      </span>

      <!-- Status indicator -->
      <span
        *ngIf="status"
        class="luna-avatar__status"
        [class]="'luna-avatar__status--' + status"
        [style.width]="statusSize"
        [style.height]="statusSize"
      ></span>

      <!-- Badge -->
      <span *ngIf="badge" class="luna-avatar__badge">{{ badge }}</span>
    </div>
  `,
  styles: [`
    .luna-avatar {
      position: relative;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      overflow: hidden;
      background: var(--gradient-accent);
      transition: all var(--transition-fast);
    }

    .luna-avatar--circle { border-radius: var(--radius-full); }
    .luna-avatar--square { border-radius: var(--radius-lg); }
    .luna-avatar--rounded { border-radius: var(--radius-md); }

    .luna-avatar__image {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }

    .luna-avatar__fallback {
      font-family: var(--font-sans);
      font-weight: var(--fw-semibold);
      color: var(--text-inverse);
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }

    .luna-avatar__status {
      position: absolute;
      bottom: 0;
      right: 0;
      border-radius: var(--radius-full);
      border: 2px solid var(--bg-base);
      background: var(--neutral-400);
    }

    .luna-avatar__status--online { background: var(--success-500); }
    .luna-avatar__status--away { background: var(--warning-500); }
    .luna-avatar__status--busy { background: var(--error-500); }
    .luna-avatar__status--offline { background: var(--neutral-400); }

    .luna-avatar__badge {
      position: absolute;
      top: -4px;
      right: -4px;
      display: flex;
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
      border: 2px solid var(--bg-base);
    }

    /* Group overlap */
    .luna-avatar-group .luna-avatar {
      margin-left: -8px;
      border: 2px solid var(--bg-base);
    }

    .luna-avatar-group .luna-avatar:first-child {
      margin-left: 0;
    }
  `]
})
export class LunaAvatarComponent {
  @Input() src?: string;
  @Input() alt = '';
  @Input() name = '';
  @Input() size: AvatarSize = 'md';
  @Input() shape: AvatarShape = 'circle';
  @Input() status?: 'online' | 'away' | 'busy' | 'offline';
  @Input() badge?: string;

  imageError = false;

  private sizeMap: Record<AvatarSize, number> = {
    xs: 24,
    sm: 32,
    md: 40,
    lg: 48,
    xl: 64
  };

  get sizePx(): string {
    return `${this.sizeMap[this.size]}px`;
  }

  get fontSize(): string {
    const baseSize = this.sizeMap[this.size];
    return `${Math.max(baseSize * 0.35, 10)}px`;
  }

  get statusSize(): string {
    const baseSize = this.sizeMap[this.size];
    return `${Math.max(baseSize * 0.3, 8)}px`;
  }

  get initials(): string {
    if (!this.name) return '?';
    return this.name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  }

  get avatarClasses(): string {
    return [
      'luna-avatar',
      `luna-avatar--${this.shape}`
    ].join(' ');
  }
}