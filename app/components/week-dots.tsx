import type { Season } from "../lib/github-activity";
import { tx, type Locale } from "../lib/locale";

/**
 * The season's weeks as dots, oldest first: filled when a PR was opened in it,
 * this week ringed, the weeks still to come faint.
 */
export function WeekDots({ weeks, current, locale }: { weeks: boolean[]; current: number; locale: Locale }) {
  const filled = weeks.filter(Boolean).length;
  return (
    <span
      className="ax-weeks"
      role="img"
      aria-label={tx(
        locale,
        `${filled} dari ${current + 1} minggu musim ini ada PR`,
        `${filled} of this season's ${current + 1} weeks so far had a PR`,
      )}
    >
      {weeks.map((on, index) => (
        <i key={index} className={[on ? "is-on" : "", index === current ? "is-now" : "", index > current ? "is-later" : ""].join(" ").trim() || undefined} />
      ))}
    </span>
  );
}

/**
 * An ⓘ that explains the season's numbers — "4/4", 🔥, the dots — on hover,
 * or on focus for a keyboard or a tap. Plain CSS (.info-tip), so it works
 * before the script does.
 */
export function SeasonInfo({ season, locale }: { season: Season; locale: Locale }) {
  const soFar = season.current + 1;
  const total = season.weeks.length;
  return (
    <span className="info-tip">
      <button type="button" className="info-tip-icon" aria-label={tx(locale, "Cara membaca skor", "How to read the scores")}>
        i
      </button>
      <span className="info-tip-body" role="tooltip">
        {locale === "id" ? (
          <>
            <b>x/{soFar}</b>{" "}
            = minggu yang ada PR-nya, dari {soFar} minggu musim ini yang sudah berjalan (musim ini {total} minggu). {soFar}/{soFar} berarti
            belum pernah absen.
            <br />
            <b>🔥</b> = streak, minggu berturut-turut ada PR.
            <br />
            <b>Titik</b> = minggu-minggu musim ini; yang berbingkai minggu ini, yang pudar belum tiba.
          </>
        ) : (
          <>
            <b>x/{soFar}</b>{" "}= weeks with a PR, out of the season&apos;s {soFar} weeks so far (it has {total}). {soFar}/{soFar} means not
            a week missed.
            <br />
            <b>🔥</b> = streak, weeks in a row with a PR.
            <br />
            <b>Dots</b> = the season&apos;s weeks; the ringed one is this week, the faint ones are still to come.
          </>
        )}
      </span>
    </span>
  );
}
