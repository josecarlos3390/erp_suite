import type { Config } from 'tailwindcss';

/**
 * Los colores, radios, tipografia y sombras NO se escriben aqui: se leen de las
 * CSS variables que emite `scripts/sync-tokens.mjs` desde la capa de tokens del
 * ERP (LUNA). Asi la tienda y el back office comparten una sola fuente de verdad
 * y ningun componente necesita un color hexadecimal literal.
 */
const config: Config = {
  content: [
    './src/app/**/*.{ts,tsx}',
    './src/components/**/*.{ts,tsx}',
    './src/lib/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        // Superficies
        base: 'var(--bg-base)',
        elevated: 'var(--bg-elevated)',
        surface: 'var(--bg-surface)',
        inset: 'var(--bg-inset)',
        hover: 'var(--bg-hover)',
        active: 'var(--bg-active)',
        selected: 'var(--bg-selected)',
        skeleton: 'var(--bg-skeleton)',
        overlay: 'var(--bg-overlay)',
        // Texto
        fg: {
          DEFAULT: 'var(--text-primary)',
          secondary: 'var(--text-secondary)',
          tertiary: 'var(--text-tertiary)',
          inverse: 'var(--text-inverse)',
          accent: 'var(--text-accent)',
          success: 'var(--text-success)',
          warning: 'var(--text-warning)',
          error: 'var(--text-error)',
          purple: 'var(--text-purple)',
          disabled: 'var(--text-disabled)',
        },
        // Bordes
        line: {
          DEFAULT: 'var(--border-default)',
          subtle: 'var(--border-subtle)',
          strong: 'var(--border-strong)',
          accent: 'var(--border-accent)',
          error: 'var(--border-error)',
          focus: 'var(--border-focus)',
        },
        // Acento / marca de la tienda
        primary: {
          DEFAULT: 'var(--accent-600)',
          hover: 'var(--accent-700)',
          active: 'var(--accent-800)',
          soft: 'var(--accent-50)',
          'soft-strong': 'var(--accent-100)',
          border: 'var(--accent-300)',
          fg: 'var(--text-inverse)',
        },
        ok: {
          DEFAULT: 'var(--success-600)',
          soft: 'var(--success-50)',
          strong: 'var(--success-800)',
        },
        warn: {
          DEFAULT: 'var(--warning-500)',
          soft: 'var(--warning-50)',
          strong: 'var(--warning-800)',
        },
        danger: {
          DEFAULT: 'var(--error-600)',
          soft: 'var(--error-50)',
          strong: 'var(--error-700)',
        },
      },
      borderRadius: {
        sm: 'var(--radius-sm)',
        DEFAULT: 'var(--radius-md)',
        md: 'var(--radius-md)',
        lg: 'var(--radius-lg)',
        xl: 'var(--radius-xl)',
        '2xl': 'var(--radius-2xl)',
        full: 'var(--radius-full)',
      },
      spacing: {
        'space-0': 'var(--space-0)',
        'space-1': 'var(--space-1)',
        'space-2': 'var(--space-2)',
        'space-3': 'var(--space-3)',
        'space-4': 'var(--space-4)',
        'space-5': 'var(--space-5)',
        'space-6': 'var(--space-6)',
        'space-8': 'var(--space-8)',
        'space-10': 'var(--space-10)',
        'space-12': 'var(--space-12)',
        'space-16': 'var(--space-16)',
        'space-20': 'var(--space-20)',
        'space-24': 'var(--space-24)',
      },
      fontFamily: {
        sans: 'var(--font-sans)',
        mono: 'var(--font-mono)',
        display: 'var(--font-display)',
      },
      fontSize: {
        '2xs': ['var(--text-2xs)', { lineHeight: 'var(--lh-2xs)' }],
        xs: ['var(--text-xs)', { lineHeight: 'var(--lh-xs)' }],
        sm: ['var(--text-sm)', { lineHeight: 'var(--lh-sm)' }],
        base: ['var(--text-base)', { lineHeight: 'var(--lh-base)' }],
        md: ['var(--text-md)', { lineHeight: 'var(--lh-md)' }],
        lg: ['var(--text-lg)', { lineHeight: 'var(--lh-lg)' }],
        xl: ['var(--text-xl)', { lineHeight: 'var(--lh-xl)' }],
        '2xl': ['var(--text-2xl)', { lineHeight: 'var(--lh-2xl)' }],
        '3xl': ['var(--text-3xl)', { lineHeight: 'var(--lh-3xl)' }],
        '4xl': ['var(--text-4xl)', { lineHeight: 'var(--lh-4xl)' }],
        '5xl': ['var(--text-5xl)', { lineHeight: 'var(--lh-5xl)' }],
      },
      boxShadow: {
        sm: 'var(--shadow-sm)',
        DEFAULT: 'var(--shadow-md)',
        md: 'var(--shadow-md)',
        lg: 'var(--shadow-lg)',
        xl: 'var(--shadow-xl)',
        inner: 'var(--shadow-inner)',
        layered: 'var(--shadow-layered-md)',
        accent: 'var(--shadow-accent-lg)',
      },
      transitionTimingFunction: {
        expo: 'var(--ease-out-expo)',
        spring: 'var(--ease-out-spring)',
        smooth: 'var(--ease-in-out-smooth)',
      },
      transitionDuration: {
        fast: 'var(--duration-fast)',
        base: 'var(--duration-base)',
        slow: 'var(--duration-slow)',
      },
      zIndex: {
        sticky: 'var(--z-sticky-content)',
        panel: 'var(--z-page-panel)',
        modal: 'var(--z-modal)',
        toast: 'var(--z-toast)',
      },
    },
  },
  plugins: [],
};

export default config;
