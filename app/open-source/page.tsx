import type { Metadata } from "next";
import { Suspense } from "react";
import Form from "next/form";
import Link from "@/app/components/responsive-link";
import { SiteFooter, SiteHeader } from "../components/shell";
import { RepoCard } from "../components/open-source";
import { Skeleton } from "../components/skeleton";
import { SubmitButton } from "../components/submit-button";
import { shareCard } from "../content";
import { listOpenSourceRepos } from "../lib/open-source-live";
import {
  REPO_LISTS,
  REPO_REASONS,
  filterRepos,
  isRepoList,
  isRepoReason,
  listLabel,
  reasonLabel,
  repoLanguages,
  type RepoFilters,
} from "../lib/open-source";
import { currentLocale } from "../lib/locale-server";
import { tx, type Locale } from "../lib/locale";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await currentLocale();
  const title = tx(locale, "Open Source — Builders", "Open Source — Builders");
  const description = tx(
    locale,
    "Repo open source milik kami dan yang kami rekomendasikan, lengkap dengan alasan dan isu pemula untuk PR pertamamu.",
    "Open source repos we maintain and ones we recommend, each with its reason and starter issues for your first PR.",
  );
  return { title, description, alternates: { canonical: "/open-source" }, openGraph: shareCard({ title, description, url: "/open-source" }) };
}

type SearchParams = Promise<Record<string, string | string[] | undefined>>;
type FilterKey = "list" | "reason" | "lang" | "q";

function readFilters(query: Record<string, string | string[] | undefined>): RepoFilters {
  const list = one(query.list);
  const reason = one(query.reason);
  return {
    list: isRepoList(list) ? list : "",
    reason: isRepoReason(reason) ? reason : "",
    language: one(query.lang).slice(0, 40),
    q: one(query.q).slice(0, 100),
  };
}

function pathFor(filters: RepoFilters, patch: Partial<Record<FilterKey, string | null>> = {}): string {
  const params = new URLSearchParams();
  const base: Record<FilterKey, string> = {
    list: filters.list,
    reason: filters.reason,
    lang: filters.language,
    q: filters.q,
  };
  for (const [key, value] of Object.entries({ ...base, ...patch })) {
    if (value) params.set(key, value);
  }
  const search = params.toString();
  return `/open-source${search ? `?${search}` : ""}`;
}

/**
 * The open source catalogue.
 *
 * The heading and the guide to a first PR do not depend on the URL, so they
 * prerender; the filtered listing reads `searchParams` and streams in behind
 * a skeleton.
 */
export default async function OpenSourcePage({ searchParams }: { searchParams?: SearchParams }) {
  const query = searchParams ?? Promise.resolve({});
  const locale = await currentLocale();

  return (
    <>
      <SiteHeader returnTo={query.then((value) => pathFor(readFilters(value)))} active="open-source" />

      <main id="main-content" className="oss-page">
        <header className="oss-page-head">
          <p className="home-eyebrow">Open source</p>
          <h1>{tx(locale, "Pilih repo, ambil satu isu, kirim PR pertamamu.", "Pick a repo, take one issue, send your first PR.")}</h1>
          <p>
            {tx(
              locale,
              "Setiap repo di sini dipilih dengan alasan yang jelas — milik kami sendiri, maintainer-nya orang Indonesia, bagian dari stack kami, atau memang ramah pemula. Tombol utamanya langsung membuka isu pemula, bukan README.",
              "Every repo here is picked for a stated reason — we maintain it, its maintainers are Indonesian, it is part of our stack, or it is simply beginner friendly. The main button opens its starter issues, not its README.",
            )}
          </p>
        </header>

        <Suspense fallback={<CatalogueSkeleton />}>
          <Catalogue query={query} locale={locale} />
        </Suspense>

        <section className="oss-suggest" aria-labelledby="oss-suggest-title">
          <div>
            <h2 id="oss-suggest-title">{tx(locale, "Punya repo yang layak masuk daftar ini?", "Know a repo that belongs on this list?")}</h2>
            <p>
              {tx(
                locale,
                "Daftar ini ada di app/lib/open-source.ts. Menambahkan satu repo — dengan alasannya — adalah PR yang bagus untuk memulai.",
                "This list lives in app/lib/open-source.ts. Adding one repo — with its reason — is a good PR to start with.",
              )}
            </p>
          </div>
          <a
            className="home-hero-primary"
            href="https://github.com/zikrulihsan/builders/blob/main/app/lib/open-source.ts"
            target="_blank"
            rel="noopener noreferrer"
          >
            {tx(locale, "Usulkan lewat PR", "Suggest it in a PR")} <span aria-hidden="true">↗</span>
          </a>
        </section>
      </main>

      <SiteFooter />
    </>
  );
}

async function Catalogue({ query, locale }: { query: SearchParams; locale: Locale }) {
  const filters = readFilters(await query);
  const repos = await listOpenSourceRepos();
  const matched = filterRepos(repos, filters);
  const languages = repoLanguages(repos);
  const filtered = Boolean(filters.list || filters.reason || filters.language || filters.q);

  return (
    <>
      <div className="oss-controls">
        <nav className="oss-tabs" aria-label={tx(locale, "Daftar repo", "Repo lists")}>
          <Link className={filters.list === "" ? "is-active" : ""} aria-current={filters.list === "" ? "page" : undefined} href={pathFor(filters, { list: null })}>
            {tx(locale, "Semua", "All")} <span>{repos.length}</span>
          </Link>
          {REPO_LISTS.map((list) => (
            <Link
              key={list}
              className={filters.list === list ? "is-active" : ""}
              aria-current={filters.list === list ? "page" : undefined}
              href={pathFor(filters, { list })}
            >
              {listLabel(list, locale)} <span>{repos.filter((repo) => repo.list === list).length}</span>
            </Link>
          ))}
        </nav>

        <Form className="discovery-search oss-search" action="/open-source" role="search">
          {filters.list ? <input type="hidden" name="list" value={filters.list} /> : null}
          {filters.reason ? <input type="hidden" name="reason" value={filters.reason} /> : null}
          {filters.language ? <input type="hidden" name="lang" value={filters.language} /> : null}
          <label>
            <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
            <span className="sr-only">{tx(locale, "Cari repo", "Search repos")}</span>
            <input type="search" name="q" defaultValue={filters.q} placeholder={tx(locale, "Cari nama, topik, atau bahasa…", "Search name, topic, or language…")} />
          </label>
          <SubmitButton>{tx(locale, "Cari", "Search")}</SubmitButton>
        </Form>

        <div className="oss-chip-row" aria-label={tx(locale, "Saring berdasarkan alasan", "Filter by reason")}>
          <span className="oss-chip-label">{tx(locale, "Alasan", "Reason")}</span>
          {REPO_REASONS.map((reason) => (
            <Link
              key={reason}
              className={`oss-chip ${filters.reason === reason ? "is-active" : ""}`}
              aria-current={filters.reason === reason ? "true" : undefined}
              href={pathFor(filters, { reason: filters.reason === reason ? null : reason })}
            >
              {reasonLabel(reason, locale)}
            </Link>
          ))}
        </div>

        <div className="oss-chip-row" aria-label={tx(locale, "Saring berdasarkan bahasa", "Filter by language")}>
          <span className="oss-chip-label">{tx(locale, "Bahasa", "Language")}</span>
          {languages.map(({ value }) => (
            <Link
              key={value}
              className={`oss-chip ${filters.language === value ? "is-active" : ""}`}
              aria-current={filters.language === value ? "true" : undefined}
              href={pathFor(filters, { lang: filters.language === value ? null : value })}
            >
              {value}
            </Link>
          ))}
        </div>
      </div>

      <p className="oss-result-count" role="status">
        {tx(locale, `${matched.length} repo`, `${matched.length} ${matched.length === 1 ? "repo" : "repos"}`)}
        {filtered ? <> · <Link href="/open-source">{tx(locale, "Hapus filter", "Clear filters")}</Link></> : null}
      </p>

      {matched.length > 0 ? (
        <div className="oss-grid">
          {matched.map((repo) => <RepoCard key={`${repo.owner}/${repo.repo}`} repo={repo} locale={locale} />)}
        </div>
      ) : (
        <p className="landing-data-empty">
          {tx(locale, "Belum ada repo yang cocok dengan filter ini.", "No repo matches these filters yet.")}
        </p>
      )}
    </>
  );
}

function CatalogueSkeleton() {
  return (
    <div className="oss-grid" aria-busy="true">
      {[0, 1, 2, 3].map((slot) => <Skeleton key={slot} height={320} style={{ borderRadius: 20 }} />)}
    </div>
  );
}

function one(value: string | string[] | undefined): string {
  return (Array.isArray(value) ? value[0] : value) ?? "";
}
