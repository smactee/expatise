'use client';

import React, {
    createContext,
    useContext,
    useState,
    type ReactNode,
} from 'react';
import {
    applyThemeToDocument,
    getThemeFromDomOrStorage,
    THEME_STORAGE_KEY,
    type Theme,
} from '@/lib/theme/theme';

interface ThemeContextValue {
    theme: Theme;
    toggleTheme: () => void;
    setTheme: (theme: Theme) => void;
}

interface ThemeProviderProps {
    children: ReactNode;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(
    undefined
);

export function ThemeProvider ({ children }: ThemeProviderProps) {
    const [theme, setThemeState] = useState<Theme>(() => getThemeFromDomOrStorage());

    const applyTheme = (next: Theme) => {
        setThemeState(next);
        if (typeof window !== 'undefined') {
            try {
                window.localStorage.setItem(THEME_STORAGE_KEY, next);
            } catch {
                // Ignore storage write failures and still update the document theme.
            }
        }
        applyThemeToDocument(next);
    };

    const setTheme = (next: Theme) => {
        applyTheme(next);
    };

    const toggleTheme = () => {
        setTheme(theme === 'dark' ? 'light' : 'dark');
    };

    const value: ThemeContextValue = {
        theme,
        toggleTheme,
        setTheme,
    };

    return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
    const ctx = useContext(ThemeContext);
    if (!ctx) {
        throw new Error('useTheme must be used within a ThemeProvider');
    }
    return ctx;
}
