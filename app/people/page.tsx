import type { Metadata } from "next";
import { Suspense } from "react";
import Form from "next/form";
import Link from "@/app/components/responsive-link";
import { SiteFooter, SiteHeader } from "../components/shell";
import { AvailabilityBadges } from "../components/availability-badges";
import { initials } from "../components/pieces";
import { SearchableFilter } from "../components/searchable-filter";
import { LoadingNote, Skeleton } from "../components/skeleton";
import { SortSelect } from "../components/sort-select";
import { SubmitButton } from "../components/submit-button";
import { listPeopleAtWork, type PersonAtWork } from "../lib/data";
import { readPublicly } from "../lib/public-read";
import {
  EXPERIENCE_BANDS,
  experienceBandName,
  filterAndRankPeople,
  isExperienceBand,
  isTalentPoolMember,
  peopleFacets,
  peoplePage,
  primaryProfession,
  type PeopleFilters,
} from "../lib/people";
import { shareCard } from "../content";
import { currentLocale } from "../lib/locale-server";
import { tx, type Locale } from "../lib/locale";
import { currentViewer } from "../lib/session";
import { profileReady } from "../lib/next-steps";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await currentLocale();
  const title = "Talent Pool — Builders";
  const description = tx(locale, "Cari tech talent berdasarkan peran, keahlian, pengalaman proyek, dan status peluang.", "Find tech talent by role, skills, project experience, and opportunity status.");
  return { title, description, alternates: { canonical: "/people" }, openGraph: shareCard({ title, description, url: "/people" }) };
}

type SearchParams = Promise<Record<string, string | string[] | undefined>>;
type DirectoryParam = "q" | "profession" | "skill" | "experience" | "field" | "involvement" | "page";

/** The filters and page number this URL asks for. */
function readDirectoryQuery(query: Record<string, string | string[] | undefined>) {
  const involvementValue = one(query.involvement);
  const experienceValue = one(query.experience);
  const filters: PeopleFilters = {
    q: one(query.q).slice(0, 100),
    profession: one(query.profession).slice(0, 80),
    skill: one(query.skill).slice(0, 50),
    experience: isExperienceBand(experienceValue) ? experienceValue : "",
    field: one(query.field).slice(0, 50),
    involvement:
      involvementValue === "building" || involvementValue === "helping" ? involvementValue : "",
  };

  const rawPage = Number(one(query.page));
  return { filters, requestedPage: Number.isInteger(rawPage) && rawPage > 0 ? rawPage : 1 };
}

/**
 * The directory's frame, which is the same whatever is being searched for.
 *
 * Nothing here reads the URL, so it prerenders once and is served from the
 * edge. The results below it depend on `searchParams` — a different answer per
 * visitor — so they stream in behind a skeleton instead of holding the page.
 */
export default async function PeoplePage({ searchParams }: { searchParams?: SearchParams }) {
  const query = searchParams ?? Promise.resolve({});
  const locale = await currentLocale();

  return (
    <>
      <SiteHeader returnTo={query.then(hrefForQuery)} active="people" />

      <main id="main-content" className="people-page">
        <header className="people-directory-head">
          <div className="people-directory-copy">
            <p className="people-directory-kicker">Talent Pool</p>
            <h1>{tx(locale, "Temukan tech talent untuk timmu.", "Find tech talent for your team.")}</h1>
            <p>{tx(locale, "Untuk engineering, design, product, data, dan research. Lihat keahlian, pengalaman dan karyanya.", "For engineering, design, product, data, and research. See skills, experience and their project experiences.")}</p>
          </div>
          <Suspense fallback={<TalentPoolCtaFallback locale={locale} />}>
            <TalentPoolCta locale={locale} />
          </Suspense>
        </header>

        <Suspense fallback={<DirectorySkeleton />}>
          <Directory query={query} />
        </Suspense>
      </main>

      <SiteFooter />
    </>
  );
}

async function TalentPoolCta({ locale }: { locale: Locale }) {
  const viewer = await currentViewer();

  if (!viewer) return <TalentPoolCtaFallback locale={locale} />;

  const ready = profileReady(viewer);
  return (
    <div className="people-directory-join">
      <p>
        {ready
          ? tx(locale, "Profilmu sudah tampil. Perbarui status peluangmu bila perlu.", "Your profile is live. Update your opportunity status when needed.")
          : tx(locale, "Lengkapi profil agar keahlian tech dan pengalamanmu mudah ditemukan.", "Complete your profile so your tech skills and experience are easy to find.")}
      </p>
      <Link href="/account/profile">
        {ready ? tx(locale, "Perbarui status", "Update status") : tx(locale, "Lengkapi profil", "Complete your profile")}
        <span aria-hidden="true">→</span>
      </Link>
    </div>
  );
}

function TalentPoolCtaFallback({ locale }: { locale: Locale }) {
  return (
    <div className="people-directory-join">
      <p>{tx(locale, "Punya pengalaman membangun produk digital? Buat profil agar recruiter dapat menemukanmu.", "Have experience building digital products? Create a profile so recruiters can find you.")}</p>
      <Link href="/signup?next=%2Faccount%2Fprofile">
        {tx(locale, "Buat profil talent", "Create a talent profile")} <span aria-hidden="true">→</span>
      </Link>
    </div>
  );
}

/** The address of the directory as this URL currently has it. */
async function hrefForQuery(
  query: Record<string, string | string[] | undefined>,
): Promise<string> {
  const { filters, requestedPage } = readDirectoryQuery(query);
  return directoryPath(filters, requestedPage > 1 ? requestedPage : 1, {});
}

function directoryPath(
  filters: PeopleFilters,
  page: number,
  patch: Partial<Record<DirectoryParam, string | number | null>>,
): string {
  const base: Partial<Record<DirectoryParam, string>> = {
    q: filters.q,
    profession: filters.profession,
    skill: filters.skill,
    experience: filters.experience,
    field: filters.field,
    involvement: filters.involvement,
    page: page > 1 ? String(page) : "",
  };

  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(base)) {
    if (value) params.set(key, value);
  }
  for (const [key, value] of Object.entries(patch)) {
    if (value === null || value === "" || value === 1) params.delete(key);
    else params.set(key, String(value));
  }

  const search = params.toString();
  return `/people${search ? `?${search}` : ""}`;
}

async function Directory({ query }: { query: SearchParams }) {
  const locale = await currentLocale();
  const { filters, requestedPage } = readDirectoryQuery(await query);
  const peopleResult = await readPublicly<PersonAtWork[]>(
    "people directory",
    () => listPeopleAtWork(1000),
    [],
  );
  const allPeople = peopleResult.value;
  const talentPoolPeople = allPeople.filter(isTalentPoolMember);
  const facets = peopleFacets(talentPoolPeople);
  const matched = filterAndRankPeople(talentPoolPeople, filters);
  const pagination = peoplePage(matched, requestedPage);
  const { items: people, page, pageCount } = pagination;
  const activeFilterCount = [
    filters.q,
    filters.profession,
    filters.skill,
    filters.experience,
    filters.field,
    filters.involvement,
  ].filter(Boolean).length;
  const activeControlCount = [
    filters.profession,
    filters.skill,
    filters.experience,
    filters.field,
    filters.involvement,
  ].filter(Boolean).length;

  const directoryHref = (patch: Partial<Record<DirectoryParam, string | number | null>>) =>
    directoryPath(filters, page, patch);

  const topContributors = [...talentPoolPeople]
    .filter((entry) => entry.helping.length > 0)
    .sort(
      (a, b) =>
        b.helping.length - a.helping.length ||
        b.building.length - a.building.length ||
        a.person.name.localeCompare(b.person.name, "id"),
    )
    .slice(0, 5);
  const returnTo = directoryHref({});

  return (
    <>
        {peopleResult.unavailable ? (
          <p className="public-data-notice" role="status">
            {tx(locale, "Data talent tidak dapat dimuat.", "Talent data could not load.")} <Link href={returnTo}>{tx(locale, "Muat ulang", "Reload")}</Link>.
          </p>
        ) : null}

        <section className="people-search-panel" aria-label={tx(locale, "Cari dan saring talent", "Search and filter talent")}>
          <Form className="discovery-search collaboration-search" action="/people" role="search">
            {filters.profession ? <input type="hidden" name="profession" value={filters.profession} /> : null}
            {filters.skill ? <input type="hidden" name="skill" value={filters.skill} /> : null}
            {filters.experience ? <input type="hidden" name="experience" value={filters.experience} /> : null}
            {filters.field ? <input type="hidden" name="field" value={filters.field} /> : null}
            {filters.involvement ? <input type="hidden" name="involvement" value={filters.involvement} /> : null}
            <label className="collaboration-search-field">
              <span className="sr-only">{tx(locale, "Cari talent", "Search talent")}</span>
              <SearchIcon />
              <input
                type="search"
                name="q"
                maxLength={100}
                defaultValue={filters.q}
                placeholder={tx(locale, "Cari nama, peran, atau keahlian tech…", "Search by name, tech role, or skill…")}
              />
            </label>
            <SubmitButton pendingLabel={tx(locale, "Mencari…", "Searching…")}>{tx(locale, "Cari", "Search")}</SubmitButton>
          </Form>

          <details className="collaboration-filter-panel">
            <summary className="collaboration-filter-summary">
              <span><FilterIcon /> {tx(locale, "Filter", "Filters")}</span>
              <span>
                {activeControlCount > 0 ? tx(locale, `${activeControlCount} aktif`, `${activeControlCount} active`) : tx(locale, "Opsional", "Optional")}
                <i aria-hidden="true" />
              </span>
            </summary>

            <div className="collaboration-filter-controls">
              <div className="collaboration-control">
                <span>{tx(locale, "Peran tech", "Tech role")}</span>
                <SearchableFilter
                  action="/people"
                  name="profession"
                  value={filters.profession}
                  label={tx(locale, "Saring peran tech", "Filter tech roles")}
                  placeholder={tx(locale, "Cari peran…", "Search roles…")}
                  clearLabel={tx(locale, "Hapus filter peran", "Clear role filter")}
                  resultsLabel={tx(locale, "Hasil peran", "Role results")}
                  options={withSelectedFacet(facets.professions, filters.profession).map((facet) => ({
                    ...facet,
                    label: facet.value,
                    meta: tx(locale, `${facet.count} tech talent`, `${facet.count} tech talent`),
                  }))}
                  hidden={{ q: filters.q, skill: filters.skill, experience: filters.experience, field: filters.field, involvement: filters.involvement }}
                />
              </div>

              <div className="collaboration-control">
                <span>{tx(locale, "Keahlian", "Skill")}</span>
                <SearchableFilter
                  action="/people"
                  name="skill"
                  value={filters.skill}
                  label={tx(locale, "Saring keahlian", "Filter skills")}
                  placeholder={tx(locale, "Cari keahlian…", "Search skills…")}
                  clearLabel={tx(locale, "Hapus filter keahlian", "Clear skill filter")}
                  resultsLabel={tx(locale, "Hasil keahlian", "Skill results")}
                  options={withSelectedFacet(facets.skills, filters.skill).map((facet) => ({
                    ...facet,
                    label: facet.value,
                    meta: tx(locale, `${facet.count} tech talent`, `${facet.count} tech talent`),
                  }))}
                  hidden={{ q: filters.q, profession: filters.profession, experience: filters.experience, field: filters.field, involvement: filters.involvement }}
                />
              </div>

              <div className="collaboration-control">
                <span>{tx(locale, "Pengalaman kerja", "Work experience")}</span>
                <SortSelect
                  action="/people"
                  name="experience"
                  value={filters.experience}
                  label={tx(locale, "Saring pengalaman kerja", "Filter work experience")}
                  options={[
                    { value: "", label: tx(locale, "Semua tingkat pengalaman", "All experience levels") },
                    ...EXPERIENCE_BANDS.map((band) => ({ value: band, label: experienceBandName(band, locale) })),
                  ]}
                  hidden={{ q: filters.q, profession: filters.profession, skill: filters.skill, field: filters.field, involvement: filters.involvement }}
                />
              </div>

              <div className="collaboration-control">
                <span>{tx(locale, "Bidang", "Field")}</span>
                <SearchableFilter
                  action="/people"
                  name="field"
                  value={filters.field}
                  label={tx(locale, "Saring bidang", "Filter fields")}
                  placeholder={tx(locale, "Cari bidang…", "Search fields…")}
                  clearLabel={tx(locale, "Hapus filter bidang", "Clear field filter")}
                  resultsLabel={tx(locale, "Hasil bidang", "Field results")}
                  options={withSelectedFacet(facets.fields, filters.field).map((facet) => ({
                    ...facet,
                    label: facet.value,
                    meta: tx(locale, `${facet.count} tech talent`, `${facet.count} tech talent`),
                  }))}
                  hidden={{ q: filters.q, profession: filters.profession, skill: filters.skill, experience: filters.experience, involvement: filters.involvement }}
                />
              </div>

              <div className="collaboration-control">
                <span>{tx(locale, "Pengalaman proyek", "Project experience")}</span>
                <SortSelect
                  action="/people"
                  name="involvement"
                  value={filters.involvement}
                  label={tx(locale, "Saring pengalaman proyek", "Filter project experience")}
                  options={[
                    { value: "", label: tx(locale, "Semua", "Any") },
                    { value: "building", label: tx(locale, "Membangun proyek", "Building projects") },
                    { value: "helping", label: tx(locale, "Berkontribusi di proyek", "Contributing to projects") },
                  ]}
                  hidden={{ q: filters.q, profession: filters.profession, skill: filters.skill, experience: filters.experience, field: filters.field }}
                />
              </div>
            </div>
          </details>
        </section>

        {activeFilterCount > 0 ? (
          <div className="active-filters home-active-filters" aria-label={tx(locale, "Filter aktif", "Active filters")}>
            <ul>
              {filters.q ? (
                <ActiveFilter label={tx(locale, "Pencarian", "Search")} value={filters.q} href={directoryHref({ q: null, page: null })} locale={locale} />
              ) : null}
              {filters.profession ? (
                <ActiveFilter label={tx(locale, "Peran tech", "Tech role")} value={filters.profession} href={directoryHref({ profession: null, page: null })} locale={locale} />
              ) : null}
              {filters.skill ? (
                <ActiveFilter label={tx(locale, "Keahlian", "Skill")} value={filters.skill} href={directoryHref({ skill: null, page: null })} locale={locale} />
              ) : null}
              {filters.experience ? (
                <ActiveFilter
                  label={tx(locale, "Pengalaman kerja", "Work experience")}
                  value={experienceBandName(filters.experience, locale)}
                  href={directoryHref({ experience: null, page: null })}
                  locale={locale}
                />
              ) : null}
              {filters.field ? (
                <ActiveFilter label={tx(locale, "Bidang", "Field")} value={filters.field} href={directoryHref({ field: null, page: null })} locale={locale} />
              ) : null}
              {filters.involvement ? (
                <ActiveFilter
                  label={tx(locale, "Pengalaman proyek", "Project experience")}
                  value={filters.involvement === "building" ? tx(locale, "Membangun proyek", "Building projects") : tx(locale, "Berkontribusi", "Contributing")}
                  href={directoryHref({ involvement: null, page: null })}
                  locale={locale}
                />
              ) : null}
            </ul>
            <Link href="/people">{tx(locale, "Hapus semua", "Clear all")}</Link>
          </div>
        ) : null}

        <section className="people-results" aria-labelledby="people-results-heading" aria-live="polite">
          <div className="people-results-layout">
            <div className="people-results-main">
              <div className="people-results-head">
                <h2 id="people-results-heading">{tx(locale, `${matched.length} tech talent ditemukan`, `${matched.length} tech talent found`)}</h2>
                {matched.length > 0 ? (
                  <p>
                    {tx(locale, `Menampilkan ${pagination.from}–${pagination.to} dari ${matched.length}`, `Showing ${pagination.from}–${pagination.to} of ${matched.length}`)}
                  </p>
                ) : null}
              </div>

              {people.length === 0 ? (
                <div className="people-empty">
                  <span aria-hidden="true">⌕</span>
                  <h3>{tx(locale, "Belum ada tech talent yang cocok.", "No matching tech talent.")}</h3>
                  <p>{tx(locale, "Ubah kata kunci atau hapus filter.", "Try another keyword or clear a filter.")}</p>
                  <Link className="ghost-button" href="/people">{tx(locale, "Lihat semua tech talent", "View all tech talent")}</Link>
                </div>
              ) : (
                <ul className="people-list">
                  {people.map((entry) => (
                    <PersonRow key={entry.person.id} entry={entry} locale={locale} />
                  ))}
                </ul>
              )}

              {pageCount > 1 ? (
                <nav className="people-pagination" aria-label={tx(locale, "Halaman hasil pencarian", "Search result pages")}>
                  {page > 1 ? (
                    <Link className="pagination-direction" href={directoryHref({ page: page - 1 })} rel="prev">
                      ← {tx(locale, "Sebelumnya", "Previous")}
                    </Link>
                  ) : (
                    <span className="pagination-direction is-disabled">← {tx(locale, "Sebelumnya", "Previous")}</span>
                  )}
                  <div>
                    {paginationItems(page, pageCount).map((item) =>
                      typeof item === "number" ? (
                        <Link
                          key={item}
                          className={item === page ? "is-active" : ""}
                          aria-current={item === page ? "page" : undefined}
                          aria-label={tx(locale, `Halaman ${item}`, `Page ${item}`)}
                          href={directoryHref({ page: item })}
                        >
                          {item}
                        </Link>
                      ) : (
                        <span key={item} aria-hidden="true">…</span>
                      ),
                    )}
                  </div>
                  {page < pageCount ? (
                    <Link className="pagination-direction" href={directoryHref({ page: page + 1 })} rel="next">
                      {tx(locale, "Berikutnya", "Next")} →
                    </Link>
                  ) : (
                    <span className="pagination-direction is-disabled">{tx(locale, "Berikutnya", "Next")} →</span>
                  )}
                </nav>
              ) : null}
            </div>

            <ContributorRail people={topContributors} locale={locale} />
          </div>
        </section>
    </>
  );
}

/** The frame of the results, drawn while the real ones are on their way. */
function DirectorySkeleton() {
  return (
    <>
      <LoadingNote />
      <section className="people-search-panel">
        <Skeleton height={52} style={{ marginBottom: 12 }} />
        <Skeleton height={44} />
      </section>
      <section className="people-results">
        <div className="people-results-layout">
          <div className="people-results-main">
            <Skeleton height={24} width={220} style={{ marginBottom: 16 }} />
            {[0, 1, 2, 3, 4].map((slot) => (
              <Skeleton key={slot} height={168} style={{ marginTop: 12 }} />
            ))}
          </div>
          <aside className="people-contributor-rail">
            <Skeleton height={320} />
          </aside>
        </div>
      </section>
    </>
  );
}

function PersonRow({ entry, locale }: { entry: PersonAtWork; locale: Locale }) {
  const { person, building, helping } = entry;
  const profession = primaryProfession(entry, locale);
  const evidence = [
    ...building.map((project) => ({ project, label: tx(locale, "Membangun", "Building") })),
    ...helping.map((project) => ({ project, label: tx(locale, "Membantu", "Helping") })),
  ].slice(0, 2);
  const headline = person.headline.trim() !== profession.trim() ? person.headline : "";

  return (
    <li>
      <article className="people-row">
        <Link className="people-row-avatar" href={`/u/${person.username}`} aria-label={tx(locale, `Profil ${person.name}`, `${person.name}'s profile`)}>
          <span className="people-avatar" aria-hidden="true">{initials(person.name)}</span>
        </Link>

        <div className="people-row-body">
          <header className="people-row-heading">
            <Link href={`/u/${person.username}`}>{person.name}</Link>
            <span>·</span>
            <small>@{person.username}</small>
          </header>
          <p className={profession ? "people-profession" : "people-profession is-empty"}>
            {profession || tx(locale, "Profesi belum ditambahkan", "Profession not added")}
          </p>
          {headline ? <p className="people-headline">{headline}</p> : null}

          <AvailabilityBadges
            status={person.availability}
            fields={person.fields}
            skills={person.skills}
            locale={locale}
          />

          <ul className="people-meta">
            {person.yearsExperience !== null ? <li>{tx(locale, `${person.yearsExperience} tahun pengalaman`, `${person.yearsExperience} years of experience`)}</li> : null}
            {person.fields.slice(0, 2).map((field) => <li key={field}>{field}</li>)}
            {building.length > 0 ? <li>{tx(locale, `${building.length} proyek dibangun`, `${building.length} projects built`)}</li> : null}
            {helping.length > 0 ? <li>{tx(locale, `${helping.length} kontribusi`, `${helping.length} contributions`)}</li> : null}
          </ul>

          {person.skills.length > 0 ? (
            <ul className="people-skills" aria-label={tx(locale, `Keahlian ${person.name}`, `${person.name}'s skills`)}>
              {person.skills.slice(0, 4).map((skill) => (
                <li key={skill}><Link href={`/people?skill=${encodeURIComponent(skill)}`}>{skill}</Link></li>
              ))}
              {person.skills.length > 4 ? <li className="people-more">+{person.skills.length - 4}</li> : null}
            </ul>
          ) : null}

          <div className="people-proof">
            <strong>{tx(locale, "Proyek & kontribusi", "Projects & contributions")}</strong>
            {evidence.length > 0 ? (
              <ul>
                {evidence.map(({ project, label }) => (
                  <li key={`${label}-${project.id}`}>
                    <span>{label}</span>
                    <Link href={`/projects/${project.slug}`}>{project.title}</Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="people-no-proof">{tx(locale, "Belum ada proyek publik.", "No public projects yet.")}</p>
            )}
          </div>
        </div>

        <div className="people-row-action">
          <Link href={`/u/${person.username}`}>
            {tx(locale, "Lihat profil", "View profile")} <span aria-hidden="true">→</span>
          </Link>
        </div>
      </article>
    </li>
  );
}

function ContributorRail({ people, locale }: { people: PersonAtWork[]; locale: Locale }) {
  return (
    <aside className="people-contributor-rail" aria-labelledby="contributors-heading">
      <div className="people-contributor-card">
        <p className="section-label">{tx(locale, "Talent pool", "Talent pool")}</p>
        <h2 id="contributors-heading">{tx(locale, "Kontributor", "Contributors")}</h2>
        <p className="people-contributor-note">
          {tx(locale, "Orang yang sudah ikut membantu proyek di sini, dengan jumlah proyek yang mereka bantu.", "People who have helped on projects here, with how many they have helped on.")}
        </p>

        {people.length > 0 ? (
          <ol>
            {people.map((entry) => (
              <li key={entry.person.id}>
                <Link className="people-contributor-person" href={`/u/${entry.person.username}`}>
                  <span className="people-mini-avatar" aria-hidden="true">{initials(entry.person.name)}</span>
                  <span>
                    <strong>{entry.person.name}</strong>
                    <small>{primaryProfession(entry, locale) || `@${entry.person.username}`}</small>
                  </span>
                </Link>
                <strong className="people-contributor-count">{entry.helping.length}</strong>
              </li>
            ))}
          </ol>
        ) : (
          <p className="people-contributor-empty">{tx(locale, "Belum ada kontribusi yang ditampilkan.", "No contributions shown yet.")}</p>
        )}

        <Link className="people-contributor-all" href="/people?involvement=helping">
          {tx(locale, "Lihat semua kontributor", "View all contributors")} <span aria-hidden="true">→</span>
        </Link>
      </div>
    </aside>
  );
}

function ActiveFilter({ label, value, href, locale }: { label: string; value: string; href: string; locale: Locale }) {
  return (
    <li>
      <Link href={href} aria-label={tx(locale, `Hapus filter ${label}: ${value}`, `Remove ${label} filter: ${value}`)}>
        {label}: <strong>{value}</strong> <span aria-hidden="true">×</span>
      </Link>
    </li>
  );
}

function withSelectedFacet(
  facets: { value: string; count: number }[],
  selected: string,
): { value: string; count: number }[] {
  return selected && !hasFacet(facets, selected)
    ? [{ value: selected, count: 0 }, ...facets]
    : facets;
}

function FilterIcon() {
  return (
    <svg className="icon" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 7h16M7 12h10M10 17h4" />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg className="icon" viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="11" cy="11" r="6.5" />
      <path d="m16 16 4 4" />
    </svg>
  );
}

function paginationItems(current: number, total: number): (number | string)[] {
  if (total <= 7) return Array.from({ length: total }, (_, index) => index + 1);

  const pages = [...new Set([1, current - 1, current, current + 1, total])]
    .filter((value) => value >= 1 && value <= total)
    .sort((a, b) => a - b);
  const result: (number | string)[] = [];
  for (const value of pages) {
    const previous = result.at(-1);
    if (typeof previous === "number" && value - previous > 1) result.push(`gap-${previous}`);
    result.push(value);
  }
  return result;
}

function one(value: string | string[] | undefined): string {
  return (Array.isArray(value) ? value[0] : value ?? "").trim();
}

function hasFacet(facets: { value: string }[], value: string): boolean {
  return facets.some((facet) => facet.value.localeCompare(value, "id", { sensitivity: "base" }) === 0);
}
