import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "@/app/components/responsive-link";
import { setActivityVisibility } from "../../actions";
import { SiteFooter, SiteHeader } from "../../components/shell";
import { ActivityList, initials, monthYear } from "../../components/pieces";
import { LinkIcon, type LinkIconKind } from "../../components/link-icons";
import { PageScrollTop } from "../../components/project-scroll-top";
import { ShareProfileButton } from "../../components/share-profile-button";
import { AvailabilityBadges } from "../../components/availability-badges";
import { OssRecordEmpty, OssRecordList } from "../../components/oss-record";
import { SubmitButton } from "../../components/submit-button";
import {
  getPerson,
  getPersonStats,
  getPortfolio,
  listOssContributionsOf,
  listPeople,
  listPersonActivity,
  type Person,
  type ProjectSummary,
} from "../../lib/data";
import { EVENT_KINDS, HIGHLIGHT_KINDS, eventKindLabel } from "../../lib/activity";
import { domainOf, projectBlurb } from "../../lib/brief";
import { nextSteps, remainingSteps } from "../../lib/next-steps";
import { githubHandle, type OssContribution } from "../../lib/oss";
import { readPublicly } from "../../lib/public-read";
import { stageLabel } from "../../lib/stages";
import { currentViewer } from "../../lib/session";
import { currentLocale } from "../../lib/locale-server";
import { tx, type Locale } from "../../lib/locale";

type Params = Promise<{ username: string }>;

/**
 * Pre-render a bounded set of public portfolios for direct links and shares.
 * Less frequently visited profiles are still cached on their first prefetch
 * or visit, without making a growing directory slow every deployment.
 */
export async function generateStaticParams(): Promise<{ username: string }[]> {
  try {
    const people = await listPeople(80);
    return people.slice(0, 32).map((person) => ({ username: person.username }));
  } catch (error) {
    console.warn("[ahsan] Profile detail was not prerendered:", error);
    return [];
  }
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const [{ username }, locale] = await Promise.all([params, currentLocale()]);
  const person = await getPerson(username);
  if (!person) return { title: tx(locale, "Orang tidak ditemukan — Builders", "Person not found — Builders") };

  const description =
    person.headline || tx(locale, `Hal yang sedang dibangun dan dibantu ${person.name} di Builders.`, `What ${person.name} is building and contributing to on Builders.`);

  return {
    title: `${person.name} — Builders`,
    description,
    alternates: { canonical: `/u/${person.username}` },
    // The card image comes from opengraph-image.tsx beside this file.
    openGraph: {
      type: "profile",
      title: `${person.name} — Builders`,
      description,
      url: `/u/${person.username}`,
    },
  };
}

const TRAIL_PAGE = 40;

/**
 * A member's page, read in the order a visitor wants it.
 *
 * Somebody lands here from a badge in the directory — "2 friends have
 * contributed" — wanting to know who this is and whether to ask them. So the
 * page leads with who (face, GitHub, what they do), then their open source
 * record with a link to the PRs behind each claim, then the products they
 * build or help on here, and the system-kept trail last.
 */
export default async function ProfilePage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { username } = await params;
  const query = (await searchParams) ?? {};
  const [person, viewer, locale] = await Promise.all([getPerson(username), currentViewer(), currentLocale()]);
  if (!person) notFound();

  // "Muat lebih lama" grows the limit instead of paging cursors: the list is
  // one request either way, and the URL stays shareable.
  const showAll = query.trail === "all";
  const rawLimit = Number(Array.isArray(query.limit) ? query.limit[0] : query.limit);
  const limit = Math.min(Number.isInteger(rawLimit) && rawLimit > 0 ? rawLimit : TRAIL_PAGE, 400);

  const isSelf = viewer?.id === person.id;
  const [{ owned, contributing }, activity, stats, recordsResult] = await Promise.all([
    getPortfolio(person),
    listPersonActivity(person.id, {
      limit: limit + 1,
      kinds: showAll ? undefined : HIGHLIGHT_KINDS,
      viewer,
    }),
    getPersonStats(person.id, viewer),
    readPublicly("open source record on a profile", () => listOssContributionsOf(person.id), []),
  ]);
  const records = recordsResult.value;
  const hasOlder = activity.length > limit;
  const trail = activity.slice(0, limit);
  const handle = githubHandle(person.github);
  const maintained = records.filter((record) => record.relation === "maintainer").length;
  const contributed = records.length - maintained;

  const website = safeWebUrl(person.website);
  const linkedin = safeWebUrl(person.linkedin);
  const x = safeWebUrl(person.x);
  const resume = safeWebUrl(person.resume);
  const publicEmail = safePublicEmail(person.publicEmail);
  const contacts: Array<{ href: string; icon: LinkIconKind; label: string; external: boolean }> = [
    ...(handle ? [{ href: `https://github.com/${handle}`, icon: "github" as const, label: `@${handle}`, external: true }] : []),
    ...(website ? [{ href: website, icon: "website" as const, label: domainOf(website) || "Website", external: true }] : []),
    ...(publicEmail ? [{ href: `mailto:${publicEmail}`, icon: "email" as const, label: publicEmail, external: false }] : []),
    ...(linkedin ? [{ href: linkedin, icon: "linkedin" as const, label: "LinkedIn", external: true }] : []),
    ...(x ? [{ href: x, icon: "x" as const, label: "X", external: true }] : []),
    ...(resume ? [{ href: resume, icon: "resume" as const, label: tx(locale, "Résumé", "Résumé"), external: true }] : []),
  ];

  const trailPath = (next: { trail?: string; limit?: number }) => {
    const params = new URLSearchParams();
    if (next.trail === "all") params.set("trail", "all");
    if (next.limit && next.limit > TRAIL_PAGE) params.set("limit", String(next.limit));
    const search = params.toString();
    return `/u/${person.username}${search ? `?${search}` : ""}#activity-heading`;
  };

  return (
    <>
      <PageScrollTop />
      <SiteHeader returnTo={`/u/${person.username}`} />

      <main id="main-content" className="dx-page pf-page">
        <header className="pf-head">
          <Avatar name={person.name} handle={handle} />
          <div className="pf-identity">
            <h1>{person.name}</h1>
            <p className="pf-role">
              {person.profession || tx(locale, "Anggota Builders", "Builders member")}
              <span>@{person.username}</span>
            </p>
            {person.headline ? <p className="pf-headline">{person.headline}</p> : null}
            {contacts.length > 0 ? (
              <ul className="pf-links" aria-label={tx(locale, `Tautan ${person.name}`, `${person.name}'s links`)}>
                {contacts.map((contact) => (
                  <li key={`${contact.icon}-${contact.href}`}>
                    <a href={contact.href} target={contact.external ? "_blank" : undefined} rel={contact.external ? "noreferrer" : undefined}>
                      <LinkIcon kind={contact.icon} />
                      <span>{contact.label}</span>
                    </a>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
          <div className="pf-head-actions">
            {isSelf ? <Link className="pf-button" href="/account/profile">{tx(locale, "Edit profil", "Edit profile")}</Link> : null}
            <ShareProfileButton name={person.name} path={`/u/${person.username}`} />
          </div>
        </header>

        <ul className="pf-stats" aria-label={tx(locale, "Ringkasan", "Summary")}>
          <Stat value={contributed} label={tx(locale, "repo dikontribusi", "repos contributed to")} />
          <Stat value={maintained} label={tx(locale, "repo di-maintain", "repos maintained")} />
          <Stat value={owned.length} label={tx(locale, "produk dibangun", "products built")} />
          <Stat value={contributing.length} label={tx(locale, "produk dibantu", "products helped")} />
          {stats.since ? <Stat value={monthYear(stats.since, locale)} label={tx(locale, "aktif sejak", "active since")} /> : null}
        </ul>

        {isSelf ? <SelfNote person={person} owned={owned} ossCount={records.length} locale={locale} /> : null}

        <div className="pf-layout">
          <div className="pf-main">
            <section className="pf-section" aria-labelledby="oss-heading">
              <div className="pf-section-head">
                <h2 id="oss-heading">{tx(locale, "Kontribusi open source", "Open source contributions")}</h2>
                {isSelf ? <Link href="/account/profile#open-source">{tx(locale, "Kelola", "Manage")}</Link> : null}
              </div>
              {records.length > 0 ? (
                <OssRecordList records={sortRecords(records)} handle={handle} locale={locale} />
              ) : (
                <OssRecordEmpty self={isSelf} locale={locale} />
              )}
            </section>

            {owned.length > 0 || isSelf ? (
              <section className="pf-section" aria-labelledby="owned-heading">
                <div className="pf-section-head">
                  <h2 id="owned-heading">{tx(locale, "Produk yang dibangun", "Products built")}</h2>
                  {isSelf ? <Link href="/new">{tx(locale, "+ Daftarkan", "+ List one")}</Link> : null}
                </div>
                {owned.length > 0 ? (
                  <ul className="pf-products">
                    {owned.map((project) => <ProductRow key={project.id} project={project} locale={locale} />)}
                  </ul>
                ) : (
                  <p className="oss-record-empty">{tx(locale, "Belum ada produk.", "No products yet.")}</p>
                )}
              </section>
            ) : null}

            {contributing.length > 0 ? (
              <section className="pf-section" aria-labelledby="helping-heading">
                <div className="pf-section-head">
                  <h2 id="helping-heading">{tx(locale, "Membantu di", "Helping on")}</h2>
                </div>
                <ul className="pf-products">
                  {contributing.map((project) => <ProductRow key={project.id} project={project} locale={locale} />)}
                </ul>
              </section>
            ) : null}

            <section className="pf-section" aria-labelledby="activity-heading">
              <div className="pf-section-head">
                <h2 id="activity-heading">{tx(locale, "Jejak karya", "Work trail")}</h2>
                <div className="pf-trail-modes">
                  <Link className={showAll ? "" : "is-active"} href={trailPath({})}>{tx(locale, "Sorotan", "Highlights")}</Link>
                  <Link className={showAll ? "is-active" : ""} href={trailPath({ trail: "all" })}>{tx(locale, "Lengkap", "Full")}</Link>
                </div>
              </div>
              <p className="pf-note">
                {tx(locale, "Dicatat oleh sistem saat pekerjaan berlangsung di Builders — bukan ditambahkan setelahnya.", "Recorded by the system as work happens on Builders — not added afterwards.")}
              </p>

              {trail.length === 0 ? (
                <p className="oss-record-empty">
                  {showAll ? tx(locale, "Belum ada entri.", "No entries yet.") : tx(locale, "Belum ada sorotan.", "No highlights yet.")}
                </p>
              ) : (
                <div className="pf-trail">
                  <ActivityList events={trail} hidden={isSelf ? person.activityHidden : []} />
                </div>
              )}

              {hasOlder ? (
                <p className="trail-more">
                  <Link href={trailPath({ trail: showAll ? "all" : undefined, limit: limit + TRAIL_PAGE })}>
                    {tx(locale, "Muat entri sebelumnya", "Load earlier entries")}
                  </Link>
                </p>
              ) : null}

              {isSelf ? (
                <details className="owner-tool">
                  <summary>{tx(locale, "Pilih yang dapat dilihat", "Choose what is visible")}</summary>
                  <form action={setActivityVisibility}>
                    <p className="hint">
                      {tx(locale, "Item yang dicentang muncul di profil publikmu. Item yang tidak dicentang tetap hanya terlihat olehmu—tetap tercatat dan tidak dihapus.", "Checked items appear on your public profile. Unchecked items remain visible only to you—they are still recorded and are not deleted.")}
                    </p>
                    <ul className="kind-list">
                      {EVENT_KINDS.map((kind) => (
                        <li key={kind}>
                          <label htmlFor={`show-${kind}`}>
                            <input id={`show-${kind}`} type="checkbox" name="show" value={kind} defaultChecked={!person.activityHidden.includes(kind)} />
                            {eventKindLabel(kind, locale)}
                          </label>
                        </li>
                      ))}
                    </ul>
                    <SubmitButton pendingLabel={tx(locale, "Menyimpan…", "Saving…")}>{tx(locale, "Simpan", "Save")}</SubmitButton>
                  </form>
                </details>
              ) : null}
            </section>
          </div>

          <aside className="pf-side">
            {person.bio ? (
              <section className="pf-card">
                <h2>{tx(locale, "Tentang", "About")}</h2>
                <p className="pf-bio">{person.bio}</p>
              </section>
            ) : null}
            {person.skills.length > 0 || person.fields.length > 0 || person.yearsExperience !== null ? (
              <section className="pf-card">
                <h2>{tx(locale, "Keahlian", "Skills")}</h2>
                <ul className="pf-tags">
                  {person.yearsExperience !== null ? (
                    <li>{tx(locale, `${person.yearsExperience} tahun pengalaman`, `${person.yearsExperience} years of experience`)}</li>
                  ) : null}
                  {person.fields.map((field) => <li key={`field-${field}`}>{field}</li>)}
                  {person.skills.map((skill) => <li key={`skill-${skill}`}>{skill}</li>)}
                </ul>
              </section>
            ) : null}
            <section className="pf-card">
              <h2>{tx(locale, "Status", "Status")}</h2>
              <AvailabilityBadges status={person.availability} fields={[]} skills={[]} locale={locale} />
            </section>
          </aside>
        </div>
      </main>

      <SiteFooter />
    </>
  );
}

/** Maintained repos first — the stronger claim — then in the order listed. */
function sortRecords(records: OssContribution[]): OssContribution[] {
  return [...records].sort((a, b) => Number(b.relation === "maintainer") - Number(a.relation === "maintainer"));
}

/**
 * The person's face: their GitHub picture when they have linked GitHub,
 * initials otherwise. The same picture the directory badges show, so
 * somebody arriving from a badge recognises who they clicked.
 */
function Avatar({ name, handle }: { name: string; handle: string }) {
  return handle ? (
    // eslint-disable-next-line @next/next/no-img-element -- a GitHub avatar; see BadgeChip on the directory.
    <img className="pf-avatar" src={`https://github.com/${handle}.png?size=160`} alt="" width={72} height={72} />
  ) : (
    <span className="pf-avatar pf-avatar-initials" aria-hidden="true">{initials(name)}</span>
  );
}

function Stat({ value, label }: { value: number | string; label: string }) {
  return (
    <li>
      <strong>{value}</strong>
      <span>{label}</span>
    </li>
  );
}

function ProductRow({ project, locale }: { project: ProjectSummary; locale: Locale }) {
  return (
    <li>
      <span className="dx-logo" aria-hidden="true">{project.title.slice(0, 1).toUpperCase()}</span>
      <div className="pf-product-copy">
        <Link href={`/projects/${project.slug}`}>{project.title}</Link>
        <p>{projectBlurb(project)}</p>
      </div>
      <span className="pf-product-stage">{stageLabel(project.stage, locale)}</span>
    </li>
  );
}

/**
 * What the owner of this page sees that nobody else does: the steps still
 * owed before they are on the directory's map.
 */
function SelfNote({
  person,
  owned,
  ossCount,
  locale,
}: {
  person: Person;
  owned: ProjectSummary[];
  ossCount: number;
  locale: Locale;
}) {
  const remaining = remainingSteps(nextSteps({ person, owned, ossCount, locale }));
  if (remaining.length === 0) return null;

  return (
    <p className="pf-self-note">
      {tx(
        locale,
        `${remaining.length} langkah lagi supaya kamu tercatat di direktori: ${remaining.map((step) => step.title.toLowerCase()).join(", ")}.`,
        `${remaining.length} more ${remaining.length === 1 ? "step" : "steps"} to be on the directory: ${remaining.map((step) => step.title.toLowerCase()).join(", ")}.`,
      )}{" "}
      <Link href="/get-started?all=1">{tx(locale, "Selesaikan", "Finish them")}</Link>
    </p>
  );
}

function safeWebUrl(value: string): string {
  if (!value) return "";
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:" ? value : "";
  } catch {
    return "";
  }
}

function safePublicEmail(value: string): string {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) ? value : "";
}
