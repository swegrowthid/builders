import Link from "@/app/components/responsive-link";
import { initials } from "./pieces";
import { RelativeTime } from "./relative-time";
import type { PersonAtWork } from "../lib/data";
import { githubHandle } from "../lib/community";
import type { LiveRepo } from "../lib/open-source-live";
import {
  listLabel,
  localized,
  reasonLabel,
  repoSlug,
  repoUrl,
  starterIssuesUrl,
} from "../lib/open-source";
import { primaryProfession } from "../lib/people";
import { tx, type Locale } from "../lib/locale";

/**
 * One repository, as the listing and the home page show it.
 *
 * The reason it is here comes before the numbers: stars say a repo is
 * popular, the reason says why *you* might start there. The primary link is
 * the starter issues, not the README — somebody on this page came to
 * contribute, and the issue list is where that begins.
 */
export function RepoCard({ repo, locale }: { repo: LiveRepo; locale: Locale }) {
  const slug = repoSlug(repo);

  return (
    <article className={`oss-card oss-card-${repo.list}`}>
      <div className="oss-card-head">
        <span className="oss-card-mark" aria-hidden="true">{repo.owner.slice(0, 1).toUpperCase()}</span>
        <div className="oss-card-title">
          <p>{listLabel(repo.list, locale)}</p>
          <h3>
            <a href={repoUrl(repo)} target="_blank" rel="noopener noreferrer">
              <span className="oss-card-owner">{repo.owner}/</span>{repo.repo}
            </a>
          </h3>
        </div>
      </div>

      <p className="oss-card-summary">{localized(repo.summary, locale)}</p>

      <div className="oss-card-why">
        <small>{tx(locale, "Kenapa di sini", "Why it's here")}</small>
        <p>{localized(repo.why, locale)}</p>
      </div>

      <ul className="oss-reasons" aria-label={tx(locale, `Alasan ${slug} direkomendasikan`, `Why ${slug} is recommended`)}>
        {repo.reasons.map((reason) => (
          <li key={reason} className={`oss-reason oss-reason-${reason}`}>{reasonLabel(reason, locale)}</li>
        ))}
      </ul>

      <dl className="oss-card-facts">
        {repo.language ? (
          <div><dt>{tx(locale, "Bahasa", "Language")}</dt><dd>{repo.language}</dd></div>
        ) : null}
        {repo.stats ? (
          <div><dt>{tx(locale, "Bintang", "Stars")}</dt><dd>{compactNumber(repo.stats.stars, locale)}</dd></div>
        ) : null}
        {repo.stats?.pushedAt ? (
          <div><dt>{tx(locale, "Push terakhir", "Last push")}</dt><dd><RelativeTime value={repo.stats.pushedAt} locale={locale} /></dd></div>
        ) : null}
      </dl>

      <div className="oss-card-actions">
        <a className="oss-card-primary" href={starterIssuesUrl(repo)} target="_blank" rel="noopener noreferrer">
          {repo.starterLabel ? tx(locale, "Lihat isu pemula", "Starter issues") : tx(locale, "Lihat isu", "Open issues")}
          <span aria-hidden="true">↗</span>
        </a>
        <a className="oss-card-secondary" href={`${repoUrl(repo)}#readme`} target="_blank" rel="noopener noreferrer">
          README
        </a>
      </div>
    </article>
  );
}

/** One member of the community, with the evidence that put them in a group. */
export function MemberCard({ entry, locale }: { entry: PersonAtWork; locale: Locale }) {
  const { person } = entry;
  const handle = githubHandle(person.github);
  const profession = primaryProfession(entry, locale);

  return (
    <article className="member-card">
      <Link className="member-card-person" href={`/u/${person.username}`}>
        <span className="member-avatar" aria-hidden="true">{initials(person.name)}</span>
        <span className="member-copy">
          <strong>{person.name}</strong>
          <small>{profession || `@${person.username}`}</small>
        </span>
      </Link>

      <ul className="member-evidence">
        {entry.building.length > 0 ? (
          <li>
            <span className="member-badge member-badge-founder">{tx(locale, "Founder", "Founder")}</span>
            {entry.building.slice(0, 2).map((project) => project.title).join(", ")}
            {entry.building.length > 2 ? ` +${entry.building.length - 2}` : ""}
          </li>
        ) : null}
        {entry.helping.length > 0 ? (
          <li>
            <span className="member-badge">{tx(locale, "Membantu", "Helping")}</span>
            {entry.helping.slice(0, 2).map((project) => project.title).join(", ")}
            {entry.helping.length > 2 ? ` +${entry.helping.length - 2}` : ""}
          </li>
        ) : null}
        {person.skills.length > 0 ? (
          <li className="member-skills">
            {person.skills.slice(0, 3).map((skill) => <i key={skill}>{skill}</i>)}
          </li>
        ) : null}
      </ul>

      {handle ? (
        <a className="member-github" href={`https://github.com/${handle}`} target="_blank" rel="noopener noreferrer">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2a10 10 0 0 0-3.16 19.49c.5.09.68-.22.68-.48v-1.7c-2.78.6-3.37-1.34-3.37-1.34-.45-1.16-1.11-1.47-1.11-1.47-.91-.62.07-.6.07-.6 1 .07 1.53 1.03 1.53 1.03.9 1.52 2.34 1.08 2.91.83.09-.65.35-1.08.63-1.33-2.22-.25-4.55-1.11-4.55-4.94 0-1.09.39-1.98 1.03-2.68-.1-.25-.45-1.27.1-2.65 0 0 .84-.27 2.75 1.02a9.58 9.58 0 0 1 5 0c1.91-1.3 2.75-1.02 2.75-1.02.55 1.38.2 2.4.1 2.65.64.7 1.03 1.59 1.03 2.68 0 3.84-2.34 4.68-4.57 4.93.36.31.68.92.68 1.85v2.75c0 .27.18.58.69.48A10 10 0 0 0 12 2Z" /></svg>
          <span>{handle}</span>
        </a>
      ) : null}
    </article>
  );
}

function compactNumber(value: number, locale: Locale): string {
  return new Intl.NumberFormat(locale === "id" ? "id-ID" : "en-US", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}
