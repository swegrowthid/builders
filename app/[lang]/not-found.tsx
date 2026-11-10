import Link from "@/app/components/responsive-link";
import { SiteFooter, SiteHeader, Arrow } from "../components/shell";
import { currentLocale } from "../lib/locale-server";
import { tx } from "../lib/locale";

export default async function NotFound() {
  const locale = await currentLocale();
  return (
    <>
      <SiteHeader />
      <main id="main-content" className="notfound">
        <h1>{tx(locale, "Halaman tidak ditemukan.", "Page not found.")}</h1>
        <p className="muted">{tx(locale, "Halaman ini mungkin telah dipindahkan atau tautannya salah.", "This page may have moved, or the link may be incorrect.")}</p>
        <p style={{ marginTop: 24 }}>
          <Link className="primary-button" href="/">
            {tx(locale, "Kembali ke papan proyek", "Back to the board")} <Arrow />
          </Link>
        </p>
      </main>
      <SiteFooter />
    </>
  );
}
