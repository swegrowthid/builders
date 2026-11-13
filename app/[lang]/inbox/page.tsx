import type { Metadata } from "next";
import Link from "@/app/components/responsive-link";
import { redirect } from "next/navigation";
import { decideProposal, markNoticesSeen } from "../../actions";
import { reactionEmoji } from "../../lib/reactions";
import { SiteFooter, SiteHeader } from "../../components/shell";
import { initials } from "../../components/pieces";
import { RelativeTime } from "../../components/relative-time";
import {
  listFollowedUpdates,
  listIncomingApplications,
  listMyApplications,
  listNotices,
  type ApplicationView,
  type NoticeView,
} from "../../lib/data";
import { localizeRoleLabel, roleLabel } from "../../lib/roles";
import { currentViewer } from "../../lib/session";
import { signInPath } from "../../lib/urls";
import { ConfirmSubmitButton, SubmitButton } from "../../components/submit-button";
import { currentLocale } from "../../lib/locale-server";
import { tx, type Locale } from "../../lib/locale";

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
    title: tx(locale, "Kotak masuk — Builders", "Inbox — Builders"),
    description: tx(locale, "Kabar terbaru dari proyek yang kamu ikuti dan pengajuan dari kedua arah.", "Updates from projects you follow and applications in both directions."),
    robots: { index: false },
  };
}

/*
 * Proposals remain as a small history instead of taking over the task or role
 * row, so one target can collect several people's offers at once.
 */
function statusLabel(status: string, locale: Locale): string {
  const labels: Record<string, [string, string]> = {
    pending: ["Menunggu tanggapan", "Awaiting a response"],
    accepted: ["Diterima", "Accepted"],
    declined: ["Tidak dilanjutkan", "Not moving forward"],
  };
  return labels[status] ? tx(locale, ...labels[status]) : status;
}

export default async function InboxPage() {
  const [viewer, locale] = await Promise.all([currentViewer(), currentLocale()]);
  if (!viewer) redirect(signInPath("/inbox"));

  const [incoming, mine, notices, followed] = await Promise.all([
    listIncomingApplications(viewer.id),
    listMyApplications(viewer.id),
    listNotices(viewer.id),
    listFollowedUpdates(viewer.id),
  ]);
  const unseen = notices.filter((notice) => !notice.seen).length;

  return (
    <>
      <SiteHeader returnTo="/inbox" />

      <main id="main-content" className="page-narrow inbox">
        <p className="eyebrow">
          <span /> {tx(locale, "Kotak masuk", "Inbox")}
        </p>
        <h1>{tx(locale, "Kabar terbaru dan pengajuan.", "Updates and applications.")}</h1>
        <p className="lede">
          {tx(locale, "Semua perkembangan dari proyek yang kamu ikuti, hal yang menunggu tanggapanmu, dan kabar yang sedang kamu tunggu—semuanya di satu tempat.", "Everything moving in the projects you follow, what awaits your response, and what you are waiting to hear back about—in one place.")}
        </p>

        {notices.length > 0 ? (
          <section aria-labelledby="notices-heading">
            <h2 id="notices-heading" className="section-title">
              {tx(locale, "Kabar untukmu", "Updates for you")} {unseen > 0 ? tx(locale, `(${unseen} baru)`, `(${unseen} new)`) : ""}
            </h2>

            <ul className="notice-list">
              {notices.map((notice) => (
                <li key={notice.id} className={notice.seen ? "" : "is-new"}>
                  <NoticeLine notice={notice} locale={locale} />
                  <small>
                    {notice.seen ? null : <span className="notice-new">{tx(locale, "Baru", "New")} · </span>}
                    <RelativeTime value={notice.createdAt} locale={locale} />
                  </small>
                </li>
              ))}
            </ul>

            {unseen > 0 ? (
              <form action={markNoticesSeen}>
                <SubmitButton className="quiet" pendingLabel={tx(locale, "Mohon tunggu…", "Please wait…")}>
                  {tx(locale, "Tandai sudah dibaca", "Mark as read")}
                </SubmitButton>
              </form>
            ) : null}
          </section>
        ) : null}

        {followed.length > 0 ? (
          <section aria-labelledby="followed-heading">
            <h2 id="followed-heading" className="section-title">
              {tx(locale, "Dari proyek yang kamu ikuti", "From projects you follow")}
            </h2>
            <ul className="followed-list">
              {followed.map((update) => (
                <li key={update.id}>
                  <p className="followed-project">
                    {update.project.slug ? (
                      <Link href={`/projects/${update.project.slug}`}>{update.project.title}</Link>
                    ) : (
                      <strong>{update.project.title}</strong>
                    )}
                  </p>
                  <h3>{update.title}</h3>
                  {update.body ? <p className="followed-body">{update.body}</p> : null}
                  <small><RelativeTime value={update.createdAt} locale={locale} /></small>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <section aria-labelledby="incoming-heading">
          <h2 id="incoming-heading" className="section-title">
            {tx(locale, "Menunggu tanggapanmu", "Awaiting your response")} {incoming.length > 0 ? `(${incoming.length})` : ""}
          </h2>

          {incoming.length === 0 ? (
            <p className="muted">
              {tx(locale, "Belum ada pengajuan. Proyek dengan peran yang jelas lebih cepat menemukan kontributor—buka peran dari halaman proyekmu.", "No applications yet. Projects with clearly named roles find contributors sooner—open one from your project page.")}
            </p>
          ) : (
            <ul className="application-list">
              {incoming.map((application) => (
                <li key={application.proposalId}>
                  <ApplicationHead application={application} showApplicant locale={locale} />
                  {application.pitch ? <blockquote>{application.pitch}</blockquote> : null}
                  <form action={decideProposal}>
                    <input type="hidden" name="slug" value={application.project.slug} />
                    <input type="hidden" name="proposalId" value={application.proposalId} />
                    <SubmitButton name="decision" value="terima" pendingLabel={tx(locale, "Mohon tunggu…", "Please wait…")}>
                      {tx(locale, "Terima", "Accept")}
                    </SubmitButton>
                    <ConfirmSubmitButton
                      className="quiet"
                      name="decision"
                      value="tolak"
                      confirmLabel={tx(locale, "Yakin tolak?", "Decline for sure?")}
                      pendingLabel={tx(locale, "Mohon tunggu…", "Please wait…")}
                    >
                      {tx(locale, "Tolak", "Decline")}
                    </ConfirmSubmitButton>
                  </form>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section aria-labelledby="mine-heading">
          <h2 id="mine-heading" className="section-title">
            {tx(locale, "Pengajuanmu", "Your applications")}
          </h2>

          {mine.length === 0 ? (
            <p className="muted">
              {tx(locale, "Kamu belum bergabung ke proyek apa pun.", "You have not joined anything yet.")} {" "}
              <Link href="/directory?track=role">{tx(locale, "Cari proyek untuk dikontribusi", "Find a project to contribute to")}</Link>.
            </p>
          ) : (
            <ul className="application-list">
              {mine.map((application) => (
                <li key={application.proposalId}>
                  <ApplicationHead application={application} locale={locale} />
                  {application.pitch ? <blockquote>{application.pitch}</blockquote> : null}
                  <p className={`application-status status-${application.status}`}>
                    {statusLabel(application.status, locale)}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>

      <SiteFooter />
    </>
  );
}

/**
 * One line of news, built from the notice's own snapshot of the project.
 *
 * The slug can be empty if the project was deleted after the decision — the
 * sentence still reads, it just stops being a link.
 */
function NoticeLine({ notice, locale }: { notice: NoticeView; locale: Locale }) {
  if (notice.kind === "pull_request_reacted") return <ReactionNotice notice={notice} locale={locale} />;

  const target = localizeRoleLabel(
    notice.payload.target || (notice.payload.role ? roleLabel(notice.payload.role, "", locale) : ""),
    locale,
  );
  const title = notice.payload.title || tx(locale, "proyek yang dihapus", "deleted project");
  const slug = notice.payload.slug;
  const project = slug ? (
    <Link href={`/projects/${slug}`}>{title}</Link>
  ) : (
    <strong>{title}</strong>
  );

  if (notice.kind === "application_accepted") {
    return (
      <p>
        {tx(locale, "Pengajuanmu diterima—sekarang kamu menjadi", "Your application was accepted—you are now")} {target ? <strong>{target}</strong> : tx(locale, "anggota", "a member")} {tx(locale, "di", "of")}{" "}
        {project}.
      </p>
    );
  }

  if (notice.kind === "proposal_accepted") {
    return <p>{tx(locale, "Proposalmu untuk", "Your proposal for")} <strong>{target || tx(locale, "sebuah kontribusi", "a contribution")}</strong> {tx(locale, "diterima di", "was accepted on")} {project}.</p>;
  }

  if (notice.kind === "application_declined") {
    return (
      <p>
        {tx(locale, "Peran", "The")} {target ? <strong>{target}</strong> : tx(locale, "tersebut", "role")} {tx(locale, "di", "on")} {project} {tx(locale, "telah dibuka kembali, sehingga pengajuanmu tidak dilanjutkan. Masih banyak proyek lain yang mencari bantuan.", "has reopened, so your application is not moving forward. There are plenty of other projects looking for help.")}
      </p>
    );
  }

  if (notice.kind === "proposal_declined") {
    return <p>{tx(locale, "Proposalmu untuk", "Your proposal for")} <strong>{target || tx(locale, "sebuah kontribusi", "a contribution")}</strong> {tx(locale, "di", "on")} {project} {tx(locale, "tidak dilanjutkan.", "is not moving forward.")}</p>;
  }

  return <p>{tx(locale, "Ada kabar terbaru dari", "There is an update from")} {project}.</p>;
}

/** Somebody reacted to one of the viewer's pull requests on /activity. */
function ReactionNotice({ notice, locale }: { notice: NoticeView; locale: Locale }) {
  const { url, repo, number, title, emoji, target, actor_name: name, actor_username: username } = notice.payload;
  const who = username ? <Link href={`/u/${username}`}>{name || `@${username}`}</Link> : <strong>{name || tx(locale, "Seseorang", "Somebody")}</strong>;
  if (target === "event") {
    const product = notice.payload.slug ? <Link href={`/projects/${notice.payload.slug}`}>{title || notice.payload.slug}</Link> : <strong>{title}</strong>;
    return (
      <p>
        {who} {tx(locale, "memberi", "reacted")} {reactionEmoji(emoji ?? "")} {tx(locale, "untuk kabar", "to the news from")} {product}.{" "}
        <Link href="/">{tx(locale, "Lihat di Aktivitas", "See it on Activity")}</Link>
      </p>
    );
  }
  if (target === "commits") {
    return (
      <p>
        {who} {tx(locale, "memberi", "reacted")} {reactionEmoji(emoji ?? "")} {tx(locale, "untuk kesibukanmu di repo sendiri.", "to the work on your own repositories.")}{" "}
        <Link href="/">{tx(locale, "Lihat di Aktivitas", "See it on Activity")}</Link>
      </p>
    );
  }
  const pr = url?.startsWith("https://github.com/") ? (
    <a href={url} target="_blank" rel="noopener noreferrer">
      {title || `#${number}`}
    </a>
  ) : (
    <strong>{title || `#${number}`}</strong>
  );
  return (
    <p>
      {who} {tx(locale, "memberi", "reacted")} {reactionEmoji(emoji ?? "")} {tx(locale, "untuk PR-mu", "to your pull request")} {pr}
      {repo ? <> {tx(locale, "di", "on")} <strong>{repo}</strong></> : null}.{" "}
      <Link href="/">{tx(locale, "Lihat di Aktivitas", "See it on Activity")}</Link>
    </p>
  );
}

function ApplicationHead({
  application,
  showApplicant = false,
  locale,
}: {
  application: ApplicationView;
  showApplicant?: boolean;
  locale: Locale;
}) {
  const targetLabel = application.targetKind === "role"
    ? localizeRoleLabel(application.targetLabel, locale)
    : application.targetLabel;

  return (
    <div className="application-head">
      {showApplicant && application.person ? (
        <span className="avatar" aria-hidden="true">
          {initials(application.person.name)}
        </span>
      ) : null}
      <div>
        <p className="application-title">
          {showApplicant && application.person ? (
            <>
              <Link href={`/u/${application.person.username}`}>{application.person.name}</Link>{" "}
              {tx(locale, "ingin membantu pada", "wants to help with")} <strong>{targetLabel}</strong>
            </>
          ) : (
            <>
              <strong>{targetLabel}</strong> {tx(locale, "di", "on")}{" "}
              <Link href={`/projects/${application.project.slug}`}>
                {application.project.title}
              </Link>
            </>
          )}
        </p>
        <p className="application-meta">
          {showApplicant ? (
            <Link href={`/projects/${application.project.slug}`}>{application.project.title}</Link>
          ) : null}
          {showApplicant ? " · " : ""}
          <RelativeTime value={application.createdAt} locale={locale} />
        </p>
      </div>
    </div>
  );
}
