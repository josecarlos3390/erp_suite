📁 Estructura de archivos generados
Voy a generar los archivos con ipython para que puedas descargarlos:
Python
import os

# Crear directorio de salida
output_dir = "/mnt/agents/output/luna-tokens-v2"
os.makedirs(output_dir, exist_ok=True)

# 1. PRIMITIVES — Colores base
primitives = '''/* ═══════════════════════════════════════════════════════════════
   LUNA TOKENS — 01 PRIMITIVES
   Colores base: Neutral, Accent, Semantic
   ═══════════════════════════════════════════════════════════════ */

:root {
  /* ── Neutral Scale (Slate) ───────────────────────────────── */
  --neutral-0:  #ffffff;
  --neutral-50:  #f8f9fb;
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

  /* ── Accent Scale (Indigo) ──────────────────────────────── */
  --accent-50:  #eef2ff;
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

  /* ── Semantic — Success ─────────────────────────────────── */
  --success-50:  #ecfdf5;
  --success-100: #d1fae5;
  --success-200: #a7f3d0;
  --success-300: #6ee7b7;
  --success-400: #34d399;
  --success-500: #22c55e;
  --success-600: #16a34a;
  --success-700: #15803d;
  --success-800: #166534;
  --success-900: #14532d;
  --success-950: #052e16;

  /* ── Semantic — Warning ─────────────────────────────────── */
  --warning-50:  #fffbeb;
  --warning-100: #fef3c7;
  --warning-200: #fde68a;
  --warning-300: #fcd34d;
  --warning-400: #fbbf24;
  --warning-500: #f59e0b;
  --warning-600: #d97706;
  --warning-700: #b45309;
  --warning-800: #92400e;
  --warning-900: #78350f;
  --warning-950: #451a03;

  /* ── Semantic — Error ───────────────────────────────────── */
  --error-50:  #fef2f2;
  --error-100: #fee2e2;
  --error-200: #fecaca;
  --error-300: #fca5a5;
  --error-400: #f87171;
  --error-500: #ef4444;
  --error-600: #dc2626;
  --error-700: #b91c1c;
  --error-800: #991b1b;
  --error-900: #7f1d1d;
  --error-950: #450a0a;

  /* ── Semantic — Info ────────────────────────────────────── */
  --info-50:  #eff6ff;
  --info-100: #dbeafe;
  --info-200: #bfdbfe;
  --info-300: #93c5fd;
  --info-400: #60a5fa;
  --info-500: #3b82f6;
  --info-600: #2563eb;
  --info-700: #1d4ed8;
  --info-800: #1e40af;
  --info-900: #1e3a8a;
  --info-950: #172554;
}

/* ── Dark Mode Primitives ───────────────────────────────── */
[data-theme='dark'] {
  /* Neutral — inverted */
  --neutral-0:  #0a0a0f;
  --neutral-50:  #12121a;
  --neutral-100: #1a1a25;
  --neutral-200: #242433;
  --neutral-300: #35354a;
  --neutral-400: #6e7089;
  --neutral-500: #8a8ca8;
  --neutral-600: #a5a7bf;
  --neutral-700: #c2c4d8;
  --neutral-800: #e2e4f0;
  --neutral-900: #ffffff;
  --neutral-950: #f8f9fb;

  /* Accent — inverted for vibrancy in dark */
  --accent-50:  #1e1b4b;
  --accent-100: #312e81;
  --accent-200: #4338ca;
  --accent-300: #4f46e5;
  --accent-400: #6366f1;
  --accent-500: #818cf8;
  --accent-600: #a5b4fc;
  --accent-700: #c7d2fe;
  --accent-800: #e0e7ff;
  --accent-900: #eef2ff;
  --accent-950: #f5f7ff;

  /* Semantic — inverted */
  --success-50:  #052e16;
  --success-100: #14532d;
  --success-200: #166534;
  --success-300: #15803d;
  --success-400: #16a34a;
  --success-500: #4ade80;
  --success-600: #34d399;
  --success-700: #6ee7b7;
  --success-800: #a7f3d0;
  --success-900: #d1fae5;
  --success-950: #ecfdf5;

  --warning-50:  #451a03;
  --warning-100: #78350f;
  --warning-200: #92400e;
  --warning-300: #b45309;
  --warning-400: #d97706;
  --warning-500: #fbbf24;
  --warning-600: #fcd34d;
  --warning-700: #fde68a;
  --warning-800: #fef3c7;
  --warning-900: #fffbeb;
  --warning-950: #fffbeb;

  --error-50:  #450a0a;
  --error-100: #7f1d1d;
  --error-200: #991b1b;
  --error-300: #b91c1c;
  --error-400: #dc2626;
  --error-500: #f87171;
  --error-600: #fca5a5;
  --error-700: #fecaca;
  --error-800: #fee2e2;
  --error-900: #fef2f2;
  --error-950: #fef2f2;

  --info-50:  #172554;
  --info-100: #1e3a8a;
  --info-200: #1e40af;
  --info-300: #1d4ed8;
  --info-400: #2563eb;
  --info-500: #60a5fa;
  --info-600: #93c5fd;
  --info-700: #bfdbfe;
  --info-800: #dbeafe;
  --info-900: #eff6ff;
  --info-950: #eff6ff;
}
'''

with open(f"{output_dir}/_01-primitives.scss", "w") as f:
    f.write(primitives)

# 2. SEMANTIC — Tokens de significado
semantic = '''/* ═══════════════════════════════════════════════════════════════
   LUNA TOKENS — 02 SEMANTIC
   Tokens con significado: backgrounds, text, borders
   Mapean primitives → contexto de UI
   ═══════════════════════════════════════════════════════════════ */

:root {
  /* ── Backgrounds ─────────────────────────────────────────── */
  --bg-base:      var(--neutral-0);
  --bg-elevated:  var(--neutral-50);
  --bg-surface:   var(--neutral-100);
  --bg-overlay:   rgba(255, 255, 255, 0.96);
  --bg-inset:     var(--neutral-50);
  --bg-hover:     var(--neutral-100);
  --bg-active:    var(--neutral-200);
  --bg-selected:  var(--accent-50);

  /* ── Text ──────────────────────────────────────────────── */
  --text-primary:   var(--neutral-900);
  --text-secondary: var(--neutral-500);
  --text-tertiary:  var(--neutral-400);
  --text-inverse:   var(--neutral-0);
  --text-accent:    var(--accent-600);
  --text-success:   var(--success-600);
  --text-warning:   var(--warning-600);
  --text-error:     var(--error-600);
  --text-disabled:  var(--neutral-400);

  /* ── Borders ───────────────────────────────────────────── */
  --border-default: var(--neutral-200);
  --border-subtle:  var(--neutral-100);
  --border-strong:  var(--neutral-300);
  --border-accent:  var(--accent-300);
  --border-error:   var(--error-300);
  --border-focus:   var(--accent-500);
}

/* ── Dark Mode Semantic ───────────────────────────────────── */
[data-theme='dark'] {
  /* Backgrounds */
  --bg-base:      var(--neutral-0);
  --bg-elevated:  var(--neutral-50);
  --bg-surface:   var(--neutral-100);
  --bg-overlay:   rgba(18, 18, 26, 0.96);
  --bg-inset:     var(--neutral-0);
  --bg-hover:     var(--neutral-50);
  --bg-active:    var(--neutral-100);
  --bg-selected:  rgba(30, 27, 75, 0.3);

  /* Text */
  --text-primary:   var(--neutral-900);
  --text-secondary: var(--neutral-500);
  --text-tertiary:  var(--neutral-400);
  --text-inverse:   var(--neutral-0);
  --text-accent:    var(--accent-500);
  --text-success:   var(--success-500);
  --text-warning:   var(--warning-500);
  --text-error:     var(--error-500);
  --text-disabled:  var(--neutral-400);

  /* Borders */
  --border-default: var(--neutral-200);
  --border-subtle:  var(--neutral-100);
  --border-strong:  var(--neutral-300);
  --border-accent:  var(--accent-700);
  --border-error:   var(--error-700);
  --border-focus:   var(--accent-400);
}
'''

with open(f"{output_dir}/_02-semantic.scss", "w") as f:
    f.write(semantic)

# 3. EFFECTS — Sombras, glass, glow, gradients
effects = '''/* ═══════════════════════════════════════════════════════════════
   LUNA TOKENS — 03 EFFECTS
   Sombras layered, glassmorphism, glows, gradients
   ═══════════════════════════════════════════════════════════════ */

:root {
  /* ── LAYERED SHADOWS ─────────────────────────────────────── */
  /* Layer 1: Ambient (difusa, lejos) */
  /* Layer 2: Directional (cerca, definida) */
  /* Layer 3: Colored (acento) */

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

  /* ── GLASSMORPHISM ─────────────────────────────────────── */
  --glass-bg: rgba(255, 255, 255, 0.80);
  --glass-bg-elevated: rgba(255, 255, 255, 0.90);
  --glass-border: rgba(255, 255, 255, 0.20);
  --glass-border-strong: rgba(255, 255, 255, 0.30);
  --glass-backdrop: blur(20px) saturate(180%);
  --glass-backdrop-heavy: blur(32px) saturate(200%);

  /* ── GLOW / HALO EFFECTS ───────────────────────────────── */
  --glow-accent: 0 0 0 3px rgba(99, 102, 241, 0.15);
  --glow-accent-strong: 0 0 0 4px rgba(99, 102, 241, 0.25);
  --glow-error: 0 0 0 3px rgba(239, 68, 68, 0.15);
  --glow-success: 0 0 0 3px rgba(34, 197, 94, 0.15);
  --glow-focus: 0 0 0 2px var(--bg-base), 0 0 0 4px var(--accent-500);

  /* ── GRADIENTS ─────────────────────────────────────────── */
  --gradient-accent: linear-gradient(180deg, var(--accent-500), var(--accent-600));
  --gradient-accent-hover: linear-gradient(180deg, var(--accent-400), var(--accent-500));
  --gradient-accent-active: linear-gradient(180deg, var(--accent-600), var(--accent-700));
  --gradient-surface: linear-gradient(180deg, var(--neutral-0), var(--neutral-50));
  --gradient-overlay: linear-gradient(180deg, rgba(255,255,255,0.98), rgba(255,255,255,0.95));
  --gradient-shimmer: linear-gradient(90deg, transparent, rgba(255,255,255,0.40), transparent);

  /* ── SEMANTIC GLASS ────────────────────────────────────── */
  --border-glass: var(--glass-border);
  --surface-glass: var(--glass-bg);
  --surface-glass-elevated: var(--glass-bg-elevated);
}

/* ── Dark Mode Effects ────────────────────────────────────── */
[data-theme='dark'] {
  /* Shadows */
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

  /* Glassmorphism */
  --glass-bg: rgba(18, 18, 26, 0.85);
  --glass-bg-elevated: rgba(26, 26, 37, 0.90);
  --glass-border: rgba(255, 255, 255, 0.08);
  --glass-border-strong: rgba(255, 255, 255, 0.12);
  --glass-backdrop: blur(24px) saturate(160%);
  --glass-backdrop-heavy: blur(40px) saturate(180%);

  /* Glows */
  --glow-accent: 0 0 0 3px rgba(129, 140, 248, 0.20);
  --glow-accent-strong: 0 0 0 4px rgba(129, 140, 248, 0.30);
  --glow-error: 0 0 0 3px rgba(248, 113, 113, 0.20);
  --glow-success: 0 0 0 3px rgba(74, 222, 128, 0.20);
  --glow-focus: 0 0 0 2px var(--bg-base), 0 0 0 4px var(--accent-400);

  /* Gradients */
  --gradient-accent: linear-gradient(180deg, var(--accent-400), var(--accent-500));
  --gradient-accent-hover: linear-gradient(180deg, var(--accent-300), var(--accent-400));
  --gradient-accent-active: linear-gradient(180deg, var(--accent-500), var(--accent-600));
  --gradient-surface: linear-gradient(180deg, var(--neutral-0), var(--neutral-50));
  --gradient-overlay: linear-gradient(180deg, rgba(10,10,15,0.98), rgba(10,10,15,0.95));
  --gradient-shimmer: linear-gradient(90deg, transparent, rgba(255,255,255,0.05), transparent);
}
'''

with open(f"{output_dir}/_03-effects.scss", "w") as f:
    f.write(effects)

# 4. MOTION — Animaciones y transiciones
motion = '''/* ═══════════════════════════════════════════════════════════════
   LUNA TOKENS — 04 MOTION
   Easing curves, durations, transforms, keyframes
   ═══════════════════════════════════════════════════════════════ */

:root {
  /* ── EASING CURVES ──────────────────────────────────────── */
  --ease-out-expo: cubic-bezier(0.16, 1, 0.3, 1);
  --ease-out-spring: cubic-bezier(0.34, 1.56, 0.64, 1);
  --ease-in-out-smooth: cubic-bezier(0.65, 0, 0.35, 1);
  --ease-in-out-sine: cubic-bezier(0.37, 0, 0.63, 1);

  /* ── DURATIONS ─────────────────────────────────────────── */
  --duration-instant: 0ms;
  --duration-fast: 150ms;
  --duration-base: 200ms;
  --duration-slow: 300ms;
  --duration-slower: 400ms;
  --duration-slowest: 500ms;

  /* ── TRANSITIONS ───────────────────────────────────────── */
  --transition-fast: var(--duration-fast) var(--ease-out-expo);
  --transition-base: var(--duration-base) var(--ease-out-expo);
  --transition-slow: var(--duration-slow) var(--ease-out-expo);
  --transition-spring: var(--duration-slower) var(--ease-out-spring);
  --transition-bounce: var(--duration-slow) var(--ease-out-spring);
  --transition-width: var(--duration-base) var(--ease-in-out-smooth);

  /* ── TRANSFORM TOKENS ──────────────────────────────────── */
  --transform-hover-lift: translateY(-1px);
  --transform-active-press: scale(0.98);
  --transform-modal-enter: scale(0.95);
  --transform-modal-active: scale(1);
  --transform-drawer-enter: translateX(100%);
  --transform-drawer-active: translateX(0);
  --transform-toast-enter: translateX(100%);
  --transform-toast-active: translateX(0);
}

/* ── KEYFRAME ANIMATIONS ──────────────────────────────────── */
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

@keyframes luna-slide-left {
  from { opacity: 0; transform: translateX(8px); }
  to { opacity: 1; transform: translateX(0); }
}

@keyframes luna-slide-right {
  from { opacity: 0; transform: translateX(-8px); }
  to { opacity: 1; transform: translateX(0); }
}

@keyframes luna-scale-in {
  from { opacity: 0; transform: scale(0.95); }
  to { opacity: 1; transform: scale(1); }
}

@keyframes luna-scale-out {
  from { opacity: 1; transform: scale(1); }
  to { opacity: 0; transform: scale(0.95); }
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

@keyframes luna-pulse-ring {
  0% { transform: scale(0.8); opacity: 1; }
  100% { transform: scale(2); opacity: 0; }
}

@keyframes luna-bounce {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-4px); }
}

@keyframes luna-shake {
  0%, 100% { transform: translateX(0); }
  25% { transform: translateX(-4px); }
  75% { transform: translateX(4px); }
}

@keyframes luna-count-up {
  from { opacity: 0; transform: translateY(4px); }
  to { opacity: 1; transform: translateY(0); }
}

/* ── REDUCED MOTION ───────────────────────────────────────── */
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
    --transition-width: 0ms;
  }

  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
'''

with open(f"{output_dir}/_04-motion.scss", "w") as f:
    f.write(motion)

# 5. LAYOUT — Spacing, radius, z-index
layout = '''/* ═══════════════════════════════════════════════════════════════
   LUNA TOKENS — 05 LAYOUT
   Spacing, radius, z-index
   ═══════════════════════════════════════════════════════════════ */

:root {
  /* ── SPACING SCALE ──────────────────────────────────────── */
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

  /* ── RADIUS SCALE ──────────────────────────────────────── */
  --radius-none: 0px;
  --radius-sm: 6px;
  --radius-md: 8px;
  --radius-lg: 12px;
  --radius-xl: 14px;
  --radius-2xl: 16px;
  --radius-full: 9999px;

  /* ── Z-INDEX SCALE ─────────────────────────────────────── */
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
'''

with open(f"{output_dir}/_05-layout.scss", "w") as f:
    f.write(layout)

# 6. TYPOGRAPHY — Fuentes, tamaños, pesos
typography = '''/* ═══════════════════════════════════════════════════════════════
   LUNA TOKENS — 06 TYPOGRAPHY
   Font families, sizes, weights, line heights, letter spacing
   ═══════════════════════════════════════════════════════════════ */

:root {
  /* ── FONT FAMILIES ────────────────────────────────────── */
  --font-sans: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  --font-mono: 'JetBrains Mono', 'SF Mono', 'Fira Code', monospace;
  --font-display: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
  --font-numeric: 'Inter', -apple-system, sans-serif;

  /* ── FONT VARIANTS ─────────────────────────────────────── */
  --font-variant-numeric: tabular-nums;
  --font-variant-proportional: proportional-nums;

  /* ── FONT WEIGHTS ─────────────────────────────────────── */
  --fw-normal: 400;
  --fw-medium: 500;
  --fw-semibold: 600;
  --fw-bold: 700;

  /* ── FONT SIZES ────────────────────────────────────────── */
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

  /* ── LINE HEIGHTS ──────────────────────────────────────── */
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

  /* ── LETTER SPACING ───────────────────────────────────── */
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
}
'''

with open(f"{output_dir}/_06-typography.scss", "w") as f:
    f.write(typography)

# 7. INDEX — Barrel export
index = '''/* ═══════════════════════════════════════════════════════════════
   LUNA TOKENS — INDEX
   Importa todos los módulos de tokens en orden correcto
   ═══════════════════════════════════════════════════════════════ */

@use '01-primitives';
@use '02-semantic';
@use '03-effects';
@use '04-motion';
@use '05-layout';
@use '06-typography';
'''

with open(f"{output_dir}/index.scss", "w") as f:
    f.write(index)

# 8. THEME SERVICE — Angular
theme_service = '''import { Injectable, Renderer2, RendererFactory2 } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

export type ThemeMode = 'light' | 'dark' | 'system';

@Injectable({ providedIn: 'root' })
export class LunaThemeService {
  private readonly STORAGE_KEY = 'luna-theme-preference';
  private readonly THEME_ATTR = 'data-theme';
  
  private currentTheme = new BehaviorSubject<<ThemeMode>('light');
  public theme$ = this.currentTheme.asObservable();
  
  private renderer: Renderer2;
  
  constructor(rendererFactory: RendererFactory2) {
    this.renderer = rendererFactory.createRenderer(null, null);
    this.initTheme();
  }
  
  /**
   * Inicializa el tema desde localStorage o preferencia del sistema
   */
  private initTheme(): void {
    const saved = this.getSavedTheme();
    const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    
    let theme: ThemeMode;
    
    if (saved === 'system') {
      theme = systemPrefersDark ? 'dark' : 'light';
      this.currentTheme.next('system');
    } else {
      theme = saved || (systemPrefersDark ? 'dark' : 'light');
      this.currentTheme.next(theme as ThemeMode);
    }
    
    this.applyTheme(theme);
    
    // Escuchar cambios del sistema si está en modo 'system'
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
      if (this.currentTheme.value === 'system') {
        this.applyTheme(e.matches ? 'dark' : 'light');
      }
    });
  }
  
  /**
   * Aplica el tema al documento
   */
  private applyTheme(theme: 'light' | 'dark'): void {
    this.renderer.setAttribute(document.documentElement, this.THEME_ATTR, theme);
    document.documentElement.style.colorScheme = theme;
  }
  
  /**
   * Cambia el tema activo
   */
  setTheme(theme: ThemeMode): void {
    this.currentTheme.next(theme);
    this.saveTheme(theme);
    
    if (theme === 'system') {
      const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      this.applyTheme(systemPrefersDark ? 'dark' : 'light');
    } else {
      this.applyTheme(theme);
    }
  }
  
  /**
   * Toggle entre light y dark
   */
  toggle(): void {
    const current = this.currentTheme.value;
    const isDark = document.documentElement.getAttribute(this.THEME_ATTR) === 'dark';
    
    if (current === 'system') {
      this.setTheme(isDark ? 'light' : 'dark');
    } else {
      this.setTheme(current === 'dark' ? 'light' : 'dark');
    }
  }
  
  /**
   * Obtiene el tema guardado
   */
  private getSavedTheme(): ThemeMode | null {
    try {
      return localStorage.getItem(this.STORAGE_KEY) as ThemeMode | null;
    } catch {
      return null;
    }
  }
  
  /**
   * Guarda la preferencia de tema
   */
  private saveTheme(theme: ThemeMode): void {
    try {
      localStorage.setItem(this.STORAGE_KEY, theme);
    } catch {
      // Silently fail if localStorage is not available
    }
  }
  
  /**
   * Verifica si el tema actual es dark
   */
  isDark(): boolean {
    return document.documentElement.getAttribute(this.THEME_ATTR) === 'dark';
  }
  
  /**
   * Obtiene el tema actual como Observable
   */
  getTheme(): Observable<<ThemeMode> {
    return this.theme$;
  }
}
'''

with open(f"{output_dir}/luna-theme.service.ts", "w") as f:
    f.write(theme_service)

# 9. COMPONENTE TOGGLE — Angular
theme_toggle = '''import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LunaThemeService } from './luna-theme.service';

@Component({
  selector: 'luna-theme-toggle',
  standalone: true,
  imports: [CommonModule],
  template: `
    <button
      class="luna-theme-toggle"
      (click)="themeService.toggle()"
      [attr.aria-label]="'Cambiar tema'"
      [title]="themeService.isDark() ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'"
    >
      <span class="luna-theme-toggle__icon" [class.luna-theme-toggle__icon--dark]="themeService.isDark()">
        <i *ngIf="!themeService.isDark()" class="fas fa-moon"></i>
        <i *ngIf="themeService.isDark()" class="fas fa-sun"></i>
      </span>
      <span class="luna-theme-toggle__label">
        {{ themeService.isDark() ? 'Modo oscuro' : 'Modo claro' }}
      </span>
    </button>
  `,
  styles: [`
    .luna-theme-toggle {
      display: inline-flex;
      align-items: center;
      gap: var(--space-2);
      padding: var(--space-2) var(--space-3);
      background: var(--bg-surface);
      border: 1px solid var(--border-default);
      border-radius: var(--radius-md);
      color: var(--text-secondary);
      font-family: var(--font-sans);
      font-size: var(--text-sm);
      font-weight: var(--fw-medium);
      cursor: pointer;
      transition: all var(--transition-fast);
    }
    
    .luna-theme-toggle:hover {
      background: var(--bg-hover);
      border-color: var(--border-strong);
      color: var(--text-primary);
    }
    
    .luna-theme-toggle:active {
      transform: var(--transform-active-press);
    }
    
    .luna-theme-toggle__icon {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 20px;
      height: 20px;
      transition: transform var(--transition-spring);
    }
    
    .luna-theme-toggle__icon--dark {
      color: var(--text-warning);
    }
    
    .luna-theme-toggle__label {
      font-size: var(--text-sm);
    }
  `]
})
export class LunaThemeToggleComponent {
  constructor(public themeService: LunaThemeService) {}
}
'''

with open(f"{output_dir}/luna-theme-toggle.component.ts", "w") as f:
    f.write(theme_toggle)

# 10. README con instrucciones
readme = '''# Luna Design Tokens v2.0.0 — Premium

## Estructura de archivos
tokens/
├── _01-primitives.scss      # Colores base (neutral, accent, semantic)
├── _02-semantic.scss        # Tokens con significado (bg-, text-, border-)
├── _03-effects.scss         # Sombras, glassmorphism, glows, gradients
├── _04-motion.scss          # Animaciones, transiciones, keyframes
├── _05-layout.scss          # Spacing, radius, z-index
├── _06-typography.scss      # Fuentes, tamaños, pesos
└── index.scss               # Barrel export
plain

## Instalación en Angular

### 1. Copiar archivos a tu proyecto

```bash
# Copiar a src/styles/tokens/
cp -r luna-tokens-v2/* src/styles/tokens/
2. Importar en styles.scss
scss
// src/styles.scss
@use 'tokens/index';
3. Copiar Theme Service
bash
# Copiar a src/app/core/services/
cp luna-tokens-v2/luna-theme.service.ts src/app/core/services/
cp luna-tokens-v2/luna-theme-toggle.component.ts src/app/shared/luna/luna-theme-toggle/
4. Usar en tu app
TypeScript
// app.component.ts
import { Component } from '@angular/core';
import { LunaThemeService } from './core/services/luna-theme.service';

@Component({
  selector: 'app-root',
  template: `
    <luna-theme-toggle></luna-theme-toggle>
    <router-outlet></router-outlet>
  `
})
export class AppComponent {
  constructor(private themeService: LunaThemeService) {}
}
5. Toggle de tema en cualquier componente
TypeScript
import { LunaThemeService } from '../../../core/services/luna-theme.service';

@Component({...})
export class MiComponente {
  constructor(public themeService: LunaThemeService) {}
  
  cambiarTema() {
    this.themeService.toggle();
  }
}
Uso de tokens en componentes
scss
// Ejemplo: Botón premium
.mi-boton {
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
Nuevos tokens premium vs v1.0
Table
Feature	v1.0	v2.0
Sombras	Simples	Layered (ambient + directional + colored)
Glassmorphism	❌	✅ Completo
Glow effects	❌	✅ Focus, error, success
Gradientes	❌	✅ Botones y superficies
Motion tokens	3 básicas	Easing curves, durations, transforms
Shimmer	❌	✅ Keyframe global
Reduced motion	❌	✅ Respeto a preferencias
Font tokens	❌	✅ Sans, mono, display, numeric
Cambios respecto a tu archivo anterior
Tokens renombrados (compatibilidad)
space-0.5 → space-0-5 (CSS no permite puntos en nombres de custom properties)
ls-* mantenidos pero documentados mejor
Tokens nuevos
Todos los de la sección "Effects" (glass, glow, gradients, layered shadows)
Todos los de "Motion" (easing, durations, transforms, keyframes)
Font families (font-sans, font-mono, font-display, font-numeric)
Tokens mejorados
Sombras: ahora son layered para mayor profundidad real
Dark mode: glassmorphism y glows adaptados
'''
with open(f"{output_dir}/README.md", "w") as f:
f.write(readme)
print("✅ Archivos generados correctamente")
print(f"📁 Directorio: {output_dir}")
print("\nArchivos creados:")
for f in sorted(os.listdir(output_dir)):
size = os.path.getsize(f"{output_dir}/{f}")
print(f"  • {f} ({size:,} bytes)")
plain

He generado todos los archivos del sistema de tokens premium. Aquí tienes los enlaces para descargarlos:

**Tokens SCSS (modular):**
- [01 Primitives](sandbox:///mnt/agents/output/luna-tokens-v2/_01-primitives.scss)
- [02 Semantic](sandbox:///mnt/agents/output/luna-tokens-v2/_02-semantic.scss)
- [03 Effects](sandbox:///mnt/agents/output/luna-tokens-v2/_03-effects.scss)
- [04 Motion](sandbox:///mnt/agents/output/luna-tokens-v2/_04-motion.scss)
- [05 Layout](sandbox:///mnt/agents/output/luna-tokens-v2/_05-layout.scss)
- [06 Typography](sandbox:///mnt/agents/output/luna-tokens-v2/_06-typography.scss)
- [Index (barrel)](sandbox:///mnt/agents/output/luna-tokens-v2/index.scss)

**Angular Services:**
- [Luna Theme Service](sandbox:///mnt/agents/output/luna-tokens-v2/luna-theme.service.ts)
- [Theme Toggle Component](sandbox:///mnt/agents/output/luna-tokens-v2/luna-theme-toggle.component.ts)

**Documentación:**
- [README](sandbox:///mnt/agents/output/luna-tokens-v2/README.md)

---

## 🚀 Pasos para implementar

### 1. Copiar tokens a tu proyecto
```bash
# Crear carpeta y copiar archivos
mkdir -p src/styles/tokens
cp luna-tokens-v2/_0*.scss src/styles/tokens/
cp luna-tokens-v2/index.scss src/styles/tokens/
2. Actualizar tu styles.scss
scss
// ANTES (tu archivo actual)
// @import 'tokens'; // o lo que tengas

// DESPUÉS
@use 'tokens/index';
3. Copiar el Theme Service
bash
mkdir -p src/app/core/services
cp luna-tokens-v2/luna-theme.service.ts src/app/core/services/
4. Usar el toggle en tu app
TypeScript
// En tu app.component.ts o topbar
import { LunaThemeToggleComponent } from './shared/luna/luna-theme-toggle/luna-theme-toggle.component';

@Component({
  imports: [LunaThemeToggleComponent, ...],
  template: `
    <luna-theme-toggle></luna-theme-toggle>
  `
})
⚠️ Nota importante sobre compatibilidad
Tu archivo original tenía --space-0.5 que no es válido en CSS (los custom properties no pueden tener puntos). Lo cambié a --space-0-5. Si ya lo usas en tu código, actualiza esas referencias.
¿Necesitas que genere algún componente específico usando estos tokens (como el botón premium, modal glassmorphism, o toast)?