"use client";

import { unstable_isUnrecognizedActionError } from "next/navigation";
import { useEffect } from "react";
import { useLanguage } from "../components/language-provider";

const ACTION_RELOAD_KEY = "ahsan:last-server-action-reload";
const ACTION_RELOAD_COOLDOWN_MS = 30_000;

/**
 * What people see when a page cannot load — most often because the database is
 * unreachable. It deliberately does not fall back to the bundled seed: showing
 * yesterday's board as though it were today's would be worse than saying so.
 */
export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const hasOutdatedAction = unstable_isUnrecognizedActionError(error);
  const { tx } = useLanguage();

  useEffect(() => {
    console.error(error);

    // A tab left open across a deployment still carries the previous build's
    // Server Action IDs. The rejected request never reached the action, so one
    // full reload is safe and gives the tab the current action manifest.
    if (!hasOutdatedAction) return;

    const lastReload = Number(sessionStorage.getItem(ACTION_RELOAD_KEY));
    if (Number.isFinite(lastReload) && Date.now() - lastReload < ACTION_RELOAD_COOLDOWN_MS) return;

    sessionStorage.setItem(ACTION_RELOAD_KEY, String(Date.now()));
    window.location.reload();
  }, [error, hasOutdatedAction]);

  if (hasOutdatedAction) {
    return (
      <main id="main-content" className="notfound">
        <h1>{tx("Situs baru saja diperbarui.", "The site was just updated.")}</h1>
        <p className="muted">
          {tx("Tab ini masih menggunakan versi lama. Muat ulang halaman, lalu kirim kembali proposalmu.", "This tab still has an older version. Reload the page, then send your proposal again.")}
        </p>
        <p style={{ marginTop: 24 }}>
          <button className="primary-button" type="button" onClick={() => window.location.reload()}>
            {tx("Muat ulang halaman", "Reload page")}
          </button>
        </p>
      </main>
    );
  }

  return (
    <main id="main-content" className="notfound">
      <h1>{tx("Terjadi kesalahan.", "Something went wrong.")}</h1>
      <p className="muted">
        {tx("Papan proyek tidak dapat dimuat. Biasanya ini hanya sementara, jadi coba lagi sebentar lagi.", "The board could not load. This is usually temporary, so please try again shortly.")}
      </p>
      <p style={{ marginTop: 24 }}>
        <button className="primary-button" type="button" onClick={reset}>
          {tx("Coba lagi", "Try again")}
        </button>
      </p>
    </main>
  );
}
