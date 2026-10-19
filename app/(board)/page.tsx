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
  filterDirectory,
  isDirectoryTrack,
  productEntries,
  repoEntry,
  sourceLabel,
  trackLabel,
  type DirectoryEntry,
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
    "Cari project open source dan produk builders yang menerima kontribusi, lalu langsung mulai dari isu pemulanya.",
    "Find open source projects and builders' products that welcome contributions, and start straight from their starter issues.",
  );
  return { title, description, alternates: { canonical: "/" }, openGraph: shareCard({ title, description, url: "/" }) };
}

type SearchParams = Promise<Record<string, string | string[] | undefined>>;
type Filters = { track: DirectoryTrack | ""; q: string };

function readFilters(query: Record<string, string | string[] | undefined>): Filters {
  const track = one(query.track);
  return { track: isDirectoryTrack(track) ? track : "", q: one(query.q).slice(0, 100) };
}

function pathFor(filters: Filters): string {
  const params = new URLSearchParams();
  if (filters.track) params.set("track", filters.track);
  if (filters.q) params.set("q", filters.q);
  const search = params.toString();
  return `/${search ? `?${search}` : ""}`;
}

/**
 * The directory. One heading, one search box, one list.
 *
 * The heading prerenders; the list depends on the URL and streams in behind
 * a skeleton.
 */
export default async function Directory({ searchParams }: { searchParams?: SearchParams }) {
  const query = searchParams ?? Promise.resolve({});
  const locale = await currentLocale();

  return (
    <>
      <SiteHeader returnTo={query.then((value) => pathFor(readFilters(value)))} active="home" />

      <main id="main-content" className="dir-page">
        <header className="dir-head">
          <h1>{tx(locale, "Project yang bisa kamu kontribusikan.", "Projects you can contribute to.")}</h1>
          <p>
            {tx(
              locale,
              "Dua jalan untuk berkontribusi: kirim kode lewat pull request di GitHub, atau gabung ke produk builders lewat peran lain — desain, produk, riset, konten.",
              "Two ways to contribute: send code as a pull request on GitHub, or join a builders' product in another role — design, product, research, content.",
            )}
          </p>
        </header>

        <Suspense fallback={<ListSkeleton />}>
          <DirectoryList query={query} locale={locale} />
        </Suspense>
      </main>

      <SiteFooter />
    </>
  );
}

async function DirectoryList({ query, locale }: { query: SearchParams; locale: Locale }) {
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
  const count = (track: DirectoryTrack) => entries.filter((entry) => entry.track === track).length;
  const shown = filters.track ? [filters.track] : DIRECTORY_TRACKS;

  return (
    <>
      <div className="dir-controls">
        <Form className="dir-search" action="/" role="search">
          {filters.track ? <input type="hidden" name="track" value={filters.track} /> : null}
          <label>
            <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
            <span className="sr-only">{tx(locale, "Cari project", "Search projects")}</span>
            <input
              type="search"
              name="q"
              defaultValue={filters.q}
              placeholder={tx(locale, "Cari nama, bahasa, atau peran…", "Search name, language, or role…")}
            />
          </label>
        </Form>

        <nav className="dir-tabs" aria-label={tx(locale, "Cara berkontribusi", "How to contribute")}>
          <TabLink active={filters.track === ""} href={pathFor({ ...filters, track: "" })}>
            {tx(locale, "Semua", "All")} <span>{entries.length}</span>
          </TabLink>
          {DIRECTORY_TRACKS.map((track) => (
            <TabLink key={track} active={filters.track === track} href={pathFor({ ...filters, track })}>
              <TrackIcon track={track} /> {trackLabel(track, locale)} <span>{count(track)}</span>
            </TabLink>
          ))}
        </nav>
      </div>

      {reposResult.unavailable || projectsResult.unavailable ? (
        <p className="public-data-notice" role="status">
          {tx(locale, "Sebagian daftar tidak dapat dimuat.", "Part of the list could not be loaded.")} <Link href={pathFor(filters)}>{tx(locale, "Muat ulang", "Reload")}</Link>.
        </p>
      ) : null}

      {shown.map((track) => {
        const rows = matched.filter((entry) => entry.track === track);
        return (
          <section key={track} className={`dir-section dir-section-${track}`} aria-labelledby={`dir-${track}-title`}>
            <div className="dir-section-head">
              <h2 id={`dir-${track}-title`}><TrackIcon track={track} /> {trackLabel(track, locale)}</h2>
              <p>
                {track === "github"
                  ? tx(locale, "Kontribusi kode lewat pull request. Tombolnya membuka isu di GitHub.", "Code contributions through pull requests. The button opens the issues on GitHub.")
                  : tx(locale, "Gabung ke produk builders lewat peran yang mereka cari — tanpa harus lewat PR.", "Join a builders' product in a role it is looking for — no pull request needed.")}
              </p>
            </div>
            {rows.length > 0 ? (
              <ul className="dir-list">
                {rows.map((entry) => <DirectoryRow key={entry.key} entry={entry} locale={locale} />)}
              </ul>
            ) : (
              <p className="dir-empty">
                {filters.q
                  ? tx(locale, "Tidak ada yang cocok dengan pencarian ini.", "Nothing matches this search.")
                  : tx(locale, "Belum ada.", "Nothing here yet.")}
              </p>
            )}
          </section>
        );
      })}

      <p className="dir-suggest">
        {tx(locale, "Punya project yang butuh kontributor?", "Have a project that needs contributors?")}{" "}
        <Link href="/new">{tx(locale, "Daftarkan di sini", "List it here")}</Link>
        {" · "}
        <a href="https://github.com/zikrulihsan/builders/blob/main/app/lib/open-source.ts" target="_blank" rel="noopener noreferrer">
          {tx(locale, "Usulkan repo open source lewat PR", "Suggest an open source repo in a PR")}
        </a>
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

function TabLink({ active, href, children }: { active: boolean; href: string; children: React.ReactNode }) {
  return (
    <Link className={active ? "is-active" : ""} aria-current={active ? "page" : undefined} href={href}>
      {children}
    </Link>
  );
}

function DirectoryRow({ entry, locale }: { entry: DirectoryEntry; locale: Locale }) {
  const external = (href: string) =>
    href.startsWith("http") ? { target: "_blank", rel: "noopener noreferrer" } : {};

  return (
    <li className={`dir-row dir-row-${entry.track} dir-row-${entry.source}`}>
      <span className="dir-mark" aria-hidden="true">{entry.name.slice(0, 1).toUpperCase()}</span>

      <div className="dir-main">
        <h3>
          {entry.href.startsWith("http") ? (
            <a href={entry.href} {...external(entry.href)}>
              {entry.source !== "product" ? <span className="dir-owner">{entry.owner}/</span> : null}
              {entry.name}
            </a>
          ) : (
            <Link href={entry.href}>{entry.name}</Link>
          )}
        </h3>
        <p>{entry.description}</p>
        <ul className="dir-meta">
          <li className="dir-kind">{sourceLabel(entry.source, locale)}</li>
          {entry.source === "product" ? <li>{tx(locale, `oleh ${entry.owner}`, `by ${entry.owner}`)}</li> : null}
          {entry.language ? <li>{entry.language}</li> : null}
          {entry.stars !== null ? <li>★ {compactNumber(entry.stars, locale)}</li> : null}
          {entry.track === "github"
            ? entry.labels.map((label) => <li key={label} className="dir-label">{label}</li>)
            : null}
        </ul>
        {entry.track === "role" && entry.labels.length > 0 ? (
          <ul className="dir-roles" aria-label={tx(locale, `Peran yang dicari ${entry.name}`, `Roles ${entry.name} is looking for`)}>
            <li className="dir-roles-lead">{tx(locale, "Mencari", "Looking for")}</li>
            {entry.labels.map((label) => <li key={label}>{label}</li>)}
          </ul>
        ) : null}
      </div>

      {entry.external ? (
        <a className="dir-action" href={entry.actionHref} {...external(entry.actionHref)}>
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

function ListSkeleton() {
  return (
    <div className="dir-list" aria-busy="true">
      {[0, 1, 2, 3, 4].map((slot) => <Skeleton key={slot} height={92} style={{ borderRadius: 14, marginBottom: 8 }} />)}
    </div>
  );
}

function compactNumber(value: number, locale: Locale): string {
  return new Intl.NumberFormat(locale === "id" ? "id-ID" : "en-US", { notation: "compact", maximumFractionDigits: 1 }).format(value);
}

function one(value: string | string[] | undefined): string {
  return (Array.isArray(value) ? value[0] : value) ?? "";
}
