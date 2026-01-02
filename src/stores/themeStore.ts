import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type ThemeMode = 'light' | 'dark' | 'system';
export type ResolvedTheme = 'light' | 'dark';
export type ColorTheme = 'default' | 'ocean' | 'forest' | 'sunset' | 'purple';

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

function applyThemeToDOM(resolvedTheme: ResolvedTheme) {
  const root = document.documentElement;
  if (resolvedTheme === 'dark') {
    root.classList.add('dark');
  } else {
    root.classList.remove('dark');
  }
}

function applyColorThemeToDOM(colorThemeId: ColorTheme) {
  const root = document.documentElement;
  const selectedTheme = colorThemes.find(t => t.id === colorThemeId);
  if (selectedTheme) {
    root.style.setProperty('--primary', selectedTheme.primary);
    root.style.setProperty('--ring', selectedTheme.primary);
    root.style.setProperty('--sidebar-primary', selectedTheme.primary);
    root.style.setProperty('--sidebar-ring', selectedTheme.primary);
  }
}

interface ThemeState {
  themeMode: ThemeMode;
  resolvedTheme: ResolvedTheme;
  colorTheme: ColorTheme;
  
  // Computed
  theme: ResolvedTheme;
  
  // Actions
  setTheme: (mode: ThemeMode) => void;
  toggleTheme: () => void;
  setColorTheme: (color: ColorTheme) => void;
  initializeTheme: () => void;
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set, get) => ({
      themeMode: 'system',
      resolvedTheme: getSystemTheme(),
      colorTheme: 'default',
      
      get theme() {
        return get().resolvedTheme;
      },

      setTheme: (mode: ThemeMode) => {
        const resolved = mode === 'system' ? getSystemTheme() : mode;
        set({ themeMode: mode, resolvedTheme: resolved });
        applyThemeToDOM(resolved);
      },

      toggleTheme: () => {
        const { themeMode, resolvedTheme } = get();
        let newMode: ThemeMode;
        
        if (themeMode === 'light') {
          newMode = 'dark';
        } else if (themeMode === 'dark') {
          newMode = 'light';
        } else {
          // If system, toggle to opposite of current resolved
          newMode = resolvedTheme === 'light' ? 'dark' : 'light';
        }
        
        // newMode here is always 'light' or 'dark', never 'system'
        set({ themeMode: newMode, resolvedTheme: newMode as ResolvedTheme });
        applyThemeToDOM(newMode as ResolvedTheme);
      },

      setColorTheme: (color: ColorTheme) => {
        set({ colorTheme: color });
        applyColorThemeToDOM(color);
      },

      initializeTheme: () => {
        const { themeMode, colorTheme } = get();
        const resolved = themeMode === 'system' ? getSystemTheme() : themeMode as ResolvedTheme;
        set({ resolvedTheme: resolved });
        applyThemeToDOM(resolved);
        applyColorThemeToDOM(colorTheme);
        
        // Listen for system theme changes
        if (typeof window !== 'undefined') {
          const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
          const handleChange = (e: MediaQueryListEvent) => {
            if (get().themeMode === 'system') {
              const newResolved = e.matches ? 'dark' : 'light';
              set({ resolvedTheme: newResolved });
              applyThemeToDOM(newResolved);
            }
          };
          mediaQuery.addEventListener('change', handleChange);
        }
      },
    }),
    {
      name: 'theme-storage',
      partialize: (state) => ({ 
        themeMode: state.themeMode, 
        colorTheme: state.colorTheme 
      }),
      onRehydrateStorage: () => (state) => {
        // Apply theme after rehydration
        if (state) {
          state.initializeTheme();
        }
      },
    }
  )
);

// Hook for compatibility with existing code
export function useTheme() {
  const store = useThemeStore();
  return {
    theme: store.resolvedTheme,
    themeMode: store.themeMode,
    toggleTheme: store.toggleTheme,
    setTheme: store.setTheme,
    colorTheme: store.colorTheme,
    setColorTheme: store.setColorTheme,
    colorThemes,
  };
}
