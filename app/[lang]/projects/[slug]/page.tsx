import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "@/app/components/responsive-link";
import { closeSeat, openSeat } from "../../../actions";
import { waOfferHelpUrl } from "../../../content";
import { SubmitButton } from "../../../components/submit-button";
import { SiteFooter, SiteHeader, Arrow } from "../../../components/shell";
import { TagRow, initials } from "../../../components/pieces";
import { domainOf, projectBlurb } from "../../../lib/brief";
import { getProject, listProjects } from "../../../lib/data";
import { roleLabel } from "../../../lib/roles";
import { CommitmentField } from "../../../components/commitment-field";
import { RoleFields } from "../../../components/role-fields";
import { accessOf, canManage } from "../../../lib/access";
import { currentViewer } from "../../../lib/session";
import { ProjectLogo } from "../../../components/project-logo";
import { parseGitHubRepositoryUrl } from "../../../lib/github";
import { ossUrl } from "../../../lib/site";
import { currentLocale } from "../../../lib/locale-server";
import { tx, type Locale } from "../../../lib/locale";

type Params = Promise<{ slug: string }>;

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
    console.warn("[builders] Project detail was not prerendered:", error);
    return [];
  }
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const [{ slug }, locale] = await Promise.all([params, currentLocale()]);
  const project = await getProject(slug);
  if (!project) return { title: tx(locale, "Proyek tidak ditemukan — Builders", "Project not found — Builders") };

  return {
    title: `${project.title} — Builders`,
    // What it is doing now says more than what it is, when there is one.
    description: project.nowText || projectBlurb(project),
    alternates: { canonical: `/projects/${project.slug}` },
    // The card image comes from opengraph-image.tsx beside this file.
    openGraph: {
      type: "article",
      title: `${project.title} — Builders`,
      description: project.nowText || projectBlurb(project),
      url: `/projects/${project.slug}`,
    },
  };
}

/**
 * A product's page, cut down to what somebody deciding whether to help needs:
 * what it is, who is behind it, and the roles it is asking for.
 *
 * For now an offer to help goes to the SWE Growth admin on WhatsApp, the
 * message already naming the project and the role, rather than through
 * proposals here — so follows, support, the journey, tasks and discussion are
 * left off. The owner keeps opening and closing roles, which is what the list
 * is built from. Old links with `?tab=…` simply land on this one page; the
 * roles keep their `#help-heading` anchor.
 */
export default async function ProjectPage({ params }: { params: Params }) {
  const { slug } = await params;
  // The project and the visitor are independent questions — ask them together.
  const [project, viewer, locale] = await Promise.all([getProject(slug), currentViewer(), currentLocale()]);
  if (!project) notFound();

  const access = accessOf(viewer?.id, project.owner.id, project.seats);
  const isOwner = access === "owner";
  const isManager = canManage(access);
  const open = project.seats.filter((seat) => seat.status === "open");

  return (
    <>
      <SiteHeader returnTo={`/projects/${project.slug}`} />

      <main id="main-content" className="project-page">
        <div className="breadcrumb breadcrumb-row">
          <p>
            <Link href="/directory?track=role">{tx(locale, "Direktori", "Directory")}</Link> <span aria-hidden="true">/</span> {project.title}
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
            </div>
            <h1>{project.title}</h1>
            <p className="project-tagline">{projectBlurb(project)}</p>
            <TagRow tags={project.tags} />

            <div className="project-hero-meta">
              <Link className="card-owner" href={`/u/${project.owner.username}`}>
                <span className="avatar" aria-hidden="true">
                  {initials(project.owner.name)}
                </span>
                <span>
                  <strong>{project.owner.name}</strong>
                  <small>{tx(locale, "Pemilik proyek", "Project owner")}</small>
                </span>
              </Link>
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
                    <RepositoryLink repoUrl={project.repoUrl} locale={locale} />
                  </li>
                ) : null}
              </ul>
            )}
          </div>
        </section>

        <div className="project-main project-simple">
          <section className="brief" aria-labelledby="brief-heading">
            <h2 id="brief-heading">{tx(locale, "Tentang proyek ini", "About this project")}</h2>

            {/* The owner's own words come first: on a project added as a
                link this is the whole of what a person wrote. */}
            {project.highlight ? <p className="brief-highlight">{project.highlight}</p> : null}
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
            {!project.highlight && !project.problem && !project.solution && !project.audience ? (
              <p className="brief-empty">
                {isOwner
                  ? tx(locale, "Ringkasan proyek masih kosong. Menambahkan masalah, apa yang kamu buat, dan siapa sasarannya membantu orang tertarik untuk berkontribusi.", "The brief is still empty. Adding the problem, what you are making, and who it is for is what makes people want to help.")
                  : tx(locale, "Ringkasan proyek belum ditulis. Tautan proyek adalah tempat terbaik untuk mulai melihatnya.", "The brief has not been written yet. What the project links to is the best place to start.")}
                {isOwner ? (
                  <>
                    {" "}
                    <Link href={`/projects/${project.slug}/edit`}>{tx(locale, "Tulis ringkasan", "Write the brief")}</Link>
                  </>
                ) : null}
              </p>
            ) : null}
          </section>

          <section className="help" aria-labelledby="help-heading">
            <h2 id="help-heading">{tx(locale, "Peran yang dicari", "Roles wanted")}</h2>

            {open.length > 0 ? (
              <ul className="seat-list">
                {open.map((seat) => {
                  const role = roleLabel(seat.role, seat.roleTitle, locale);
                  return (
                    <li key={seat.id}>
                      <div>
                        <h3>{role}</h3>
                        <p>{seat.brief}</p>
                        {seat.commitment ? <p className="seat-commitment">{seat.commitment}</p> : null}
                      </div>
                      <div className="seat-actions">
                        <a
                          className="primary-button seat-offer"
                          href={waOfferHelpUrl(project.title, roleLabel(seat.role, seat.roleTitle, "id"))}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          {tx(locale, "Tawarkan bantuan", "Offer to help")} <Arrow diagonal />
                        </a>
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
                  );
                })}
              </ul>
            ) : (
              <p className="muted">
                {tx(locale, "Belum ada peran yang dibuka.", "No roles are open yet.")}
                {isManager ? tx(locale, " Buka peran di bawah jika ada pekerjaan yang dapat dibagikan.", " Open a role below if there is work to share.") : ""}
              </p>
            )}

            {open.length > 0 ? (
              <p className="seat-offer-note">
                {tx(locale, "Tombol di atas membuka WhatsApp Admin SWE Growth dengan pesan yang sudah terisi.", "The button opens WhatsApp with the SWE Growth admin, the message already written.")}
              </p>
            ) : null}

            {isManager ? (
              <details className="owner-tool">
                <summary>{tx(locale, "Cari bantuan baru", "Find new help")}</summary>
                <form action={openSeat}>
                  <input type="hidden" name="slug" value={project.slug} />
                  <RoleFields id="new-seat-role" />
                  <label htmlFor="new-seat-brief">{tx(locale, "Bagian yang membutuhkan bantuan", "What needs help")}</label>
                  <textarea id="new-seat-brief" name="brief" rows={3} required />
                  <CommitmentField id="new-seat-commitment" name="commitment" />
                  <SubmitButton pendingLabel={tx(locale, "Membuka…", "Opening…")}>{tx(locale, "Buka peran", "Open role")}</SubmitButton>
                </form>
              </details>
            ) : null}
          </section>
        </div>
      </main>

      <SiteFooter />
    </>
  );
}

/**
 * A product's repository. Code contributions are the open source site's, so a
 * GitHub repository is shown there, where its card and its starter issues are,
 * rather than here; any other host is just a link.
 */
function RepositoryLink({ repoUrl, locale }: { repoUrl: string; locale: Locale }) {
  const repository = parseGitHubRepositoryUrl(repoUrl);
  if (!repository) {
    return (
      <a href={repoUrl} target="_blank" rel="noreferrer">
        {tx(locale, "Repositori", "Repository")} <Arrow diagonal />
      </a>
    );
  }
  return (
    <a href={ossUrl(`/?q=${encodeURIComponent(`${repository.owner}/${repository.repo}`)}`)} target="_blank" rel="noreferrer">
      {tx(locale, "Kontribusi kode di oss.swegrowth.id", "Contribute code on oss.swegrowth.id")} <Arrow diagonal />
    </a>
  );
}
