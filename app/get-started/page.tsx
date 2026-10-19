import type { Metadata } from "next";
import Link from "@/app/components/responsive-link";
import { redirect } from "next/navigation";
import { setNow } from "../actions";
import { OssAddForm } from "../components/oss-record";
import { SiteFooter, SiteHeader } from "../components/shell";
import { StageBadge } from "../components/pieces";
import { ProjectLogo } from "../components/project-logo";
import { SubmitButton } from "../components/submit-button";
import { MAXIMUM } from "../lib/brief";
import { getPortfolio, listOssContributionsOf, type ProjectSummary } from "../lib/data";
import { readPublicly } from "../lib/public-read";
import { nextSteps, remainingSteps, type NextStep } from "../lib/next-steps";
import { currentViewer } from "../lib/session";
import { signInPath } from "../lib/urls";
import { currentLocale } from "../lib/locale-server";
import { tx } from "../lib/locale";

/*
 * Allowed to block — same reason as /inbox. The whole page is one person's
 * own state, there is nothing cacheable to paint before knowing who is asking,
 * and a visitor about to be redirected should not watch it render first.
 */
export const instant = false;

export async function generateMetadata(): Promise<Metadata> {
  const locale = await currentLocale();
  return {
    title: tx(locale, "Langkah berikutnya — Builders", "Next steps — Builders"),
    description: tx(locale, "Tiga langkah sebelum kontribusi pertamamu: GitHub, repo yang pernah kamu kontribusi, dan profilmu.", "Three steps before your first contribution: GitHub, the repos you have contributed to, and your profile."),
    robots: { index: false },
  };
}

/**
 * Where signing in lands, until there is nothing left to do here.
 *
 * Three numbered steps that put a new member on the directory's map — GitHub,
 * their open source record, who they are — with the record's form right here
 * rather than a link away, because it is the step people skip when it costs a
 * page. Product steps follow for founders, offered and never owed.
 *
 * Nothing here blocks anybody. Every step can be skipped, and once none are
 * owed the page forwards to the directory instead of standing in the way of
 * every future sign-in — `?all=1` keeps it reachable on purpose from the menu.
 */
export default async function StartPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [viewer, locale] = await Promise.all([currentViewer(), currentLocale()]);
  if (!viewer) redirect(signInPath("/get-started"));

  const query = (await searchParams) ?? {};
  const keepOpen = query.all === "1";
  const ossStatus = typeof query.oss === "string" ? query.oss : "";

  const [{ owned }, records] = await Promise.all([
    getPortfolio(viewer),
    readPublicly("open source record on get-started", () => listOssContributionsOf(viewer.id), []),
  ]);
  const steps = nextSteps({ person: viewer, owned, ossCount: records.value.length, locale });
  const remaining = remainingSteps(steps);
  if (remaining.length === 0 && !keepOpen) redirect("/");

  const [owed, extras] = [steps.filter((step) => !step.optional), steps.filter((step) => step.optional)];
  const firstName = viewer.name.split(" ")[0];

  return (
    <>
      <SiteHeader returnTo="/get-started" />

      <main id="main-content" className="dx-page ob-page">
        <header className="ob-head">
          <p className="ob-kicker">{tx(locale, "Mulai di Builders", "Getting started")}</p>
          <h1>{tx(locale, `Halo, ${firstName}.`, `Hello, ${firstName}.`)}</h1>
          <p>
            {remaining.length === 0
              ? tx(locale, "Semua langkah sudah selesai. Saatnya pilih project dari direktori.", "Every step is done. Time to pick a project from the directory.")
              : tx(
                  locale,
                  `${remaining.length} langkah lagi supaya kamu tercatat di direktori — dan pemula lain tahu kamu bisa ditanya.`,
                  `${remaining.length} more ${remaining.length === 1 ? "step" : "steps"} to put you on the directory — so newcomers know they can ask you.`,
                )}
          </p>
        </header>

        <ol className="ob-steps">
          {owed.map((step, index) => (
            <StepRow key={step.id} step={step} index={index + 1} locale={locale}>
              {step.id === "oss" ? <OssAddForm returnTo="/get-started?all=1" status={ossStatus} locale={locale}>
                  {records.value.length > 0 ? (
                    <small>
                      {tx(locale, `${records.value.length} repo tercatat.`, `${records.value.length} ${records.value.length === 1 ? "repo" : "repos"} listed.`)}{" "}
                      <Link href="/account/profile#open-source">{tx(locale, "Kelola", "Manage")}</Link>
                    </small>
                  ) : null}
                </OssAddForm> : null}
            </StepRow>
          ))}
        </ol>

        <div className="ob-next">
          <div>
            <strong>{tx(locale, "Lalu: pilih project pertamamu", "Then: pick your first project")}</strong>
            <span>{tx(locale, "Kode di GitHub atau peran lain — semuanya ada di direktori.", "Code on GitHub or another role — it is all in the directory.")}</span>
          </div>
          <Link className="dx-action" href="/">{tx(locale, "Buka direktori", "Open the directory")} <span aria-hidden="true">→</span></Link>
        </div>

        {extras.length > 0 ? (
          <section className="ob-extra" aria-labelledby="optional-heading">
            <h2 id="optional-heading">{tx(locale, "Untuk founder", "For founders")}</h2>
            <ol className="ob-steps ob-steps-quiet">
              {extras.map((step) => (
                <StepRow key={step.id} step={step} locale={locale} />
              ))}
            </ol>
          </section>
        ) : null}

        {owned.length > 0 ? (
          <section className="ob-extra" aria-labelledby="projects-heading">
            <h2 id="projects-heading">{tx(locale, "Produkmu", "Your products")}</h2>
            <ul className="start-project-list">
              {owned.map((project) => (
                <StartProjectRow key={project.id} project={project} locale={locale} />
              ))}
            </ul>
          </section>
        ) : null}

        <p className="ob-skip">
          <Link href="/">{tx(locale, "Lewati dulu, langsung ke direktori", "Skip for now and go to the directory")}</Link>
        </p>
      </main>

      <SiteFooter />
    </>
  );
}

function StepRow({
  step,
  index,
  locale,
  children,
}: {
  step: NextStep;
  index?: number;
  locale: Awaited<ReturnType<typeof currentLocale>>;
  children?: React.ReactNode;
}) {
  return (
    <li id={`step-${step.id}`} className={`ob-step ${step.done ? "is-done" : ""}`}>
      <span className="ob-step-mark" aria-hidden="true">{step.done ? "✓" : index ?? "·"}</span>
      <div className="ob-step-copy">
        <h3>
          {step.title}
          {step.done ? <span className="ob-step-state">{tx(locale, "selesai", "done")}</span> : null}
        </h3>
        <p>{step.blurb}</p>
        {children}
      </div>
      <Link className={step.done ? "ob-step-edit" : "dx-action"} href={step.href}>
        {step.done ? tx(locale, "Ubah", "Edit") : step.cta}
      </Link>
    </li>
  );
}

/**
 * One owned project with the three things its owner most often comes back for.
 *
 * The "sekarang sedang…" line is edited here rather than linked to, because it
 * otherwise lives inside a collapsed panel inside a tab on the project page —
 * far enough away that the line people read for freshness is the one least
 * likely to be kept fresh. `setNow` is the same action that panel calls.
 */
function StartProjectRow({ project, locale }: { project: ProjectSummary; locale: Awaited<ReturnType<typeof currentLocale>> }) {
  return (
    <li className="start-project-row">
      <div className="start-project-head">
        <ProjectLogo title={project.title} website={project.liveUrl} logoUrl={project.logoUrl} />
        <div className="start-project-title">
          <h3>
            <Link href={`/projects/${project.slug}`}>{project.title}</Link>
          </h3>
          <StageBadge stage={project.stage} />
        </div>
        <Link className="start-project-edit" href={`/projects/${project.slug}/edit`}>
          {tx(locale, "Edit brief", "Edit brief")}
        </Link>
      </div>

      <form className="start-now-form" action={setNow}>
        <input type="hidden" name="slug" value={project.slug} />
        <label htmlFor={`now-${project.slug}`}>{tx(locale, "Sedang dikerjakan…", "Working on now…")}</label>
        <div className="start-now-row">
          <input
            id={`now-${project.slug}`}
            name="now"
            type="text"
            maxLength={MAXIMUM.now}
            defaultValue={project.nowText}
            placeholder={tx(locale, "Contoh: Menyusun draf materi keamanan pertama.", "For example: Drafting the first safety materials.")}
          />
          <SubmitButton pendingLabel={tx(locale, "Menyimpan…", "Saving…")}>{tx(locale, "Simpan", "Save")}</SubmitButton>
        </div>
      </form>

      <p className="start-project-seats">
        {project.openSeatCount > 0
          ? tx(locale, `${project.openSeatCount} peran terbuka.`, `${project.openSeatCount} open roles.`)
          : tx(locale, "Belum ada peran terbuka.", "No open roles yet.")}{" "}
        <Link href={`/projects/${project.slug}?tab=collaboration`}>
          {project.openSeatCount > 0 ? tx(locale, "Lihat kolaborasi", "View collaboration") : tx(locale, "Buka peran", "Open a role")}
        </Link>
      </p>
    </li>
  );
}
