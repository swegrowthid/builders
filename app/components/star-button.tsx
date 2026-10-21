"use client";

import { createContext, useContext, useEffect, useState, useSyncExternalStore, useTransition, type ReactNode } from "react";
import { setStar, starredAmong } from "../star-actions";
import { useLanguage } from "./language-provider";

/**
 * GitHub's Star button, working from here.
 *
 * The directory page is shared by everybody, so which repositories *this*
 * visitor has starred is asked after it loads — once for the whole table, and
 * only when the `gh-connected` cookie says there is a GitHub token to ask with.
 * Somebody without one is sent through the GitHub sign-in, and comes back to
 * the same page to press it again.
 */

type Stars = {
  /** Starred before this page did anything — the counts already include these. */
  initial: ReadonlySet<string>;
  current: ReadonlySet<string>;
  connected: boolean;
  set: (repo: string, starred: boolean) => void;
};

const StarsContext = createContext<Stars | null>(null);

const noSubscription = () => () => {};
/** Read after hydration only: the server never knows, so it renders "not connected". */
const hasGitHub = () => /(?:^|;\s*)gh-connected=1/.test(document.cookie);

export function StarsProvider({ repos, children }: { repos: string[]; children: ReactNode }) {
  const connected = useSyncExternalStore(noSubscription, hasGitHub, () => false);
  const [initial, setInitial] = useState<ReadonlySet<string>>(new Set());
  const [current, setCurrent] = useState<ReadonlySet<string>>(new Set());
  const key = repos.join(",");

  useEffect(() => {
    if (!connected || !key) return;
    let live = true;
    starredAmong(key.split(",")).then((found) => {
      if (!live) return;
      setInitial(new Set(found));
      setCurrent(new Set(found));
    });
    return () => {
      live = false;
    };
  }, [connected, key]);

  const set = (repo: string, starred: boolean) =>
    setCurrent((before) => {
      const next = new Set(before);
      if (starred) next.add(repo);
      else next.delete(repo);
      return next;
    });

  return <StarsContext.Provider value={{ initial, current, connected, set }}>{children}</StarsContext.Provider>;
}

/** The star count on the card's meta line, moved by this visitor's own star. */
export function StarCount({ repo, stars }: { repo: string; stars: number }) {
  const { tx, locale } = useLanguage();
  const context = useContext(StarsContext);
  const shift = Number(context?.current.has(repo) ?? false) - Number(context?.initial.has(repo) ?? false);
  const count = Math.max(0, stars + shift);
  // "0 stars" says nothing worth the space; the first star brings it back.
  if (count === 0) return null;
  return (
    <span className="dx-meta-stars" title={tx(`${count} bintang di GitHub`, `${count} stars on GitHub`)}>
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="m12 3.5 2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.3-4.1 5.9-.9L12 3.5Z" />
      </svg>
      {new Intl.NumberFormat(locale === "id" ? "id-ID" : "en-US", { notation: "compact", maximumFractionDigits: 1 }).format(count)}
      <span className="sr-only">{tx(" bintang", " stars")}</span>
    </span>
  );
}

export function StarButton({ repo }: { repo: string }) {
  const { tx } = useLanguage();
  const context = useContext(StarsContext);
  const [pending, startTransition] = useTransition();
  const [failed, setFailed] = useState(false);
  const starred = context?.current.has(repo) ?? false;

  const connect = () => {
    // A full navigation, not the router: /auth/github is a route handler that
    // answers with a redirect off to GitHub.
    const start = new URL("/auth/github", window.location.origin);
    start.searchParams.set("next", `${window.location.pathname}${window.location.search}`);
    window.location.assign(start);
  };

  const press = () => {
    if (!context?.connected) return connect();
    const want = !starred;
    setFailed(false);
    context.set(repo, want);
    startTransition(async () => {
      const result = await setStar(repo, want);
      if (result.ok) return;
      context.set(repo, !want);
      if (result.reason === "connect") connect();
      else setFailed(true);
    });
  };

  // GitHub's own words: the button should read like the one people know.
  // A refusal says so on the button itself — a red edge alone went unseen.
  const label = failed ? tx("Gagal", "Failed") : starred ? "Starred" : "Star";
  const title = failed
    ? tx("GitHub menolak. Coba lagi sebentar.", "GitHub refused. Try again in a moment.")
    : context?.connected
      ? starred
        ? tx(`Hapus bintang dari ${repo}`, `Unstar ${repo}`)
        : tx(`Beri bintang ${repo} di GitHub`, `Star ${repo} on GitHub`)
      : tx("Masuk dengan GitHub untuk memberi bintang", "Sign in with GitHub to star");

  return (
    <button
      type="button"
      className={`dx-star ${starred ? "is-starred" : ""} ${failed ? "is-failed" : ""}`}
      aria-pressed={starred}
      aria-busy={pending || undefined}
      title={title}
      onClick={press}
    >
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="m12 3.5 2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.3-4.1 5.9-.9L12 3.5Z" />
      </svg>
      <span className="dx-star-label" aria-live="polite">{label}</span>
    </button>
  );
}
