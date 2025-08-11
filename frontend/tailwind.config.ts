import type { Config } from 'tailwindcss'

const config: Config = {
  darkMode: ["class"],
  content: [
    './pages/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './app/**/*.{ts,tsx}',
    './src/**/*.{ts,tsx}',
  ],
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
        "3xl": "1600px",
      },
    },
    extend: {
      // Premium Color Palette - Enterprise Level
      colors: {
        // Shadcn/UI System Colors (preserved for compatibility)
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },

        // Premium Brand Colors - Sophisticated Blues
        brand: {
          25: '#f8fbff',
          50: '#eff8ff',
          100: '#d1e9ff',
          200: '#b2ddff',
          300: '#84caff',
          400: '#53b1fd',
          500: '#2e90fa',
          600: '#1570ef',
          700: '#175cd3',
          800: '#1849a9',
          900: '#194185',
          950: '#102a56',
        },

        // Luxury Gold/Amber - Premium Accents
        luxury: {
          25: '#fffef5',
          50: '#fffbeb',
          100: '#fff4c6',
          200: '#ffe588',
          300: '#ffd149',
          400: '#ffbd20',
          500: '#f79009',
          600: '#dc6803',
          700: '#b54708',
          800: '#93370d',
          900: '#792e0d',
          950: '#451a03',
        },

        // Deep Forest/Emerald - Trust & Brazilian Nature
        forest: {
          25: '#f6fdf9',
          50: '#edfcf2',
          100: '#d3f8df',
          200: '#aaf0c4',
          300: '#73e2a3',
          400: '#3ccb7f',
          500: '#16b364',
          600: '#099250',
          700: '#087443',
          800: '#095c37',
          900: '#084c2e',
          950: '#052e1c',
        },

        // Rich Purple/Violet - Luxury Positioning
        royal: {
          25: '#fdfaff',
          50: '#faf5ff',
          100: '#f4e8ff',
          200: '#e9d5ff',
          300: '#d6bbfb',
          400: '#be95f7',
          500: '#9e69f1',
          600: '#7c3aed',
          700: '#6d28d9',
          800: '#5b21b6',
          900: '#4c1d95',
          950: '#2e1065',
        },

        // Warm Coral/Orange - Brazilian Energy
        coral: {
          25: '#fffaf8',
          50: '#fff4f1',
          100: '#ffe6de',
          200: '#ffcab8',
          300: '#ffa285',
          400: '#ff6f47',
          500: '#ff4405',
          600: '#e62e05',
          700: '#c2210c',
          800: '#a11e12',
          900: '#851e13',
          950: '#460a04',
        },

        // Sophisticated Grays with Warmth
        neutral: {
          25: '#fcfcfd',
          50: '#f8fafc',
          100: '#f1f5f9',
          200: '#e2e8f0',
          300: '#cbd5e1',
          400: '#94a3b8',
          500: '#64748b',
          600: '#475569',
          700: '#334155',
          800: '#1e293b',
          900: '#0f172a',
          950: '#020617',
        },

        // Enhanced Success Colors
        success: {
          25: '#f6fef9',
          50: '#ecfdf3',
          100: '#d1fadf',
          200: '#a7f3d0',
          300: '#6ee7b7',
          400: '#34d399',
          500: '#10b981',
          600: '#059669',
          700: '#047857',
          800: '#065f46',
          900: '#064e3b',
          950: '#022c22',
        },

        // Premium Error Colors
        danger: {
          25: '#fffbfa',
          50: '#fef2f2',
          100: '#fee2e2',
          200: '#fecaca',
          300: '#fca5a5',
          400: '#f87171',
          500: '#ef4444',
          600: '#dc2626',
          700: '#b91c1c',
          800: '#991b1b',
          900: '#7f1d1d',
          950: '#450a0a',
        },

        // Premium Warning Colors
        warning: {
          25: '#fffcf5',
          50: '#fffbeb',
          100: '#fef3c7',
          200: '#fde68a',
          300: '#fcd34d',
          400: '#fbbf24',
          500: '#f59e0b',
          600: '#d97706',
          700: '#b45309',
          800: '#92400e',
          900: '#78350f',
          950: '#451a03',
        },

        // Brazilian Gold - Luxury Brazilian Theme  
        'brazilian-gold': {
          25: '#fffdf5',
          50: '#fffaeb', 
          100: '#fff3c6',
          200: '#ffe888',
          300: '#ffd949',
          400: '#ffca20',
          500: '#f2b509',
          600: '#d68e03',
          700: '#b26508',
          800: '#904f0d',
          900: '#76430d',
          950: '#441f03',
        },
      },

      // Modern Typography System
      fontFamily: {
        // Display font - for large headlines and hero text
        display: ['Poppins', 'system-ui', 'sans-serif'],
        // Heading font - for section headings
        heading: ['Poppins', 'Inter', 'system-ui', 'sans-serif'], 
        // Body font - for paragraphs and content
        body: ['Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif'],
        // UI font - for buttons, labels, and interface elements
        ui: ['DM Sans', 'Inter', 'system-ui', 'sans-serif'],
        // Default sans (Inter-based)
        sans: ['Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
        // Monospace for code
        mono: ['JetBrains Mono', 'Fira Code', 'Monaco', 'Consolas', 'monospace'],
      },

      // Enhanced Typography Scale
      fontSize: {
        'xs': ['0.75rem', { lineHeight: '1rem', letterSpacing: '0.025em' }],
        'sm': ['0.875rem', { lineHeight: '1.25rem', letterSpacing: '0.025em' }],
        'base': ['1rem', { lineHeight: '1.5rem', letterSpacing: '0em' }],
        'lg': ['1.125rem', { lineHeight: '1.75rem', letterSpacing: '-0.025em' }],
        'xl': ['1.25rem', { lineHeight: '1.75rem', letterSpacing: '-0.025em' }],
        '2xl': ['1.5rem', { lineHeight: '2rem', letterSpacing: '-0.025em' }],
        '3xl': ['1.875rem', { lineHeight: '2.25rem', letterSpacing: '-0.05em' }],
        '4xl': ['2.25rem', { lineHeight: '2.5rem', letterSpacing: '-0.05em' }],
        '5xl': ['3rem', { lineHeight: '3.5rem', letterSpacing: '-0.05em' }],
        '6xl': ['3.75rem', { lineHeight: '4rem', letterSpacing: '-0.075em' }],
        '7xl': ['4.5rem', { lineHeight: '5rem', letterSpacing: '-0.075em' }],
        '8xl': ['6rem', { lineHeight: '6.5rem', letterSpacing: '-0.1em' }],
        '9xl': ['8rem', { lineHeight: '8.5rem', letterSpacing: '-0.1em' }],
      },

      // Premium Spacing Scale
      spacing: {
        '18': '4.5rem',
        '88': '22rem',
        '128': '32rem',
        '144': '36rem',
      },

      // Enhanced Border Radius System
      borderRadius: {
        'none': '0',
        'sm': '0.125rem',
        'DEFAULT': '0.25rem',
        'md': '0.375rem',
        'lg': '0.5rem',
        'xl': '0.75rem',
        '2xl': '1rem',
        '3xl': '1.5rem',
        '4xl': '2rem',
        'full': '9999px',
      },

      // Premium Shadow System - Multi-layer Shadows
      boxShadow: {
        // Subtle shadows
        'xs': '0 1px 2px 0 rgb(0 0 0 / 0.05)',
        'sm': '0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)',
        'DEFAULT': '0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)',
        'md': '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
        'lg': '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)',
        'xl': '0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)',
        '2xl': '0 25px 50px -12px rgb(0 0 0 / 0.25)',
        
        // Premium shadows
        'premium': '0 8px 16px -4px rgb(0 0 0 / 0.1), 0 4px 8px -4px rgb(0 0 0 / 0.06)',
        'luxury': '0 12px 24px -6px rgb(0 0 0 / 0.15), 0 6px 12px -6px rgb(0 0 0 / 0.1)',
        'royal': '0 16px 32px -8px rgb(0 0 0 / 0.2), 0 8px 16px -8px rgb(0 0 0 / 0.15)',
        
        // Colored shadows for brand elements
        'brand': '0 8px 16px -4px rgb(46 144 250 / 0.3), 0 4px 8px -4px rgb(46 144 250 / 0.2)',
        'luxury-glow': '0 8px 16px -4px rgb(247 144 9 / 0.3), 0 4px 8px -4px rgb(247 144 9 / 0.2)',
        'forest-glow': '0 8px 16px -4px rgb(22 179 100 / 0.3), 0 4px 8px -4px rgb(22 179 100 / 0.2)',
        
        'inner': 'inset 0 2px 4px 0 rgb(0 0 0 / 0.05)',
        'none': 'none',
      },

      // Advanced Backdrop Blur
      backdropBlur: {
        'xs': '2px',
        'sm': '4px',
        'DEFAULT': '8px',
        'md': '12px',
        'lg': '16px',
        'xl': '24px',
        '2xl': '40px',
        '3xl': '64px',
      },

      // Premium Gradient Configurations
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'gradient-conic': 'conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))',
        'gradient-brand': 'linear-gradient(135deg, #2e90fa 0%, #1570ef 100%)',
        'gradient-luxury': 'linear-gradient(135deg, #f79009 0%, #dc6803 100%)',
        'gradient-forest': 'linear-gradient(135deg, #16b364 0%, #099250 100%)',
        'gradient-royal': 'linear-gradient(135deg, #9e69f1 0%, #7c3aed 100%)',
        'gradient-coral': 'linear-gradient(135deg, #ff6f47 0%, #ff4405 100%)',
        'gradient-premium': 'linear-gradient(135deg, #2e90fa 0%, #9e69f1 50%, #f79009 100%)',
        'gradient-hero': 'linear-gradient(135deg, rgba(46, 144, 250, 0.1) 0%, rgba(158, 105, 241, 0.1) 50%, rgba(247, 144, 9, 0.1) 100%)',
      },

      // Advanced Animation Keyframes
      keyframes: {
        // Existing animations (preserved)
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
        
        // Premium animations
        "fade-in": {
          "0%": { opacity: "0", transform: "translateY(16px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "fade-in-up": {
          "0%": { opacity: "0", transform: "translateY(24px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "fade-in-down": {
          "0%": { opacity: "0", transform: "translateY(-24px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "fade-in-left": {
          "0%": { opacity: "0", transform: "translateX(-24px)" },
          "100%": { opacity: "1", transform: "translateX(0)" },
        },
        "fade-in-right": {
          "0%": { opacity: "0", transform: "translateX(24px)" },
          "100%": { opacity: "1", transform: "translateX(0)" },
        },
        "slide-up": {
          "0%": { transform: "translateY(100%)" },
          "100%": { transform: "translateY(0)" },
        },
        "slide-down": {
          "0%": { transform: "translateY(-100%)" },
          "100%": { transform: "translateY(0)" },
        },
        "scale-in": {
          "0%": { opacity: "0", transform: "scale(0.9)" },
          "100%": { opacity: "1", transform: "scale(1)" },
        },
        "scale-out": {
          "0%": { opacity: "1", transform: "scale(1)" },
          "100%": { opacity: "0", transform: "scale(0.9)" },
        },
        "bounce-gentle": {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-4px)" },
        },
        "pulse-gentle": {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.8" },
        },
        "shimmer": {
          "0%": { transform: "translateX(-100%)" },
          "100%": { transform: "translateX(100%)" },
        },
        "float": {
          "0%, 100%": { transform: "translateY(0px)" },
          "50%": { transform: "translateY(-8px)" },
        },
        "glow": {
          "0%, 100%": { boxShadow: "0 0 20px rgba(46, 144, 250, 0.3)" },
          "50%": { boxShadow: "0 0 30px rgba(46, 144, 250, 0.6)" },
        },
      },

      // Premium Animation System
      animation: {
        // Existing animations (preserved)
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        
        // Premium animations
        "fade-in": "fade-in 0.6s cubic-bezier(0.4, 0, 0.2, 1)",
        "fade-in-up": "fade-in-up 0.6s cubic-bezier(0.4, 0, 0.2, 1)",
        "fade-in-down": "fade-in-down 0.6s cubic-bezier(0.4, 0, 0.2, 1)",
        "fade-in-left": "fade-in-left 0.6s cubic-bezier(0.4, 0, 0.2, 1)",
        "fade-in-right": "fade-in-right 0.6s cubic-bezier(0.4, 0, 0.2, 1)",
        "slide-up": "slide-up 0.4s cubic-bezier(0.4, 0, 0.2, 1)",
        "slide-down": "slide-down 0.4s cubic-bezier(0.4, 0, 0.2, 1)",
        "scale-in": "scale-in 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
        "scale-out": "scale-out 0.2s cubic-bezier(0.4, 0, 1, 1)",
        "bounce-gentle": "bounce-gentle 2s infinite",
        "pulse-gentle": "pulse-gentle 2s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        "shimmer": "shimmer 2s linear infinite",
        "float": "float 3s ease-in-out infinite",
        "glow": "glow 2s ease-in-out infinite alternate",
      },

      // Enhanced Screen Breakpoints
      screens: {
        'xs': '475px',
        'sm': '640px',
        'md': '768px',
        'lg': '1024px',
        'xl': '1280px',
        '2xl': '1536px',
        '3xl': '1600px',
        '4xl': '1920px',
      },

      // Premium Z-Index Scale
      zIndex: {
        '60': '60',
        '70': '70',
        '80': '80',
        '90': '90',
        '100': '100',
      },

      // Enhanced Transition Timing
      transitionTimingFunction: {
        'smooth': 'cubic-bezier(0.4, 0, 0.2, 1)',
        'premium': 'cubic-bezier(0.25, 0.1, 0.25, 1)',
        'luxury': 'cubic-bezier(0.4, 0, 0.1, 1)',
      },

      // Premium Line Heights for Typography
      lineHeight: {
        'tight': '1.1',
        'snug': '1.2',
        'normal': '1.4',
        'relaxed': '1.5',
        'loose': '1.6',
      },

      // Letter Spacing for Premium Typography
      letterSpacing: {
        'tighter': '-0.05em',
        'tight': '-0.025em',
        'normal': '0em',
        'wide': '0.025em',
        'wider': '0.05em',
        'widest': '0.1em',
      },
    },
  },
  plugins: [
    require("tailwindcss-animate"),
    // Additional plugins for premium features can be added here
  ],
} satisfies Config

export default config