import Image from "next/image";
import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "@/app/components/responsive-link";
import { contribReadyUrl, shareCard, waCommunityUrl } from "../content";
import { SiteFooter, SiteHeader } from "../components/shell";
import { Skeleton } from "../components/skeleton";
import { DirectoryView } from "../components/directory-view";
import { ActivityBanner } from "../components/activity-banner";
import { listAdminPicks, listOssMembers, listProjects, listRepoSignals } from "../lib/data";
import { readPublicly } from "../lib/public-read";
import { projectBlurb } from "../lib/brief";
import { productEntries, repoEntry, type DirectoryEntry } from "../lib/directory";
import { pathFor, readFilters } from "../lib/directory-url";
import { listOpenSourceRepos, signalsFor } from "../lib/open-source-live";
import { parseGitHubRepositoryUrl } from "../lib/github";
import { roleLabel } from "../lib/roles";
import { currentLocale } from "../lib/locale-server";
import { currentViewer } from "../lib/session";
import { tx, type Locale } from "../lib/locale";
import { isOss, site } from "../lib/site";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await currentLocale();
  const title = isOss
    ? tx(locale, `Direktori — ${site.name}`, `Directory — ${site.name}`)
    : tx(locale, "Direktori produk — Builders", "Product directory — Builders");
  const description = isOss
    ? tx(
        locale,
        "Repo open source rekomendasi dan kurasi komunitas swegrowth, yang bagus buat mulai kontribusi. Pilih satu, kirim PR, biar kelihatan.",
        "Open source repos recommended and curated by the swegrowth community, good places to start contributing. Pick one, send a PR, let it be seen.",
      )
    : tx(
        locale,
        "Produk buatan member komunitas swegrowth, dari ide sampai rilis. Ikuti progresnya, bantu lewat peranmu, atau daftarkan produkmu.",
        "Products built by swegrowth community members, from idea to launch. Follow their progress, help in your role, or list your own.",
      );
  return { title, description, alternates: { canonical: "/directory" }, openGraph: shareCard({ title, description, url: "/directory" }) };
}

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

/**
 * The directory, read like an index rather than a landing page.
 *
 * A sidebar of facets with their counts on the left — how you contribute,
 * where the project comes from, and its language or the role it wants — and a
 * dense table on the right: one row per project, the same columns down the
 * page, the button that starts the work always at the end of the row.
 */
export default async function Directory({ searchParams }: { searchParams?: SearchParams }) {
  const query = searchParams ?? Promise.resolve({});
  const locale = await currentLocale();

  return (
    <>
      <SiteHeader returnTo={query.then((value) => pathFor(readFilters(value)))} active="directory" />

      <main id="main-content" className="dx-page">
        <Suspense fallback={null}>
          <ActivityBanner locale={locale} />
        </Suspense>

        <header className="dx-head">
          <div>
            <h1>{isOss ? tx(locale, "Direktori", "Directory") : tx(locale, "Direktori produk", "Product directory")}</h1>
            <p className="dx-head-community">
              {/* What the place is for, in one line, for somebody who has just landed. */}
              {isOss
                ? tx(
                    locale,
                    "Repo open source rekomendasi dan kurasi komunitas, yang bagus buat mulai kontribusi. Mau lihat lebih banyak repo global? Cek ",
                    "Open source repos recommended and curated by the community, good places to start contributing. Want more global repos? See ",
                  )
                : null}
              {isOss ? (
                <a href={contribReadyUrl} target="_blank" rel="noopener noreferrer">
                  ContribReady <span aria-hidden="true">↗</span>
                </a>
              ) : (
                tx(
                    locale,
                    "Produk buatan member komunitas swegrowth, dari ide sampai rilis. Ikuti progresnya, bantu lewat peranmu, atau daftarkan produkmu.",
                    "Products built by swegrowth community members, from idea to launch. Follow their progress, help in your role, or list your own.",
                  )
              )}
            </p>
            <div className="dx-head-actions">
              <Suspense fallback={<WaButton />}>
                <JoinCta locale={locale} />
              </Suspense>
              <p className="dx-head-powered">
                Powered by
                <a href="https://swegrowth.id/" target="_blank" rel="noopener noreferrer">
                  <Image src="/swegrowth-logo.png" alt="Software Engineer Growth Community" width={25} height={24} />
                </a>
              </p>
            </div>
          </div>
          <Suspense fallback={null}>
            <HeadStats locale={locale} />
          </Suspense>
        </header>

        <Suspense fallback={<DirectorySkeleton />}>
          <DirectoryBody query={query} locale={locale} />
        </Suspense>
      </main>

      <SiteFooter />
    </>
  );
}

/**
 * Everything listed, both tracks. Every read underneath is cached, so the
 * heading's numbers and the list share one trip to the database.
 */
async function readDirectory(locale: Locale) {
  // GitHub's facts come from the database, read once and shared by catalogue
  // repos and products; nothing on this page calls GitHub.
  // Only the catalogue waits for the signals; the products and the members'
  // records start at the same time, rather than queueing behind them.
  const signalsRead = readPublicly("repository signals in the directory", () => listRepoSignals(), {});
  const [reposResult, projectsResult, membersResult, signalsResult, picksResult] = await Promise.all([
    signalsRead.then(({ value }) =>
      readPublicly("open source repos in the directory", () => listOpenSourceRepos(value), []),
    ),
    readPublicly("products in the directory", () => listProjects({ lane: "active" }), []),
    readPublicly("members' open source records in the directory", () => listOssMembers(), []),
    signalsRead,
    readPublicly("admin picks in the directory", () => listAdminPicks(), { repoIds: [], projectIds: [] }),
  ]);
  const pickedRepos = new Set(picksResult.value.repoIds);
  const pickedProjects = new Set(picksResult.value.projectIds);
  const signals = signalsResult.value;

  const repos = reposResult.value.map((repo) => ({ ...repo, adminPick: pickedRepos.has(repo.id) }));
  const members = membersResult.value;
  const products = projectsResult.value.map((project) => {
    const repository = parseGitHubRepositoryUrl(project.repoUrl);
    const found = repository ? signalsFor(signals, repository.owner, repository.repo) : null;
    return {
      ...project,
      repoStats: found?.stats ?? null,
      repoActivity: found?.activity ?? null,
      adminPick: pickedProjects.has(project.id),
    };
  });
  const roleName = (role: string) => roleLabel(role, "", locale);
  const entries: DirectoryEntry[] = isOss
    ? [
        ...repos.filter((repo) => repo.list === "internal").map((repo) => repoEntry(repo, locale, members)),
        ...repos.filter((repo) => repo.list === "recommended").map((repo) => repoEntry(repo, locale, members)),
        // The open source site keeps members' products that take PRs — their
        // card is the repository — and leaves the role path to the builders site.
        ...products.flatMap((project) => productEntries(project, projectBlurb, roleName, locale)),
      ].filter((entry) => entry.track === "github")
    : // The builders site is a directory of products, every active one, with
      // nothing of GitHub's: no repos, and no repository link on a card.
      products
        .flatMap((project) => productEntries(project, projectBlurb, roleName, locale, { everyProduct: true }))
        .filter((entry) => entry.track === "role")
        .map((entry) => ({ ...entry, links: entry.links.filter((link) => link.kind !== "github") }));
  return { entries, members, unavailable: reposResult.unavailable || projectsResult.unavailable };
}

/**
 * The heading's call to action: a guest is asked to join, with the WA group
 * beside it as a plain link; a member is pointed at the community's chat.
 * Showing GitHub activity is asked for by `ActivityBanner` instead, which a
 * member can close.
 */
async function JoinCta({ locale }: { locale: Locale }) {
  const viewer = await currentViewer();
  if (viewer) return <WaButton />;

  return (
    <>
      <Link className="primary-action" href="/signin">
        {tx(locale, `Gabung ke ${site.name}`, `Join ${site.name}`)}
      </Link>
      {waCommunityUrl ? (
        <a className="dx-wa-link" href={waCommunityUrl} target="_blank" rel="noopener noreferrer">
          {tx(locale, "atau gabung WA Community", "or join the WA Community")}
        </a>
      ) : null}
    </>
  );
}

function WaButton() {
  if (!waCommunityUrl) return null;
  return (
    <a className="dx-wa-cta" href={waCommunityUrl} target="_blank" rel="noopener noreferrer">
      <svg className="dx-wa-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" /></svg>
      Join WA Community
    </a>
  );
}

/** The directory in three numbers, beside the heading on a wide screen. */
async function HeadStats({ locale }: { locale: Locale }) {
  const { entries, members } = await readDirectory(locale);
  const stats = [
    ...(isOss
      ? [{ value: entries.length, label: tx(locale, "Repo", "Repos") }]
      : [
          { value: entries.length, label: tx(locale, "Produk", "Products") },
          { value: entries.filter((entry) => entry.hasOpenRoles).length, label: tx(locale, "Cari bantuan", "Looking for help") },
        ]),
    { value: members.length, label: tx(locale, "Terdaftar", "Registered") },
  ];
  return (
    <dl className="dx-head-stats">
      {stats.map((stat) => (
        <div key={stat.label}>
          <dt>{stat.label}</dt>
          <dd>{stat.value}</dd>
        </div>
      ))}
    </dl>
  );
}

async function DirectoryBody({ query, locale }: { query: SearchParams; locale: Locale }) {
  // Waiting for the request keeps the list in the server's first answer,
  // filtered as the address asks; from then on it filters in the browser.
  await query;
  const { entries, unavailable } = await readDirectory(locale);
  return <DirectoryView entries={entries} locale={locale} unavailable={unavailable} />;
}

function DirectorySkeleton() {
  return (
    <div className="dx-layout" aria-busy="true">
      <div className="dx-side">
        <Skeleton height={220} style={{ borderRadius: 8 }} />
      </div>
      <div className="dx-results">
        <Skeleton height={40} style={{ borderRadius: 8, marginBottom: 14 }} />
        {[0, 1, 2, 3, 4, 5].map((slot) => <Skeleton key={slot} height={78} style={{ borderRadius: 0, marginBottom: 1 }} />)}
      </div>
    </div>
  );
}
