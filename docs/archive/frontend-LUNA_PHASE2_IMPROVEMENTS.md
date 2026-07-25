# LUNA Design System — Fase 2 Implementations

## Overview
LUNA Design System ha sido mejorado con Dark Mode automático + Skeleton Loading para mejor UX.

---

## 🎨 Phase 2 Improvements (3-5 days)

### 1. **Dark Mode** — ✅ Already Implemented
- **Service:** `ThemeService` (src/app/core/theme/theme.service.ts)
- **Auto-detection:** Prefersencia del sistema operativo
- **Manual toggle:** Botón en header
- **Storage:** Preferencia guardada en localStorage
- **Attribute:** `data-theme="dark"` / `data-theme="light"`

**Usage:**
```typescript
// En AppComponent (ya integrado)
isDarkMode = this._darkMode.darkMode$;

// Toggle desde template
<button (click)="toggleTheme()">
  {{ isDarkMode ? '🌙' : '☀️' }}
</button>
```

**Tokens:** Ya existentes en `styles/tokens_01-primitives.scss`

---

### 2. **Skeleton Loading** — ✅ New Components
Proporciona feedback visual pulsante durante la carga de datos.

#### Components:
1. **LunaSkeletonText** — Texto pulsante
   ```html
   <luna-skeleton-text width="100%" height="1em" variant="text"></luna-skeleton-text>
   <luna-skeleton-text width="60%" height="1.5em" variant="heading"></luna-skeleton-text>
   ```

2. **LunaSkeletonCard** — Tarjeta completa con avatar, título, líneas
   ```html
   <luna-skeleton-card [avatar]="true" [title]="true" [lines]="3" [actions]="true"></luna-skeleton-card>
   ```

3. **LunaSkeletonAvatar** — Avatar circular
   ```html
   <luna-skeleton-avatar size="md"></luna-skeleton-avatar>
   ```

4. **LunaSkeletonButton** — Botón pulsante
   ```html
   <luna-skeleton-button size="md"></luna-skeleton-button>
   ```

5. **LunaSkeletonTable** — Tabla con header y filas
   ```html
   <luna-skeleton-table [rows]="5" [columns]="4"></luna-skeleton-table>
   ```

#### Features:
- ✅ Animación `pulse` suave (1.5s, ease-in-out)
- ✅ Efecto `shimmer` (gradient desplazamiento)
- ✅ Dark mode automático
- ✅ `prefers-reduced-motion` support
- ✅ Tamaños: sm, md, lg (avatar, button)
- ✅ Variantes: text, heading, subheading (skeleton-text)

---

### 3. **Integration Examples**

#### Example 1: Cards Loading
```html
<div class="cards-grid">
  @if (isLoading) {
    <luna-skeleton-card [avatar]="true" [title]="true" [lines]="3"></luna-skeleton-card>
    <luna-skeleton-card [avatar]="true" [title]="true" [lines]="3"></luna-skeleton-card>
    <luna-skeleton-card [avatar]="true" [title]="true" [lines]="3"></luna-skeleton-card>
  } @else {
    @for (partner of partners; track partner.id) {
      <partner-card [partner]="partner"></partner-card>
    }
  }
</div>
```

#### Example 2: Table Loading
```html
<div class="table-container">
  @if (isLoading) {
    <luna-skeleton-table [rows]="10" [columns]="6"></luna-skeleton-table>
  } @else {
    <luna-data-table [data]="data" [columns]="columns"></luna-data-table>
  }
</div>
```

#### Example 3: Form Loading
```html
<div class="form-container">
  @if (isLoading) {
    <luna-skeleton-text width="40%" height="1.5em" variant="heading"></luna-skeleton-text>
    <luna-skeleton-text width="100%" height="1em" variant="text"></luna-skeleton-text>
    <luna-skeleton-text width="80%" height="1em" variant="text"></luna-skeleton-text>
    <luna-skeleton-text width="100%" height="1em" variant="text"></luna-skeleton-text>
    <luna-skeleton-button></luna-skeleton-button>
  } @else {
    <form [formGroup]="form">
      <luna-input formControlName="name" label="Nombre"></luna-input>
      <luna-textarea formControlName="description" label="Descripción"></luna-textarea>
      <luna-button (click)="save()">Guardar</luna-button>
    </form>
  }
</div>
```

#### Example 4: Avatar Loading
```html
<div class="user-profile">
  @if (isLoading) {
    <luna-skeleton-avatar size="lg"></luna-skeleton-avatar>
  } @else {
    <img [src]="user.avatarUrl" [alt]="user.name" />
  }
</div>
```

---

## 📊 Impact Summary

| Component | Before | After | Improvement |
|-----------|--------|-------|-------------|
| Dark mode | Manual | Auto + manual | ✅ Better UX |
| Loading states | Spinner | Skeleton pulsante | ✅ Visual feedback |
| Dark mode tokens | Basic | Full 2-way sync | ✅ Consistent |
| Accessibility | Basic | Improved | ✅ A11y tags |

---

## 🎯 Key Benefits

### 1. **Automatic Dark Mode**
- Detecta preferencia del sistema
- Guarda preferencia en localStorage
- Switch manual disponible

### 2. **Skeleton Loading**
- FABULOSO feedback visual pulsante
- Mimica estructura real de datos
- Reduce perceived latency

### 3. **Accessibility**
- `prefers-reduced-motion` support
- ARIA labels en todos componentes
- Keyboard navigation friendly

### 4. **Consistency**
- Tokens de color bien definidos
- Componentes reutilizables
- Dark mode automático

---

## 📝 Migration Guide

### For Developers
No code changes required! Dark mode already works via ThemeService.

### For Skeleton Usage
```typescript
import {
  LunaSkeletonTextComponent,
  LunaSkeletonCardComponent,
  LunaSkeletonTableComponent,
} from '@shared/luna';

@Component({
  standalone: true,
  imports: [LunaSkeletonTextComponent, LunaSkeletonCardComponent, LunaSkeletonTableComponent],
  template: `
    @if (isLoading) {
      <luna-skeleton-table [rows]="5" [columns]="4"></luna-skeleton-table>
    } @else {
      <luna-data-table [data]="data"></luna-data-table>
    }
  `,
})
```

---

## 🚀 Next Steps (Phase 3)

1. ✅ **Select/Dropdown** — Para selecciones simples
2. ✅ **Tooltip** — Ayuda contextual
3. ✅ **Storybook** — Documentación visual
4. ✅ **Skeleton Loading** — Para todos los estados de carga

---

## 📚 References

- **Theme Service:** `src/app/core/theme/theme.service.ts`
- **Theme Tokens:** `styles/tokens_01-primitives.scss` (dark mode section)
- **Skeleton Components:** `src/app/shared/skeleton/skeleton.component.ts`
- **Skeleton SCSS:** `src/app/shared/skeleton/skeleton.component.scss`
- **Dark Mode in LUNA:** Dark mode section in primitives.scss

---

## ✨ Example: Before vs After

### Loading State

**Before:**
- Spinner rotating (generic)
- No context of what's loading
- Boring

**After:**
```html
<!-- Cards loading -->
<luna-skeleton-card [avatar]="true" [title]="true" [lines]="3"></luna-skeleton-card>

<!-- Table loading -->
<luna-skeleton-table [rows]="10" [columns]="6"></luna-skeleton-table>

<!-- Form loading -->
<luna-skeleton-text width="40%" height="1.5em" variant="heading"></luna-skeleton-text>
<luna-skeleton-text width="100%" height="1em" variant="text"></luna-skeleton-text>
<luna-skeleton-button></luna-skeleton-button>
```
- **Effect:** Mimics real content, provides context, feels faster

### Dark Mode

**Before:**
- Manual only (user remembers to switch)

**After:**
- Auto-detects system preference
- Manual toggle available
- Persists across sessions
- **Effect:** Matches OS preference seamlessly

---

**Status:** ✅ **COMPLETED** — Ready for review and testing