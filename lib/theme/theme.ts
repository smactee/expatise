export type Theme = "light" | "dark";

export const THEME_STORAGE_KEY = "THEME_STORAGE_KEY";

export function isTheme(value: unknown): value is Theme {
  return value === "light" || value === "dark";
}

export function getSystemTheme(): Theme {
  if (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-color-scheme: dark)").matches
  ) {
    return "dark";
  }

  return "light";
}

export function getThemeFromDomOrStorage(): Theme {
  if (typeof document !== "undefined") {
    const domTheme = document.documentElement.dataset.theme;
    if (isTheme(domTheme)) return domTheme;
  }

  if (typeof window !== "undefined") {
    try {
      const storedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);
      if (isTheme(storedTheme)) return storedTheme;
    } catch {
      // Ignore storage access failures and fall back to system preference.
    }
  }

  return getSystemTheme();
}

export function applyThemeToDocument(theme: Theme) {
  if (typeof document === "undefined") return;

  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme;
}

export function getThemeBootstrapScript() {
  return `(function(){var d=document.documentElement;var key=${JSON.stringify(THEME_STORAGE_KEY)};var theme="light";try{var stored=window.localStorage.getItem(key);if(stored==="light"||stored==="dark"){theme=stored}else if(typeof window.matchMedia==="function"&&window.matchMedia("(prefers-color-scheme: dark)").matches){theme="dark"}}catch(_){if(typeof window.matchMedia==="function"&&window.matchMedia("(prefers-color-scheme: dark)").matches){theme="dark"}}d.dataset.theme=theme;d.style.colorScheme=theme;})();`;
}
