import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "@/app/components/responsive-link";
import {
  addComment,
  assignTask,
  closeSeat,
  createTask,
  decideProposal,
  deleteTask,
  deleteUpdate,
  moveTask,
  openSeat,
  postUpdate,
  submitProposal,
  setNow,
  setSeatAccess,
  setStage,
  setTaskRole,
} from "../../actions";
import { signInPath } from "../../lib/urls";
import { SubmitButton } from "../../components/submit-button";
import { SiteFooter, SiteHeader, Arrow } from "../../components/shell";
import {
  ActivityList,
  GitHubContributeBadge,
  JourneyList,
  RungRail,
  StageBadge,
  TagRow,
  TypeBadge,
  Freshness,
  initials,
} from "../../components/pieces";
import { RelativeTime } from "../../components/relative-time";
import { MAXIMUM, domainOf, projectBlurb } from "../../lib/brief";
import {
  getProject,
  getProjectReactionCounts,
  hasBoosted,
  isFollowing,
  listProjects,
  listProjectProposals,
  listProjectActivity,
  type ProjectDetail,
} from "../../lib/data";
import { profileReady } from "../../lib/next-steps";
import { projectTypeContribution, projectTypeLabel } from "../../lib/project-types";
import { roleLabel } from "../../lib/roles";
import { CommitmentField } from "../../components/commitment-field";
import { RoleFields } from "../../components/role-fields";
import { STAGES, meetsStage, requirementsFor, stageBlurb, stageLabel, type StageInput } from "../../lib/stages";
import { accessOf, canManage } from "../../lib/access";
import { UPDATE_LIMITS } from "../../lib/updates";
import {
  TASK_ORDER,
  TASK_STATUSES,
  taskStatusLabel,
  taskStatusBlurb,
  taskStatusTone,
} from "../../lib/tasks";
import { currentViewer } from "../../lib/session";
import { ProjectScrollTop } from "../../components/project-scroll-top";
import { ProjectLogo } from "../../components/project-logo";
import { ProjectReactions } from "../../components/project-reactions";
import { ProjectTabContent, ProjectTabSwitcher } from "../../components/project-tabs";
import { isProjectTab, type ProjectTab } from "../../lib/project-tabs";
import { isGitHubRepositoryUrl } from "../../lib/github";
import { currentLocale } from "../../lib/locale-server";
import { tx } from "../../lib/locale";

type Params = Promise<{ slug: string }>;
type SearchParams = Promise<{ tab?: string | string[] }>;

/**
 * Prime the public project pages people are most likely to open from Explore.
 *
 * Cache Components upgrades every other slug after its first prefetch or
 * visit, so this deliberately stays a bounded set: a catalogue growing into
 * thousands of projects must not turn every deployment into thousands of
 * five-query detail renders.
 */
export async function generateStaticParams(): Promise<{ slug: string }[]> {
  try {
    const projects = await listProjects({ lane: "active" });
    return projects.slice(0, 32).map((project) => ({ slug: project.slug }));
  } catch (error) {
    // A temporary database outage should not make a deploy fail. Unknown
    // slugs still receive the segment loading state and upgrade on first use.
    console.warn("[ahsan] Project detail was not prerendered:", error);
    return [];
  }
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const [{ slug }, locale] = await Promise.all([params, currentLocale()]);
  const project = await getProject(slug);
  if (!project) return { title: tx(locale, "Proyek tidak ditemukan — Ahsan Project", "Project not found — Ahsan Project") };

  return {
    title: `${project.title} — Ahsan Project`,
    // What it is doing now says more than what it is, when there is one.
    description: project.nowText || projectBlurb(project),
    alternates: { canonical: `/projects/${project.slug}` },
    // The card image comes from opengraph-image.tsx beside this file.
    openGraph: {
      type: "article",
      title: `${project.title} — Ahsan Project`,
      description: project.nowText || projectBlurb(project),
      url: `/projects/${project.slug}`,
    },
  };
}

export default async function ProjectPage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: SearchParams;
}) {
  const [{ slug }, query] = await Promise.all([params, searchParams]);
  const requestedTab = Array.isArray(query.tab) ? query.tab[0] : query.tab;
  const activeTab: ProjectTab = requestedTab && isProjectTab(requestedTab) ? requestedTab : "about";
  // The project and the visitor are independent questions — ask them together.
  const [project, viewer, locale] = await Promise.all([getProject(slug), currentViewer(), currentLocale()]);
  if (!project) notFound();

  // Where this visitor stands. The database decides what may actually
  // happen; this only decides what is worth rendering.
  const access = accessOf(viewer?.id, project.owner.id, project.seats);
  const isOwner = access === "owner";
  const isManager = canManage(access);
  const [reactionCounts, boosted, following, history, proposals] = await Promise.all([
    getProjectReactionCounts(project.id),
    viewer ? hasBoosted(project.id, viewer.id) : Promise.resolve(false),
    viewer ? isFollowing(project.id, viewer.id) : Promise.resolve(false),
    listProjectActivity(project.id, { slug: project.slug, viewer }),
    viewer
      ? listProjectProposals(
          project.tasks.map((task) => task.id),
          project.seats.map((seat) => seat.id),
        )
      : Promise.resolve([]),
  ]);
  const { followerCount, boostCount } = reactionCounts ?? project;
  const returnTo =
    activeTab === "about"
      ? `/projects/${project.slug}`
      : `/projects/${project.slug}?tab=${activeTab}`;
  const followersLabel = tx(locale, "orang mengikuti proyek ini.", "people follow this project.");

  const stageInput = toStageInput(project);

  const team = project.seats.filter((seat) => seat.status === "filled");
  const open = project.seats.filter((seat) => seat.status === "open");
  // A closed role still shows up here — closed only turns off new proposals,
  // it does not decide the ones already sent.
  const awaitingDecision = project.seats.filter((seat) => seat.status !== "filled");
  const viewerSeat = viewer ? project.seats.find((seat) => seat.person?.id === viewer.id) : undefined;
  const canPropose = Boolean(viewer && profileReady(viewer));
  const profileReturnTo = `/account/profile?returnTo=${encodeURIComponent(returnTo)}`;
  const proposalsForSeat = (seatId: number) => proposals.filter((proposal) => proposal.seatId === seatId);
  const proposalsForTask = (taskId: number) => proposals.filter((proposal) => proposal.taskId === taskId);

  const doneTasks = project.tasks.filter((task) => task.status === "done").length;
  // Who a task may be handed to: the owner, plus everybody holding a seat.
  const assignable = [
    { id: project.owner.id, name: project.owner.name },
    ...team.flatMap((seat) => (seat.person ? [{ id: seat.person.id, name: seat.person.name }] : [])),
  ];

  return (
    <>
      <ProjectScrollTop />
      <SiteHeader returnTo={returnTo} />

      <main id="main-content" className="project-page">
        <div className="breadcrumb breadcrumb-row">
          <p>
            <Link href="/">{tx(locale, "Jelajahi", "Explore")}</Link> <span aria-hidden="true">/</span> {project.title}
          </p>
          {isOwner ? <Link className="edit-link" href={`/projects/${project.slug}/edit`}>{tx(locale, "Edit proyek", "Edit project")}</Link> : null}
        </div>

        <section className="project-hero">
          <div className="project-hero-copy">
            <div className="project-hero-top">
              <ProjectLogo
                className={`hero-glyph level-${project.stage}`}
                fallback={project.glyph || initials(project.title)}
                title={project.title}
                website={project.liveUrl}
                logoUrl={project.logoUrl}
              />
              <div className="project-head-badges">
                <StageBadge stage={project.stage} />
                <TypeBadge type={project.projectType} />
                {project.openForGitHubContributions ? (
                  <GitHubContributeBadge repoUrl={project.repoUrl} />
                ) : null}
              </div>
            </div>
            <h1>{project.title}</h1>
            <p className="project-tagline">{projectBlurb(project)}</p>
            <TagRow tags={project.tags} />

            {projectTypeContribution(project.projectType, locale) ? (
              /* What saying yes here actually means. The badge names the kind;
                 this is the sentence somebody weighing an application needs,
                 and it belongs beside the ask rather than in a tooltip. */
              <p className="project-type-note">
                <strong>{projectTypeLabel(project.projectType, locale)}</strong>
                {projectTypeContribution(project.projectType, locale)}
              </p>
            ) : null}

            <div className="project-hero-meta">
              <Link className="card-owner" href={`/u/${project.owner.username}`}>
                <span className="avatar" aria-hidden="true">
                  {initials(project.owner.name)}
                </span>
                <span>
                  <strong>
                    {project.owner.name}
                    {team.length > 0 ? tx(locale, ` + ${team.length} orang`, ` + ${team.length} people`) : ""}
                  </strong>
                  <small><Freshness project={project} locale={locale} /></small>
                </span>
              </Link>

              {viewer ? (
                <ProjectReactions
                  projectId={project.id}
                  initialState={{ following, followerCount, boosted, boostCount }}
                  labels={{
                    follow: tx(locale, "Ikuti proyek", "Follow project"),
                    following: tx(locale, "Mengikuti", "Following"),
                    support: tx(locale, "dukungan", "support"),
                    followers: followersLabel,
                    error: tx(locale, "Belum tersimpan. Coba lagi.", "Could not save. Try again."),
                  }}
                />
              ) : (
                <div className="project-reactions">
                  <div className="hero-actions">
                    <Link className="follow" href={signInPath(returnTo)}>
                      {tx(locale, "Ikuti proyek", "Follow project")}
                    </Link>
                    <Link className="boost" href={signInPath(returnTo)}>
                      <span aria-hidden="true">♡</span>
                      <strong>{boostCount}</strong>
                      <span className="sr-only">{tx(locale, "dukungan", "support")}</span>
                    </Link>
                  </div>
                  {followerCount > 0 ? (
                    <p className="follower-count">
                      {followerCount} {followersLabel}
                    </p>
                  ) : null}
                </div>
              )}
            </div>

            {(project.liveUrl || project.docUrl || project.repoUrl) && (
              <ul className="project-links">
                {project.liveUrl ? (
                  <li>
                    <a href={project.liveUrl} target="_blank" rel="noreferrer">
                      {domainOf(project.liveUrl) || tx(locale, "Buka produk", "Open product")} <Arrow diagonal />
                    </a>
                  </li>
                ) : null}
                {project.docUrl ? (
                  <li>
                    <a href={project.docUrl} target="_blank" rel="noreferrer">
                      {tx(locale, "Dokumen", "Document")} <Arrow diagonal />
                    </a>
                  </li>
                ) : null}
                {project.repoUrl ? (
                  <li>
                    <a href={project.repoUrl} target="_blank" rel="noreferrer">
                      {isGitHubRepositoryUrl(project.repoUrl) ? tx(locale, "Lihat repositori GitHub", "View GitHub repository") : tx(locale, "Repositori", "Repository")} <Arrow diagonal />
                    </a>
                  </li>
                ) : null}
              </ul>
            )}
          </div>
        </section>

        <ProjectTabSwitcher initialTab={activeTab}>
          <div className="project-main">
            <ProjectTabContent tab="about">
              <section className="brief" aria-labelledby="brief-heading">
                <h2 id="brief-heading">{tx(locale, "Tentang proyek ini", "About this project")}</h2>

                {/* The owner's own words come first: on a project added as a
                    link this is the whole of what a person wrote, and on a
                    fully written one it is still the part worth reading first. */}
                {project.highlight ? (
                  <p className="brief-highlight">{project.highlight}</p>
                ) : null}

                {project.problem ? (
                  <article>
                    <h3>{tx(locale, "Masalah yang ingin diselesaikan", "Problem to solve")}</h3>
                    <p>{project.problem}</p>
                  </article>
                ) : null}
                {project.solution ? (
                  <article>
                    <h3>{tx(locale, "Hal yang sedang dibangun", "What is being built")}</h3>
                    <p>{project.solution}</p>
                  </article>
                ) : null}
                {project.audience ? (
                  <article>
                    <h3>{tx(locale, "Untuk siapa", "Who it is for")}</h3>
                    <p>{project.audience}</p>
                  </article>
                ) : null}

                {/* A project that arrived as a link has nothing here yet. Saying
                    so, and saying who can fix it, beats an empty heading. */}
                {!project.problem && !project.solution && !project.audience ? (
                  <p className="brief-empty">
                    {isOwner
                      ? tx(locale, "Ringkasan proyek masih kosong. Menambahkan masalah, apa yang kamu buat, dan siapa sasarannya hanya perlu beberapa menit serta membantu orang tertarik untuk berkontribusi.", "The brief is still empty. Adding the problem, what you are making, and who it is for takes a couple of minutes and is what makes people want to help.")
                      : tx(locale, "Ringkasan proyek belum ditulis. Tautan proyek adalah tempat terbaik untuk mulai melihatnya.", "The brief has not been written yet. What the project links to is the best place to start.")}
                    {isOwner ? (
                      <>
                        {" "}
                        <Link href={`/projects/${project.slug}/edit`}>{tx(locale, "Tulis ringkasan", "Write the brief")}</Link>
                      </>
                    ) : null}
                  </p>
                ) : null}
                {isGitHubRepositoryUrl(project.repoUrl) ? (
                  <article className="github-contribution">
                    <h3>{tx(locale, "Ingin membantu lewat kode?", "Want to help with code?")}</h3>
                    <p>
                      {tx(locale, "Lihat panduan kontribusi, issue terbuka, atau buat pull request langsung dari repositori GitHub proyek ini.", "View the contribution guide, open issues, or open a pull request directly from this project’s GitHub repository.")}
                    </p>
                    <a href={project.repoUrl} target="_blank" rel="noreferrer">
                      {tx(locale, "Berkontribusi di GitHub", "Contribute on GitHub")} <Arrow diagonal />
                    </a>
                  </article>
                ) : null}
              </section>
            </ProjectTabContent>

            {/* Right under the story, because "what are they doing about it"
                is the next question anybody has — and the answer is what makes
                the project look alive rather than parked. */}
            <ProjectTabContent tab="about">
              <section className="now-card" aria-labelledby="now-heading">
              <h2 id="now-heading">{tx(locale, "Sedang dikerjakan", "Work in progress")}</h2>

              {project.nowText ? (
                <>
                  <p className="now-headline">{project.nowText}</p>
                  {project.nowUpdatedAt ? (
                    <p className="now-when">{tx(locale, "Ditulis", "Written")} <RelativeTime value={project.nowUpdatedAt} locale={locale} /></p>
                  ) : null}
                </>
              ) : (
                <p className="muted">
                  {tx(locale, "Belum ada yang ditulis.", "Nothing has been written yet.")}
                  {isManager ? tx(locale, " Satu kalimat sudah cukup untuk menunjukkan bahwa proyek ini aktif.", " One sentence is enough to make this project feel active.") : ""}
                </p>
              )}

              {isManager ? (
                <details className="owner-tool">
                  <summary>{project.nowText ? tx(locale, "Perbarui", "Update") : tx(locale, "Tulis apa yang sedang dikerjakan", "Write what you are working on")}</summary>
                  <form action={setNow}>
                    <input type="hidden" name="slug" value={project.slug} />
                    <label htmlFor="now-text">{tx(locale, "Sedang dikerjakan…", "Working on now…")}</label>
                    <input
                      id="now-text"
                      name="now"
                      type="text"
                      maxLength={MAXIMUM.now}
                      defaultValue={project.nowText}
                      placeholder={tx(locale, "Menyusun draf materi keselamatan pertama.", "Drafting the first safety materials.")}
                    />
                    <p className="hint">
                      {tx(locale, "Cukup satu kalimat—perbarui saat arahnya berubah. Dari sinilah orang tahu bahwa proyek masih bergerak.", "One sentence—update it whenever the direction changes. This is how people know the project is still moving.")}
                    </p>
                    <SubmitButton pendingLabel={tx(locale, "Menyimpan…", "Saving…")}>{tx(locale, "Simpan", "Save")}</SubmitButton>
                  </form>
                </details>
              ) : null}
              </section>
            </ProjectTabContent>

            {/* Contribution details live together in their own tab. */}
            <ProjectTabContent tab="collaboration">
              {(open.length > 0 || isManager) && (
                <section className="help" aria-labelledby="help-heading">
                <h2 id="help-heading">{tx(locale, "Ingin membantu?", "Want to help?")}</h2>

                {open.length > 0 ? (
                  <ul className="seat-list">
                    {open.map((seat) => (
                      <li key={seat.id}>
                        <div>
                          <h3>{roleLabel(seat.role, seat.roleTitle, locale)}</h3>
                          <p>{seat.brief}</p>
                          {seat.commitment ? (
                            <p className="seat-commitment">{seat.commitment}</p>
                          ) : null}
                        </div>
                        <div className="seat-actions">
                          {isOwner ? (
                            <p className="muted">{tx(locale, "Menunggu seseorang bergabung.", "Waiting for someone to join.")}</p>
                          ) : viewer ? (
                            viewerSeat ? (
                              <p className="muted">
                                {viewerSeat.status === "filled"
                                  ? tx(locale, `Kamu sudah berada di tim ini sebagai ${roleLabel(viewerSeat.role, viewerSeat.roleTitle, locale)}.`, `You are already on this team as ${roleLabel(viewerSeat.role, viewerSeat.roleTitle, locale)}.`)
                                  : tx(locale, "Kamu sudah mendaftar ke proyek ini.", "You have already applied to this project.")}
                              </p>
                            ) : !canPropose ? (
                              <p className="muted">
                                {tx(locale, "Lengkapi profil talent pool untuk mendaftar ke peran ini.", "Complete your talent-pool profile to apply for this role.")} {" "}
                                <Link href={profileReturnTo}>{tx(locale, "Lengkapi profil", "Complete your profile")}</Link>
                              </p>
                            ) : (
                              proposalsForSeat(seat.id).some((proposal) => proposal.person.id === viewer.id && proposal.status === "pending") ? (
                                <p className="muted">{tx(locale, "Proposalmu sedang menunggu tanggapan.", "Your proposal is awaiting a response.")}</p>
                              ) : (
                                <details>
                                  <summary>{tx(locale, "Daftar untuk peran ini", "Apply for this role")}</summary>
                                  <form action={submitProposal}>
                                  <input type="hidden" name="slug" value={project.slug} />
                                  <input type="hidden" name="seatId" value={seat.id} />
                                  <label htmlFor={`pitch-${seat.id}`}>
                                    {tx(locale, "Ceritakan mengapa kamu cocok dan berapa banyak waktu yang dapat kamu kontribusikan.", "Tell us why you are a good fit and how much time you can contribute.")}
                                  </label>
                                  <textarea
                                    id={`pitch-${seat.id}`}
                                    name="pitch"
                                    rows={4}
                                    required
                                    placeholder={tx(locale, "Contoh: Saya pernah membantu riset serupa dan dapat berkontribusi tiga jam per minggu.", "For example: I have helped with similar research and can contribute three hours per week.")}
                                  />
                                    <SubmitButton pendingLabel={tx(locale, "Mengirim…", "Sending…")}>{tx(locale, "Kirim proposal", "Send proposal")}</SubmitButton>
                                  </form>
                                </details>
                              )
                            )
                          ) : (
                            <Link className="ghost-button" href={signInPath(returnTo)}>
                              {tx(locale, "Masuk untuk bergabung", "Sign in to join")}
                            </Link>
                          )}
                          {isManager ? (
                            <form action={closeSeat}>
                              <input type="hidden" name="slug" value={project.slug} />
                              <input type="hidden" name="seatId" value={seat.id} />
                              <SubmitButton className="quiet" pendingLabel={tx(locale, "Menutup…", "Closing…")}>
                                {tx(locale, "Tutup peran", "Close role")}
                              </SubmitButton>
                            </form>
                          ) : null}
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="muted">
                    {tx(locale, "Belum ada bantuan yang diminta.", "No help is being requested yet.")}
                    {isManager ? tx(locale, " Buka peran di bawah jika ada pekerjaan yang dapat dibagikan.", " Open a role below if there is work to share.") : ""}
                  </p>
                )}

                {isManager && proposals.filter((proposal) => proposal.seatId && proposal.status === "pending").length > 0 ? (
                  <div className="pending-list">
                    <h3>{tx(locale, "Proposal peran yang menunggu", "Pending role proposals")}</h3>
                    {awaitingDecision.flatMap((seat) => proposalsForSeat(seat.id)
                      .filter((proposal) => proposal.status === "pending")
                      .map((proposal) => (
                        <article key={proposal.id} className="pending-card">
                          <p><strong>{proposal.person.name}</strong> {tx(locale, "ingin membantu sebagai", "wants to help as")} {roleLabel(seat.role, seat.roleTitle, locale)}</p>
                          <blockquote>{proposal.pitch}</blockquote>
                          <form action={decideProposal}>
                            <input type="hidden" name="slug" value={project.slug} />
                            <input type="hidden" name="proposalId" value={proposal.id} />
                            <SubmitButton name="decision" value="terima" pendingLabel={tx(locale, "Mohon tunggu…", "Please wait…")}>{tx(locale, "Terima", "Accept")}</SubmitButton>
                            <SubmitButton className="quiet" name="decision" value="tolak">{tx(locale, "Tolak", "Decline")}</SubmitButton>
                          </form>
                        </article>
                      )))}
                  </div>
                ) : null}

                {isManager ? (
                  <details className="owner-tool">
                    <summary>{tx(locale, "Cari bantuan baru", "Find new help")}</summary>
                    <form action={openSeat}>
                      <input type="hidden" name="slug" value={project.slug} />
                      <RoleFields id="new-seat-role" />
                      <label htmlFor="new-seat-brief">{tx(locale, "Bagian yang membutuhkan bantuan", "What needs help")}</label>
                      <textarea id="new-seat-brief" name="brief" rows={3} required />
                      <CommitmentField
                        id="new-seat-commitment"
                        name="commitment"
                      />
                      <SubmitButton pendingLabel={tx(locale, "Membuka…", "Opening…")}>{tx(locale, "Buka peran", "Open role")}</SubmitButton>
                    </form>
                  </details>
                ) : null}
                </section>
              )}
            </ProjectTabContent>

            <ProjectTabContent tab="journey">
              <section className="journey-section" aria-labelledby="journey-heading">
              <h2 id="journey-heading">{tx(locale, "Perjalanan proyek", "Project journey")}</h2>
              <p className="muted">{tx(locale, "Ditulis oleh orang-orang yang mengerjakannya, dari yang terbaru.", "Written by the people working on it, newest first.")}</p>

              <JourneyList
                updates={project.updates}
                startedAt={project.createdAt}
                slug={project.slug}
                onDelete={
                  isManager
                    ? (update) => (
                        <form className="journey-remove" action={deleteUpdate}>
                          <input type="hidden" name="slug" value={project.slug} />
                          <input type="hidden" name="updateId" value={update.id} />
                          <SubmitButton className="quiet">{tx(locale, "Hapus", "Delete")}</SubmitButton>
                        </form>
                      )
                    : undefined
                }
              />

              {isManager ? (
                <details className="owner-tool">
                  <summary>{tx(locale, "Tulis kabar terbaru", "Write an update")}</summary>
                  <form action={postUpdate}>
                    <input type="hidden" name="slug" value={project.slug} />
                    <label htmlFor="update-title">{tx(locale, "Apa kabar terbarunya?", "What is the update?")}</label>
                    <input
                      id="update-title"
                      name="title"
                      type="text"
                      required
                      minLength={UPDATE_LIMITS.title.min}
                      maxLength={UPDATE_LIMITS.title.max}
                      placeholder={tx(locale, "Draf materi pertama selesai", "First materials draft completed")}
                    />
                    <label htmlFor="update-body">{tx(locale, "Detail", "Details")}</label>
                    <textarea
                      id="update-body"
                      name="body"
                      rows={4}
                      maxLength={UPDATE_LIMITS.body.max}
                      placeholder={tx(locale, "Apa yang berubah, apa yang dipelajari, dan apa langkah berikutnya?", "What changed, what did you learn, and what comes next?")}
                    />
                    <SubmitButton pendingLabel={tx(locale, "Mengirim…", "Sending…")}>{tx(locale, "Kirim kabar terbaru", "Post update")}</SubmitButton>
                  </form>
                </details>
              ) : null}
              </section>
            </ProjectTabContent>

            <ProjectTabContent tab="collaboration">
              <section className="team" aria-labelledby="team-heading">
              <h2 id="team-heading">{tx(locale, "Orang-orang di balik proyek", "People behind the project")}</h2>

              <ul className="member-list">
                <li>
                  <span className="avatar" aria-hidden="true">
                    {initials(project.owner.name)}
                  </span>
                  <span>
                    <strong>
                      <Link href={`/u/${project.owner.username}`}>{project.owner.name}</Link>
                    </strong>
                    <small>{tx(locale, "Memulai proyek", "Started it")}</small>
                  </span>
                </li>
                {team.map((seat) => (
                  <li key={seat.id}>
                    <span className="avatar" aria-hidden="true">
                      {initials(seat.person?.name ?? "?")}
                    </span>
                    <span>
                      <strong>
                        {seat.person ? (
                          <Link href={`/u/${seat.person.username}`}>{seat.person.name}</Link>
                        ) : (
                          tx(locale, "Tanpa nama", "Unnamed")
                        )}
                      </strong>
                      <small>
                        {roleLabel(seat.role, seat.roleTitle, locale)}
                        {seat.access === "admin" ? <span className="access-badge">admin</span> : null}
                      </small>
                    </span>
                  </li>
                ))}
              </ul>

              {isOwner && team.length > 0 ? (
                <details className="owner-tool">
                  <summary>{tx(locale, "Kelola akses", "Manage access")}</summary>
                  <p className="hint">
                    {tx(locale, "Admin dapat mengelola tugas, mencari bantuan, menanggapi pendaftar, dan menulis kabar terbaru. Ringkasan, tahap, dan penghapusan proyek tetap hanya dapat kamu kelola.", "Admins can manage tasks, seek help, respond to applicants, and write updates. The brief, stage, and project deletion remain yours alone.")}
                  </p>
                  {team.map((seat) => (
                    <form className="access-form" action={setSeatAccess} key={seat.id}>
                      <input type="hidden" name="slug" value={project.slug} />
                      <input type="hidden" name="seatId" value={seat.id} />
                      <span>{seat.person?.name ?? tx(locale, "Tanpa nama", "Unnamed")}</span>
                      <SubmitButton
                        name="access"
                        value={seat.access === "admin" ? "member" : "admin"}
                        className={seat.access === "admin" ? "quiet" : ""}
                      >
                        {seat.access === "admin" ? tx(locale, "Jadikan anggota", "Make member") : tx(locale, "Jadikan admin", "Make admin")}
                      </SubmitButton>
                    </form>
                  ))}
                </details>
              ) : null}
              </section>
            </ProjectTabContent>

            {/* The task list is for the people already working on it. */}
            <ProjectTabContent tab="tasks">
              <section className="tasks" aria-labelledby="tasks-heading">
                <h2 id="tasks-heading">
                  {tx(locale, "Tugas", "Tasks")}
                  {project.tasks.length > 0 ? tx(locale, ` (${doneTasks} dari ${project.tasks.length} selesai)`, ` (${doneTasks} of ${project.tasks.length} complete)`) : ""}
                </h2>

                {project.tasks.length === 0 ? (
                  <p className="muted">
                    {tx(locale, "Belum ada tugas di sini.", "There are no tasks here yet.")}
                    {isManager ? tx(locale, " Tambahkan satu agar orang tahu apa yang sedang dikerjakan.", " Add one so people know what is in progress.") : ""}
                  </p>
                ) : (
                  TASK_ORDER.map((status) => {
                    const items = project.tasks.filter((task) => task.status === status);
                    if (items.length === 0) return null;

                    return (
                      <div className="task-group" key={status}>
                        <h3>{taskStatusLabel(status, locale)}</h3>
                        <ul className="task-list">
                          {items.map((task) => {
                            const mine = Boolean(viewer && task.assignee?.id === viewer.id);

                            return (
                              <li key={task.id} className={status === "done" ? "is-done" : ""}>
                                <div>
                                  <h4>{task.title}</h4>
                                  {task.detail ? <p className="muted">{task.detail}</p> : null}
                                  {task.role ? (
                                    <p className="task-role">{tx(locale, "Peran terkait", "Related role")}: {roleLabel(task.role.role, task.role.roleTitle, locale)}</p>
                                  ) : null}
                                  <p className="task-holder">
                                    {task.assignee ? (
                                      <>
                                        <span className="avatar" aria-hidden="true">
                                          {initials(task.assignee.name)}
                                        </span>
                                        <Link href={`/u/${task.assignee.username}`}>
                                          {task.assignee.name}
                                        </Link>
                                      </>
                                    ) : (
                                      <span className="muted">{tx(locale, "Belum ada yang mengambilnya", "Nobody has taken it yet")}</span>
                                    )}
                                  </p>

                                  {isManager ? (
                                    <form className="task-manage" action={assignTask}>
                                      <input type="hidden" name="slug" value={project.slug} />
                                      <input type="hidden" name="taskId" value={task.id} />
                                      <label className="sr-only" htmlFor={`assignee-${task.id}`}>
                                        {tx(locale, `Orang yang ditugaskan untuk ${task.title}`, `Who is assigned to ${task.title}`)}
                                      </label>
                                      <select
                                        id={`assignee-${task.id}`}
                                        name="assigneeId"
                                        defaultValue={task.assignee?.id ?? ""}
                                      >
                                        <option value="">{tx(locale, "Belum ada yang mengambilnya", "Nobody has taken it yet")}</option>
                                        {assignable.map((person) => (
                                          <option key={person.id} value={person.id}>
                                            {person.name}
                                          </option>
                                        ))}
                                      </select>
                                      <SubmitButton pendingLabel={tx(locale, "Mohon tunggu…", "Please wait…")}>{tx(locale, "Simpan", "Save")}</SubmitButton>
                                      <label className="sr-only" htmlFor={`task-role-${task.id}`}>
                                        {tx(locale, `Peran terkait untuk ${task.title}`, `Related role for ${task.title}`)}
                                      </label>
                                      <select id={`task-role-${task.id}`} name="seatId" defaultValue={task.role?.id ?? ""}>
                                        <option value="">{tx(locale, "Tidak ada peran terkait", "No related role")}</option>
                                        {project.seats.map((seat) => (
                                          <option key={seat.id} value={seat.id}>
                                            {roleLabel(seat.role, seat.roleTitle, locale)}
                                          </option>
                                        ))}
                                      </select>
                                      <SubmitButton className="quiet" formAction={setTaskRole}>{tx(locale, "Simpan peran", "Save role")}</SubmitButton>
                                      <SubmitButton className="quiet" formAction={deleteTask}>
                                        {tx(locale, "Hapus", "Delete")}
                                      </SubmitButton>
                                    </form>
                                  ) : null}

                                  {!isManager && !task.assignee && task.status !== "done" ? (
                                    !viewer ? (
                                      <Link className="ghost-button" href={signInPath(returnTo)}>{tx(locale, "Masuk untuk mendaftar ke tugas ini", "Sign in to apply for this task")}</Link>
                                    ) : !canPropose ? (
                                      <p className="muted">
                                        {tx(locale, "Lengkapi profil talent pool untuk mendaftar ke tugas ini.", "Complete your talent-pool profile to apply for this task.")} {" "}
                                        <Link href={profileReturnTo}>{tx(locale, "Lengkapi profil", "Complete your profile")}</Link>
                                      </p>
                                    ) : proposalsForTask(task.id).some((proposal) => proposal.person.id === viewer.id && proposal.status === "pending") ? (
                                      <p className="muted">{tx(locale, "Proposalmu sedang menunggu tanggapan.", "Your proposal is awaiting a response.")}</p>
                                    ) : (
                                      <details className="task-proposal">
                                        <summary>{tx(locale, "Daftar untuk mengerjakan ini", "Apply to work on this")}</summary>
                                        <form action={submitProposal}>
                                          <input type="hidden" name="slug" value={project.slug} />
                                          <input type="hidden" name="taskId" value={task.id} />
                                          <label htmlFor={`task-pitch-${task.id}`}>{tx(locale, "Mengapa kamu cocok mengerjakan ini?", "Why are you a good fit for this?")}</label>
                                          <textarea id={`task-pitch-${task.id}`} name="pitch" rows={3} required />
                                          <SubmitButton pendingLabel={tx(locale, "Mengirim…", "Sending…")}>{tx(locale, "Kirim proposal", "Send proposal")}</SubmitButton>
                                        </form>
                                      </details>
                                    )
                                  ) : null}

                                  {isManager && proposalsForTask(task.id).filter((proposal) => proposal.status === "pending").length > 0 ? (
                                    <div className="pending-list task-proposal-list">
                                      <h4>{tx(locale, "Proposal untuk tugas ini", "Proposals for this task")}</h4>
                                      {proposalsForTask(task.id).filter((proposal) => proposal.status === "pending").map((proposal) => (
                                        <article key={proposal.id} className="pending-card">
                                          <p><strong>{proposal.person.name}</strong> {tx(locale, "ingin mengerjakan tugas ini.", "wants to work on this task.")}</p>
                                          <blockquote>{proposal.pitch}</blockquote>
                                          <form action={decideProposal}>
                                            <input type="hidden" name="slug" value={project.slug} />
                                            <input type="hidden" name="proposalId" value={proposal.id} />
                                            <SubmitButton name="decision" value="terima" pendingLabel={tx(locale, "Mohon tunggu…", "Please wait…")}>{tx(locale, "Terima", "Accept")}</SubmitButton>
                                            <SubmitButton className="quiet" name="decision" value="tolak">{tx(locale, "Tolak", "Decline")}</SubmitButton>
                                          </form>
                                        </article>
                                      ))}
                                    </div>
                                  ) : null}
                                </div>

                                <div className="task-side">
                                  <span className={`task-status ${taskStatusTone(task.status)}`}>
                                    {taskStatusLabel(task.status, locale)}
                                  </span>

                                  {mine || isManager ? (
                                    <form className="task-move" action={moveTask}>
                                      <input type="hidden" name="slug" value={project.slug} />
                                      <input type="hidden" name="taskId" value={task.id} />
                                      {TASK_STATUSES.map((next) => (
                                        <SubmitButton
                                          key={next}
                                          name="status"
                                          value={next}
                                          disabled={next === task.status}
                                          title={taskStatusBlurb(next, locale)}
                                        >
                                          {taskStatusLabel(next, locale)}
                                        </SubmitButton>
                                      ))}
                                    </form>
                                  ) : null}
                                </div>
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                    );
                  })
                )}

                {isManager ? (
                  <details className="owner-tool">
                    <summary>{tx(locale, "Tambahkan tugas", "Add task")}</summary>
                    <form action={createTask}>
                      <input type="hidden" name="slug" value={project.slug} />
                      <label htmlFor="task-title">{tx(locale, "Judul tugas", "Task title")}</label>
                      <input id="task-title" name="title" type="text" required maxLength={120} />
                      <label htmlFor="task-detail">{tx(locale, "Deskripsi singkat", "Short description")}</label>
                      <textarea id="task-detail" name="detail" rows={2} maxLength={400} />
                      <label htmlFor="task-role">{tx(locale, "Peran terkait (opsional)", "Related role (optional)")}</label>
                      <select id="task-role" name="seatId" defaultValue="">
                        <option value="">{tx(locale, "Tidak terhubung ke peran", "Not linked to a role")}</option>
                        {project.seats.map((seat) => (
                          <option key={seat.id} value={seat.id}>
                            {roleLabel(seat.role, seat.roleTitle, locale)}{seat.status === "open" ? tx(locale, " · terbuka", " · open") : ""}
                          </option>
                        ))}
                      </select>
                      <label htmlFor="task-assignee">{tx(locale, "Penanggung jawab", "Assignee")}</label>
                      <select id="task-assignee" name="assigneeId" defaultValue="">
                        <option value="">{tx(locale, "Belum ada yang mengambilnya", "Nobody has taken it yet")}</option>
                        {assignable.map((person) => (
                          <option key={person.id} value={person.id}>
                            {person.name}
                          </option>
                        ))}
                      </select>
                      <SubmitButton pendingLabel={tx(locale, "Menambahkan…", "Adding…")}>{tx(locale, "Tambahkan tugas", "Add task")}</SubmitButton>
                    </form>
                  </details>
                ) : null}
              </section>
            </ProjectTabContent>

            <ProjectTabContent tab="discussion">
              <section className="discussion" aria-labelledby="discussion-heading">
              <h2 id="discussion-heading">{tx(locale, "Diskusi", "Discussion")} ({project.comments.length})</h2>

              {viewer ? (
                <form className="comment-form" action={addComment}>
                  <input type="hidden" name="slug" value={project.slug} />
                  <label htmlFor="comment-body">{tx(locale, "Komentar atau pertanyaan", "Comment or question")}</label>
                  <textarea
                    id="comment-body"
                    name="body"
                    rows={4}
                    required
                    placeholder={tx(locale, "Bagian mana yang terasa paling berisiko? Apakah ada cara yang lebih sederhana?", "Which part feels most risky? Is there a simpler way?")}
                  />
                  <SubmitButton pendingLabel={tx(locale, "Mengirim…", "Sending…")}>{tx(locale, "Kirim", "Send")}</SubmitButton>
                </form>
              ) : (
                <p className="muted">
                  <Link href={signInPath(returnTo)}>{tx(locale, "Masuk", "Sign in")}</Link> {tx(locale, "untuk bergabung dalam diskusi proyek ini.", "to join this project’s discussion.")}
                </p>
              )}

              {project.comments.length === 0 ? (
                <p className="muted">{tx(locale, "Belum ada komentar. Silakan mulai percakapan.", "No comments yet. Feel free to start the conversation.")}</p>
              ) : (
                <ul className="comment-list">
                  {project.comments.map((comment) => (
                    <li key={comment.id}>
                      <div className="comment-head">
                        <span className="avatar" aria-hidden="true">
                          {initials(comment.author.name)}
                        </span>
                        <Link href={`/u/${comment.author.username}`}>{comment.author.name}</Link>
                        <small><RelativeTime value={comment.createdAt} locale={locale} /></small>
                      </div>
                      <p>{comment.body}</p>
                    </li>
                  ))}
                </ul>
              )}
              </section>
            </ProjectTabContent>

            <ProjectTabContent tab="journey">
              {history.length > 0 ? (
                <section className="history" aria-labelledby="history-heading">
                  <h2 id="history-heading">{tx(locale, "Catatan sistem", "System record")}</h2>
                  <p className="muted">
                    {tx(locale, "Dicatat oleh sistem saat kejadian berlangsung—bukan diketik belakangan. Catatan ini melengkapi perjalanan di atas.", "Recorded by the system when it happened—not typed in later. It complements the journey above.")}
                  </p>
                  <ActivityList events={history} showActor />
                </section>
              ) : null}
            </ProjectTabContent>
          </div>

          <aside className="project-side">
            <section className="level-card">
              <h2>{tx(locale, "Sejauh ini", "So far")}</h2>
              <RungRail stage={project.stage} />

              <h3>{tx(locale, "Syarat untuk tahap ini", "Requirements for this stage")}</h3>
              <ul className="requirement-list">
                {requirementsFor(project.stage, stageInput, locale).map((requirement) => (
                  <li key={requirement.label} className={requirement.met ? "met" : ""}>
                    <span aria-hidden="true">{requirement.met ? "✓" : "○"}</span>
                    {requirement.label}
                  </li>
                ))}
              </ul>

              {isOwner ? (
                <form className="stage-form" action={setStage}>
                  <input type="hidden" name="slug" value={project.slug} />
                  <h3>{tx(locale, "Ubah tahap", "Change stage")}</h3>
                  <div className="stage-buttons">
                    {STAGES.filter((stage) => stage !== project.stage).map((stage) => {
                      const allowed = meetsStage(stage, stageInput);
                      return (
                        <SubmitButton
                          key={stage}
                          name="stage"
                          value={stage}
                          disabled={!allowed}
                          title={
                            allowed
                              ? stageBlurb(stage, locale)
                              : tx(locale, "Syarat untuk tahap ini belum terpenuhi.", "The requirements for this stage are not met yet.")
                          }
                        >
                          {stageLabel(stage, locale)}
                        </SubmitButton>
                      );
                    })}
                  </div>
                </form>
              ) : null}
            </section>
          </aside>
        </ProjectTabSwitcher>
      </main>

      <SiteFooter />
    </>
  );
}

function toStageInput(project: ProjectDetail): StageInput {
  return {
    nowText: project.nowText,
    docUrl: project.docUrl,
    repoUrl: project.repoUrl,
    liveUrl: project.liveUrl,
  };
}
