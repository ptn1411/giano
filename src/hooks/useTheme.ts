import { useEffect, useState } from 'react';

type Theme = 'light' | 'dark';
type ColorTheme = 'default' | 'ocean' | 'forest' | 'sunset' | 'purple';

export const colorThemes: { id: ColorTheme; name: string; primary: string; preview: string }[] = [
  { id: 'default', name: 'Default Blue', primary: '200 98% 39%', preview: '#0284c7' },
  { id: 'ocean', name: 'Ocean Teal', primary: '173 80% 40%', preview: '#0d9488' },
  { id: 'forest', name: 'Forest Green', primary: '142 76% 36%', preview: '#16a34a' },
  { id: 'sunset', name: 'Sunset Orange', primary: '24 95% 53%', preview: '#f97316' },
  { id: 'purple', name: 'Royal Purple', primary: '271 81% 55%', preview: '#a855f7' },
];

export function useTheme() {
  const [theme, setTheme] = useState<Theme>(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('theme') as Theme;
      if (stored) return stored;
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    return 'light';
  });

  const [colorTheme, setColorTheme] = useState<ColorTheme>(() => {
    if (typeof window !== 'undefined') {
      return (localStorage.getItem('colorTheme') as ColorTheme) || 'default';
    }
    return 'default';
  });

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    localStorage.setItem('theme', theme);
  }, [theme]);

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

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'light' ? 'dark' : 'light'));
  };

  const setColor = (color: ColorTheme) => {
    setColorTheme(color);
  };

  return { theme, toggleTheme, colorTheme, setColorTheme: setColor, colorThemes };
}
