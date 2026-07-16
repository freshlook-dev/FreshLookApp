import React, { createContext, useContext, useEffect, useState } from 'react';
import { Appearance } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

type ThemeMode = 'light' | 'dark';

type ThemeContextType = {
  theme: ThemeMode;
  toggleTheme: () => void;
};

const ThemeContext = createContext<ThemeContextType>({
  theme: 'light',
  toggleTheme: () => {},
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemTheme = Appearance.getColorScheme() ?? 'light';
  const [theme, setTheme] = useState<ThemeMode>('light');

  useEffect(() => {
    let active = true;

    const loadTheme = async () => {
      try {
        const saved = await AsyncStorage.getItem('theme');
        if (!active) return;
        setTheme(saved === 'light' || saved === 'dark' ? saved : systemTheme);
      } catch {
        if (active) setTheme(systemTheme);
      }
    };

    void loadTheme();
    return () => {
      active = false;
    };
  }, [systemTheme]);

  const toggleTheme = async () => {
    const nextTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(nextTheme);
    try {
      await AsyncStorage.setItem('theme', nextTheme);
    } catch (error) {
      console.warn('Theme preference could not be saved', error);
    }
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);
