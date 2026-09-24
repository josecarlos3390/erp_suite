import type { Config } from 'tailwindcss';

/**
 * Los colores, radios, tipografia y sombras NO se escriben aqui: se leen de las
 * CSS variables que emite `scripts/sync-tokens.mjs` desde la capa de tokens del
 * ERP (LUNA) y de la **capa de marca de la tienda** (`src/styles/brand.css`,
 * F9/D23: variables `--sf-*`). Asi la tienda y el back office comparten una sola
 * fuente de verdad y ningun componente necesita un color hexadecimal literal.
 *
 * `primary` y `fg.accent` apuntan a la marca de la TIENDA (`--sf-brand-*`), no al
 * indigo del back office: el mismo marcado adopta la identidad comercial sin
 * tener que tocar cada componente.
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
          accent: 'var(--sf-brand-700)',
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
          accent: 'var(--sf-brand-300)',
          error: 'var(--border-error)',
          focus: 'var(--sf-brand-600)',
        },
        // Acento / marca de la TIENDA (capa `--sf-*`, no el indigo del back office)
        primary: {
          DEFAULT: 'var(--sf-brand-600)',
          hover: 'var(--sf-brand-700)',
          active: 'var(--sf-brand-800)',
          soft: 'var(--sf-brand-50)',
          'soft-strong': 'var(--sf-brand-100)',
          border: 'var(--sf-brand-300)',
          fg: 'var(--sf-brand-contrast)',
        },
        // Escala de marca completa (campanas, degradados, estados suaves)
        brand: {
          50: 'var(--sf-brand-50)',
          100: 'var(--sf-brand-100)',
          200: 'var(--sf-brand-200)',
          300: 'var(--sf-brand-300)',
          400: 'var(--sf-brand-400)',
          500: 'var(--sf-brand-500)',
          600: 'var(--sf-brand-600)',
          700: 'var(--sf-brand-700)',
          800: 'var(--sf-brand-800)',
          900: 'var(--sf-brand-900)',
          950: 'var(--sf-brand-950)',
        },
        promo: {
          soft: 'var(--sf-promo-50)',
          200: 'var(--sf-promo-200)',
          500: 'var(--sf-promo-500)',
          600: 'var(--sf-promo-600)',
          700: 'var(--sf-promo-700)',
        },
        deal: {
          soft: 'var(--sf-deal-50)',
          500: 'var(--sf-deal-500)',
          600: 'var(--sf-deal-600)',
          700: 'var(--sf-deal-700)',
        },
        price: {
          DEFAULT: 'var(--sf-price)',
          compare: 'var(--sf-price-compare)',
          deal: 'var(--sf-price-deal)',
          free: 'var(--sf-price-free)',
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
        // Formas de la tienda (F9/D23): mas redondeadas que el back office.
        btn: 'var(--sf-radius-btn)',
        card: 'var(--sf-radius-card)',
        media: 'var(--sf-radius-media)',
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
        sans: 'var(--sf-font-sans)',
        mono: 'var(--font-mono)',
        display: 'var(--sf-font-display)',
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
        // Elevacion comercial de la tienda (F9/D23)
        card: 'var(--sf-shadow-card)',
        'card-hover': 'var(--sf-shadow-card-hover)',
        cta: 'var(--sf-shadow-cta)',
        header: 'var(--sf-shadow-header)',
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
