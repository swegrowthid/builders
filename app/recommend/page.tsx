import type { Metadata } from "next";
import Link from "@/app/components/responsive-link";
import { deleteRepo } from "../actions";
import { SiteFooter, SiteHeader } from "../components/shell";
import { RepoForm } from "../components/repo-form";
import { SignInInline } from "../components/sign-in-inline";
import { SubmitButton } from "../components/submit-button";
import { listMySubmissions } from "../lib/data";
import { listLabel, reasonLabel, repoSlug, repoUrl, statusLabel, type OpenSourceRepo } from "../lib/open-source";
import { readPublicly } from "../lib/public-read";
import { currentViewer, viewerId } from "../lib/session";
import { currentLocale } from "../lib/locale-server";
import { tx, type Locale } from "../lib/locale";

/*
 * Allowed to block, like the /account pages: what this page shows depends on
 * who is asking — the form, and their own submissions — and there is nothing
 * worth prerendering before that is known.
 */
export const instant = false;

export async function generateMetadata(): Promise<Metadata> {
  const locale = await currentLocale();
  const title = tx(locale, "Usulkan repo — Builders", "Suggest a repo — Builders");
  const description = tx(
    locale,
    "Usulkan repo open source — milikmu atau yang kamu rekomendasikan — untuk masuk direktori kontribusi.",
    "Suggest an open source repo — yours or one you recommend — for the contribution directory.",
  );
  return { title, description, alternates: { canonical: "/recommend" } };
}

/**
 * Where any member puts a repository forward for the directory.
 *
 * The directory lists only what somebody here vouched for, in their own
 * words, and an admin approved. This page is the first half of that: the
 * form, and the member's own submissions with where each one stands.
 */
export default async function RecommendPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  // The submissions only need the id, which is checked locally, so they are
  // read alongside the profile instead of after it.
  const [viewer, locale, query, mine] = await Promise.all([
    currentViewer(),
    currentLocale(),
    searchParams ?? Promise.resolve({}),
    viewerId().then(async (id) => (id ? (await readPublicly("own repo submissions", () => listMySubmissions(id), [])).value : [])),
  ]);
  const sent = (query as Record<string, unknown>).sent === "1";

  return (
    <>
      <SiteHeader returnTo="/recommend" active="recommend" />

      <main id="main-content" className="dx-page ob-page">
        <header className="ob-head">
          <p className="ob-kicker">{tx(locale, "Katalog open source", "Open source catalogue")}</p>
          <h1>{tx(locale, "Usulkan repo", "Suggest a repo")}</h1>
          <p>
            {tx(
              locale,
              "Repo milikmu sendiri, atau repo orang lain yang menurutmu layak jadi tempat PR pertama. Admin akan mereview, lalu repo-nya muncul di direktori beserta alasan yang kamu pilih.",
              "One of your own, or somebody else's you think makes a good first PR. An admin reviews it, then it appears in the directory with the reasons you picked.",
            )}
          </p>
        </header>

        {sent ? (
          <p className="ob-notice" role="status">
            {tx(locale, "Terkirim. Usulanmu muncul di direktori setelah disetujui admin.", "Sent. It appears in the directory once an admin approves it.")}
          </p>
        ) : null}

        <section className="ob-card">
          {viewer ? (
            <RepoForm mode="submit" />
          ) : (
            <SignInInline
              next="/recommend"
              locale={locale}
              message={tx(locale, "Masuk dulu untuk mengusulkan repo — usulan tampil atas namamu.", "Sign in to suggest a repo — suggestions appear under your name.")}
            />
          )}
        </section>

        {mine.length > 0 ? (
          <section className="ob-extra" aria-labelledby="mine-heading">
            <h2 id="mine-heading">{tx(locale, "Usulanmu", "Your suggestions")}</h2>
            <ul className="adm-list">
              {mine.map((repo) => <MySubmission key={repo.id} repo={repo} locale={locale} />)}
            </ul>
          </section>
        ) : null}

        <p className="ob-skip">
          {tx(locale, "Punya produk yang butuh desainer, PM, atau peran lain? ", "Have a product that needs a designer, PM, or another role? ")}
          <Link href="/new">{tx(locale, "Daftarkan produk dan buka peran", "List it and open a role")}</Link>
        </p>
      </main>

      <SiteFooter />
    </>
  );
}

function MySubmission({ repo, locale }: { repo: OpenSourceRepo; locale: Locale }) {
  return (
    <li className="adm-item">
      <div className="adm-item-head">
        <a href={repoUrl(repo)} target="_blank" rel="noopener noreferrer">{repoSlug(repo)}</a>
        <span className={`adm-status adm-status-${repo.status}`}>{statusLabel(repo.status, locale)}</span>
        <span className="adm-list-tag">{listLabel(repo.list, locale)}</span>
        {repo.reasons.map((reason) => <span key={reason} className="adm-list-tag">{reasonLabel(reason, locale)}</span>)}
      </div>
      {repo.why ? <p className="adm-why">{repo.why}</p> : null}
      {repo.status === "pending" ? (
        <form action={deleteRepo} className="adm-actions">
          <input type="hidden" name="id" value={repo.id} />
          <input type="hidden" name="returnTo" value="/recommend" />
          <SubmitButton className="adm-button adm-button-quiet">{tx(locale, "Tarik usulan", "Withdraw")}</SubmitButton>
        </form>
      ) : null}
    </li>
  );
}
