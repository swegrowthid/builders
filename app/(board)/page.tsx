import type { Metadata } from "next";
import { Suspense } from "react";
import Form from "next/form";
import Link from "@/app/components/responsive-link";
import { shareCard } from "../content";
import { SiteFooter, SiteHeader } from "../components/shell";
import { Skeleton } from "../components/skeleton";
import { listOssMembers, listProjects } from "../lib/data";
import { readPublicly } from "../lib/public-read";
import { projectBlurb } from "../lib/brief";
import {
  DIRECTORY_SOURCES,
  DIRECTORY_TRACKS,
  badgeCounts,
  directoryFacets,
  filterDirectory,
  isDirectorySource,
  isDirectoryTrack,
  productEntries,
  repoEntry,
  sourceLabel,
  type DirectoryEntry,
  type DirectoryFilters,
  type DirectorySource,
  type DirectoryTrack,
} from "../lib/directory";
import { listOpenSourceRepos } from "../lib/open-source-live";
import { badgeKindLabel, badgeLabel, badgePeople, isBadgeKind, type Badge, type BadgeKind } from "../lib/badges";
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
  const source = one(query.source);
  const badge = one(query.badge);
  return {
    track: isDirectoryTrack(track) ? track : "github",
    source: isDirectorySource(source) ? source : "",
    badge: isBadgeKind(badge) ? badge : "",
    facet: one(query.facet).slice(0, 60),
    q: one(query.q).slice(0, 100),
  };
}

function pathFor(filters: DirectoryFilters): string {
  const params = new URLSearchParams();
  if (filters.track !== "github") params.set("track", filters.track);
  if (filters.source) params.set("source", filters.source);
  if (filters.badge) params.set("badge", filters.badge);
  if (filters.facet) params.set("facet", filters.facet);
  if (filters.q) params.set("q", filters.q);
  const search = params.toString();
  return `/${search ? `?${search}` : ""}`;
}

const TRACK_COPY: Record<DirectoryTrack, { titleId: string; titleEn: string; noteId: string; noteEn: string }> = {
  github: {
    titleId: "Kode di GitHub",
    titleEn: "Code on GitHub",
    noteId: "Kirim pull request",
    noteEn: "Send a pull request",
  },
  role: {
    titleId: "Peran lain",
    titleEn: "Other roles",
    noteId: "Desain, produk, riset, konten",
    noteEn: "Design, product, research, content",
  },
};

/** GitHub's own colours for the languages in the catalogue, so a dot reads at a glance. */
const LANGUAGE_COLOURS: Record<string, string> = {
  TypeScript: "#3178c6",
  JavaScript: "#f1e05a",
  Go: "#00add8",
  Python: "#3572a5",
  PHP: "#4f5d95",
  Markdown: "#083fa1",
  Rust: "#dea584",
  Java: "#b07219",
  Kotlin: "#a97bff",
  Dart: "#00b4ab",
  Ruby: "#701516",
  Swift: "#f05138",
};

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
      <SiteHeader returnTo={query.then((value) => pathFor(readFilters(value)))} active="home" />

      <main id="main-content" className="dx-page">
        <header className="dx-head">
          <div>
            <h1>{tx(locale, "Direktori kontribusi", "Contribution directory")}</h1>
            <p>
              {tx(
                locale,
                "Project open source dan produk builders yang sedang menerima kontributor.",
                "Open source projects and builders' products that are taking contributors right now.",
              )}
            </p>
          </div>
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
  const [reposResult, projectsResult, membersResult] = await Promise.all([
    readPublicly("open source repos in the directory", () => listOpenSourceRepos(), []),
    readPublicly("products in the directory", () => listProjects({ lane: "active" }), []),
    readPublicly("members' open source records in the directory", () => listOssMembers(), []),
  ]);

  const repos = reposResult.value;
  const members = membersResult.value;
  const entries: DirectoryEntry[] = [
    ...repos.filter((repo) => repo.list === "internal").map((repo) => repoEntry(repo, locale, members)),
    ...repos.filter((repo) => repo.list === "recommended").map((repo) => repoEntry(repo, locale, members)),
    ...projectsResult.value.flatMap((project) =>
      productEntries(project, projectBlurb, (role) => roleLabel(role, "", locale), locale),
    ),
  ];
  const matched = filterDirectory(entries, filters);
  const onTrack = entries.filter((entry) => entry.track === filters.track);
  const facets = directoryFacets(entries, filters.track);
  const sources = DIRECTORY_SOURCES.map((source) => ({
    source,
    count: onTrack.filter((entry) => entry.source === source).length,
  })).filter(({ count }) => count > 0);
  const badges = badgeCounts(entries, filters.track);
  const code = filters.track === "github";
  const filtered = Boolean(filters.source || filters.badge || filters.facet || filters.q);

  return (
    <div className="dx-layout">
      {/* On a phone the first choice is a two-way tab across the top; the
          sidebar group below says the same thing on a wide screen. */}
      <nav className="dx-mtabs" aria-label={tx(locale, "Cara kontribusi", "How to contribute")}>
        {DIRECTORY_TRACKS.map((track) => (
          <Link
            key={track}
            className={filters.track === track ? "is-active" : ""}
            aria-current={filters.track === track ? "page" : undefined}
            href={pathFor({ track, source: "", badge: "", facet: "", q: filters.q })}
          >
            <TrackIcon track={track} />
            {tx(locale, TRACK_COPY[track].titleId, TRACK_COPY[track].titleEn)}
            <span>{entries.filter((entry) => entry.track === track).length}</span>
          </Link>
        ))}
      </nav>

      <aside className="dx-side" aria-label={tx(locale, "Filter", "Filters")}>
        <FacetGroup className="dx-facet-tracks" title={tx(locale, "Cara kontribusi", "How to contribute")}>
          {DIRECTORY_TRACKS.map((track) => (
            <FacetLink
              key={track}
              active={filters.track === track}
              href={pathFor({ track, source: "", badge: "", facet: "", q: filters.q })}
              count={entries.filter((entry) => entry.track === track).length}
              icon={<TrackIcon track={track} />}
              note={tx(locale, TRACK_COPY[track].noteId, TRACK_COPY[track].noteEn)}
            >
              {tx(locale, TRACK_COPY[track].titleId, TRACK_COPY[track].titleEn)}
            </FacetLink>
          ))}
        </FacetGroup>

        {badges.length > 0 ? (
          <FacetGroup title={tx(locale, "Tanda", "Signals")}>
            {badges.map(({ kind, count }) => (
              <FacetLink
                key={kind}
                active={filters.badge === kind}
                href={pathFor({ ...filters, badge: filters.badge === kind ? "" : kind })}
                count={count}
                icon={<BadgeIcon kind={kind} />}
              >
                {badgeKindLabel(kind, locale)}
              </FacetLink>
            ))}
          </FacetGroup>
        ) : null}

        {sources.length > 1 ? (
          <FacetGroup title={tx(locale, "Sumber", "Source")}>
            <FacetLink all active={filters.source === ""} href={pathFor({ ...filters, source: "" })} count={onTrack.length}>
              {tx(locale, "Semua", "All")}
            </FacetLink>
            {sources.map(({ source, count }) => (
              <FacetLink
                key={source}
                active={filters.source === source}
                href={pathFor({ ...filters, source: filters.source === source ? "" : source })}
                count={count}
              >
                {sourceLabel(source, locale)}
              </FacetLink>
            ))}
          </FacetGroup>
        ) : null}

        {facets.length > 0 ? (
          <FacetGroup title={code ? tx(locale, "Bahasa", "Language") : tx(locale, "Peran yang dicari", "Role wanted")}>
            <FacetLink all active={filters.facet === ""} href={pathFor({ ...filters, facet: "" })} count={onTrack.length}>
              {tx(locale, "Semua", "All")}
            </FacetLink>
            {facets.map(({ value, count }) => (
              <FacetLink
                key={value}
                active={filters.facet === value}
                href={pathFor({ ...filters, facet: filters.facet === value ? "" : value })}
                count={count}
                icon={code ? <LanguageDot language={value} /> : undefined}
              >
                {value}
              </FacetLink>
            ))}
          </FacetGroup>
        ) : null}
      </aside>

      <section className="dx-results" aria-label={tx(locale, "Hasil", "Results")}>
        <div className="dx-toolbar">
          <Form className="dx-search" action="/" role="search">
            {filters.track !== "github" ? <input type="hidden" name="track" value={filters.track} /> : null}
            {filters.source ? <input type="hidden" name="source" value={filters.source} /> : null}
            {filters.badge ? <input type="hidden" name="badge" value={filters.badge} /> : null}
            {filters.facet ? <input type="hidden" name="facet" value={filters.facet} /> : null}
            <label>
              <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
              <span className="sr-only">{tx(locale, "Cari project", "Search projects")}</span>
              <input type="search" name="q" defaultValue={filters.q} placeholder={tx(locale, "Cari project…", "Search projects…")} />
            </label>
          </Form>
          <p className="dx-count" role="status">
            <strong>{matched.length}</strong> {tx(locale, "project", matched.length === 1 ? "project" : "projects")}
            {filtered ? <> · <Link href={pathFor({ track: filters.track, source: "", badge: "", facet: "", q: "" })}>{tx(locale, "reset", "reset")}</Link></> : null}
          </p>
        </div>

        {reposResult.unavailable || projectsResult.unavailable ? (
          <p className="public-data-notice" role="status">
            {tx(locale, "Sebagian daftar tidak dapat dimuat.", "Part of the list could not be loaded.")} <Link href={pathFor(filters)}>{tx(locale, "Muat ulang", "Reload")}</Link>.
          </p>
        ) : null}

        <div className={`dx-table dx-table-${filters.track}`} role="table" aria-label={tx(locale, "Daftar project", "Project list")}>
          <div className="dx-row dx-row-head" role="row">
            <span role="columnheader">Project</span>
            <span role="columnheader">{code ? tx(locale, "Bahasa", "Language") : tx(locale, "Mencari", "Looking for")}</span>
            <span role="columnheader" className="dx-col-stars">{code ? "★" : ""}</span>
            <span role="columnheader"><span className="sr-only">{tx(locale, "Aksi", "Action")}</span></span>
          </div>

          {matched.length > 0 ? (
            matched.map((entry) => <DirectoryRow key={entry.key} entry={entry} locale={locale} />)
          ) : (
            <div className="dx-empty" role="row">
              <p role="cell">
                {tx(locale, "Tidak ada project yang cocok.", "No project matches.")}{" "}
                <Link href={pathFor({ track: filters.track, source: "", badge: "", facet: "", q: "" })}>{tx(locale, "Reset filter", "Reset filters")}</Link>
              </p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

function FacetGroup({ title, className = "", children }: { title: string; className?: string; children: React.ReactNode }) {
  return (
    <div className={`dx-facet ${className}`}>
      <p className="dx-facet-title">{title}</p>
      <ul>{children}</ul>
    </div>
  );
}

function FacetLink({
  active,
  href,
  count,
  icon,
  note,
  all = false,
  children,
}: {
  active: boolean;
  href: string;
  count: number;
  icon?: React.ReactNode;
  note?: string;
  /** The "All" entry of a group, which a phone leaves out. */
  all?: boolean;
  children: React.ReactNode;
}) {
  return (
    <li className={all ? "dx-facet-all" : undefined}>
      <Link className={`dx-facet-link ${active ? "is-active" : ""}`} aria-current={active ? "true" : undefined} href={href}>
        {icon}
        <span className="dx-facet-label">
          {children}
          {note ? <small>{note}</small> : null}
        </span>
        <span className="dx-facet-count">{count}</span>
      </Link>
    </li>
  );
}

/**
 * One badge on a row. When it names people, their GitHub avatars ride along —
 * a face is what makes "a friend has been here" believable — and the badge
 * links to the first of them: their profile here when the badge comes from
 * members' own records, their GitHub otherwise.
 */
function BadgeChip({ badge, locale }: { badge: Badge; locale: Locale }) {
  const people = badgePeople(badge);
  const label = badgeLabel(badge, locale);
  const title = people.length > 0 ? `${label}: ${people.map((person) => `@${person}`).join(", ")}` : label;
  const content = (
    <>
      <BadgeIcon kind={badge.kind} />
      <span>{label}</span>
      {people.length > 0 ? (
        <span className="dx-badge-faces" aria-hidden="true">
          {people.slice(0, 3).map((person) => (
            // GitHub serves a small avatar at this address for any username;
            // next/image would need the host allow-listed for a 20px picture.
            // eslint-disable-next-line @next/next/no-img-element
            <img key={person} src={`https://github.com/${person}.png?size=40`} alt="" width={18} height={18} loading="lazy" />
          ))}
        </span>
      ) : null}
    </>
  );

  const profile = badge.profiles?.[0];

  return (
    <li className={`dx-badge dx-badge-${badge.kind}`} title={title}>
      {profile ? (
        <Link href={`/u/${profile}`} aria-label={title}>{content}</Link>
      ) : people.length > 0 ? (
        <a href={`https://github.com/${people[0]}`} target="_blank" rel="noopener noreferrer" aria-label={title}>{content}</a>
      ) : (
        content
      )}
    </li>
  );
}

function BadgeIcon({ kind }: { kind: BadgeKind }) {
  if (kind === "indonesian") {
    return (
      <svg className="dx-badge-icon dx-flag" viewBox="0 0 16 12" aria-hidden="true">
        <rect width="16" height="6" fill="#e70011" />
        <rect y="6" width="16" height="6" fill="#fff" />
        <rect x=".5" y=".5" width="15" height="11" fill="none" stroke="#d4d4d8" />
      </svg>
    );
  }
  if (kind === "in-our-group") {
    return (
      <svg className="dx-badge-icon" viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="9" cy="8" r="3" /><path d="M3.5 19a5.5 5.5 0 0 1 11 0M16 5.5a3 3 0 0 1 0 5.5M17.5 14a5 5 0 0 1 3 5" />
      </svg>
    );
  }
  return (
    <svg className="dx-badge-icon" viewBox="0 0 24 24" aria-hidden="true">
      <path d="m5 12 4.5 4.5L19 7" />
    </svg>
  );
}

function LanguageDot({ language }: { language: string }) {
  return <span className="dx-lang-dot" style={{ background: LANGUAGE_COLOURS[language] ?? "#a1a1aa" }} aria-hidden="true" />;
}

function TrackIcon({ track }: { track: DirectoryTrack }) {
  return track === "github" ? (
    <svg className="dx-track-icon" viewBox="0 0 24 24" aria-hidden="true">
      <path fill="currentColor" stroke="none" d="M12 2a10 10 0 0 0-3.16 19.49c.5.09.68-.22.68-.48v-1.7c-2.78.6-3.37-1.34-3.37-1.34-.45-1.16-1.11-1.47-1.11-1.47-.91-.62.07-.6.07-.6 1 .07 1.53 1.03 1.53 1.03.9 1.52 2.34 1.08 2.91.83.09-.65.35-1.08.63-1.33-2.22-.25-4.55-1.11-4.55-4.94 0-1.09.39-1.98 1.03-2.68-.1-.25-.45-1.27.1-2.65 0 0 .84-.27 2.75 1.02a9.58 9.58 0 0 1 5 0c1.91-1.3 2.75-1.02 2.75-1.02.55 1.38.2 2.4.1 2.65.64.7 1.03 1.59 1.03 2.68 0 3.84-2.34 4.68-4.57 4.93.36.31.68.92.68 1.85v2.75c0 .27.18.58.69.48A10 10 0 0 0 12 2Z" />
    </svg>
  ) : (
    <svg className="dx-track-icon" viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="8" r="3.5" /><path d="M5 20a7 7 0 0 1 14 0" />
    </svg>
  );
}

function DirectoryRow({ entry, locale }: { entry: DirectoryEntry; locale: Locale }) {
  const external = { target: "_blank", rel: "noopener noreferrer" };
  const owner = entry.source === "product" ? tx(locale, `oleh ${entry.owner}`, `by ${entry.owner}`) : entry.owner;
  const sourceTag: Record<DirectorySource, string> = {
    internal: tx(locale, "milik kami", "ours"),
    recommended: tx(locale, "rekomendasi", "recommended"),
    product: tx(locale, "produk builders", "builders' product"),
  };

  return (
    <div className={`dx-row dx-row-${entry.source}`} role="row">
      <div className="dx-cell-main" role="cell">
        <span className="dx-logo" aria-hidden="true">{entry.name.slice(0, 1).toUpperCase()}</span>
        <div className="dx-main-copy">
          <p className="dx-name">
            {entry.href.startsWith("http") ? (
              <a href={entry.href} {...external}>{entry.name}</a>
            ) : (
              <Link href={entry.href}>{entry.name}</Link>
            )}
            <span className="dx-owner">{owner}</span>
          </p>
          <p className="dx-desc">{entry.description}</p>
          {entry.badges.length > 0 ? (
            <ul className="dx-badges" aria-label={tx(locale, "Tanda", "Signals")}>
              {entry.badges.map((badge) => <BadgeChip key={badge.kind} badge={badge} locale={locale} />)}
            </ul>
          ) : null}
          <p className="dx-tags">
            <span className={`dx-tag dx-tag-${entry.source}`}>{sourceTag[entry.source]}</span>
            {entry.track === "github" ? entry.labels.map((label) => <span key={label} className="dx-tag">{label}</span>) : null}
          </p>
        </div>
      </div>

      <div className="dx-cell-meta" role="cell">
        {entry.track === "github" ? (
          entry.language ? <span className="dx-lang"><LanguageDot language={entry.language} />{entry.language}</span> : <span className="dx-muted">—</span>
        ) : (
          <span className="dx-roles">
            {entry.labels.slice(0, 2).map((label) => <span key={label} className="dx-role">{label}</span>)}
            {entry.labels.length > 2 ? <span className="dx-muted">+{entry.labels.length - 2}</span> : null}
          </span>
        )}
      </div>

      <div className="dx-cell-stars" role="cell">
        {entry.stars !== null ? compactNumber(entry.stars, locale) : entry.track === "github" ? <span className="dx-muted">—</span> : null}
      </div>

      <div className="dx-cell-action" role="cell">
        {entry.external ? (
          <a className="dx-action" href={entry.actionHref} {...external}>
            {entry.track === "github" ? tx(locale, "Lihat isu", "Issues") : entry.actionLabel} <span aria-hidden="true">↗</span>
          </a>
        ) : (
          <Link className="dx-action" href={entry.actionHref}>
            {tx(locale, "Lihat peran", "Roles")} <span aria-hidden="true">→</span>
          </Link>
        )}
      </div>
    </div>
  );
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

function compactNumber(value: number, locale: Locale): string {
  return new Intl.NumberFormat(locale === "id" ? "id-ID" : "en-US", { notation: "compact", maximumFractionDigits: 1 }).format(value);
}

function one(value: string | string[] | undefined): string {
  return (Array.isArray(value) ? value[0] : value) ?? "";
}
