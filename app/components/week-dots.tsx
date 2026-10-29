import { seasonLabel, seasonOf, type BoardCount, type BoardOf, type BoardSpan, type BoardWindow } from "../lib/github-activity";
import { tx, type Locale } from "../lib/locale";

/**
 * A board's weeks as dots, oldest first: filled when a PR was opened in it,
 * this week ringed, the weeks still to come faint. Slim: one thin bar of
 * segments, for a row in a list.
 */
export function WeekDots({ weeks, current, slim = false, locale }: { weeks: boolean[]; current: number; slim?: boolean; locale: Locale }) {
  const filled = weeks.filter(Boolean).length;
  return (
    <span
      className={`ax-weeks ${slim ? "is-slim" : ""}`}
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
 * An ⓘ that explains a board's numbers — "4/4", 🔥, the bar — on hover,
 * or on focus for a keyboard or a tap. Plain CSS (.info-tip), so it works
 * before the script does.
 */
export function BoardInfo({
  weeks,
  span,
  of = "external",
  count = "opened",
  places = false,
  streak = true,
  locale,
}: {
  weeks: BoardWindow;
  span: BoardSpan;
  of?: BoardOf;
  count?: BoardCount;
  /** Whether the board offers local or global, which the ⓘ then explains. */
  places?: boolean;
  /** Whether the board shows the 🔥 streak, which the ⓘ then explains. */
  streak?: boolean;
  locale: Locale;
}) {
  const soFar = weeks.current + 1;
  const total = weeks.weeks.length;
  // The season's Monday weeks all fall in its quarter: its first names it.
  const months = span === "season" ? seasonLabel(seasonOf(weeks.weeks[0]), locale) : "";
  return (
    <span className="info-tip">
      <button type="button" className="info-tip-icon" aria-label={tx(locale, "Cara membaca skor", "How to read the scores")}>
        i
      </button>
      <span className="info-tip-body" role="tooltip">
        {locale === "id" ? (
          <>
            {countedRule(of, count, locale)}
            <br />
            {places ? (
              <>
                <b>Lokal</b> = proyek member komunitas atau repo dengan maintainer Indonesia; <b>global</b> = sisanya.
                <br />
              </>
            ) : null}
            <b>x/{soFar}</b>{" "}
            {span === "season"
              ? `= minggu yang ada PR-nya, dari ${soFar} minggu musim ini yang sudah berjalan (musim ${months}, ${total} minggu).`
              : `= minggu yang ada PR-nya, dari ${total} minggu terakhir termasuk minggu ini.`}{" "}
            {soFar}/{soFar} berarti nggak pernah absen.
            {streak ? (
              <>
                <br />
                <b>🔥</b> = streak, minggu berturut-turut ada PR.
              </>
            ) : null}
            <br />
            <b>Bar</b> = satu kotak per minggu, {span === "season" ? "sepanjang musim" : `${total} minggu terakhir`}; berwarna kalau ada PR,
            minggu ini paling akhir{span === "season" ? ", yang pudar belum tiba" : ""}.
          </>
        ) : (
          <>
            {countedRule(of, count, locale)}
            <br />
            {places ? (
              <>
                <b>Local</b> = a community member&apos;s project or a repo with Indonesian maintainers; <b>global</b> = the rest.
                <br />
              </>
            ) : null}
            <b>x/{soFar}</b>{" "}
            {span === "season"
              ? `= weeks with a PR, out of the season's ${soFar} weeks so far (${months}, ${total} weeks).`
              : `= weeks with a PR, out of the last ${total} weeks, this one included.`}{" "}
            {soFar}/{soFar} means not a week missed.
            {streak ? (
              <>
                <br />
                <b>🔥</b> = streak, weeks in a row with a PR.
              </>
            ) : null}
            <br />
            <b>Bar</b> = one block a week, {span === "season" ? "across the season" : `the last ${total} weeks`}; coloured when it had a PR,
            this week last{span === "season" ? ", the faint ones still to come" : ""}.
          </>
        )}
      </span>
    </span>
  );
}

/** What fills a week, for the board's choices. */
export function countedRule(of: BoardOf, count: BoardCount, locale: Locale): string {
  const where = of === "own" ? tx(locale, "repo sendiri", "their own repo") : tx(locale, "repo orang lain", "somebody else's repo");
  return count === "merged"
    ? tx(
        locale,
        `Satu minggu terisi kalau ada PR ke ${where} yang dibuka minggu itu dan sudah di-merge.`,
        `A week counts when a PR to ${where} was opened in it and has been merged.`,
      )
    : tx(
        locale,
        `Satu minggu terisi kalau ada PR yang dibuka ke ${where}, direview atau sudah di-merge.`,
        `A week counts when a PR was opened to ${where}, in review or merged.`,
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
