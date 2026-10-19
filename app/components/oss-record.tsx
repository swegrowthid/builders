import Link from "@/app/components/responsive-link";
import { addOssContribution, removeOssContribution } from "../actions";
import { SubmitButton } from "./submit-button";
import { contributionEvidenceUrl, type OssContribution } from "../lib/oss";
import { tx, type Locale } from "../lib/locale";

/**
 * A member's open source record: the repos they have contributed to or
 * maintain. The onboarding page embeds the add form; the profile editor shows
 * the whole record; the public profile reads it through `OssRecordList`.
 */

/** What the last add or remove said, from `?oss=` — the forms post without JavaScript. */
export function OssStatus({ status, locale }: { status: string; locale: Locale }) {
  const message =
    status === "added"
      ? tx(locale, "Tersimpan. Badge-mu muncul di direktori.", "Saved. Your badge now shows in the directory.")
      : status === "exists"
        ? tx(locale, "Repo itu sudah ada di catatanmu.", "That repo is already on your record.")
        : status === "invalid"
          ? tx(locale, "Tulis sebagai owner/repo atau tempel URL GitHub-nya.", "Write it as owner/repo or paste its GitHub URL.")
          : status === "removed"
            ? tx(locale, "Dihapus dari catatanmu.", "Removed from your record.")
            : "";
  if (!message) return null;
  return <p className={`oss-status ${status === "invalid" ? "is-error" : ""}`} role="status">{message}</p>;
}

export function OssAddForm({
  returnTo,
  status,
  locale,
  children,
}: {
  /** `/get-started?all=1` comes back to onboarding; anything else, to the editor. */
  returnTo: string;
  status: string;
  locale: Locale;
  children?: React.ReactNode;
}) {
  const id = returnTo.startsWith("/get-started") ? "ob-repo" : "profile-repo";
  return (
    <form className="oss-add-form" action={addOssContribution}>
      <OssStatus status={status} locale={locale} />
      <input type="hidden" name="returnTo" value={returnTo} />
      <div className="oss-add-row">
        <label className="sr-only" htmlFor={id}>{tx(locale, "Repo GitHub", "GitHub repo")}</label>
        <input id={id} name="repo" type="text" required placeholder={tx(locale, "owner/repo atau URL GitHub", "owner/repo or a GitHub URL")} autoComplete="off" />
        <select name="relation" defaultValue="contributor" aria-label={tx(locale, "Peranmu di repo ini", "Your part in this repo")}>
          <option value="contributor">{tx(locale, "Kontributor", "Contributor")}</option>
          <option value="maintainer">Maintainer</option>
        </select>
        <SubmitButton pendingLabel={tx(locale, "Menyimpan…", "Saving…")}>{tx(locale, "Tambah", "Add")}</SubmitButton>
      </div>
      {children}
    </form>
  );
}

/**
 * The record as a list. Each row links to the person's pull requests on that
 * repo — the claim and its evidence side by side — and, for its owner, a
 * button to take it off.
 */
export function OssRecordList({
  records,
  handle,
  editable = false,
  locale,
}: {
  records: OssContribution[];
  /** The person's GitHub username; without it there is no evidence link. */
  handle: string;
  editable?: boolean;
  locale: Locale;
}) {
  return (
    <ul className="oss-record">
      {records.map((record) => (
        <li key={record.repo}>
          <span className="oss-record-mark" aria-hidden="true">{record.repo.split("/")[1]?.slice(0, 1).toUpperCase()}</span>
          <div className="oss-record-copy">
            <a href={`https://github.com/${record.repo}`} target="_blank" rel="noopener noreferrer">
              <span className="oss-record-owner">{record.repo.split("/")[0]}/</span>
              {record.repo.split("/")[1]}
            </a>
            <span className={`oss-record-relation oss-record-${record.relation}`}>
              {record.relation === "maintainer" ? "Maintainer" : tx(locale, "Kontributor", "Contributor")}
            </span>
          </div>
          {handle ? (
            <a className="oss-record-evidence" href={contributionEvidenceUrl(record.repo, handle)} target="_blank" rel="noopener noreferrer">
              {tx(locale, "Lihat PR", "See PRs")} <span aria-hidden="true">↗</span>
            </a>
          ) : null}
          {editable ? (
            <form action={removeOssContribution}>
              <input type="hidden" name="repo" value={record.repo} />
              <SubmitButton className="oss-record-remove" aria-label={tx(locale, `Hapus ${record.repo}`, `Remove ${record.repo}`)}>
                {tx(locale, "Hapus", "Remove")}
              </SubmitButton>
            </form>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

/** The empty state, with the way to fill it when it is the viewer's own. */
export function OssRecordEmpty({ self, locale }: { self: boolean; locale: Locale }) {
  return (
    <p className="oss-record-empty">
      {self
        ? tx(locale, "Belum ada repo yang kamu catat. ", "You have not listed any repos yet. ")
        : tx(locale, "Belum ada repo open source yang dicatat.", "No open source repos listed yet.")}
      {self ? <Link href="/account/profile#open-source">{tx(locale, "Catat sekarang", "List one now")}</Link> : null}
    </p>
  );
}
