import { useEffect, useState, type AnchorHTMLAttributes, type MouseEvent, type ReactNode } from 'react';

function parse(hash: string): string[] {
  const clean = hash.replace(/^#\/?/, '').split('?')[0];
  return clean ? clean.split('/').map(decodeURIComponent) : [];
}

let current: string[] = (() => {
  try {
    return parse(window.location.hash);
  } catch {
    return [];
  }
})();
const listeners = new Set<() => void>();

export function navigate(path: string, opts: { scroll?: boolean } = {}) {
  const target = '/' + path.replace(/^#?\/?/, '');
  current = parse(target);
  try {
    if (window.location.hash !== '#' + target) window.history.pushState(null, '', '#' + target);
  } catch {
    /* history unavailable: state still updates in memory */
  }
  listeners.forEach((l) => l());
  if (opts.scroll !== false) window.scrollTo({ top: 0 });
}

if (typeof window !== 'undefined') {
  window.addEventListener('hashchange', () => {
    current = parse(window.location.hash);
    listeners.forEach((l) => l());
  });
  window.addEventListener('popstate', () => {
    current = parse(window.location.hash);
    listeners.forEach((l) => l());
  });
}

export function useRoute(): string[] {
  const [, set] = useState(0);
  useEffect(() => {
    const l = () => set((n) => n + 1);
    listeners.add(l);
    return () => void listeners.delete(l);
  }, []);
  return current;
}

interface LinkProps extends Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> {
  to: string;
  children: ReactNode;
}

export function Link({ to, children, onClick, ...rest }: LinkProps) {
  const href = '#/' + to.replace(/^#?\/?/, '');
  return (
    <a
      {...rest}
      href={href}
      onClick={(e: MouseEvent<HTMLAnchorElement>) => {
        onClick?.(e);
        if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
        e.preventDefault();
        navigate(to);
      }}
    >
      {children}
    </a>
  );
}
