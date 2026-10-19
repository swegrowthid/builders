import { BADGE_KINDS, PRODUCT_BADGES, type Badge, type BadgeKind } from "./badges";
import { memberBadges, mergeBadges, type OssMember } from "./oss";
import type { GitHubRepositoryStats } from "./github";
import { parseGitHubRepositoryUrl } from "./github";
import { tx, type Locale } from "./locale";
import {
  localized,
  reasonLabel,
  repoUrl,
  starterIssuesUrl,
  type OpenSourceRepo,
} from "./open-source";

/**
 * The directory: every project somebody can contribute to, in one list.
 *
 * Split by *how* you contribute, because that is the first thing somebody
 * decides and the two paths do not overlap:
 *
 *   - `github` — code, through a pull request on GitHub. Open source we
 *     maintain, open source we recommend, and builders' products that take PRs.
 *   - `role` — joining a builders' product in a named role (design, product,
 *     research, content, engineering…), asked for and answered on this site.
 *
 * A product that does both is listed once on each path, with the action that
 * path needs. `source` says where an entry comes from, as a label.
 *
 * Pure, so the unit tests read it directly.
 */
export const DIRECTORY_TRACKS = ["github", "role"] as const;
export type DirectoryTrack = (typeof DIRECTORY_TRACKS)[number];

export function isDirectoryTrack(value: string): value is DirectoryTrack {
  return (DIRECTORY_TRACKS as readonly string[]).includes(value);
}

export const DIRECTORY_SOURCES = ["internal", "recommended", "product"] as const;
export type DirectorySource = (typeof DIRECTORY_SOURCES)[number];

export function isDirectorySource(value: string): value is DirectorySource {
  return (DIRECTORY_SOURCES as readonly string[]).includes(value);
}

export type DirectoryEntry = {
  key: string;
  track: DirectoryTrack;
  source: DirectorySource;
  name: string;
  /** Who it belongs to: a GitHub owner, or the founder's name. */
  owner: string;
  description: string;
  /** Why a repo is listed, or the roles a product is asking for. */
  labels: string[];
  /** Hand-set trust signals about the people around it — see `badges.ts`. */
  badges: Badge[];
  language: string;
  stars: number | null;
  /** Where the name links — the repo, or the product's page here. */
  href: string;
  /** The one action that matters on this path. */
  actionHref: string;
  actionLabel: string;
  /** True when `actionHref` leaves this site. */
  external: boolean;
};

/** The slice of a Builders project the directory needs. */
export type DirectoryProduct = {
  id: number;
  slug: string;
  title: string;
  tagline: string;
  repoUrl: string;
  openForGitHubContributions: boolean;
  openSeatCount: number;
  openRoles: string[];
  /** Filled seats — people who have already joined and helped. */
  activeMemberCount: number;
  owner: { name: string };
};

/**
 * A repository's entry. `members` are everybody's open source records: who
 * among us has contributed to or maintains this repo becomes its badges,
 * alongside whatever was set by hand in the catalogue.
 */
export function repoEntry(
  repo: OpenSourceRepo & { stats?: GitHubRepositoryStats | null },
  locale: Locale,
  members: OssMember[] = [],
): DirectoryEntry {
  return {
    key: `repo:${repo.owner}/${repo.repo}`,
    track: "github",
    source: repo.list,
    name: repo.repo,
    owner: repo.owner,
    description: localized(repo.summary, locale),
    labels: repo.reasons.filter((reason) => reason !== "ours").map((reason) => reasonLabel(reason, locale)),
    badges: mergeBadges(repo.badges, memberBadges(`${repo.owner}/${repo.repo}`, members)),
    language: repo.stats?.language || repo.language,
    stars: repo.stats ? repo.stats.stars : null,
    href: repoUrl(repo),
    actionHref: starterIssuesUrl(repo),
    actionLabel: tx(locale, "Isu pemula di GitHub", "Starter issues on GitHub"),
    external: true,
  };
}

/**
 * A product's entries: one on the GitHub path when it takes pull requests on
 * a GitHub repository, one on the role path when it names roles it needs, and
 * none when it asks for nothing.
 */
export function productEntries<P extends DirectoryProduct>(
  project: P,
  describe: (project: P) => string,
  roleName: (role: string) => string,
  locale: Locale,
): DirectoryEntry[] {
  const repository = project.openForGitHubContributions ? parseGitHubRepositoryUrl(project.repoUrl) : null;
  const page = `/projects/${project.slug}`;
  const base = {
    source: "product" as const,
    name: project.title,
    owner: project.owner.name,
    description: describe(project),
    language: "",
    stars: null,
    href: page,
    // A filled seat is somebody from here who already joined: the product's
    // own "a friend has been here", counted rather than named.
    badges: mergeBadges(
      PRODUCT_BADGES[project.slug] ?? [],
      project.activeMemberCount > 0 ? [{ kind: "friend-contributed", count: project.activeMemberCount }] : [],
    ),
  };
  const entries: DirectoryEntry[] = [];

  if (repository) {
    entries.push({
      ...base,
      key: `product:${project.id}:github`,
      track: "github",
      labels: [],
      actionHref: `${repository.url}/issues`,
      actionLabel: tx(locale, "Isu di GitHub", "Issues on GitHub"),
      external: true,
    });
  }
  if (project.openSeatCount > 0) {
    entries.push({
      ...base,
      key: `product:${project.id}:role`,
      track: "role",
      labels: project.openRoles.map(roleName),
      actionHref: `${page}?tab=collaboration#help-heading`,
      actionLabel: tx(locale, "Lihat peran", "See the roles"),
      external: false,
    });
  }
  return entries;
}

export type DirectoryFilters = {
  track: DirectoryTrack;
  /** Where entries come from — ours, recommended, or a builders' product. Empty for any. */
  source: DirectorySource | "";
  /** Only entries carrying this badge. Empty for any. */
  badge: BadgeKind | "";
  /** A language on the GitHub path, a role on the role path. Empty for any. */
  facet: string;
  q: string;
};

/** What the chips on a path filter by: a repo's language, or a role asked for. */
function facetsOf(entry: DirectoryEntry): string[] {
  return entry.track === "github" ? (entry.language ? [entry.language] : []) : entry.labels;
}

/**
 * One path, narrowed by its chip and the search box. Order is kept as given:
 * ours first, then recommendations, then products — the caller builds it in
 * that order.
 */
export function filterDirectory(entries: DirectoryEntry[], filters: DirectoryFilters): DirectoryEntry[] {
  const query = searchable(filters.q);
  const facet = searchable(filters.facet);
  return entries.filter((entry) => {
    if (entry.track !== filters.track) return false;
    if (filters.source && entry.source !== filters.source) return false;
    if (filters.badge && !entry.badges.some((badge) => badge.kind === filters.badge)) return false;
    if (facet && !facetsOf(entry).some((value) => searchable(value) === facet)) return false;
    if (!query) return true;
    return searchable(
      [entry.name, entry.owner, entry.description, entry.language, ...entry.labels].join(" "),
    ).includes(query);
  });
}

/** How many entries on one path carry each badge, in the order badges are defined. */
export function badgeCounts(entries: DirectoryEntry[], track: DirectoryTrack): { kind: BadgeKind; count: number }[] {
  return BADGE_KINDS.map((kind) => ({
    kind,
    count: entries.filter((entry) => entry.track === track && entry.badges.some((badge) => badge.kind === kind)).length,
  })).filter(({ count }) => count > 0);
}

/** The chips for one path, most common first. */
export function directoryFacets(entries: DirectoryEntry[], track: DirectoryTrack): { value: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const entry of entries) {
    if (entry.track !== track) continue;
    for (const value of facetsOf(entry)) counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([value, count]) => ({ value, count }))
    .sort((a, b) => b.count - a.count || a.value.localeCompare(b.value));
}

export function sourceLabel(source: DirectorySource, locale: Locale): string {
  if (source === "internal") return tx(locale, "Open source kami", "Our open source");
  if (source === "recommended") return tx(locale, "Rekomendasi", "Recommended");
  return tx(locale, "Produk builders", "Builders' product");
}

export function trackLabel(track: DirectoryTrack, locale: Locale): string {
  return track === "github"
    ? tx(locale, "Open source di GitHub", "Open source on GitHub")
    : tx(locale, "Peran lain", "Other roles");
}

function searchable(value: string): string {
  return value
    .toLocaleLowerCase("id")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}
