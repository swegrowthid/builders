import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "@/app/components/responsive-link";
import { BoardCard, CollaborationTrail, initials } from "../components/pieces";
import { RelativeTime } from "../components/relative-time";
import { ExploreSearchForm } from "../components/explore-search-form";
import { SearchableFilter } from "../components/searchable-filter";
import { Arrow, SiteFooter, SiteHeader } from "../components/shell";
import { SortSelect } from "../components/sort-select";
import { LoadingNote, Skeleton } from "../components/skeleton";
import { shareCard } from "../content";
import {
  arrangeForYou,
  familiarRoles,
  isLane,
  listPeople,
  listOpenRoleSuggestions,
  listProjects,
  listRecentActivity,
  openSeatsByRole,
  tagCountsFromProjects,
  type ActivityEvent,
  type FeedQuery,
  type Lane,
  type ProjectSummary,
} from "../lib/data";
import { readPublicly } from "../lib/public-read";
import {
  PROJECT_TYPES,
  isProjectType,
  projectTypeLabel,
  type ProjectType,
} from "../lib/project-types";
import { localizeRoleLabel, normaliseRole, roleLabel, type Role } from "../lib/roles";
import { isStage, stageLabel, STAGES, type Stage } from "../lib/stages";
import { viewerId } from "../lib/session";
import { currentLocale } from "../lib/locale-server";
import { tx, type Locale } from "../lib/locale";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await currentLocale();
  const title = tx(locale, "Produk Builders — Builders", "Builders' Products — Builders");
  const description = tx(locale, "Produk buatan builders yang sedang mencari bantuan untuk memantapkan produknya — saring berdasarkan tahap, topik, dan peran.", "Products made by builders who are looking for help to make them solid — filter by stage, topic, and role.");
  return { title, description, alternates: { canonical: "/explore" }, openGraph: shareCard({ title, description, url: "/explore" }) };
}

const SORTS: { value: Lane; label: string }[] = [
  { value: "for-you", label: "For you" },
  { value: "newest", label: "Newest projects" },
  { value: "active", label: "Most active" },
];

const SORT_VALUES = new Set<Lane>(SORTS.map((option) => option.value));
const LEGACY_LANE_STAGE: Record<string, Stage> = { dibangun: "building", berjalan: "live" };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function one(value: string | string[] | undefined): string {
  return (Array.isArray(value) ? value[0] : value)?.trim() ?? "";
}

/** What the URL is asking the board for. */
type BoardQuery = {
  sort: Lane;
  stage: Stage | "";
  /** Which kind of project, from PROJECT_TYPES. Empty means every kind. */
  type: ProjectType | "";
  role: Role | "";
  tag: string;
  q: string;
  searchBy: "project" | "role";
  needs: "open" | "";
};

function readBoardQuery(params: Record<string, string | string[] | undefined>): BoardQuery {
  const askedLane = one(params.lane);
  const legacyStage = LEGACY_LANE_STAGE[askedLane];

  return {
    sort: isLane(askedLane) && SORT_VALUES.has(askedLane) ? askedLane : "for-you",
    stage: legacyStage ?? (isStage(one(params.stage)) ? (one(params.stage) as Stage) : ""),
    type: isProjectType(one(params.type)) ? (one(params.type) as ProjectType) : "",
    role: normaliseRole(one(params.role)) ?? "",
    tag: one(params.tag),
    q: one(params.q),
    searchBy: one(params.searchBy) === "role" ? "role" : "project",
    needs: one(params.needs) === "open" || askedLane === "needs-help" ? "open" : "",
  };
}

function pathFor(query: BoardQuery): string {
  return linkTo(query);
}

/**
 * Explore's frame, which is the same question however it is being asked.
 *
 * The heading, the invitation to add a project and the footer read nothing, so
 * they prerender once and arrive with the document. Everything below depends on
 * the filters in the URL and, for the "untukmu" ordering, on who is asking —
 * neither of which exists until somebody asks, so they stream in behind a
 * skeleton rather than holding the page back.
 */
export default async function CollaborationPage({ searchParams }: { searchParams?: SearchParams }) {
  const params = searchParams ?? Promise.resolve({});
  const locale = await currentLocale();

  return (
    <>
      <SiteHeader returnTo={params.then((value) => pathFor(readBoardQuery(value)))} active="explore" />

      <main id="main-content" className="discovery-page collaboration-page">
        <section className="collaboration-hero" aria-labelledby="collaboration-title">
          <div>
            <h1 id="collaboration-title">{tx(locale, "Produk builders yang butuh bantuan", "Builders' products that need a hand")}</h1>
            <p>{tx(locale, "Produk dari komunitas kita yang sedang dimantapkan. Pilih yang kebutuhannya cocok dengan keahlianmu — yang berlabel GitHub menerima pull request langsung.", "Products from our community that are being made solid. Pick one whose needs fit your skills — those with the GitHub label take pull requests directly.")}</p>
          </div>
          <ContributorPulse />
        </section>

        <Suspense fallback={<BoardSkeleton />}>
          <Board params={params} />
        </Suspense>
      </main>

      <SiteFooter />
    </>
  );
}

/**
 * How many people are here. A cached public read with nothing per-visitor in
 * it, so it is prerendered into the shell alongside the heading.
 */
async function ContributorPulse() {
  const [{ value: people }, locale] = await Promise.all([
    readPublicly("people in Explore", () => listPeople(400), []),
    currentLocale(),
  ]);

  return (
    <div className="contributor-pulse" aria-label={tx(locale, `${people.length} kontributor`, `${people.length} contributors`)}>
      <div className="pulse-avatars" aria-hidden="true">
        {people.slice(0, 3).map((person) => (
          <span key={person.id}>{initials(person.name)}</span>
        ))}
        <span className="pulse-plus">+</span>
      </div>
      <p>
        <strong>{tx(locale, `${people.length} kontributor`, `${people.length} contributors`)}</strong>
        <small>{tx(locale, "siap membangun bersama", "ready to build together")}</small>
      </p>
    </div>
  );
}

function BoardSkeleton() {
  return (
    <>
      <LoadingNote />
      <section className="collaboration-panel">
        <Skeleton height={55} />
        <Skeleton height={44} style={{ marginTop: 10 }} />
      </section>
      <div className="discovery-content collaboration-content">
        <section>
          <div className="home-list-head">
            <Skeleton height={24} width={220} />
          </div>
          {[0, 1, 2, 3].map((slot) => (
            <Skeleton key={slot} height={190} style={{ marginTop: 12 }} />
          ))}
        </section>
        <aside className="discovery-sidebar">
          <Skeleton height={260} />
          <Skeleton height={360} />
        </aside>
      </div>
    </>
  );
}

async function Board({ params: paramsPromise }: { params: SearchParams }) {
  const locale = await currentLocale();
  const { sort, stage, type, role, tag, q, searchBy, needs } = readBoardQuery(await paramsPromise);

  const query: FeedQuery = {
    lane: sort,
    stage,
    projectType: type,
    tag,
    role,
    q: searchBy === "project" ? q : "",
    roleQuery: searchBy === "role" ? q : "",
    needsHelp: needs === "open",
  };

  // Who is asking does not change which projects come back — only the order of
  // the "untukmu" lane. So this is started rather than awaited: the board reads
  // below go out at the same time, and the two settle together. Awaiting it
  // here instead put the whole board behind an auth round trip and then a
  // second query, for a sort that could just as well happen at the end.
  const familiarPromise = sort === "for-you"
    ? readPublicly<string[]>(
        "familiar roles for recommendations",
        async () => {
          const id = await viewerId();
          return id ? familiarRoles(id) : [];
        },
        [],
      )
    : Promise.resolve({ value: [] as string[], unavailable: false });

  const projectsPromise = readPublicly<ProjectSummary[]>(
    "project Explore",
    () => listProjects(query),
    [],
  );
  const topicProjectsPromise = tag
    ? readPublicly<ProjectSummary[]>(
        "Explore categories",
        () => listProjects({ ...query, tag: "" }),
        [],
      )
    : projectsPromise;
  // What the rail leads with follows the search toggle: somebody looking for a
  // role wants to know whether people here actually work together, and somebody
  // looking for a project wants to know which ones are moving. Only the side
  // being shown is read.
  const trailPromise = searchBy === "role"
    ? readPublicly<ActivityEvent[]>("recent collaboration in Explore", () => listRecentActivity(5), [])
    : Promise.resolve({ value: [] as ActivityEvent[], unavailable: false });
  const activeProjectsPromise = searchBy === "role"
    ? Promise.resolve({ value: [] as ProjectSummary[], unavailable: false })
    : readPublicly<ProjectSummary[]>("most active projects in Explore", () => listProjects({ lane: "active" }), []);

  const [
    projectsResult,
    topicProjectsResult,
    trailResult,
    activeProjectsResult,
    roleSuggestionsResult,
    familiarResult,
  ] = await Promise.all([
    projectsPromise,
    topicProjectsPromise,
    trailPromise,
    activeProjectsPromise,
    readPublicly("open role suggestions", () => listOpenRoleSuggestions(), []),
    familiarPromise,
  ]);

  // The one place the visitor changes what they see: rows everybody shares,
  // put in an order that leans on the roles this person has held before.
  const projects = sort === "for-you"
    ? arrangeForYou(projectsResult.value, familiarResult.value)
    : projectsResult.value;
  const topics = tagCountsFromProjects(topicProjectsResult.value);
  const recentCollaboration = trailResult.value;
  const activeProjects = activeProjectsResult.value.slice(0, 5);
  const roleSuggestions = roleSuggestionsResult.value.map((suggestion) => ({
    ...suggestion,
    value: localizeRoleLabel(suggestion.value, locale),
    label: localizeRoleLabel(suggestion.label, locale),
  }));
  const seatsResult = await readPublicly<Map<number, Record<string, number>>>(
    "open role count",
    () => openSeatsByRole(projects.map((project) => project.id)),
    new Map(),
  );
  const seatsByRole = seatsResult.value;
  const dataUnavailable = [
    familiarResult,
    projectsResult,
    topicProjectsResult,
    trailResult,
    activeProjectsResult,
    roleSuggestionsResult,
    seatsResult,
  ].some((result) => result.unavailable);
  const filtered = Boolean(stage || type || tag || role || q || needs);
  const activeControlCount = [stage, type, tag, role, needs, sort === "for-you" ? "" : sort].filter(Boolean).length;
  const currentPath = linkTo({ lane: sort, stage, type, tag, role, q, searchBy, needs });

  return (
    <>
        {dataUnavailable ? (
          <p className="public-data-notice" role="status">
            {tx(locale, "Sebagian data tidak dapat dimuat.", "Some data could not load.")} <Link href={currentPath}>{tx(locale, "Coba lagi", "Try again")}</Link>.
          </p>
        ) : null}

        <section className="collaboration-panel" aria-label={tx(locale, "Cari proyek atau peran, lalu saring dan urutkan hasilnya", "Search projects or roles, then filter and sort the results")}>
          <ExploreSearchForm
            mode={searchBy}
            q={q}
            suggestions={roleSuggestions}
            hidden={{
              stage,
              type,
              tag,
              role,
              needs,
              lane: sort === "for-you" ? "" : sort,
            }}
          />

          <details className="collaboration-filter-panel">
            <summary className="collaboration-filter-summary">
              <span><FilterIcon /> {tx(locale, "Saring & urutkan", "Filter & sort")}</span>
              <span>
                {activeControlCount > 0 ? tx(locale, `${activeControlCount} aktif`, `${activeControlCount} active`) : tx(locale, "Opsional", "Optional")}
                <i aria-hidden="true" />
              </span>
            </summary>

            <div className="collaboration-filter-controls">
              <div className="collaboration-control collaboration-sort-control">
                <span>{tx(locale, "Urutkan", "Sort")}</span>
                <SortSelect
                  action="/explore"
                  name="lane"
                  value={sort}
                  label={tx(locale, "Urutkan proyek", "Sort projects")}
                  options={SORTS.map((entry) => ({ ...entry, label: tx(locale,
                    entry.value === "for-you" ? "Untukmu" : entry.value === "newest" ? "Proyek terbaru" : "Paling aktif",
                    entry.label,
                  ) }))}
                  hidden={{ stage, type, tag, role, q, searchBy: searchBy === "role" ? searchBy : "", needs }}
                />
              </div>

              <div className="collaboration-control">
                <span>{tx(locale, "Kategori", "Category")}</span>
                <SearchableFilter
                  action="/explore"
                  name="tag"
                  value={tag}
                  label={tx(locale, "Saring kategori", "Filter categories")}
                  placeholder={tx(locale, "Masukkan kategori…", "Enter a category…")}
                  options={withSelectedTopic(topics, tag).map((topic) => ({
                    value: topic.tag,
                    label: topic.tag,
                    meta: tx(locale, `${topic.count} proyek`, `${topic.count} projects`),
                  }))}
                  hidden={{ stage, type, role, q, searchBy: searchBy === "role" ? searchBy : "", needs, lane: sort === "for-you" ? "" : sort }}
                />
              </div>

              <div className="collaboration-control">
                <span>{tx(locale, "Tahap proyek", "Project stage")}</span>
                <SortSelect
                  action="/explore"
                  name="stage"
                  value={stage}
                  label={tx(locale, "Saring tahap proyek", "Filter project stages")}
                  options={[
                    { value: "", label: tx(locale, "Semua tahap", "All stages") },
                    ...STAGES.map((entry) => ({ value: entry, label: stageLabel(entry, locale) })),
                  ]}
                  hidden={{ type, tag, role, q, searchBy: searchBy === "role" ? searchBy : "", needs, lane: sort === "for-you" ? "" : sort }}
                />
              </div>

              <div className="collaboration-control">
                <span>{tx(locale, "Jenis proyek", "Project kind")}</span>
                <SortSelect
                  action="/explore"
                  name="type"
                  value={type}
                  label={tx(locale, "Saring jenis proyek", "Filter project kind")}
                  options={[
                    { value: "", label: tx(locale, "Semua jenis", "All kinds") },
                    ...PROJECT_TYPES.map((entry) => ({
                      value: entry,
                      label: projectTypeLabel(entry, locale),
                    })),
                  ]}
                  hidden={{ stage, tag, role, q, searchBy: searchBy === "role" ? searchBy : "", needs, lane: sort === "for-you" ? "" : sort }}
                />
              </div>

              <div className="collaboration-control">
                <span>{tx(locale, "Kebutuhan", "Needs")}</span>
                <SortSelect
                  action="/explore"
                  name="needs"
                  value={needs}
                  label={tx(locale, "Saring kebutuhan kolaborasi", "Filter collaboration needs")}
                  options={[
                    { value: "", label: tx(locale, "Semua proyek", "All projects") },
                    { value: "open", label: tx(locale, "Mencari kolaborator", "Looking for collaborators") },
                  ]}
                  hidden={{ stage, type, tag, role, q, searchBy: searchBy === "role" ? searchBy : "", lane: sort === "for-you" ? "" : sort }}
                />
              </div>
            </div>
          </details>
        </section>

        {filtered ? (
          <div className="active-filters home-active-filters" aria-label={tx(locale, "Filter aktif", "Active filters")}>
            <ul>
              {role ? (
                <li>
                  <Link href={linkTo({ lane: sort, stage, type, tag, q, searchBy, needs })}>
                    {tx(locale, "Peran", "Role")}: <strong>{roleLabel(role, "", locale)}</strong> <span>×</span>
                  </Link>
                </li>
              ) : null}
              {tag ? <li><Link href={linkTo({ lane: sort, stage, type, role, q, searchBy, needs })}>{tx(locale, "Kategori", "Category")}: <strong>{tag}</strong> <span>×</span></Link></li> : null}
              {stage ? <li><Link href={linkTo({ lane: sort, type, tag, role, q, searchBy, needs })}>{tx(locale, "Tahap", "Stage")}: <strong>{stageLabel(stage, locale)}</strong> <span>×</span></Link></li> : null}
              {type ? <li><Link href={linkTo({ lane: sort, stage, tag, role, q, searchBy, needs })}>{tx(locale, "Jenis", "Kind")}: <strong>{projectTypeLabel(type, locale)}</strong> <span>×</span></Link></li> : null}
              {needs ? <li><Link href={linkTo({ lane: sort, stage, type, tag, role, q, searchBy })}>{tx(locale, "Kebutuhan", "Needs")}: <strong>{tx(locale, "Mencari kolaborator", "Looking for collaborators")}</strong> <span>×</span></Link></li> : null}
              {q ? <li><Link href={linkTo({ lane: sort, stage, type, tag, role, searchBy, needs })}>{searchBy === "role" ? tx(locale, "Pencarian peran", "Role search") : tx(locale, "Pencarian", "Search")}: <strong>“{q}”</strong> <span>×</span></Link></li> : null}
            </ul>
            <Link className="clear-filters" href={linkTo({ lane: sort })}>{tx(locale, "Hapus semua", "Clear all")}</Link>
          </div>
        ) : null}

        <div className="discovery-content collaboration-content">
          <section className="home-projects" aria-labelledby="collaboration-project-list-title">
            <div className="home-list-head collaboration-list-head">
              <div>
                <h2 id="collaboration-project-list-title">{tx(locale, "Proyek untuk berkolaborasi", "Projects for collaboration")}</h2>
                <p>{tx(locale, `${projects.length} proyek ditemukan`, `${projects.length} projects found`)}</p>
              </div>
            </div>

            <div className="feed" aria-label={tx(locale, "Daftar proyek", "Project list")}>
              {projects.length === 0 ? (
                <div className="empty home-empty">
                  <p>{tx(locale, "Belum ada proyek yang cocok dengan pencarian ini.", "No projects match this search yet.")}</p>
                  <Link href="/explore">{tx(locale, "Lihat semua proyek", "View all projects")}</Link>
                </div>
              ) : (
                <ul className="board-grid">
                  {projects.map((project) => (
                    <BoardCard
                      key={project.id}
                      project={project}
                      roleCounts={seatsByRole.get(project.id)}
                    />
                  ))}
                </ul>
              )}
            </div>
          </section>

          <aside className="discovery-sidebar" aria-label={tx(locale, "Pintasan kolaborasi", "Collaboration shortcuts")}>
            {searchBy === "role" ? (
              <section className="explore-spotlight" aria-labelledby="explore-spotlight-title">
                <div className="explore-spotlight-head">
                  <div>
                    <p className="home-eyebrow">{tx(locale, "Kolaborasi terbaru", "Latest collaboration")}</p>
                    <h2 id="explore-spotlight-title">{tx(locale, "Aktivitas kolaborasi terakhir", "The last collaboration activity")}</h2>
                    <p>{tx(locale, "Yang baru saja terjadi ketika orang mengambil peran di sini.", "What has just happened as people took roles here.")}</p>
                  </div>
                  <span className="live-dot" title={tx(locale, "Diperbarui dari aktivitas proyek", "Updated from project activity")} />
                </div>
                <CollaborationTrail
                  events={recentCollaboration}
                  locale={locale}
                  emptyNote={tx(locale, "Belum ada kolaborasi yang tercatat.", "No collaboration recorded yet.")}
                />
                <Link className="explore-spotlight-link" href="/explore?searchBy=role&needs=open">
                  {tx(locale, "Lihat peran yang sedang dibuka", "See the roles being opened")} <Arrow />
                </Link>
              </section>
            ) : (
              <section className="explore-spotlight" aria-labelledby="explore-spotlight-title">
                <div className="explore-spotlight-head">
                  <div>
                    <p className="home-eyebrow">{tx(locale, "Sedang bergerak", "On the move")}</p>
                    <h2 id="explore-spotlight-title">{tx(locale, "Proyek yang paling aktif", "The most active projects")}</h2>
                    <p>{tx(locale, "Proyek dengan aktivitas terbaru — di sinilah kontribusimu paling cepat terlihat.", "Projects with the newest activity — where your contribution shows up fastest.")}</p>
                  </div>
                  <span className="live-dot" title={tx(locale, "Diperbarui dari aktivitas proyek", "Updated from project activity")} />
                </div>
                <ActiveProjectList projects={activeProjects} locale={locale} />
                <Link className="explore-spotlight-link" href="/explore?lane=active">
                  {tx(locale, "Urutkan semua proyek dari yang paling aktif", "Sort every project by most active")} <Arrow />
                </Link>
              </section>
            )}

            <section className="show-project-card">
              <span className="show-project-plus" aria-hidden="true">+</span>
              <h2>{tx(locale, "Sedang membangun sesuatu?", "Building something?")}</h2>
              <p>{tx(locale, "Tampilkan proyekmu dan temukan orang yang dapat membantu mengembangkannya.", "Show your project and find people who can help move it forward.")}</p>
              <Link href="/new">{tx(locale, "Tambah proyek", "Add a project")}</Link>
              <small>{tx(locale, "Gratis untuk komunitas", "Free for the community")}</small>
            </section>
          </aside>
        </div>
    </>
  );
}

/** The projects that moved most recently, each with how long ago that was. */
function ActiveProjectList({ projects, locale }: { projects: ProjectSummary[]; locale: Locale }) {
  if (projects.length === 0) {
    return <p className="explore-spotlight-empty">{tx(locale, "Belum ada proyek yang bergerak.", "Nothing is moving yet.")}</p>;
  }

  return (
    <ol className="explore-spotlight-projects">
      {projects.map((project) => (
        <li key={project.id}>
          <Link href={`/projects/${project.slug}`}>
            <span>
              <strong>{project.title}</strong>
              <small>
                {stageLabel(project.stage, locale)}
                {" · "}
                <RelativeTime value={project.lastActivityAt || project.createdAt} locale={locale} />
              </small>
            </span>
            <Arrow />
          </Link>
        </li>
      ))}
    </ol>
  );
}

function withSelectedTopic(topics: { tag: string; count: number }[], selected: string) {
  return selected && !topics.some((topic) => topic.tag === selected)
    ? [{ tag: selected, count: 0 }, ...topics]
    : topics;
}

function FilterIcon() {
  return (
    <svg className="icon" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 7h16M7 12h10M10 17h4" />
    </svg>
  );
}

function linkTo(query: {
  lane?: string;
  stage?: string;
  type?: string;
  tag?: string;
  role?: string;
  q?: string;
  searchBy?: string;
  needs?: string;
}): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    const isDefault = (key === "lane" && value === "for-you") ||
      (key === "searchBy" && value === "project");
    if (value && !isDefault) params.set(key, value);
  }
  const search = params.toString();
  return search ? `/explore?${search}` : "/explore";
}
