import type { CSSProperties } from "react";
import { calendarMonths, weekdayOf, type ContributionDay, type GitHubProfile } from "../lib/github-profile";
import type { ReadmeInline } from "../lib/readme";
import { tx, type Locale } from "../lib/locale";
import { CalendarScroll } from "./calendar-scroll";

const COUNTING_URL = "https://docs.github.com/en/account-and-profile/concepts/contributions-on-your-profile";

/**
 * The last year of contributions as GitHub draws it on a profile: one square
 * a day, greener for a busier one, the latest week on the right. It sits under
 * the profile's numbers, so the year's total has its shape beside it.
 */
export function ContributionCalendar({ weeks, total, locale }: { weeks: ContributionDay[][]; total: number; locale: Locale }) {
  const tag = locale === "id" ? "id-ID" : "en-GB";
  const monthName = new Intl.DateTimeFormat(tag, { month: "short", timeZone: "UTC" });
  const dayName = new Intl.DateTimeFormat(tag, { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
  // The first week can start after Sunday; blank squares keep its days on their rows.
  const lead = weekdayOf(weeks[0][0].date);

  const dayTitle = ({ date, count }: ContributionDay) => {
    const when = dayName.format(new Date(`${date}T00:00:00Z`));
    if (count === 0) return tx(locale, `Tidak ada kontribusi pada ${when}`, `No contributions on ${when}`);
    const amount = count.toLocaleString(tag);
    return tx(locale, `${amount} kontribusi pada ${when}`, `${amount} ${count === 1 ? "contribution" : "contributions"} on ${when}`);
  };

  return (
    <div className="gh-cal" id="github-contributions">
      <CalendarScroll className="gh-cal-scroll">
        <div className="gh-cal-body" style={{ "--weeks": weeks.length } as CSSProperties}>
          <div className="gh-cal-months" aria-hidden="true">
            {calendarMonths(weeks).map(({ column, month }) => (
              <span key={month} style={{ gridColumnStart: column + 1 }}>
                {monthName.format(new Date(`${month}-01T00:00:00Z`))}
              </span>
            ))}
          </div>
          <div className="gh-cal-days" aria-hidden="true">
            <span />
            <span>{tx(locale, "Sen", "Mon")}</span>
            <span />
            <span>{tx(locale, "Rab", "Wed")}</span>
            <span />
            <span>{tx(locale, "Jum", "Fri")}</span>
            <span />
          </div>
          <div
            className="gh-cal-grid"
            role="img"
            aria-label={tx(
              locale,
              `${total.toLocaleString(tag)} kontribusi di GitHub dalam setahun terakhir`,
              `${total.toLocaleString(tag)} contributions on GitHub in the last year`,
            )}
          >
            {Array.from({ length: lead }, (_, index) => (
              <i key={`lead-${index}`} className="is-lead" />
            ))}
            {weeks.flat().map((day) => (
              <i key={day.date} className={`is-l${day.level}`} title={dayTitle(day)} />
            ))}
          </div>
        </div>
      </CalendarScroll>
      <div className="gh-cal-foot">
        <a href={COUNTING_URL} target="_blank" rel="noreferrer">
          {tx(locale, "Cara GitHub menghitung kontribusi", "How GitHub counts contributions")} ↗
        </a>
        <span className="gh-cal-legend" aria-hidden="true">
          {tx(locale, "Sedikit", "Less")}
          {[0, 1, 2, 3, 4].map((level) => (
            <i key={level} className={`is-l${level}`} />
          ))}
          {tx(locale, "Banyak", "More")}
        </span>
      </div>
    </div>
  );
}

/**
 * A member's open source work as GitHub tells it, on their profile: pull
 * requests still open on other people's repositories, where their merged ones
 * landed, and what they pinned. Lists, not prose — each row is a repository
 * and a number, and leads to GitHub.
 */
export function GitHubSummary({ profile, locale }: { profile: GitHubProfile; locale: Locale }) {
  const { login, open, merged, pinned } = profile;
  const openShown = open.slice(0, 6);
  const mergedShown = merged.repos.slice(0, 8);

  return (
    <>
      <section className="pf-section" aria-labelledby="gh-open-heading">
        <div className="pf-section-head">
          <h2 id="gh-open-heading">
            {tx(locale, "PR berjalan", "Open pull requests")} <span className="pf-count">{open.length}</span>
          </h2>
          {open.length > openShown.length ? (
            <a href={searchUrl(login, "open")} target="_blank" rel="noreferrer">
              {tx(locale, "Semua di GitHub", "All on GitHub")} ↗
            </a>
          ) : null}
        </div>
        {openShown.length > 0 ? (
          <ul className="gh-rows">
            {openShown.map((pr) => (
              <li key={pr.url}>
                <a className="gh-row" href={pr.url} target="_blank" rel="noreferrer">
                  <span className="gh-row-repo">{pr.repo}</span>
                  <span className="gh-row-title">{pr.title}</span>
                  <span className="gh-row-meta">
                    {pr.draft ? <span className="gh-draft">draft</span> : null}#{pr.number} · {on(pr.openedAt, locale)}
                  </span>
                </a>
              </li>
            ))}
          </ul>
        ) : (
          <p className="oss-record-empty">{tx(locale, "Tidak ada PR terbuka ke repo orang lain.", "No open pull requests to other people's repos.")}</p>
        )}
      </section>

      <section className="pf-section" aria-labelledby="gh-merged-heading">
        <div className="pf-section-head">
          <h2 id="gh-merged-heading">
            {tx(locale, "Sudah di-merge", "Merged")} <span className="pf-count">{merged.count}</span>
          </h2>
          {merged.count > 0 ? (
            <a href={searchUrl(login, "merged")} target="_blank" rel="noreferrer">
              {tx(locale, "Semua di GitHub", "All on GitHub")} ↗
            </a>
          ) : null}
        </div>
        {mergedShown.length > 0 ? (
          <ul className="gh-rows">
            {mergedShown.map((repo) => (
              <li key={repo.repo}>
                <a className="gh-row gh-row-repo-only" href={`${repo.url}/pulls?q=${encodeURIComponent(`is:pr is:merged author:${login}`)}`} target="_blank" rel="noreferrer">
                  <span className="gh-row-repo">{repo.repo}</span>
                  <span className="gh-row-meta">
                    {repo.stars > 0 ? `★ ${compact(repo.stars)} · ` : ""}
                    {tx(locale, `terakhir ${on(repo.lastMergedAt, locale)}`, `last ${on(repo.lastMergedAt, locale)}`)}
                  </span>
                  <strong className="gh-merged">{repo.merged}</strong>
                </a>
              </li>
            ))}
          </ul>
        ) : (
          <p className="oss-record-empty">{tx(locale, "Belum ada PR yang di-merge ke repo orang lain.", "No pull requests merged into other people's repos yet.")}</p>
        )}
        {merged.more ? (
          <p className="pf-note">{tx(locale, `Dihitung dari ${merged.repos.reduce((sum, repo) => sum + repo.merged, 0)} PR terakhir.`, `Grouped from the latest ${merged.repos.reduce((sum, repo) => sum + repo.merged, 0)} pull requests.`)}</p>
        ) : null}
      </section>

      {pinned.length > 0 ? (
        <section className="pf-section" aria-labelledby="gh-pinned-heading">
          <div className="pf-section-head">
            <h2 id="gh-pinned-heading">{tx(locale, "Disematkan", "Pinned")}</h2>
          </div>
          <ul className="gh-pinned">
            {pinned.map((repo) => (
              <li key={repo.repo}>
                <a href={repo.url} target="_blank" rel="noreferrer">
                  <strong>{repo.repo}</strong>
                  {repo.description ? <p>{repo.description}</p> : null}
                  <span className="gh-pinned-meta">
                    {repo.language ? (
                      <span>
                        <i style={{ background: repo.language.color || "var(--dx-muted)" }} aria-hidden="true" />
                        {repo.language.name}
                      </span>
                    ) : null}
                    {repo.stars > 0 ? <span>★ {compact(repo.stars)}</span> : null}
                  </span>
                </a>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </>
  );
}

/**
 * Their GitHub profile README as the profile's description: the words only,
 * rendered as text (see lib/readme.ts), with the whole thing a click away.
 */
export function GitHubReadme({ profile, locale }: { profile: GitHubProfile; locale: Locale }) {
  return (
    <div className="pf-readme">
      {profile.readme.map((block, index) =>
        block.kind === "heading" ? (
          <h3 key={index}>
            <Inlines parts={block.inlines} />
          </h3>
        ) : block.kind === "list" ? (
          <ul key={index}>
            {block.items.map((item, itemIndex) => (
              <li key={itemIndex}>
                <Inlines parts={item} />
              </li>
            ))}
          </ul>
        ) : (
          <p key={index}>
            <Inlines parts={block.inlines} />
          </p>
        ),
      )}
      <a className="pf-readme-source" href={`https://github.com/${profile.login}`} target="_blank" rel="noreferrer">
        {tx(locale, "README di GitHub", "README on GitHub")} ↗
      </a>
    </div>
  );
}

function Inlines({ parts }: { parts: ReadmeInline[] }) {
  return parts.map((part, index) =>
    part.kind === "link" ? (
      <a key={index} href={part.href} target="_blank" rel="noreferrer nofollow">
        {part.text}
      </a>
    ) : part.kind === "strong" ? (
      <strong key={index}>{part.text}</strong>
    ) : part.kind === "em" ? (
      <em key={index}>{part.text}</em>
    ) : part.kind === "code" ? (
      <code key={index}>{part.text}</code>
    ) : (
      part.text
    ),
  );
}

function searchUrl(login: string, state: "open" | "merged"): string {
  return `https://github.com/pulls?q=${encodeURIComponent(`is:pr is:public is:${state} author:${login} -user:${login}`)}`;
}

function compact(value: number): string {
  return value >= 1000 ? `${(value / 1000).toFixed(value >= 10000 ? 0 : 1)}k` : String(value);
}

/**
 * "23 Okt 2026": a date rather than "3 days ago", which would change by the
 * minute and could not be prerendered or cached.
 */
function on(iso: string, locale: Locale): string {
  const time = Date.parse(iso);
  if (!Number.isFinite(time)) return "";
  return new Intl.DateTimeFormat(locale === "id" ? "id-ID" : "en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Jakarta" }).format(time);
}
