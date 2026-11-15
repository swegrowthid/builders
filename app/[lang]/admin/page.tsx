import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import Link from "@/app/components/responsive-link";
import { deleteRepo, reviewRepo, setAdminPick } from "../../actions";
import { SiteFooter, SiteHeader } from "../../components/shell";
import { RepoForm } from "../../components/repo-form";
import { SubmitButton } from "../../components/submit-button";
import { isSiteAdmin, listAdminPicks, listCatalogueForAdmin, listProjects, type ProjectSummary } from "../../lib/data";
import { listLabel, reasonLabel, repoSlug, repoUrl, statusLabel, type OpenSourceRepo } from "../../lib/open-source";
import { viewerId } from "../../lib/session";
import { signInPath } from "../../lib/urls";
import { currentLocale } from "../../lib/locale-server";
import { tx, type Locale } from "../../lib/locale";
import { isOss, site } from "../../lib/site";

export const instant = false;

export async function generateMetadata(): Promise<Metadata> {
  const locale = await currentLocale();
  return { title: tx(locale, `Admin — ${site.name}`, `Admin — ${site.name}`), robots: { index: false } };
}

/**
 * Where site admins curate the open source catalogue.
 *
 * Submissions waiting for a decision first — they are the queue — then what
 * the directory lists now, then what was turned down. An admin can also add a
 * repo directly, or edit any row (`?edit=<id>` opens its form at the top).
 *
 * Anybody who is not an admin gets a 404 rather than a refusal: the page is
 * not something to advertise. The policies on `oss_repos` hold either way.
 */
export default async function AdminPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  // All at once rather than one after another: each is its own trip to the
  // database, and the catalogue read is harmless for a non-admin — the
  // policies hand them only what they could see anyway, and they get a 404.
  const [viewer, locale, admin, all, query, picks, products] = await Promise.all([
    viewerId(),
    currentLocale(),
    isSiteAdmin(),
    listCatalogueForAdmin(),
    searchParams ?? Promise.resolve({} as Record<string, string | string[] | undefined>),
    listAdminPicks(),
    listProjects({ lane: "active" }),
  ]);
  if (!viewer) redirect(signInPath("/admin"));
  if (!admin) notFound();

  const editId = Number(typeof query.edit === "string" ? query.edit : NaN);
  const saved = typeof query.saved === "string" ? query.saved : "";
  const pending = all.filter((repo) => repo.status === "pending");
  const approved = all.filter((repo) => repo.status === "approved");
  const rejected = all.filter((repo) => repo.status === "rejected");
  const editing = all.find((repo) => repo.id === editId);
  const pickedRepos = new Set(picks.repoIds);
  const pickedProjects = new Set(picks.projectIds);
  // The products the directory lists.
  const listed = products
    // On the open source site only the ones with a repository; on builders, every product.
    .filter((project) => (isOss ? Boolean(project.repoUrl) : true))
    .toSorted((a, b) => Number(pickedProjects.has(b.id)) - Number(pickedProjects.has(a.id)));

  return (
    <>
      <SiteHeader returnTo="/admin" active="admin" />

      <main id="main-content" className="dx-page adm-page">
        <header className="ob-head adm-head">
          <p className="ob-kicker">Admin</p>
          {/* The repo catalogue is the open source site's; builders curates products. */}
          <h1>{isOss ? tx(locale, "Katalog open source", "Open source catalogue") : tx(locale, "Produk member", "Members' products")}</h1>
          <p>
            {isOss
              ? tx(
                  locale,
                  `${pending.length} menunggu review · ${approved.length} di direktori · ${rejected.length} ditolak`,
                  `${pending.length} awaiting review · ${approved.length} in the directory · ${rejected.length} rejected`,
                )
              : tx(locale, `${listed.length} produk di direktori`, `${listed.length} products in the directory`)}
          </p>
        </header>

        {saved ? (
          <p className="ob-notice" role="status">{tx(locale, `Tersimpan: ${saved}`, `Saved: ${saved}`)}</p>
        ) : null}

        {isOss ? (
          <>
            {editing ? (
              <section className="ob-card adm-edit" aria-labelledby="edit-heading">
                <div className="adm-section-head">
                  <h2 id="edit-heading">{tx(locale, `Edit ${repoSlug(editing)}`, `Edit ${repoSlug(editing)}`)}</h2>
                  <Link href="/admin">{tx(locale, "Batal", "Cancel")}</Link>
                </div>
                <RepoForm
                  key={editing.id}
                  mode="edit"
                  id={editing.id}
                  initial={{
                    repo: repoSlug(editing),
                    list: editing.list,
                    reasons: editing.reasons,
                    why: editing.why,
                    summary: editing.summary,
                    indonesian: editing.indonesian,
                    starterLabel: editing.starterLabel,
                  }}
                />
              </section>
            ) : null}

            <Section title={tx(locale, "Menunggu review", "Awaiting review")} repos={pending} picked={pickedRepos} empty={tx(locale, "Tidak ada usulan baru.", "No new suggestions.")} locale={locale} />
            <Section title={tx(locale, "Di direktori", "In the directory")} repos={approved} picked={pickedRepos} empty={tx(locale, "Belum ada repo yang disetujui.", "No approved repos yet.")} locale={locale} />
            {rejected.length > 0 ? (
              <details className="adm-rejected">
                <summary>{tx(locale, `Ditolak (${rejected.length})`, `Rejected (${rejected.length})`)}</summary>
                <Section title="" repos={rejected} picked={pickedRepos} empty="" locale={locale} />
              </details>
            ) : null}
          </>
        ) : null}

        <section className="adm-section" aria-labelledby="products-heading">
          <div className="adm-section-head">
            <h2 id="products-heading">{tx(locale, "Produk member", "Members' products")} <span>{listed.length}</span></h2>
          </div>
          <p className="adm-note">
            {tx(
              locale,
              "Pilihan admin tampil paling atas di direktori, dengan badge. Yang tidak menerima PR tidak ikut naik di direktori open source.",
              "Admin's picks come first in the directory, with a badge. On the open source directory, one not taking PRs does not rise.",
            )}
          </p>
          {listed.length > 0 ? (
            <ul className="adm-list">
              {listed.map((project) => <ProductItem key={project.id} project={project} picked={pickedProjects.has(project.id)} locale={locale} />)}
            </ul>
          ) : (
            <p className="oss-record-empty">{tx(locale, "Belum ada produk di direktori.", "No products in the directory yet.")}</p>
          )}
        </section>

        {isOss ? (
          <section className="ob-card adm-add" aria-labelledby="add-heading">
            <h2 id="add-heading">{tx(locale, "Tambah repo langsung", "Add a repo directly")}</h2>
            <p className="adm-note">{tx(locale, "Langsung tampil di direktori, tanpa antrean review.", "Shows in the directory straight away, without the review queue.")}</p>
            <RepoForm mode="add" />
          </section>
        ) : null}
      </main>

      <SiteFooter />
    </>
  );
}

function Section({
  title,
  repos,
  picked,
  empty,
  locale,
}: {
  title: string;
  repos: OpenSourceRepo[];
  picked: Set<number>;
  empty: string;
  locale: Locale;
}) {
  return (
    <section className="adm-section">
      {title ? (
        <div className="adm-section-head">
          <h2>{title} <span>{repos.length}</span></h2>
        </div>
      ) : null}
      {repos.length > 0 ? (
        <ul className="adm-list">
          {repos.map((repo) => <AdminItem key={repo.id} repo={repo} picked={picked.has(repo.id)} locale={locale} />)}
        </ul>
      ) : empty ? (
        <p className="oss-record-empty">{empty}</p>
      ) : null}
    </section>
  );
}

/** Pick or unpick, as a one-button form. */
function PickButton({ kind, id, picked, locale }: { kind: "repo" | "project"; id: number; picked: boolean; locale: Locale }) {
  return (
    <form action={setAdminPick}>
      <input type="hidden" name="kind" value={kind} />
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="on" value={picked ? "0" : "1"} />
      <SubmitButton className={`adm-button ${picked ? "" : "adm-button-primary"}`}>
        {picked ? tx(locale, "Batalkan pilihan admin", "Remove admin's pick") : tx(locale, "Jadikan pilihan admin", "Make admin's pick")}
      </SubmitButton>
    </form>
  );
}

function ProductItem({ project, picked, locale }: { project: ProjectSummary; picked: boolean; locale: Locale }) {
  return (
    <li className="adm-item" id={`project-${project.id}`}>
      <div className="adm-item-head">
        <Link href={`/projects/${project.slug}`}>{project.title}</Link>
        {picked ? <span className="adm-list-tag adm-pick-tag">{tx(locale, "Pilihan admin", "Admin's pick")}</span> : null}
        {project.repoUrl ? <span className="adm-list-tag">GitHub</span> : null}
        {project.openSeatCount > 0 ? (
          <span className="adm-list-tag">{tx(locale, `${project.openSeatCount} posisi terbuka`, `${project.openSeatCount} open seats`)}</span>
        ) : null}
      </div>
      <p className="adm-meta">{tx(locale, `oleh ${project.owner.name}`, `by ${project.owner.name}`)}</p>
      <div className="adm-actions">
        <PickButton kind="project" id={project.id} picked={picked} locale={locale} />
      </div>
    </li>
  );
}

function AdminItem({ repo, picked, locale }: { repo: OpenSourceRepo; picked: boolean; locale: Locale }) {
  return (
    <li className="adm-item" id={`repo-${repo.id}`}>
      <div className="adm-item-head">
        <a href={repoUrl(repo)} target="_blank" rel="noopener noreferrer">{repoSlug(repo)}</a>
        <span className={`adm-status adm-status-${repo.status}`}>{statusLabel(repo.status, locale)}</span>
        {picked ? <span className="adm-list-tag adm-pick-tag">{tx(locale, "Pilihan admin", "Admin's pick")}</span> : null}
        <span className="adm-list-tag">{listLabel(repo.list, locale)}</span>
        {repo.indonesian ? <span className="adm-list-tag">{tx(locale, "Maintainer Indonesia", "Indonesian maintainers")}</span> : null}
        {repo.reasons.map((reason) => <span key={reason} className="adm-list-tag">{reasonLabel(reason, locale)}</span>)}
      </div>
      {repo.why ? <p className="adm-why">{repo.why}</p> : null}
      {repo.summary ? <p className="adm-summary">{repo.summary}</p> : null}
      <p className="adm-meta">
        {repo.submittedBy ? (
          <>
            {tx(locale, "Diusulkan oleh ", "Suggested by ")}
            <Link href={`/u/${repo.submittedBy.username}`}>{repo.submittedBy.name}</Link>
          </>
        ) : (
          tx(locale, "Bawaan", "Built in")
        )}
      </p>

      <div className="adm-actions">
        {repo.status === "approved" ? <PickButton kind="repo" id={repo.id} picked={picked} locale={locale} /> : null}
        {repo.status !== "approved" ? (
          <form action={reviewRepo}>
            <input type="hidden" name="id" value={repo.id} />
            <input type="hidden" name="decision" value="approved" />
            <SubmitButton className="adm-button adm-button-primary">{tx(locale, "Setujui", "Approve")}</SubmitButton>
          </form>
        ) : null}
        {repo.status !== "rejected" ? (
          <form action={reviewRepo}>
            <input type="hidden" name="id" value={repo.id} />
            <input type="hidden" name="decision" value="rejected" />
            <SubmitButton className="adm-button">
              {repo.status === "approved" ? tx(locale, "Turunkan", "Unlist") : tx(locale, "Tolak", "Reject")}
            </SubmitButton>
          </form>
        ) : null}
        <Link className="adm-button" href={`/admin?edit=${repo.id}`}>{tx(locale, "Edit", "Edit")}</Link>
        <form action={deleteRepo}>
          <input type="hidden" name="id" value={repo.id} />
          <input type="hidden" name="returnTo" value="/admin" />
          <SubmitButton className="adm-button adm-button-danger">{tx(locale, "Hapus", "Delete")}</SubmitButton>
        </form>
      </div>
    </li>
  );
}
