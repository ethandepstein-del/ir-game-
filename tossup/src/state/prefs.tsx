import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

export type ThemePref = 'system' | 'light' | 'dark';

interface Prefs {
  theme: ThemePref;
  setTheme: (t: ThemePref) => void;
  nerd: boolean;
  setNerd: (n: boolean) => void;
}

const Ctx = createContext<Prefs | null>(null);

/** A theme the embedding page set on <html> before we started, if any. */
const HOST_THEME: string | null = (() => {
  try {
    return document.documentElement.getAttribute('data-theme');
  } catch {
    return null;
  }
})();

/** Whether the page is showing its dark palette right now, whoever chose it. */
export function useIsDark(): boolean {
  const read = () => {
    const attr = document.documentElement.getAttribute('data-theme');
    return attr === 'dark' || (attr !== 'light' && !!window.matchMedia?.('(prefers-color-scheme: dark)').matches);
  };
  const [dark, setDark] = useState(read);
  useEffect(() => {
    const update = () => setDark(read());
    const mo = new MutationObserver(update);
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    const mq = window.matchMedia?.('(prefers-color-scheme: dark)');
    mq?.addEventListener?.('change', update);
    update();
    return () => {
      mo.disconnect();
      mq?.removeEventListener?.('change', update);
    };
  }, []);
  return dark;
}

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
    if (theme !== 'system') {
      el.setAttribute('data-theme', theme);
    } else if (HOST_THEME) {
      // A host page (for example a published artifact) may have chosen a theme for us; go back to it.
      el.setAttribute('data-theme', HOST_THEME);
    } else {
      el.removeAttribute('data-theme');
    }
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
