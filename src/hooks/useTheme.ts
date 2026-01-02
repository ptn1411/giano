import { useEffect, useState, useCallback } from 'react';

export type ThemeMode = 'light' | 'dark' | 'system';
type ResolvedTheme = 'light' | 'dark';
type ColorTheme = 'default' | 'ocean' | 'forest' | 'sunset' | 'purple';

export const colorThemes: { id: ColorTheme; name: string; primary: string; preview: string }[] = [
  { id: 'default', name: 'Default Blue', primary: '200 98% 39%', preview: '#0284c7' },
  { id: 'ocean', name: 'Ocean Teal', primary: '173 80% 40%', preview: '#0d9488' },
  { id: 'forest', name: 'Forest Green', primary: '142 76% 36%', preview: '#16a34a' },
  { id: 'sunset', name: 'Sunset Orange', primary: '24 95% 53%', preview: '#f97316' },
  { id: 'purple', name: 'Royal Purple', primary: '271 81% 55%', preview: '#a855f7' },
];

function getSystemTheme(): ResolvedTheme {
  if (typeof window !== 'undefined') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  return 'light';
}

export function useTheme() {
  const [themeMode, setThemeMode] = useState<ThemeMode>(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('themeMode') as ThemeMode;
      if (stored) return stored;
      // Legacy support
      const legacyTheme = localStorage.getItem('theme');
      if (legacyTheme === 'light' || legacyTheme === 'dark') {
        return legacyTheme;
      }
      return 'system';
    }
    return 'system';
  });

  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>(() => {
    if (themeMode === 'system') {
      return getSystemTheme();
    }
    return themeMode as ResolvedTheme;
  });

  const [colorTheme, setColorTheme] = useState<ColorTheme>(() => {
    if (typeof window !== 'undefined') {
      return (localStorage.getItem('colorTheme') as ColorTheme) || 'default';
    }
    return 'default';
  });

  // Listen for system theme changes
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    
    const handleChange = (e: MediaQueryListEvent) => {
      if (themeMode === 'system') {
        setResolvedTheme(e.matches ? 'dark' : 'light');
      }
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [themeMode]);

  // Update resolved theme when mode changes
  useEffect(() => {
    if (themeMode === 'system') {
      setResolvedTheme(getSystemTheme());
    } else {
      setResolvedTheme(themeMode as ResolvedTheme);
    }
    localStorage.setItem('themeMode', themeMode);
    // Clean up legacy key
    localStorage.removeItem('theme');
  }, [themeMode]);

  // Apply theme to DOM
  useEffect(() => {
    const root = document.documentElement;
    if (resolvedTheme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [resolvedTheme]);

  // Apply color theme
  useEffect(() => {
    const root = document.documentElement;
    const selectedTheme = colorThemes.find(t => t.id === colorTheme);
    if (selectedTheme) {
      root.style.setProperty('--primary', selectedTheme.primary);
      root.style.setProperty('--ring', selectedTheme.primary);
      root.style.setProperty('--sidebar-primary', selectedTheme.primary);
      root.style.setProperty('--sidebar-ring', selectedTheme.primary);
    }
    localStorage.setItem('colorTheme', colorTheme);
  }, [colorTheme]);

  const toggleTheme = useCallback(() => {
    setThemeMode((prev) => {
      if (prev === 'light') return 'dark';
      if (prev === 'dark') return 'light';
      // If system, toggle to opposite of current resolved
      return resolvedTheme === 'light' ? 'dark' : 'light';
    });
  }, [resolvedTheme]);

  const setTheme = useCallback((mode: ThemeMode) => {
    setThemeMode(mode);
  }, []);

  const setColor = useCallback((color: ColorTheme) => {
    setColorTheme(color);
  }, []);

  return { 
    theme: resolvedTheme, 
    themeMode,
    toggleTheme, 
    setTheme,
    colorTheme, 
    setColorTheme: setColor, 
    colorThemes 
  };
}
