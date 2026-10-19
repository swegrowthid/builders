import { tx, type Locale } from "./locale";
import { isGitHubHandle } from "./oss";

/**
 * Trust signals on a directory entry.
 *
 * Unlike the reasons a repo is listed (it is our stack, it is beginner
 * friendly), a badge says something about *people*: somebody we know has
 * already been through this project's review, its maintainer is in our group,
 * its maintainers are Indonesian. That is what makes a newcomer brave enough
 * to open the first PR, so it gets its own, louder treatment on the row.
 *
 * Two sources, merged per kind:
 *
 *   - members' own records — the repos they list on their profile as
 *     contributor or maintainer (`app/lib/oss.ts`), which is where most
 *     badges should come from;
 *   - hand-set ones, for what no member can say for themselves (the
 *     maintainers are Indonesian) or for somebody not signed up yet:
 *     repositories carry theirs in `app/lib/open-source.ts`, on `badges`, and
 *     builders' products in `PRODUCT_BADGES` below, by slug.
 */
export const BADGE_KINDS = ["friend-contributed", "in-our-group", "indonesian"] as const;
export type BadgeKind = (typeof BADGE_KINDS)[number];

export type Badge = {
  kind: BadgeKind;
  /**
   * GitHub usernames of the people the badge is about — who contributed, who
   * is in the group. Optional: "maintainer Indonesia" needs nobody named.
   */
  people?: string[];
  /**
   * How many people, when it is more than the names given — a product's
   * helpers are counted from its seats, not listed. Defaults to `people`.
   */
  count?: number;
  /**
   * Builders usernames, when the badge comes from members' own records, so
   * the badge can link to their profile here rather than to GitHub.
   */
  profiles?: string[];
};

/**
 * Badges for products listed on Builders, keyed by the product's slug (the
 * part after `/projects/` in its address).
 *
 * Example:
 *   "main-aman": [{ kind: "friend-contributed", people: ["someone"] }],
 */
export const PRODUCT_BADGES: Record<string, Badge[]> = {};

export function isBadgeKind(value: string): value is BadgeKind {
  return (BADGE_KINDS as readonly string[]).includes(value);
}

/** The badge's name, as the sidebar filter shows it. */
export function badgeKindLabel(kind: BadgeKind, locale: Locale): string {
  if (kind === "friend-contributed") return tx(locale, "Teman kita pernah kontribusi", "Friends have contributed");
  if (kind === "in-our-group") return tx(locale, "Ada di grup kita", "In our group");
  return tx(locale, "Maintainer Indonesia", "Indonesian maintainers");
}

/** The badge as a row shows it — with a count when people are named. */
export function badgeLabel(badge: Badge, locale: Locale): string {
  const count = badge.count ?? badge.people?.length ?? 0;
  if (badge.kind === "friend-contributed" && count > 0) {
    return tx(locale, `${count} teman pernah kontribusi`, `${count} ${count === 1 ? "friend has" : "friends have"} contributed`);
  }
  if (badge.kind === "in-our-group") {
    return count > 1
      ? tx(locale, `${count} maintainer di grup kita`, `${count} maintainers in our group`)
      : tx(locale, "Maintainer di grup kita", "Maintainer in our group");
  }
  return badgeKindLabel(badge.kind, locale);
}

/** Only well-formed GitHub usernames — they become avatar and profile URLs. */
export function badgePeople(badge: Badge): string[] {
  return [...new Set((badge.people ?? []).map((person) => person.trim().replace(/^@/, "")))].filter((person) =>
    isGitHubHandle(person),
  );
}
