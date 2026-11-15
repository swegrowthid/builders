import type { Metadata } from "next";
import Link from "@/app/components/responsive-link";
import { SiteFooter, SiteHeader } from "../../components/shell";
import { currentLocale } from "../../lib/locale-server";
import { tx } from "../../lib/locale";
import { site } from "../../lib/site";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await currentLocale();
  const title = tx(locale, `Tambah project — ${site.name}`, `Add a project — ${site.name}`);
  const description = tx(
    locale,
    "Usulkan repo open source untuk dikirimi PR, atau daftarkan produk yang butuh bantuan di peran lain.",
    "Suggest an open source repo to send PRs to, or list a product that needs help in another role.",
  );
  return { title, description, alternates: { canonical: "/submit" } };
}

/**
 * The one way in for adding anything to the directory.
 *
 * The site has two kinds of listing and used to have a button for each; now
 * there is one button, and this page asks the only question that decides
 * which form comes next: is it code people send pull requests to, or a
 * product that needs people in other roles? A product with both is listed as
 * a product — its GitHub repository puts it on the code tab as well.
 */
export default async function SubmitPage() {
  const locale = await currentLocale();

  return (
    <>
      <SiteHeader returnTo="/submit" />

      <main id="main-content" className="dx-page ob-page">
        <header className="ob-head">
          <p className="ob-kicker">{tx(locale, "Direktori kontribusi", "Contribution directory")}</p>
          <h1>{tx(locale, "Tambah project", "Add a project")}</h1>
          <p>{tx(locale, "Pilih yang paling cocok. Keduanya bisa milikmu sendiri.", "Pick whichever fits. Either can be your own.")}</p>
        </header>

        <ul className="submit-choices">
          <li className="tone-account">
            <Link href="/recommend">
              <span className="submit-choice-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24">
                  <circle cx="6" cy="6" r="2.5" /><circle cx="6" cy="18" r="2.5" /><circle cx="18" cy="18" r="2.5" />
                  <path d="M6 8.5v7M18 15.5V9a3 3 0 0 0-3-3h-4m2-2.5L10.5 6 13 8.5" />
                </svg>
              </span>
              <span className="submit-choice-copy">
                <strong>{tx(locale, "Repo open source", "An open source repo")}</strong>
                <small>
                  {tx(
                    locale,
                    "Repo GitHub yang bisa dikirimi PR — milikmu, atau milik orang lain yang kamu rekomendasikan. Masuk tab Kode di GitHub.",
                    "A GitHub repo people can send PRs to — yours, or somebody else's you recommend. Goes on the Code on GitHub tab.",
                  )}
                </small>
              </span>
              <span className="submit-choice-arrow" aria-hidden="true">→</span>
            </Link>
          </li>
          <li className="tone-pick">
            <Link href="/new">
              <span className="submit-choice-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="3.5" /><path d="M5 20a7 7 0 0 1 14 0" /></svg>
              </span>
              <span className="submit-choice-copy">
                <strong>{tx(locale, "Produk yang butuh bantuan", "A product that needs a hand")}</strong>
                <small>
                  {tx(
                    locale,
                    "Produkmu, dengan peran yang dibuka — desain, produk, riset, QA, marketing. Kalau ada repo GitHub-nya, ikut muncul di tab Kode juga.",
                    "Your product, with the roles it needs — design, product, research, QA, marketing. With a GitHub repo it shows on the Code tab too.",
                  )}
                </small>
              </span>
              <span className="submit-choice-arrow" aria-hidden="true">→</span>
            </Link>
          </li>
        </ul>
      </main>

      <SiteFooter />
    </>
  );
}
