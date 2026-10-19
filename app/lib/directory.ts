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

export type DirectorySource = "internal" | "recommended" | "product";

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
  owner: { name: string };
};

export function repoEntry(
  repo: OpenSourceRepo & { stats?: GitHubRepositoryStats | null },
  locale: Locale,
): DirectoryEntry {
  return {
    key: `repo:${repo.owner}/${repo.repo}`,
    track: "github",
    source: repo.list,
    name: repo.repo,
    owner: repo.owner,
    description: localized(repo.summary, locale),
    labels: repo.reasons.filter((reason) => reason !== "ours").map((reason) => reasonLabel(reason, locale)),
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

/**
 * Narrowed by the tab and the search box. Order is kept as given: ours first,
 * then recommendations, then products — the caller builds it in that order.
 */
export function filterDirectory(
  entries: DirectoryEntry[],
  filters: { track: DirectoryTrack | ""; q: string },
): DirectoryEntry[] {
  const query = searchable(filters.q);
  return entries.filter((entry) => {
    if (filters.track && entry.track !== filters.track) return false;
    if (!query) return true;
    return searchable(
      [entry.name, entry.owner, entry.description, entry.language, ...entry.labels].join(" "),
    ).includes(query);
  });
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
    .replace(/[̀-ͯ]/g, "")
    .trim();
}
