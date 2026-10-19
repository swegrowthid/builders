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
  DIRECTORY_KINDS,
  filterDirectory,
  isDirectoryKind,
  kindLabel,
  productEntry,
  repoEntry,
  type DirectoryEntry,
  type DirectoryKind,
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
type Filters = { kind: DirectoryKind | ""; q: string };

function readFilters(query: Record<string, string | string[] | undefined>): Filters {
  const kind = one(query.type);
  return { kind: isDirectoryKind(kind) ? kind : "", q: one(query.q).slice(0, 100) };
}

function pathFor(filters: Filters): string {
  const params = new URLSearchParams();
  if (filters.kind) params.set("type", filters.kind);
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
              "Pilih satu, buka isunya, kirim PR. Open source milik kami, open source yang kami rekomendasikan, dan produk builders yang butuh bantuan.",
              "Pick one, open its issues, send a PR. Open source we maintain, open source we recommend, and builders' products that need a hand.",
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
    ...projectsResult.value
      .map((project) => productEntry(project, projectBlurb, (role) => roleLabel(role, "", locale), locale))
      .filter((entry): entry is DirectoryEntry => entry !== null),
  ];
  const matched = filterDirectory(entries, filters);
  const count = (kind: DirectoryKind) => entries.filter((entry) => entry.kind === kind).length;

  return (
    <>
      <div className="dir-controls">
        <Form className="dir-search" action="/" role="search">
          {filters.kind ? <input type="hidden" name="type" value={filters.kind} /> : null}
          <label>
            <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
            <span className="sr-only">{tx(locale, "Cari project", "Search projects")}</span>
            <input
              type="search"
              name="q"
              defaultValue={filters.q}
              placeholder={tx(locale, "Cari nama, bahasa, atau topik…", "Search name, language, or topic…")}
            />
          </label>
        </Form>

        <nav className="dir-tabs" aria-label={tx(locale, "Jenis project", "Project type")}>
          <TabLink active={filters.kind === ""} href={pathFor({ ...filters, kind: "" })}>
            {tx(locale, "Semua", "All")} <span>{entries.length}</span>
          </TabLink>
          {DIRECTORY_KINDS.map((kind) => (
            <TabLink key={kind} active={filters.kind === kind} href={pathFor({ ...filters, kind })}>
              {kindLabel(kind, locale)} <span>{count(kind)}</span>
            </TabLink>
          ))}
        </nav>
      </div>

      {reposResult.unavailable || projectsResult.unavailable ? (
        <p className="public-data-notice" role="status">
          {tx(locale, "Sebagian daftar tidak dapat dimuat.", "Part of the list could not be loaded.")} <Link href={pathFor(filters)}>{tx(locale, "Muat ulang", "Reload")}</Link>.
        </p>
      ) : null}

      {matched.length > 0 ? (
        <ul className="dir-list">
          {matched.map((entry) => <DirectoryRow key={entry.key} entry={entry} locale={locale} />)}
        </ul>
      ) : (
        <div className="dir-empty">
          <p>{tx(locale, "Tidak ada project yang cocok.", "No project matches.")}</p>
          <Link href="/">{tx(locale, "Lihat semua", "See all")}</Link>
        </div>
      )}

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
    <li className={`dir-row dir-row-${entry.kind}`}>
      <span className="dir-mark" aria-hidden="true">{entry.name.slice(0, 1).toUpperCase()}</span>

      <div className="dir-main">
        <h2>
          {entry.href.startsWith("http") ? (
            <a href={entry.href} {...external(entry.href)}>
              {entry.kind !== "product" ? <span className="dir-owner">{entry.owner}/</span> : null}
              {entry.name}
            </a>
          ) : (
            <Link href={entry.href}>{entry.name}</Link>
          )}
        </h2>
        <p>{entry.description}</p>
        <ul className="dir-meta">
          <li className="dir-kind">{kindLabel(entry.kind, locale)}</li>
          {entry.kind === "product" ? <li>{tx(locale, `oleh ${entry.owner}`, `by ${entry.owner}`)}</li> : null}
          {entry.language ? <li>{entry.language}</li> : null}
          {entry.stars !== null ? <li>★ {compactNumber(entry.stars, locale)}</li> : null}
          {entry.labels.map((label) => <li key={label} className="dir-label">{label}</li>)}
        </ul>
      </div>

      {entry.external ? (
        <a className="dir-action" href={entry.contributeHref} {...external(entry.contributeHref)}>
          {entry.contributeLabel} <span aria-hidden="true">↗</span>
        </a>
      ) : (
        <Link className="dir-action" href={entry.contributeHref}>
          {entry.contributeLabel} <span aria-hidden="true">→</span>
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
