import { useEffect, useState } from 'react';

const KEY = 'cr_theme';
const OPTIONS = ['dark', 'light', 'auto'];

function read() {
  try {
    const t = localStorage.getItem(KEY);
    return OPTIONS.includes(t) ? t : 'dark';
  } catch {
    return 'dark';
  }
}

/** 'dark' (default) | 'light' | 'auto' (follow system), stored per device. */
export function useTheme() {
  const [theme, setTheme] = useState(read);
  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') delete root.dataset.theme;
    else root.dataset.theme = theme;
    try {
      localStorage.setItem(KEY, theme);
    } catch {
      /* storage unavailable */
    }
  }, [theme]);
  return [theme, setTheme];
}

export const THEME_OPTIONS = [
  { value: 'dark', label: 'Dark' },
  { value: 'light', label: 'Light' },
  { value: 'auto', label: 'Auto' },
];
