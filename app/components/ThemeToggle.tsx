"use client";

import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";

type Theme = "light" | "dark";

const storageKey = "raiz-theme";

function currentTheme(): Theme {
  if (typeof document === "undefined") return "light";
  return document.documentElement.dataset.theme === "dark" ? "dark" : "light";
}

function applyTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme;
  window.localStorage.setItem(storageKey, theme);
}

export function ThemeToggle({ compact = false }: { compact?: boolean }) {
  const [theme, setTheme] = useState<Theme>("light");

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => setTheme(currentTheme()));
    return () => window.cancelAnimationFrame(frame);
  }, []);

  const isDark = theme === "dark";
  const label = isDark ? "Usar tema claro" : "Usar tema oscuro";

  return (
    <button
      className={`theme-toggle ${compact ? "theme-toggle-compact" : ""}`}
      type="button"
      aria-label={label}
      aria-pressed={isDark}
      title={label}
      onClick={() => {
        const next = isDark ? "light" : "dark";
        applyTheme(next);
        setTheme(next);
      }}
    >
      <Sun size={17} aria-hidden="true" />
      <Moon size={17} aria-hidden="true" />
      {!compact ? <span>{isDark ? "Tema oscuro" : "Tema claro"}</span> : null}
    </button>
  );
}
