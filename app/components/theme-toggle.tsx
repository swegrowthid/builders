"use client";

import { useSyncExternalStore } from "react";
import { useLanguage } from "./language-provider";
import { THEME_COOKIE, type Theme } from "../lib/theme";

const DARK_QUERY = "(prefers-color-scheme: dark)";
const CHANGE_EVENT = "swegrowth:theme-change";

/** What the page is showing now: the visitor's choice, or else the device's. */
function shownTheme(): Theme {
  const chosen = document.documentElement.dataset.theme;
  if (chosen === "light" || chosen === "dark") return chosen;
  return window.matchMedia(DARK_QUERY).matches ? "dark" : "light";
}

/** Re-reads the theme when the device's preference or the visitor's choice changes. */
function subscribe(onChange: () => void): () => void {
  const media = window.matchMedia(DARK_QUERY);
  media.addEventListener("change", onChange);
  window.addEventListener(CHANGE_EVENT, onChange);
  return () => {
    media.removeEventListener("change", onChange);
    window.removeEventListener(CHANGE_EVENT, onChange);
  };
}

/**
 * One button that flips between light and dark.
 *
 * The choice is applied to <html> at once and kept in a cookie, which the
 * root layout's inline script reads before the next page is painted, so it
 * opens in it without a flash. Flipping back to whatever the device prefers
 * clears the cookie instead, so a visitor who never meant to pin a theme goes
 * on following their system.
 *
 * Both icons are always in the markup and CSS shows the right one, because
 * the server cannot know the device's preference.
 */
export function ThemeToggle({ row = false }: { row?: boolean }) {
  const { tx } = useLanguage();
  const dark = useSyncExternalStore(subscribe, () => shownTheme() === "dark", () => false);

  function flip() {
    const next: Theme = shownTheme() === "dark" ? "light" : "dark";
    const device: Theme = window.matchMedia(DARK_QUERY).matches ? "dark" : "light";
    const root = document.documentElement;
    if (next === device) {
      delete root.dataset.theme;
      document.cookie = `${THEME_COOKIE}=; path=/; max-age=0; samesite=lax`;
    } else {
      root.dataset.theme = next;
      document.cookie = `${THEME_COOKIE}=${next}; path=/; max-age=31536000; samesite=lax`;
    }
    window.dispatchEvent(new Event(CHANGE_EVENT));
  }

  // In a menu or the footer: a labelled row with a switch that shows the state.
  if (row) {
    return (
      <button type="button" className="theme-row" onClick={flip} role="switch" aria-checked={dark}>
        <svg className="menu-icon" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5Z" />
        </svg>
        <span>{tx("Mode gelap", "Dark mode")}</span>
        <span className="theme-switch" aria-hidden="true" />
      </button>
    );
  }

  return (
    <button
      type="button"
      className="icon-button theme-toggle"
      onClick={flip}
      aria-pressed={dark}
      aria-label={tx("Mode gelap", "Dark mode")}
      title={dark ? tx("Ganti ke mode terang", "Switch to light mode") : tx("Ganti ke mode gelap", "Switch to dark mode")}
    >
      <svg className="icon theme-icon-moon" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5Z" />
      </svg>
      <svg className="icon theme-icon-sun" viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
      </svg>
    </button>
  );
}
