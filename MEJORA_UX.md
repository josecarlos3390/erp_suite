Tokens Premium Optimizados
Aquí va tu archivo actualizado con todas las mejoras premium:
scss
/* ═══════════════════════════════════════════════════════════════
   LUNA DESIGN TOKENS v2.0.0 — PREMIUM
   Primitives → Semantic → Motion → Glass → Premium
   Fuente única de verdad visual. Nunca hardcodear valores.
   ═══════════════════════════════════════════════════════════════ */

// ── PRIMITIVES — Light Mode ────────────────────────────────────
:root {
  /* Neutral Scale (Slate) — MANTENIDO (ya está perfecto) */
  --neutral-0: #ffffff;
  --neutral-50: #f8f9fb;
  --neutral-100: #f1f3f6;
  --neutral-200: #e4e7ec;
  --neutral-300: #d0d5dd;
  --neutral-400: #98a2b3;
  --neutral-500: #667085;
  --neutral-600: #475467;
  --neutral-700: #344054;
  --neutral-800: #1d2939;
  --neutral-900: #101828;
  --neutral-950: #020617;

  /* Accent Scale (Indigo) — MANTENIDO */
  --accent-50: #eef2ff;
  --accent-100: #e0e7ff;
  --accent-200: #c7d2fe;
  --accent-300: #a5b4fc;
  --accent-400: #818cf8;
  --accent-500: #6366f1;
  --accent-600: #4f46e5;
  --accent-700: #4338ca;
  --accent-800: #3730a3;
  --accent-900: #312e81;
  --accent-950: #1e1b4b;

  /* Semantic — Success, Warning, Error, Info — MANTENIDOS */

  // ── NUEVO: GRADIENTS PREMIUM ───────────────────────────────
  --gradient-accent: linear-gradient(180deg, var(--accent-500), var(--accent-600));
  --gradient-accent-hover: linear-gradient(180deg, var(--accent-400), var(--accent-500));
  --gradient-accent-active: linear-gradient(180deg, var(--accent-600), var(--accent-700));
  --gradient-surface: linear-gradient(180deg, var(--neutral-0), var(--neutral-50));
  --gradient-overlay: linear-gradient(180deg, rgba(255,255,255,0.98), rgba(255,255,255,0.95));
  --gradient-shimmer: linear-gradient(90deg, transparent, rgba(255,255,255,0.4), transparent);
  
  // ── NUEVO: GLASSMORPHISM TOKENS ────────────────────────────
  --glass-bg: rgba(255, 255, 255, 0.8);
  --glass-bg-elevated: rgba(255, 255, 255, 0.9);
  --glass-border: rgba(255, 255, 255, 0.2);
  --glass-border-strong: rgba(255, 255, 255, 0.3);
  --glass-backdrop: blur(20px) saturate(180%);
  --glass-backdrop-heavy: blur(32px) saturate(200%);
  
  // ── NUEVO: GLOW / HALO EFFECTS ─────────────────────────────
  --glow-accent: 0 0 0 3px rgba(99, 102, 241, 0.15);
  --glow-accent-strong: 0 0 0 4px rgba(99, 102, 241, 0.25);
  --glow-error: 0 0 0 3px rgba(239, 68, 68, 0.15);
  --glow-success: 0 0 0 3px rgba(34, 197, 94, 0.15);
  --glow-focus: 0 0 0 2px var(--bg-base), 0 0 0 4px var(--accent-500);
  
  // ── NUEVO: LAYERED SHADOWS (reemplaza shadows simples) ─────
  /* Layer 1: Ambient (difusa, lejos) */
  /* Layer 2: Directional (cerca, definida) */
  /* Layer 3: Colored (para acentos) */
  --shadow-ambient-sm: 0 1px 2px rgba(0, 0, 0, 0.04);
  --shadow-directional-sm: 0 1px 4px rgba(0, 0, 0, 0.03);
  --shadow-sm: var(--shadow-ambient-sm), var(--shadow-directional-sm);
  
  --shadow-ambient-md: 0 4px 6px rgba(0, 0, 0, 0.02);
  --shadow-directional-md: 0 8px 16px rgba(0, 0, 0, 0.06);
  --shadow-md: var(--shadow-ambient-md), var(--shadow-directional-md);
  
  --shadow-ambient-lg: 0 8px 16px rgba(0, 0, 0, 0.04);
  --shadow-directional-lg: 0 16px 32px rgba(0, 0, 0, 0.08);
  --shadow-accent-lg: 0 8px 24px rgba(79, 70, 229, 0.15);
  --shadow-lg: var(--shadow-ambient-lg), var(--shadow-directional-lg);
  
  --shadow-ambient-xl: 0 16px 32px rgba(0, 0, 0, 0.06);
  --shadow-directional-xl: 0 32px 64px rgba(0, 0, 0, 0.10);
  --shadow-xl: var(--shadow-ambient-xl), var(--shadow-directional-xl);
  
  --shadow-inner: inset 0 2px 4px rgba(16, 24, 40, 0.04);
  --shadow-inner-strong: inset 0 2px 8px rgba(16, 24, 40, 0.08);
  
  // ── NUEVO: MOTION / ANIMATION TOKENS ───────────────────────
  --ease-out-expo: cubic-bezier(0.16, 1, 0.3, 1);
  --ease-out-spring: cubic-bezier(0.34, 1.56, 0.64, 1);
  --ease-in-out-smooth: cubic-bezier(0.65, 0, 0.35, 1);
  
  --duration-instant: 0ms;
  --duration-fast: 150ms;
  --duration-base: 200ms;
  --duration-slow: 300ms;
  --duration-slower: 400ms;
  --duration-slowest: 500ms;
  
  --transition-fast: var(--duration-fast) var(--ease-out-expo);
  --transition-base: var(--duration-base) var(--ease-out-expo);
  --transition-slow: var(--duration-slow) var(--ease-out-expo);
  --transition-spring: var(--duration-slower) var(--ease-out-spring);
  --transition-bounce: var(--duration-slow) var(--ease-out-spring);
  
  // ── NUEVO: TRANSFORM TOKENS ────────────────────────────────
  --transform-hover-lift: translateY(-1px);
  --transform-active-press: scale(0.98);
  --transform-modal-enter: scale(0.95);
  --transform-modal-active: scale(1);
  --transform-drawer-enter: translateX(100%);
  --transform-drawer-active: translateX(0);
  
  // ── SEMANTIC TOKENS — Light Mode ────────────────────────────
  /* Backgrounds — MANTENIDOS */
  --bg-base: var(--neutral-0);
  --bg-elevated: var(--neutral-50);
  --bg-surface: var(--neutral-100);
  --bg-overlay: var(--glass-bg);
  --bg-inset: var(--neutral-50);
  --bg-hover: var(--neutral-100);
  --bg-active: var(--neutral-200);
  --bg-selected: var(--accent-50);

  /* Text — MANTENIDOS */
  --text-primary: var(--neutral-900);
  --text-secondary: var(--neutral-500);
  --text-tertiary: var(--neutral-400);
  --text-inverse: var(--neutral-0);
  --text-accent: var(--accent-600);
  --text-success: var(--success-600);
  --text-warning: var(--warning-600);
  --text-error: var(--error-600);
  --text-disabled: var(--neutral-400);

  /* Borders — MANTENIDOS */
  --border-default: var(--neutral-200);
  --border-subtle: var(--neutral-100);
  --border-strong: var(--neutral-300);
  --border-accent: var(--accent-300);
  --border-error: var(--error-300);
  --border-focus: var(--accent-500);
  
  // ── NUEVO: SEMANTIC PREMIUM ─────────────────────────────────
  --border-glass: var(--glass-border);
  --surface-glass: var(--glass-bg);
  --surface-glass-elevated: var(--glass-bg-elevated);
}

// ── PRIMITIVES — Dark Mode ─────────────────────────────────────
[data-theme='dark'] {
  /* Neutral, Accent, Semantic — MANTENIDOS (ya están bien) */
  
  // ── NUEVO: DARK GLASSMORPHISM ──────────────────────────────
  --glass-bg: rgba(18, 18, 26, 0.85);
  --glass-bg-elevated: rgba(26, 26, 37, 0.9);
  --glass-border: rgba(255, 255, 255, 0.08);
  --glass-border-strong: rgba(255, 255, 255, 0.12);
  --glass-backdrop: blur(24px) saturate(160%);
  --glass-backdrop-heavy: blur(40px) saturate(180%);
  
  // ── NUEVO: DARK GLOWS ────────────────────────────────────────
  --glow-accent: 0 0 0 3px rgba(129, 140, 248, 0.2);
  --glow-accent-strong: 0 0 0 4px rgba(129, 140, 248, 0.3);
  --glow-error: 0 0 0 3px rgba(248, 113, 113, 0.2);
  --glow-success: 0 0 0 3px rgba(74, 222, 128, 0.2);
  --glow-focus: 0 0 0 2px var(--bg-base), 0 0 0 4px var(--accent-400);
  
  // ── NUEVO: DARK GRADIENTS ──────────────────────────────────
  --gradient-accent: linear-gradient(180deg, var(--accent-400), var(--accent-500));
  --gradient-accent-hover: linear-gradient(180deg, var(--accent-300), var(--accent-400));
  --gradient-surface: linear-gradient(180deg, var(--neutral-0), var(--neutral-50));
  --gradient-overlay: linear-gradient(180deg, rgba(10,10,15,0.98), rgba(10,10,15,0.95));
  --gradient-shimmer: linear-gradient(90deg, transparent, rgba(255,255,255,0.05), transparent);
  
  // ── NUEVO: DARK LAYERED SHADOWS ────────────────────────────
  --shadow-ambient-sm: 0 1px 2px rgba(0, 0, 0, 0.30);
  --shadow-directional-sm: 0 1px 4px rgba(0, 0, 0, 0.25);
  --shadow-sm: var(--shadow-ambient-sm), var(--shadow-directional-sm);
  
  --shadow-ambient-md: 0 4px 6px rgba(0, 0, 0, 0.30);
  --shadow-directional-md: 0 8px 16px rgba(0, 0, 0, 0.40);
  --shadow-md: var(--shadow-ambient-md), var(--shadow-directional-md);
  
  --shadow-ambient-lg: 0 8px 16px rgba(0, 0, 0, 0.40);
  --shadow-directional-lg: 0 16px 32px rgba(0, 0, 0, 0.50);
  --shadow-accent-lg: 0 8px 24px rgba(129, 140, 248, 0.20);
  --shadow-lg: var(--shadow-ambient-lg), var(--shadow-directional-lg);
  
  --shadow-ambient-xl: 0 16px 32px rgba(0, 0, 0, 0.50);
  --shadow-directional-xl: 0 32px 64px rgba(0, 0, 0, 0.60);
  --shadow-xl: var(--shadow-ambient-xl), var(--shadow-directional-xl);
  
  --shadow-inner: inset 0 2px 4px rgba(0, 0, 0, 0.15);
  --shadow-inner-strong: inset 0 2px 8px rgba(0, 0, 0, 0.25);

  // ── SEMANTIC TOKENS — Dark Mode ─────────────────────────────
  --bg-base: var(--neutral-0);
  --bg-elevated: var(--neutral-50);
  --bg-surface: var(--neutral-100);
  --bg-overlay: var(--glass-bg);
  --bg-inset: var(--neutral-0);
  --bg-hover: var(--neutral-50);
  --bg-active: var(--neutral-100);
  --bg-selected: rgba(30, 27, 75, 0.3);

  --text-primary: var(--neutral-900);
  --text-secondary: var(--neutral-500);
  --text-tertiary: var(--neutral-400);
  --text-inverse: var(--neutral-0);
  --text-accent: var(--accent-500);
  --text-success: var(--success-500);
  --text-warning: var(--warning-500);
  --text-error: var(--error-500);
  --text-disabled: var(--neutral-400);

  --border-default: var(--neutral-200);
  --border-subtle: var(--neutral-100);
  --border-strong: var(--neutral-300);
  --border-accent: var(--accent-700);
  --border-error: var(--error-700);
  --border-focus: var(--accent-400);
  
  --border-glass: var(--glass-border);
  --surface-glass: var(--glass-bg);
  --surface-glass-elevated: var(--glass-bg-elevated);
}

// ── SPACING SCALE — MANTENIDO ──────────────────────────────────
:root {
  --space-0: 0px;
  --space-px: 1px;
  --space-0-5: 2px;
  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-5: 20px;
  --space-6: 24px;
  --space-8: 32px;
  --space-10: 40px;
  --space-12: 48px;
  --space-16: 64px;
  --space-20: 80px;
  --space-24: 96px;
}

// ── TYPOGRAPHY SCALE — MANTENIDO + MEJORAS ───────────────────
:root {
  --text-2xs: 10px;
  --text-xs: 12px;
  --text-sm: 13px;
  --text-base: 14px;
  --text-md: 16px;
  --text-lg: 18px;
  --text-xl: 20px;
  --text-2xl: 24px;
  --text-3xl: 30px;
  --text-4xl: 36px;
  --text-5xl: 48px;

  --lh-2xs: 14px;
  --lh-xs: 16px;
  --lh-sm: 18px;
  --lh-base: 20px;
  --lh-md: 24px;
  --lh-lg: 28px;
  --lh-xl: 30px;
  --lh-2xl: 32px;
  --lh-3xl: 38px;
  --lh-4xl: 44px;
  --lh-5xl: 56px;

  --ls-2xs: 0.02em;
  --ls-xs: 0.01em;
  --ls-sm: 0;
  --ls-base: 0;
  --ls-md: -0.01em;
  --ls-lg: -0.02em;
  --ls-xl: -0.02em;
  --ls-2xl: -0.02em;
  --ls-3xl: -0.03em;
  --ls-4xl: -0.03em;
  --ls-5xl: -0.04em;
  
  // ── NUEVO: FONT FAMILY TOKENS ──────────────────────────────
  --font-sans: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  --font-mono: 'JetBrains Mono', 'SF Mono', 'Fira Code', monospace;
  --font-display: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
  
  // ── NUEVO: TABULAR NUMS (para tablas financieras) ───────────
  --font-numeric: 'Inter', -apple-system, sans-serif;
  --font-variant-numeric: tabular-nums;
}

// ── RADIUS SCALE — MANTENIDO ─────────────────────────────────
:root {
  --radius-none: 0px;
  --radius-sm: 6px;
  --radius-md: 8px;
  --radius-lg: 12px;
  --radius-xl: 14px;
  --radius-2xl: 16px;
  --radius-full: 9999px;
}

// ── Z-INDEX SCALE — MANTENIDO ────────────────────────────────
:root {
  --z-background: 0;
  --z-content: 10;
  --z-sticky: 20;
  --z-floating: 30;
  --z-dropdown: 200;
  --z-overlay: 50;
  --z-modal: 60;
  --z-toast: 70;
  --z-loading: 80;
}

// ── FONT WEIGHT TOKENS — MANTENIDO ───────────────────────────
:root {
  --fw-normal: 400;
  --fw-medium: 500;
  --fw-semibold: 600;
  --fw-bold: 700;
}

// ── TRANSITION TOKENS — ACTUALIZADO CON PREMIUM ──────────────
:root {
  --transition-fast: var(--duration-fast) var(--ease-out-expo);
  --transition-base: var(--duration-base) var(--ease-out-expo);
  --transition-slow: var(--duration-slow) var(--ease-out-expo);
  --transition-width: var(--duration-base) var(--ease-in-out-smooth);
}

// ── NUEVO: ANIMATION KEYFRAMES GLOBALES ──────────────────────
@keyframes luna-fade-in {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes luna-fade-out {
  from { opacity: 1; }
  to { opacity: 0; }
}

@keyframes luna-slide-up {
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
}

@keyframes luna-slide-down {
  from { opacity: 0; transform: translateY(-8px); }
  to { opacity: 1; transform: translateY(0); }
}

@keyframes luna-scale-in {
  from { opacity: 0; transform: scale(0.95); }
  to { opacity: 1; transform: scale(1); }
}

@keyframes luna-shimmer {
  0% { transform: translateX(-100%); }
  100% { transform: translateX(100%); }
}

@keyframes luna-spin {
  to { transform: rotate(360deg); }
}

@keyframes luna-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

@keyframes luna-bounce {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-4px); }
}

// ── NUEVO: REDUCED MOTION ────────────────────────────────────
@media (prefers-reduced-motion: reduce) {
  :root {
    --duration-fast: 0ms;
    --duration-base: 0ms;
    --duration-slow: 0ms;
    --duration-slower: 0ms;
    --duration-slowest: 0ms;
    --transition-fast: 0ms;
    --transition-base: 0ms;
    --transition-slow: 0ms;
    --transition-spring: 0ms;
    --transition-bounce: 0ms;
  }
  
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
📊 Comparativa: Antes vs. Después
Table
Feature	v1.0 (Actual)	v2.0 (Premium)
Sombras	Simples, 1 capa	Layered (ambient + directional)
Glassmorphism	❌ No existe	✅ Completo con backdrop
Glow effects	❌ No existe	✅ Para focus, error, success
Gradientes	❌ No existe	✅ Para botones y superficies
Motion tokens	Solo 3 transitions	✅ Easing curves, durations, transforms
Shimmer	❌ No existe	✅ Token + keyframe global
Reduced motion	❌ No existe	✅ Respeto a preferencias del usuario
Font tokens	❌ No existe	✅ Sans, mono, display, numeric
🎯 ¿Cómo usar los nuevos tokens?
Botón Premium (antes vs. después)
scss
// ANTES (v1.0)
.luna-button-primary {
  background: var(--accent-600);
  box-shadow: var(--shadow-md);
  transition: var(--transition-base);
}

// DESPUÉS (v2.0 — Premium)
.luna-button-primary {
  background: var(--gradient-accent);
  box-shadow: var(--shadow-md), var(--shadow-accent-lg);
  transition: all var(--transition-base);
  
  &:hover {
    transform: var(--transform-hover-lift);
    background: var(--gradient-accent-hover);
    box-shadow: var(--shadow-lg), var(--shadow-accent-lg);
  }
  
  &:active {
    transform: var(--transform-active-press);
  }
  
  &:focus-visible {
    box-shadow: var(--glow-focus);
  }
}
Modal Glassmorphism
scss
// DESPUÉS (v2.0)
.luna-modal-overlay {
  background: rgba(10, 10, 15, 0.5);
  backdrop-filter: var(--glass-backdrop);
}

.luna-modal-panel {
  background: var(--surface-glass);
  backdrop-filter: var(--glass-backdrop);
  border: 1px solid var(--border-glass);
  box-shadow: var(--shadow-xl);
}
📁 Recomendación de estructura
Si tu archivo crece mucho, te sugiero separarlo:
plain
src/styles/tokens/
├── _primitives.scss      // Colores base (neutral, accent, semantic)
├── _semantic.scss         // bg-, text-, border- (light + dark)
├── _effects.scss          // shadows, glass, glow, gradients
├── _motion.scss           // transitions, animations, keyframes
├── _layout.scss           // spacing, radius, z-index
├── _typography.scss       // fonts, sizes, weights
└── index.scss             // @forward todos