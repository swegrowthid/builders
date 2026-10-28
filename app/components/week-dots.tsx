import type { BoardSpan, BoardWindow } from "../lib/github-activity";
import { tx, type Locale } from "../lib/locale";

/**
 * A board's weeks as dots, oldest first: filled when a PR was opened in it,
 * this week ringed, the weeks still to come faint.
 */
export function WeekDots({ weeks, current, locale }: { weeks: boolean[]; current: number; locale: Locale }) {
  const filled = weeks.filter(Boolean).length;
  return (
    <span
      className="ax-weeks"
      role="img"
      aria-label={tx(locale, `${filled} dari ${current + 1} minggu ada PR`, `${filled} of ${current + 1} weeks so far had a PR`)}
    >
      {weeks.map((on, index) => (
        <i key={index} className={[on ? "is-on" : "", index === current ? "is-now" : "", index > current ? "is-later" : ""].join(" ").trim() || undefined} />
      ))}
    </span>
  );
}

/**
 * An ⓘ that explains a board's numbers — "4/4", 🔥, the dots — on hover,
 * or on focus for a keyboard or a tap. Plain CSS (.info-tip), so it works
 * before the script does.
 */
export function BoardInfo({
  weeks,
  span,
  dots = true,
  locale,
}: {
  weeks: BoardWindow;
  span: BoardSpan;
  /** Whether the board beside it shows each week as a dot. */
  dots?: boolean;
  locale: Locale;
}) {
  const soFar = weeks.current + 1;
  const total = weeks.weeks.length;
  return (
    <span className="info-tip">
      <button type="button" className="info-tip-icon" aria-label={tx(locale, "Cara membaca skor", "How to read the scores")}>
        i
      </button>
      <span className="info-tip-body" role="tooltip">
        {locale === "id" ? (
          <>
            Satu minggu terisi kalau ada PR yang dibuka ke repo orang lain, direview atau sudah di-merge.
            <br />
            <b>x/{soFar}</b>{" "}
            {span === "season"
              ? `= minggu yang ada PR-nya, dari ${soFar} minggu musim ini yang sudah berjalan (musim ini ${total} minggu).`
              : `= minggu yang ada PR-nya, dari ${total} minggu terakhir termasuk minggu ini.`}{" "}
            {soFar}/{soFar} berarti nggak pernah absen.
            <br />
            <b>🔥</b> = streak, minggu berturut-turut ada PR.
            {dots ? <br /> : null}
            {dots ? (
              <>
                <b>Titik</b> = {span === "season" ? "minggu-minggu musim ini" : `${total} minggu terakhir`}; yang berbingkai minggu ini
                {span === "season" ? ", yang pudar belum tiba" : ""}.
              </>
            ) : null}
          </>
        ) : (
          <>
            A week counts when a PR was opened to somebody else&apos;s repo, in review or merged.
            <br />
            <b>x/{soFar}</b>{" "}
            {span === "season"
              ? `= weeks with a PR, out of the season's ${soFar} weeks so far (it has ${total}).`
              : `= weeks with a PR, out of the last ${total} weeks, this one included.`}{" "}
            {soFar}/{soFar} means not a week missed.
            <br />
            <b>🔥</b> = streak, weeks in a row with a PR.
            {dots ? <br /> : null}
            {dots ? (
              <>
                <b>Dots</b> = {span === "season" ? "the season's weeks" : `the last ${total} weeks`}; the ringed one is this week
                {span === "season" ? ", the faint ones are still to come" : ""}.
              </>
            ) : null}
          </>
        )}
      </span>
    </span>
  );
}

/**
 * Who has already filled this week, so nobody has to scan the dots for it:
 * a few names, then how many more.
 */
export function ThisWeek({ names, locale, className }: { names: string[]; locale: Locale; className: string }) {
  const shown = names.slice(0, 3);
  const more = names.length - shown.length;
  return (
    <p className={className}>
      {names.length === 0 ? (
        tx(locale, "Minggu ini belum ada yang PR. Jadilah yang pertama!", "Nobody has a PR this week yet. Be the first!")
      ) : (
        <>
          <span aria-hidden="true">✓</span> {tx(locale, "Minggu ini sudah PR:", "PR'd this week:")} <strong>{shown.join(", ")}</strong>
          {more > 0 ? tx(locale, ` +${more} lainnya`, ` +${more} more`) : ""}
        </>
      )}
    </p>
  );
}
