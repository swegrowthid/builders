import type { Metadata } from "next";
import Link from "@/app/components/responsive-link";
import { SiteFooter, SiteHeader } from "../../components/shell";
import { FeedbackForm } from "../../components/feedback-form";
import { GitHubMark } from "../../components/github-mark";
import { shareCard, sourceRepo } from "../../content";
import { currentLocale } from "../../lib/locale-server";
import { tx } from "../../lib/locale";
import { site } from "../../lib/site";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await currentLocale();
  const title = tx(locale, `Masukan — ${site.name}`, `Feedback — ${site.name}`);
  const description = tx(
    locale,
    `Ceritakan apa yang error, bikin bingung, atau kamu harap ada di ${site.name}. Masukanmu jadi issue di GitHub.`,
    `Tell us what is broken, what is confusing, or what you wish existed on ${site.name}. Your feedback becomes a GitHub issue.`,
  );
  return {
    title,
    description,
    alternates: { canonical: "/feedback" },
    openGraph: shareCard({ title, description, url: "/feedback" }),
  };
}

/**
 * Where a masukan is written — and then sent from GitHub.
 *
 * The site keeps none of it. The form asks what kind of feedback it is and
 * what happened, then opens a GitHub issue with the matching template filled
 * in; see `app/lib/feedback.ts`. The page never reads who is looking, so it
 * never waits on the auth round trip: the header streams the visitor in
 * behind its own boundary, and the form ships with the rest of the page.
 */
export default async function FeedbackPage() {
  const locale = await currentLocale();

  return (
    <>
      <SiteHeader returnTo="/feedback" active="feedback" />

      <main id="main-content" className="page-narrow feedback-page">
        <h1>{tx(locale, "Ada yang ganjil? Bilang aja.", "Something off? Just say so.")}</h1>
        <p className="lede">
          {tx(
            locale,
            "Situs ini juga sebuah project yang lagi dibangun, dan masukanmu adalah kontribusi—sama seperti kontribusi lain di sini. Nggak perlu rapi—form ini membantu menyusunnya jadi issue di GitHub.",
            "This site is a project being built too, and your feedback is a contribution—the same as any other one here. No need to be polished: this form helps shape it into a GitHub issue.",
          )}
        </p>
        {/* The form is a guide; whoever already knows GitHub's templates can skip it. */}
        <p className="feedback-github">
          {tx(locale, "Sudah biasa pakai GitHub?", "At home on GitHub?")}{" "}
          <a href={`https://github.com/${sourceRepo}/issues/new/choose`} rel="noreferrer noopener" target="_blank">
            <GitHubMark />
            {tx(locale, "Pilih template issue langsung", "Pick an issue template directly")} <span aria-hidden="true">↗</span>
          </a>
        </p>

        <FeedbackForm />

        <aside className="feedback-elsewhere">
          <p>
            {tx(
              locale,
              "Menemukan celah keamanan? Jangan ditulis di sini atau di issue publik—ikuti cara pelaporan di",
              "Found a security hole? Do not write it here or in a public issue — follow the reporting steps in the repository's",
            )}{" "}
            <a
              href={`https://github.com/${sourceRepo}/blob/main/SECURITY.md`}
              rel="noreferrer noopener"
              target="_blank"
            >
              SECURITY.md
            </a>
            {tx(locale, " pada repositori.", ".")}
          </p>
          <p>
            {tx(
              locale,
              "Situs ini tidak menyimpan masukanmu; yang tersimpan hanya issue yang kamu kirim di GitHub, dan itu publik. Selengkapnya di",
              "This site stores none of your feedback; only the issue you submit on GitHub is kept, and it is public. More in the",
            )}{" "}
            <Link href="/privacy">{tx(locale, "Kebijakan Privasi", "Privacy Policy")}</Link>.
          </p>
        </aside>
      </main>

      <SiteFooter />
    </>
  );
}
