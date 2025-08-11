import {DefaultTheme} from 'react-native-paper';
import {CustomTheme} from '@/types';

// Premium Brazilian Color Palette - Mobile Edition
export const colors = {
  // Core system colors
  primary: '#2e90fa',
  primaryDark: '#1570ef',
  secondary: '#16b364',
  secondaryDark: '#099250',
  background: '#ffffff',
  surface: '#f8fafc',
  error: '#ef4444',
  success: '#16b364',
  warning: '#f59e0b',
  info: '#2e90fa',
  text: '#0f172a',
  textSecondary: '#64748b',
  textLight: '#ffffff',
  border: '#e2e8f0',
  divider: '#f1f5f9',
  overlay: 'rgba(0, 0, 0, 0.5)',
  shadow: 'rgba(0, 0, 0, 0.1)',

  // Premium Brand Colors - Sophisticated Blues
  brand: {
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
  },

  // Brazilian Gold/Luxury Colors
  brazilianGold: {
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
  },

  // Forest/Emerald - Brazilian Nature
  forest: {
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
  },

  // Royal Purple - Luxury
  royal: {
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
  },

  // Warm Coral - Brazilian Energy
  coral: {
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
  },

  // Premium Neutral Colors
  neutral: {
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
  },

  // Legacy support
  brandPrimary: '#2e90fa',
  brandSecondary: '#16b364',
  brandAccent: '#f79009',
};

// Premium Spacing System
export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
  xxxl: 64,
  // Premium spacing scale
  micro: 2,
  tiny: 6,
  base: 12,
  comfortable: 20,
  spacious: 28,
  generous: 40,
  luxurious: 56,
};

// Premium Border Radius System
export const borderRadius = {
  none: 0,
  xs: 2,
  sm: 4,
  md: 8,
  lg: 12,
  xl: 16,
  xxl: 20,
  xxxl: 24,
  full: 999,
  // Premium radius for luxury feel
  premium: 18,
  luxury: 22,
  brazilian: 14, // Warm, approachable rounding
};

// Premium Typography System
export const fonts = {
  // Font families (system fonts optimized for each platform)
  regular: 'System',
  medium: 'System',
  semibold: 'System',
  bold: 'System',
  
  // Premium font weights
  weights: {
    light: '300',
    regular: '400',
    medium: '500',
    semibold: '600',
    bold: '700',
    extrabold: '800',
  },
  
  // Premium type scale
  sizes: {
    xs: 11,
    sm: 13,
    base: 15,
    md: 16,
    lg: 18,
    xl: 20,
    xxl: 24,
    xxxl: 28,
    display: 32,
    hero: 40,
    // Premium heading sizes
    h1: 36,
    h2: 30,
    h3: 24,
    h4: 20,
    h5: 18,
    h6: 16,
  },
  
  // Premium line heights
  lineHeights: {
    tight: 1.1,
    snug: 1.2,
    normal: 1.4,
    relaxed: 1.5,
    loose: 1.6,
  },
  
  // Premium letter spacing
  letterSpacing: {
    tighter: -0.02,
    tight: -0.01,
    normal: 0,
    wide: 0.01,
    wider: 0.02,
    widest: 0.04,
  },
};

// Premium Shadow System
export const shadows = {
  // Basic shadows
  none: {
    shadowColor: 'transparent',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
  },
  
  xs: {
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 1,
    elevation: 1,
  },
  
  sm: {
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  
  md: {
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 4,
  },
  
  lg: {
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 8,
  },
  
  xl: {
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 12,
  },
  
  // Premium colored shadows
  premium: {
    shadowColor: colors.brazilianGold[500],
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 12,
  },
  
  luxury: {
    shadowColor: colors.royal[500],
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 16,
  },
  
  brazilian: {
    shadowColor: colors.forest[500],
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 10,
  },
  
  // Glass effect shadow
  glass: {
    shadowColor: colors.brand[500],
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 8,
  },
};

// Premium React Native Paper Theme
export const theme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    primary: colors.brand[500],
    primaryContainer: colors.brand[100],
    secondary: colors.forest[500],
    secondaryContainer: colors.forest[100],
    tertiary: colors.brazilianGold[500],
    tertiaryContainer: colors.brazilianGold[100],
    background: colors.background,
    surface: colors.surface,
    surfaceVariant: colors.neutral[50],
    error: colors.error,
    errorContainer: colors.coral[100],
    onPrimary: colors.textLight,
    onSecondary: colors.textLight,
    onTertiary: colors.text,
    onBackground: colors.text,
    onSurface: colors.text,
    onError: colors.textLight,
    outline: colors.border,
    outlineVariant: colors.neutral[200],
    inverseSurface: colors.neutral[800],
    inverseOnSurface: colors.textLight,
    inversePrimary: colors.brand[300],
    shadow: colors.shadow,
    scrim: colors.overlay,
    backdrop: colors.overlay,
    // Legacy support
    text: colors.text,
    disabled: colors.textSecondary,
    placeholder: colors.textSecondary,
    notification: colors.error,
  },
  fonts: {
    ...DefaultTheme.fonts,
    displayLarge: {
      fontFamily: fonts.bold,
      fontWeight: fonts.weights.bold as any,
      fontSize: fonts.sizes.hero,
      lineHeight: fonts.sizes.hero * fonts.lineHeights.tight,
      letterSpacing: fonts.letterSpacing.tighter,
    },
    displayMedium: {
      fontFamily: fonts.bold,
      fontWeight: fonts.weights.bold as any,
      fontSize: fonts.sizes.display,
      lineHeight: fonts.sizes.display * fonts.lineHeights.tight,
      letterSpacing: fonts.letterSpacing.tight,
    },
    displaySmall: {
      fontFamily: fonts.semibold,
      fontWeight: fonts.weights.semibold as any,
      fontSize: fonts.sizes.h1,
      lineHeight: fonts.sizes.h1 * fonts.lineHeights.snug,
      letterSpacing: fonts.letterSpacing.normal,
    },
    headlineLarge: {
      fontFamily: fonts.semibold,
      fontWeight: fonts.weights.semibold as any,
      fontSize: fonts.sizes.h2,
      lineHeight: fonts.sizes.h2 * fonts.lineHeights.snug,
      letterSpacing: fonts.letterSpacing.normal,
    },
    headlineMedium: {
      fontFamily: fonts.semibold,
      fontWeight: fonts.weights.semibold as any,
      fontSize: fonts.sizes.h3,
      lineHeight: fonts.sizes.h3 * fonts.lineHeights.normal,
      letterSpacing: fonts.letterSpacing.normal,
    },
    headlineSmall: {
      fontFamily: fonts.medium,
      fontWeight: fonts.weights.medium as any,
      fontSize: fonts.sizes.h4,
      lineHeight: fonts.sizes.h4 * fonts.lineHeights.normal,
      letterSpacing: fonts.letterSpacing.normal,
    },
    titleLarge: {
      fontFamily: fonts.semibold,
      fontWeight: fonts.weights.semibold as any,
      fontSize: fonts.sizes.h5,
      lineHeight: fonts.sizes.h5 * fonts.lineHeights.normal,
      letterSpacing: fonts.letterSpacing.normal,
    },
    titleMedium: {
      fontFamily: fonts.medium,
      fontWeight: fonts.weights.medium as any,
      fontSize: fonts.sizes.lg,
      lineHeight: fonts.sizes.lg * fonts.lineHeights.normal,
      letterSpacing: fonts.letterSpacing.wide,
    },
    titleSmall: {
      fontFamily: fonts.medium,
      fontWeight: fonts.weights.medium as any,
      fontSize: fonts.sizes.base,
      lineHeight: fonts.sizes.base * fonts.lineHeights.normal,
      letterSpacing: fonts.letterSpacing.wide,
    },
    labelLarge: {
      fontFamily: fonts.medium,
      fontWeight: fonts.weights.medium as any,
      fontSize: fonts.sizes.base,
      lineHeight: fonts.sizes.base * fonts.lineHeights.normal,
      letterSpacing: fonts.letterSpacing.wide,
    },
    labelMedium: {
      fontFamily: fonts.medium,
      fontWeight: fonts.weights.medium as any,
      fontSize: fonts.sizes.sm,
      lineHeight: fonts.sizes.sm * fonts.lineHeights.normal,
      letterSpacing: fonts.letterSpacing.wider,
    },
    labelSmall: {
      fontFamily: fonts.regular,
      fontWeight: fonts.weights.regular as any,
      fontSize: fonts.sizes.xs,
      lineHeight: fonts.sizes.xs * fonts.lineHeights.normal,
      letterSpacing: fonts.letterSpacing.wider,
    },
    bodyLarge: {
      fontFamily: fonts.regular,
      fontWeight: fonts.weights.regular as any,
      fontSize: fonts.sizes.md,
      lineHeight: fonts.sizes.md * fonts.lineHeights.relaxed,
      letterSpacing: fonts.letterSpacing.normal,
    },
    bodyMedium: {
      fontFamily: fonts.regular,
      fontWeight: fonts.weights.regular as any,
      fontSize: fonts.sizes.base,
      lineHeight: fonts.sizes.base * fonts.lineHeights.relaxed,
      letterSpacing: fonts.letterSpacing.normal,
    },
    bodySmall: {
      fontFamily: fonts.regular,
      fontWeight: fonts.weights.regular as any,
      fontSize: fonts.sizes.sm,
      lineHeight: fonts.sizes.sm * fonts.lineHeights.relaxed,
      letterSpacing: fonts.letterSpacing.normal,
    },
    // Legacy support
    regular: {
      fontFamily: fonts.regular,
      fontWeight: fonts.weights.regular as any,
    },
    medium: {
      fontFamily: fonts.medium,
      fontWeight: fonts.weights.medium as any,
    },
    bold: {
      fontFamily: fonts.bold,
      fontWeight: fonts.weights.bold as any,
    },
  },
  roundness: borderRadius.md,
};

// Premium Custom Theme Object
export const customTheme: CustomTheme = {
  colors: {
    // Core colors
    primary: colors.brand[500],
    secondary: colors.forest[500],
    background: colors.background,
    surface: colors.surface,
    error: colors.error,
    success: colors.success,
    warning: colors.warning,
    info: colors.info,
    text: colors.text,
    textSecondary: colors.textSecondary,
    border: colors.border,
    divider: colors.divider,
    
    // Premium color extensions
    brand: colors.brand,
    brazilianGold: colors.brazilianGold,
    forest: colors.forest,
    royal: colors.royal,
    coral: colors.coral,
    neutral: colors.neutral,
    
    // Legacy support
    brandPrimary: colors.brandPrimary,
    brandSecondary: colors.brandSecondary,
    brandAccent: colors.brandAccent,
  },
  fonts: {
    regular: fonts.regular,
    medium: fonts.medium,
    semibold: fonts.semibold,
    bold: fonts.bold,
    weights: fonts.weights,
    sizes: fonts.sizes,
    lineHeights: fonts.lineHeights,
    letterSpacing: fonts.letterSpacing,
  },
  spacing,
  borderRadius,
  shadows,
};

// Premium Theme Variants for Different Modes
export const lightTheme = {
  ...customTheme,
  colors: {
    ...customTheme.colors,
    background: '#ffffff',
    surface: '#f8fafc',
    text: '#0f172a',
    textSecondary: '#64748b',
  },
};

export const darkTheme = {
  ...customTheme,
  colors: {
    ...customTheme.colors,
    background: '#0f172a',
    surface: '#1e293b',
    text: '#f8fafc',
    textSecondary: '#94a3b8',
    border: '#334155',
    divider: '#475569',
  },
};

// Component-specific style helpers
export const componentStyles = {
  button: {
    premium: {
      backgroundColor: colors.brazilianGold[500],
      borderRadius: borderRadius.premium,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
      ...shadows.premium,
    },
    luxury: {
      backgroundColor: colors.royal[500],
      borderRadius: borderRadius.luxury,
      paddingHorizontal: spacing.xl,
      paddingVertical: spacing.lg,
      ...shadows.luxury,
    },
    brazilian: {
      backgroundColor: colors.forest[500],
      borderRadius: borderRadius.brazilian,
      paddingHorizontal: spacing.comfortable,
      paddingVertical: spacing.base,
      ...shadows.brazilian,
    },
  },
  card: {
    premium: {
      backgroundColor: colors.background,
      borderRadius: borderRadius.premium,
      padding: spacing.lg,
      ...shadows.premium,
    },
    glass: {
      backgroundColor: 'rgba(248, 250, 252, 0.8)',
      borderRadius: borderRadius.luxury,
      padding: spacing.xl,
      ...shadows.glass,
    },
  },
  input: {
    premium: {
      backgroundColor: colors.surface,
      borderRadius: borderRadius.premium,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      borderWidth: 1,
      borderColor: colors.border,
      ...shadows.sm,
    },
  },
};

export default theme;