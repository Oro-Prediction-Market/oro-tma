import { createContext, useEffect, ReactNode } from "react";

type Theme = "dark" | "light" | "system";

type ThemeProviderProps = {
  children: ReactNode;
  defaultTheme?: Theme;
  storageKey?: string;
};

type ThemeProviderState = {
  theme: Theme;
  setTheme: (theme: Theme) => void;
};

const initialState: ThemeProviderState = {
  theme: "system",
  setTheme: () => null,
};

export const ThemeContext = createContext<ThemeProviderState>(initialState);

export function ThemeProvider({
  children,
  storageKey: _storageKey = "oro-theme",
  ...props
}: ThemeProviderProps) {
  // App is dark-mode only — always apply "dark" class
  useEffect(() => {
    const root = window.document.documentElement;
    root.classList.remove("light", "system");
    root.classList.add("dark");
  }, []);

  const value = {
    theme: "dark" as Theme,
    setTheme: () => null, // no-op: light mode removed
  };

  return (
    <ThemeContext.Provider {...props} value={value}>
      {children}
    </ThemeContext.Provider>
  );
}
