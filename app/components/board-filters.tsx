"use client";

import { useRouter } from "next/navigation";
import Link from "@/app/components/responsive-link";
import { PullRequestIcon } from "./activity-view";
import { leaderboardPath, type LeaderboardChoice } from "../lib/activity-url";
import { ACTIVITY_PLACES, BOARD_OF, BOARD_SPANS, type ActivityPlace, type BoardOf, type BoardSpan } from "../lib/github-activity";
import { tx, type Locale } from "../lib/locale";

/**
 * /leaderboard's choices in one row, the way the home board has them: whose
 * repos, which weeks and — for contributions — local or global, each a pill
 * that opens a native picker; and, for contributions, one PR button that
 * switches between every PR opened (green) and merged only (purple). A real GET form, so it works
 * before the script does.
 */
export function BoardFilters({ choice, places, locale }: { choice: LeaderboardChoice; places: boolean; locale: Locale }) {
  const router = useRouter();
  const go = (next: Partial<LeaderboardChoice>) => router.push(leaderboardPath({ ...choice, ...next }), { scroll: false });
  const ofNames: Record<BoardOf, string> = { external: tx(locale, "Kontribusi", "Contributions"), own: tx(locale, "Repo sendiri", "Own repos") };
  const spanNames: Record<BoardSpan, string> = { "4": tx(locale, "4 minggu", "4 weeks"), "8": tx(locale, "8 minggu", "8 weeks"), season: tx(locale, "Musim ini", "This season") };
  const placeNames: Record<ActivityPlace, string> = { all: tx(locale, "Semua", "All"), local: tx(locale, "Lokal", "Local"), global: tx(locale, "Global", "Global") };
  const countName =
    choice.count === "merged"
      ? tx(locale, "Menghitung PR merged saja. Ganti ke semua PR yang dibuka", "Counting merged PRs only. Switch to every PR opened")
      : tx(locale, "Menghitung semua PR yang dibuka. Ganti ke PR merged saja", "Counting every PR opened. Switch to merged PRs only");

  return (
    <form className="lb-filters" action="/leaderboard">
      {choice.count !== "opened" ? <input type="hidden" name="count" value={choice.count} /> : null}
      <label>
        <span className="sr-only">{tx(locale, "Repo siapa", "Whose repos")}</span>
        <select
          name="of"
          className={`lb-filter ${choice.of !== "external" ? "is-set" : ""}`}
          value={choice.of}
          onChange={(event) => go({ of: BOARD_OF.find((of) => of === event.target.value) ?? "external" })}
        >
          {BOARD_OF.map((of) => (
            <option key={of} value={of}>
              {ofNames[of]}
            </option>
          ))}
        </select>
      </label>
      <label>
        <span className="sr-only">{tx(locale, "Minggu yang dihitung", "Weeks counted")}</span>
        <select
          name="weeks"
          className={`lb-filter ${choice.weeks !== "season" ? "is-set" : ""}`}
          value={choice.weeks}
          onChange={(event) => go({ weeks: BOARD_SPANS.find((span) => span === event.target.value) ?? "season" })}
        >
          {BOARD_SPANS.map((span) => (
            <option key={span} value={span}>
              {spanNames[span]}
            </option>
          ))}
        </select>
      </label>
      {places && choice.of === "external" ? (
        <label>
          <span className="sr-only">{tx(locale, "Repo lokal atau global", "Local or global repos")}</span>
          <select
            name="place"
            className={`lb-filter ${choice.place !== "all" ? "is-set" : ""}`}
            value={choice.place}
            onChange={(event) => go({ place: ACTIVITY_PLACES.find((place) => place === event.target.value) ?? "all" })}
          >
            {ACTIVITY_PLACES.map((place) => (
              <option key={place} value={place}>
                {placeNames[place]}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      {choice.of === "own" ? null : (
        <Link
          className="lb-count"
          href={leaderboardPath({ ...choice, count: choice.count === "merged" ? "opened" : "merged" })}
          scroll={false}
          aria-label={countName}
          title={countName}
        >
          <PullRequestIcon merged={choice.count === "merged"} />
        </Link>
      )}
      <noscript>
        <button type="submit">{tx(locale, "Terapkan", "Apply")}</button>
      </noscript>
    </form>
  );
}
