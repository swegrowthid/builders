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
 * Three kinds of entry, one shape, so the page is a single list with tabs
 * rather than three sections to scroll past:
 *
 *   - `internal` — open source repositories we maintain;
 *   - `recommended` — somebody else's open source we vouch for;
 *   - `product` — a product listed on Builders that is asking for help, either
 *     by taking pull requests or by naming a role it needs.
 *
 * Pure, so the unit tests read it directly.
 */
export const DIRECTORY_KINDS = ["internal", "recommended", "product"] as const;
export type DirectoryKind = (typeof DIRECTORY_KINDS)[number];

export function isDirectoryKind(value: string): value is DirectoryKind {
  return (DIRECTORY_KINDS as readonly string[]).includes(value);
}

export type DirectoryEntry = {
  key: string;
  kind: DirectoryKind;
  name: string;
  /** Who it belongs to: a GitHub owner, or the founder's name. */
  owner: string;
  description: string;
  /** Short labels: why it is listed, or what help it asks for. */
  labels: string[];
  language: string;
  stars: number | null;
  /** Where the name links — the repo, or the product's page here. */
  href: string;
  /** The one action that matters: where contributing starts. */
  contributeHref: string;
  contributeLabel: string;
  /** True when `contributeHref` leaves this site. */
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
  tags: string[];
  owner: { name: string };
};

export function repoEntry(
  repo: OpenSourceRepo & { stats?: GitHubRepositoryStats | null },
  locale: Locale,
): DirectoryEntry {
  return {
    key: `repo:${repo.owner}/${repo.repo}`,
    kind: repo.list,
    name: repo.repo,
    owner: repo.owner,
    description: localized(repo.summary, locale),
    labels: repo.reasons.filter((reason) => reason !== "ours").map((reason) => reasonLabel(reason, locale)),
    language: repo.stats?.language || repo.language,
    stars: repo.stats ? repo.stats.stars : null,
    href: repoUrl(repo),
    contributeHref: starterIssuesUrl(repo),
    contributeLabel: tx(locale, "Lihat isu pemula", "Starter issues"),
    external: true,
  };
}

/**
 * A product, or null when it is not asking for anything.
 *
 * A product that takes pull requests sends people straight to its GitHub
 * issues; one that only names roles sends them to its page here, where the
 * roles are and where they can offer to take one.
 */
export function productEntry<P extends DirectoryProduct>(
  project: P,
  describe: (project: P) => string,
  roleName: (role: string) => string,
  locale: Locale,
): DirectoryEntry | null {
  const repository = project.openForGitHubContributions ? parseGitHubRepositoryUrl(project.repoUrl) : null;
  if (!repository && project.openSeatCount === 0) return null;

  const page = `/projects/${project.slug}`;
  return {
    key: `product:${project.id}`,
    kind: "product",
    name: project.title,
    owner: project.owner.name,
    description: describe(project),
    labels: [
      ...(repository ? [tx(locale, "Terbuka untuk PR", "Open to PRs")] : []),
      ...project.openRoles.slice(0, 2).map(roleName),
    ],
    language: "",
    stars: null,
    href: page,
    contributeHref: repository ? `${repository.url}/issues` : page,
    contributeLabel: repository ? tx(locale, "Lihat isu", "Open issues") : tx(locale, "Lihat kebutuhan", "See what's needed"),
    external: Boolean(repository),
  };
}

/**
 * Narrowed by the tab and the search box. Order is kept as given: ours first,
 * then recommendations, then products — the caller builds it in that order.
 */
export function filterDirectory(
  entries: DirectoryEntry[],
  filters: { kind: DirectoryKind | ""; q: string },
): DirectoryEntry[] {
  const query = searchable(filters.q);
  return entries.filter((entry) => {
    if (filters.kind && entry.kind !== filters.kind) return false;
    if (!query) return true;
    return searchable(
      [entry.name, entry.owner, entry.description, entry.language, ...entry.labels].join(" "),
    ).includes(query);
  });
}

export function kindLabel(kind: DirectoryKind, locale: Locale): string {
  if (kind === "internal") return tx(locale, "Open source kami", "Our open source");
  if (kind === "recommended") return tx(locale, "Rekomendasi", "Recommended");
  return tx(locale, "Produk builders", "Builders' products");
}

function searchable(value: string): string {
  return value
    .toLocaleLowerCase("id")
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .trim();
}
