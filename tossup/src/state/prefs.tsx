import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

export type ThemePref = 'system' | 'light' | 'dark';

interface Prefs {
  theme: ThemePref;
  setTheme: (t: ThemePref) => void;
  nerd: boolean;
  setNerd: (n: boolean) => void;
}

const Ctx = createContext<Prefs | null>(null);

function read<T>(key: string, fallback: T): T {
  try {
    const v = localStorage.getItem(key);
    return v === null ? fallback : (JSON.parse(v) as T);
  } catch {
    return fallback;
  }
}
function write(key: string, v: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(v));
  } catch {
    /* storage unavailable */
  }
}

export function PrefsProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemePref>(() => read('tossup.theme', 'system'));
  const [nerd, setNerdState] = useState<boolean>(() => read('tossup.nerd', false));

  useEffect(() => {
    const el = document.documentElement;
    if (theme === 'system') el.removeAttribute('data-theme');
    else el.setAttribute('data-theme', theme);
  }, [theme]);

  const setTheme = useCallback((t: ThemePref) => {
    setThemeState(t);
    write('tossup.theme', t);
  }, []);
  const setNerd = useCallback((n: boolean) => {
    setNerdState(n);
    write('tossup.nerd', n);
  }, []);
  const value = useMemo(() => ({ theme, setTheme, nerd, setNerd }), [theme, setTheme, nerd, setNerd]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function usePrefs(): Prefs {
  const v = useContext(Ctx);
  if (!v) throw new Error('usePrefs outside provider');
  return v;
}
