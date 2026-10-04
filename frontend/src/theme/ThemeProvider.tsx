import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Platform, useColorScheme } from 'react-native';
import { palettes, type ThemeColors, type ThemeName } from './tokens';

export const THEME_STORAGE_KEY = '6nations:theme:v1';
type ThemeContextValue = { theme: ThemeName; colors: ThemeColors; toggleTheme: () => void };
const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemTheme = useColorScheme();
  const [preference, setPreference] = useState<ThemeName | null>(null);
  const changed = useRef(false);
  const writes = useRef(Promise.resolve());
  const theme = preference ?? (systemTheme === 'light' ? 'light' : 'dark');
  const colors = palettes[theme];
  useEffect(() => {
    let mounted = true;
    void AsyncStorage.getItem(THEME_STORAGE_KEY).then(saved => {
      if (mounted && !changed.current && (saved === 'light' || saved === 'dark')) setPreference(saved);
    }).catch(() => { /* Storage may be unavailable; system preference still works. */ });
    return () => { mounted = false; };
  }, []);
  const toggleTheme = useCallback(() => {
    changed.current = true;
    const next = theme === 'dark' ? 'light' : 'dark';
    setPreference(next);
    writes.current = writes.current.then(() => AsyncStorage.setItem(THEME_STORAGE_KEY, next)).catch(() => {});
  }, [theme]);
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;
    const root = document.documentElement;
    root.dataset.theme = theme;
    root.style.colorScheme = theme;
    let themeColor = document.querySelector('meta[name="theme-color"]');
    if (!themeColor) {
      themeColor = document.createElement('meta');
      themeColor.setAttribute('name', 'theme-color');
      document.head.appendChild(themeColor);
    }
    themeColor.setAttribute('content', colors.bg);
    for (const [key, value] of Object.entries(colors)) {
      root.style.setProperty(`--${key.replace(/[A-Z]/g, letter => `-${letter.toLowerCase()}`)}`, value);
    }
    const semantic = {
      background: colors.bg, surface: colors.panel, 'surface-secondary': colors.raised,
      'surface-hover': colors.elevated, 'text-primary': colors.text, 'text-secondary': colors.muted,
      accent: colors.accentFill, 'accent-hover': colors.accentHover, success: colors.emerald,
      'input-background': colors.inputBackground,
    };
    for (const [key, value] of Object.entries(semantic)) root.style.setProperty(`--${key}`, value);
  }, [colors, theme]);
  const value = useMemo(() => ({ theme, colors, toggleTheme }), [theme, colors, toggleTheme]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}
export function useTheme() {
  const value = useContext(ThemeContext);
  if (!value) throw new Error('useTheme must be used within ThemeProvider');
  return value;
}
export function useThemedStyles<T>(factory: (colors: ThemeColors) => T): T {
  const { colors } = useTheme();
  return useMemo(() => factory(colors), [colors, factory]);
}
