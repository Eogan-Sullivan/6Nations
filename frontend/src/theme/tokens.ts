export type ThemeName = 'dark' | 'light';

export const darkColors = {
  bg: '#07111A', lowest: '#091722', panel: '#0D1D29', raised: '#102532',
  elevated: '#203B47', active: '#193D35', border: 'rgba(255,255,255,0.10)',
  text: '#F5F7FA', muted: '#9BB0BF', textMuted: '#8297A7',
  emerald: '#45E0A1', accentFill: '#45E0A1', accentHover: '#6BE8B4',
  accentSoft: '#153A30', onAccent: '#07111A', onBadge: '#07111A',
  amber: '#F4C46D', danger: '#FFACA6', dangerSoft: '#40272B', teal: '#6BD8CB',
  pitch: '#0C352A', pitchStripe: '#104333', line: '#E3F8ED',
  pitchBorder: '#35684F', pitchText: '#FFFFFF', pitchMuted: '#C4E5D3',
  jerseyNeck: '#18362C', demoSurface: '#12271E', demoBorder: '#496447',
  navSurface: '#091722', inputBackground: '#091722', shadow: '#000000',
  backdrop: 'rgba(0,0,0,0.72)',
  cyan: '#8CE7F2', gold: '#F4C46D', pitchLight: '#1B6A4C', pitchShadow: '#061F19',
};
export type ThemeColors = { [Key in keyof typeof darkColors]: string };
export const lightColors: ThemeColors = {
  bg: '#F4F7F8', lowest: '#EBF1F3', panel: '#FFFFFF', raised: '#F8FAFB',
  elevated: '#E6EEF1', active: '#E4F8EF', border: '#DCE5E9',
  text: '#14232D', muted: '#526B79', textMuted: '#607582',
  emerald: '#087E50', accentFill: '#087E50', accentHover: '#087648',
  accentSoft: '#E4F8EF', onAccent: '#FFFFFF', onBadge: '#FFFFFF',
  amber: '#805600', danger: '#B53331', dangerSoft: '#FCECEB', teal: '#126C67',
  pitch: '#196943', pitchStripe: '#21784D', line: '#FFFFFF',
  pitchBorder: '#155B3A', pitchText: '#FFFFFF', pitchMuted: '#E0F1E5',
  jerseyNeck: '#18362C', demoSurface: '#EAF5EF', demoBorder: '#A8C8B6',
  navSurface: '#EDF3F5', inputBackground: '#F1F5F7', shadow: '#234433',
  backdrop: 'rgba(20,35,45,0.45)',
  cyan: '#087D8D', gold: '#805600', pitchLight: '#2B8658', pitchShadow: '#0D4A2A',
};
export const palettes: Record<ThemeName, ThemeColors> = { dark: darkColors, light: lightColors };
// Static consumers retain the incumbent default; rendered components use useTheme.
export const colors = darkColors;
export const fonts = { heading: 'Chivo_700Bold', body: 'Inter_400Regular', medium: 'Inter_600SemiBold' };

// Shared visual language for layered surfaces and stateful interactions.
// Keep these values platform-neutral so native and web surfaces stay aligned.
export const motion = {
  fast: 160,
  standard: 220,
  emphasis: 280,
  easeOut: 'cubic-bezier(0.23, 1, 0.32, 1)',
  easeInOut: 'cubic-bezier(0.77, 0, 0.175, 1)',
  drawer: 'cubic-bezier(0.32, 0.72, 0, 1)',
} as const;

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;
export const radii = { control: 6, panel: 14, feature: 18, round: 999 } as const;

export const elevation = {
  hairline: { opacity: 0.1, radius: 0, offsetY: 0 },
  raised: { opacity: 0.14, radius: 14, offsetY: 6 },
  floating: { opacity: 0.24, radius: 24, offsetY: 12 },
} as const;

export const webCssVariables = Object.fromEntries(
  Object.entries(darkColors).map(([key, value]) => [key.replace(/[A-Z]/g, letter => `-${letter.toLowerCase()}`), value]),
);
