import type { PersonAtWork } from "./data";

/**
 * The two groups the community page is split into.
 *
 *   - `contributors` — people who have put a GitHub account on their profile.
 *     That is the one thing a would-be open source contributor cannot do
 *     without, and the one a maintainer looks at first, so it is the line.
 *   - `founders` — people who own a product listed on Builders. They are who
 *     a contributor ends up working with when they help a product rather than
 *     a library.
 *
 * Somebody can be in both, and is shown in both: a founder who also sends PRs
 * elsewhere is exactly the kind of person a newcomer should meet.
 */
export const COMMUNITY_GROUPS = ["contributors", "founders"] as const;
export type CommunityGroup = (typeof COMMUNITY_GROUPS)[number];

export function isCommunityGroup(value: string): value is CommunityGroup {
  return (COMMUNITY_GROUPS as readonly string[]).includes(value);
}

const HANDLE = /^[a-z\d](?:[a-z\d]|-(?=[a-z\d])){0,38}$/i;

/**
 * The GitHub username in whatever a person typed into their profile.
 *
 * The profile form stores a URL, but older rows and hand edits hold a bare
 * handle or an `@handle`. Anything that is not plainly a GitHub account —
 * another host, an organisation's repo, a typo with spaces — reads as none,
 * so a stray link never puts somebody in the contributors group.
 */
export function githubHandle(value: string): string {
  const raw = value.trim().replace(/^@/, "");
  if (!raw) return "";
  if (HANDLE.test(raw)) return raw;

  try {
    const url = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
    if (url.hostname !== "github.com" && url.hostname !== "www.github.com") return "";
    const parts = url.pathname.split("/").filter(Boolean);
    if (parts.length !== 1) return "";
    return HANDLE.test(parts[0]) ? parts[0] : "";
  } catch {
    return "";
  }
}

export function isContributor(entry: PersonAtWork): boolean {
  return githubHandle(entry.person.github) !== "";
}

export function isFounder(entry: PersonAtWork): boolean {
  return entry.building.length > 0;
}

export function inGroup(entry: PersonAtWork, group: CommunityGroup): boolean {
  return group === "contributors" ? isContributor(entry) : isFounder(entry);
}

/**
 * Members of one group, those with the most visible work first.
 *
 * For founders that is the products they run; for contributors it is the
 * projects they have helped on. Name breaks the tie so the order is stable
 * between renders.
 */
export function communityGroup(people: PersonAtWork[], group: CommunityGroup): PersonAtWork[] {
  const weight = (entry: PersonAtWork) =>
    group === "founders"
      ? entry.building.length * 2 + entry.helping.length
      : entry.helping.length * 2 + entry.building.length;

  return people
    .filter((entry) => inGroup(entry, group))
    .sort((a, b) => weight(b) - weight(a) || a.person.name.localeCompare(b.person.name, "id"));
}
