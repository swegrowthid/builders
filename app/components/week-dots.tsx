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
