import type { Metadata } from "next";
import { Suspense } from "react";
import Form from "next/form";
import Link from "@/app/components/responsive-link";
import { shareCard } from "../content";
import { SiteFooter, SiteHeader } from "../components/shell";
import { Skeleton } from "../components/skeleton";
import { listProjects } from "../lib/data";
import { readPublicly } from "../lib/public-read";
import { projectBlurb } from "../lib/brief";
import {
  DIRECTORY_TRACKS,
  directoryFacets,
  filterDirectory,
  isDirectoryTrack,
  productEntries,
  repoEntry,
  sourceLabel,
  type DirectoryEntry,
  type DirectoryFilters,
  type DirectoryTrack,
} from "../lib/directory";
import { listOpenSourceRepos } from "../lib/open-source-live";
import { roleLabel } from "../lib/roles";
import { currentLocale } from "../lib/locale-server";
import { tx, type Locale } from "../lib/locale";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await currentLocale();
  const title = tx(locale, "Builders — Direktori Project untuk Dikontribusikan", "Builders — A Directory of Projects to Contribute To");
  const description = tx(
    locale,
    "Kirim kode ke project open source di GitHub, atau bantu produk builders lewat peran lain. Pilih caramu, pilih project-nya, mulai.",
    "Send code to open source projects on GitHub, or help builders' products in another role. Pick your way, pick a project, start.",
  );
  return { title, description, alternates: { canonical: "/" }, openGraph: shareCard({ title, description, url: "/" }) };
}

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

/**
 * What the URL asks for. Software engineers are who the site is for first,
 * so with no choice made the GitHub path is the one showing.
 */
function readFilters(query: Record<string, string | string[] | undefined>): DirectoryFilters {
  const track = one(query.track);
  return {
    track: isDirectoryTrack(track) ? track : "github",
    facet: one(query.facet).slice(0, 60),
    q: one(query.q).slice(0, 100),
  };
}

function pathFor(filters: DirectoryFilters): string {
  const params = new URLSearchParams();
  if (filters.track !== "github") params.set("track", filters.track);
  if (filters.facet) params.set("facet", filters.facet);
  if (filters.q) params.set("q", filters.q);
  const search = params.toString();
  return `/${search ? `?${search}` : ""}`;
}

const PATHS: Record<DirectoryTrack, { titleId: string; titleEn: string; bodyId: string; bodyEn: string }> = {
  github: {
    titleId: "Kirim kode",
    titleEn: "Send code",
    bodyId: "Pull request ke project open source di GitHub",
    bodyEn: "Pull requests to open source projects on GitHub",
  },
  role: {
    titleId: "Bantu lewat peran",
    titleEn: "Help in a role",
    bodyId: "Desain, produk, riset, konten di produk builders",
    bodyEn: "Design, product, research, content on builders' products",
  },
};

/**
 * The directory, laid out in the order somebody uses it:
 *
 *   1. how do I want to contribute? — two choices, side by side, at the top;
 *   2. narrow it down — a search box and one row of chips for that choice
 *      (languages for code, roles for everything else);
 *   3. pick one — a compact grid, so a screen holds most of the list;
 *   4. start — every card ends in the one button that begins the work.
 *
 * Only the chosen path is shown, so nobody scrolls past one list to find the
 * other. The heading prerenders; everything that reads the URL streams in.
 */
export default async function Directory({ searchParams }: { searchParams?: SearchParams }) {
  const query = searchParams ?? Promise.resolve({});
  const locale = await currentLocale();

  return (
    <>
      <SiteHeader returnTo={query.then((value) => pathFor(readFilters(value)))} active="home" />

      <main id="main-content" className="dir-page">
        <header className="dir-head">
          <h1>{tx(locale, "Mau kontribusi lewat apa?", "How do you want to contribute?")}</h1>
          <p>{tx(locale, "Pilih caramu, pilih project-nya, lalu mulai.", "Pick your way, pick a project, then start.")}</p>
        </header>

        <Suspense fallback={<DirectorySkeleton />}>
          <DirectoryBody query={query} locale={locale} />
        </Suspense>
      </main>

      <SiteFooter />
    </>
  );
}

async function DirectoryBody({ query, locale }: { query: SearchParams; locale: Locale }) {
  const filters = readFilters(await query);
  const [reposResult, projectsResult] = await Promise.all([
    readPublicly("open source repos in the directory", () => listOpenSourceRepos(), []),
    readPublicly("products in the directory", () => listProjects({ lane: "active" }), []),
  ]);

  const repos = reposResult.value;
  const entries: DirectoryEntry[] = [
    ...repos.filter((repo) => repo.list === "internal").map((repo) => repoEntry(repo, locale)),
    ...repos.filter((repo) => repo.list === "recommended").map((repo) => repoEntry(repo, locale)),
    ...projectsResult.value.flatMap((project) =>
      productEntries(project, projectBlurb, (role) => roleLabel(role, "", locale), locale),
    ),
  ];
  const matched = filterDirectory(entries, filters);
  const facets = directoryFacets(entries, filters.track);
  const count = (track: DirectoryTrack) => entries.filter((entry) => entry.track === track).length;

  return (
    <>
      <nav className="dir-paths" aria-label={tx(locale, "Cara berkontribusi", "How to contribute")}>
        {DIRECTORY_TRACKS.map((track) => {
          const active = filters.track === track;
          return (
            <Link
              key={track}
              className={`dir-path dir-path-${track} ${active ? "is-active" : ""}`}
              aria-current={active ? "page" : undefined}
              href={pathFor({ track, facet: "", q: filters.q })}
            >
              <TrackIcon track={track} />
              <span className="dir-path-copy">
                <strong>{tx(locale, PATHS[track].titleId, PATHS[track].titleEn)}</strong>
                <small>{tx(locale, PATHS[track].bodyId, PATHS[track].bodyEn)}</small>
              </span>
              <span className="dir-path-count">{count(track)}</span>
            </Link>
          );
        })}
      </nav>

      <div className="dir-toolbar">
        <Form className="dir-search" action="/" role="search">
          {filters.track !== "github" ? <input type="hidden" name="track" value={filters.track} /> : null}
          {filters.facet ? <input type="hidden" name="facet" value={filters.facet} /> : null}
          <label>
            <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
            <span className="sr-only">{tx(locale, "Cari project", "Search projects")}</span>
            <input type="search" name="q" defaultValue={filters.q} placeholder={tx(locale, "Cari project…", "Search projects…")} />
          </label>
        </Form>

        {facets.length > 0 ? (
          <div className="dir-chips" aria-label={filters.track === "github" ? tx(locale, "Bahasa", "Language") : tx(locale, "Peran", "Role")}>
            <Link className={`dir-chip ${filters.facet === "" ? "is-active" : ""}`} href={pathFor({ ...filters, facet: "" })}>
              {filters.track === "github" ? tx(locale, "Semua bahasa", "Any language") : tx(locale, "Semua peran", "Any role")}
            </Link>
            {facets.map(({ value }) => (
              <Link
                key={value}
                className={`dir-chip ${filters.facet === value ? "is-active" : ""}`}
                aria-current={filters.facet === value ? "true" : undefined}
                href={pathFor({ ...filters, facet: filters.facet === value ? "" : value })}
              >
                {value}
              </Link>
            ))}
          </div>
        ) : null}
      </div>

      {reposResult.unavailable || projectsResult.unavailable ? (
        <p className="public-data-notice" role="status">
          {tx(locale, "Sebagian daftar tidak dapat dimuat.", "Part of the list could not be loaded.")} <Link href={pathFor(filters)}>{tx(locale, "Muat ulang", "Reload")}</Link>.
        </p>
      ) : null}

      {matched.length > 0 ? (
        <ul className="dir-grid">
          {matched.map((entry) => <DirectoryCard key={entry.key} entry={entry} locale={locale} />)}
        </ul>
      ) : (
        <div className="dir-empty">
          <p>{tx(locale, "Tidak ada project yang cocok.", "No project matches.")}</p>
          <Link href={pathFor({ track: filters.track, facet: "", q: "" })}>{tx(locale, "Hapus filter", "Clear filters")}</Link>
        </div>
      )}

      <p className="dir-suggest">
        {tx(locale, "Punya project yang butuh kontributor?", "Have a project that needs contributors?")}{" "}
        <Link href="/new">{tx(locale, "Daftarkan di sini", "List it here")}</Link>
      </p>
    </>
  );
}

function TrackIcon({ track }: { track: DirectoryTrack }) {
  return track === "github" ? (
    <svg className="dir-track-icon" viewBox="0 0 24 24" aria-hidden="true">
      <path fill="currentColor" stroke="none" d="M12 2a10 10 0 0 0-3.16 19.49c.5.09.68-.22.68-.48v-1.7c-2.78.6-3.37-1.34-3.37-1.34-.45-1.16-1.11-1.47-1.11-1.47-.91-.62.07-.6.07-.6 1 .07 1.53 1.03 1.53 1.03.9 1.52 2.34 1.08 2.91.83.09-.65.35-1.08.63-1.33-2.22-.25-4.55-1.11-4.55-4.94 0-1.09.39-1.98 1.03-2.68-.1-.25-.45-1.27.1-2.65 0 0 .84-.27 2.75 1.02a9.58 9.58 0 0 1 5 0c1.91-1.3 2.75-1.02 2.75-1.02.55 1.38.2 2.4.1 2.65.64.7 1.03 1.59 1.03 2.68 0 3.84-2.34 4.68-4.57 4.93.36.31.68.92.68 1.85v2.75c0 .27.18.58.69.48A10 10 0 0 0 12 2Z" />
    </svg>
  ) : (
    <svg className="dir-track-icon" viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="8" r="3.5" /><path d="M5 20a7 7 0 0 1 14 0" />
    </svg>
  );
}

function DirectoryCard({ entry, locale }: { entry: DirectoryEntry; locale: Locale }) {
  const external = { target: "_blank", rel: "noopener noreferrer" };
  const nameLeaves = entry.href.startsWith("http");

  return (
    <li className={`dir-card dir-card-${entry.track} dir-card-${entry.source}`}>
      <div className="dir-card-head">
        <span className="dir-mark" aria-hidden="true">{entry.name.slice(0, 1).toUpperCase()}</span>
        <div className="dir-card-title">
          <h2>
            {nameLeaves ? (
              <a href={entry.href} {...external}>{entry.name}</a>
            ) : (
              <Link href={entry.href}>{entry.name}</Link>
            )}
          </h2>
          <small>
            {entry.source === "product" ? tx(locale, `oleh ${entry.owner}`, `by ${entry.owner}`) : entry.owner}
          </small>
        </div>
      </div>

      <p className="dir-card-desc">{entry.description}</p>

      <ul className="dir-card-meta">
        <li className="dir-source">{sourceLabel(entry.source, locale)}</li>
        {entry.language ? <li>{entry.language}</li> : null}
        {entry.stars !== null ? <li>★ {compactNumber(entry.stars, locale)}</li> : null}
        {entry.track === "role"
          ? entry.labels.slice(0, 3).map((label) => <li key={label} className="dir-role">{label}</li>)
          : entry.labels.slice(0, 1).map((label) => <li key={label} className="dir-reason">{label}</li>)}
        {entry.track === "role" && entry.labels.length > 3 ? <li>+{entry.labels.length - 3}</li> : null}
      </ul>

      {entry.external ? (
        <a className="dir-action" href={entry.actionHref} {...external}>
          {entry.actionLabel} <span aria-hidden="true">↗</span>
        </a>
      ) : (
        <Link className="dir-action" href={entry.actionHref}>
          {entry.actionLabel} <span aria-hidden="true">→</span>
        </Link>
      )}
    </li>
  );
}

function DirectorySkeleton() {
  return (
    <div aria-busy="true">
      <div className="dir-paths">
        <Skeleton height={74} style={{ borderRadius: 16 }} />
        <Skeleton height={74} style={{ borderRadius: 16 }} />
      </div>
      <Skeleton height={48} style={{ borderRadius: 12, margin: "16px 0 24px" }} />
      <div className="dir-grid">
        {[0, 1, 2, 3, 4, 5].map((slot) => <Skeleton key={slot} height={190} style={{ borderRadius: 16 }} />)}
      </div>
    </div>
  );
}

function compactNumber(value: number, locale: Locale): string {
  return new Intl.NumberFormat(locale === "id" ? "id-ID" : "en-US", { notation: "compact", maximumFractionDigits: 1 }).format(value);
}

function one(value: string | string[] | undefined): string {
  return (Array.isArray(value) ? value[0] : value) ?? "";
}
