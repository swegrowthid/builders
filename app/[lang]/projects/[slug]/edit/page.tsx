import type { Metadata } from "next";
import Link from "@/app/components/responsive-link";
import { notFound, redirect } from "next/navigation";
import { deleteProject } from "../../../../actions";
import { SiteFooter, SiteHeader } from "../../../../components/shell";
import { SubmitButton } from "../../../../components/submit-button";
import { EditForm } from "../../../../components/edit-form";
import { getProject } from "../../../../lib/data";
import { currentViewer } from "../../../../lib/session";
import { signInPath } from "../../../../lib/urls";
import { stageLabel } from "../../../../lib/stages";
import { currentLocale } from "../../../../lib/locale-server";
import { tx } from "../../../../lib/locale";

/*
 * Allowed to block.
 *
 * This page decides what to render — or whether to redirect — from who is
 * signed in, and there is no useful shell to show before that answer arrives:
 * a visitor who is about to be sent elsewhere should not watch this page paint
 * first. Nothing here is cacheable and nothing here is indexed, so blocking on
 * the session costs a request that was always going to be per-visitor.
 */
export const instant = false;

export async function generateMetadata(): Promise<Metadata> {
  const locale = await currentLocale();
  return {
    title: tx(locale, "Edit proyek — Builders", "Edit project — Builders"),
    robots: { index: false },
  };
}

type Params = Promise<{ slug: string }>;

export default async function EditProjectPage({ params }: { params: Params }) {
  const { slug } = await params;
  const [project, viewer, locale] = await Promise.all([getProject(slug), currentViewer(), currentLocale()]);
  if (!project) notFound();

  if (!viewer) redirect(signInPath(`/projects/${slug}/edit`));

  // Someone else's project is not theirs to edit, and not theirs to know about
  // either — same answer as a project that does not exist.
  if (viewer.id !== project.owner.id) notFound();

  return (
    <>
      <SiteHeader returnTo={`/projects/${slug}/edit`} />

      <main id="main-content" className="page-narrow">
        <p className="breadcrumb">
          <Link href={`/projects/${project.slug}`}>{project.title}</Link>{" "}
          <span aria-hidden="true">/</span> {tx(locale, "Edit", "Edit")}
        </p>

        <p className="eyebrow">
          <span /> {tx(locale, "Edit proyek", "Edit project")}
        </p>
        <h1>{project.title}</h1>
        <p className="lede">
          {tx(locale, "Alamatnya tetap", "Its address remains")} <code>/projects/{project.slug}</code>, {tx(locale, "sehingga tautan yang sudah kamu bagikan tetap berfungsi. Tahap saat ini:", "so links you have already shared keep working. Current stage:")} <strong>{stageLabel(project.stage, locale)}</strong>.
        </p>

        <EditForm
          project={{
            slug: project.slug,
            title: project.title,
            tagline: project.tagline,
            highlight: project.highlight,
            problem: project.problem,
            solution: project.solution,
            audience: project.audience,
            tags: project.tags,
            projectType: project.projectType,
            nowText: project.nowText,
            docUrl: project.docUrl,
            repoUrl: project.repoUrl,
            openForGitHubContributions: project.openForGitHubContributions,
            liveUrl: project.liveUrl,
            logoUrl: project.logoUrl,
            stage: project.stage,
          }}
        />

        <section className="danger-zone">
          <h2>{tx(locale, "Hapus proyek", "Delete project")}</h2>
          <p>
            {tx(locale, "Tindakan ini permanen. Diskusi, pengajuan, dan dukungannya juga akan dihapus tanpa dapat dipulihkan. Jika pekerjaan hanya dijeda, ubah proyek menjadi", "This is permanent. Its discussions, applications, and support will be deleted too, with no way to restore them. If work is only paused, change the project to")} {" "}
            <strong>{tx(locale, "Beristirahat", "Resting")}</strong> {tx(locale, "dari halamannya—kontennya akan tetap terlihat.", "from its page—the content remains visible.")}
          </p>
          <details>
            <summary>{tx(locale, "Saya tetap ingin menghapusnya", "I still want to delete it")}</summary>
            <form action={deleteProject}>
              <input type="hidden" name="slug" value={project.slug} />
              <label htmlFor="confirm">
                {tx(locale, "Ketik", "Type")} <code>{project.slug}</code> {tx(locale, "untuk mengonfirmasi bahwa tindakan ini disengaja.", "to confirm this was intentional.")}
              </label>
              <input id="confirm" name="confirm" type="text" autoComplete="off" required />
              <SubmitButton className="danger" pendingLabel={tx(locale, "Menghapus…", "Deleting…")}>
                {tx(locale, "Hapus proyek ini", "Delete this project")}
              </SubmitButton>
            </form>
          </details>
        </section>
      </main>

      <SiteFooter />
    </>
  );
}
