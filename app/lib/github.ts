import { isHttpUrl } from "./brief";

export type GitHubRepository = {
  owner: string;
  repo: string;
  url: string;
};

export type GitHubProjectDraft = {
  title: string;
  tagline: string;
  problem: string;
  solution: string;
  audience: string;
  now: string;
  tags: string[];
  liveUrl: string;
  readmeFound: boolean;
};

type GitHubRepositoryResponse = {
  name?: unknown;
  description?: unknown;
  homepage?: unknown;
  topics?: unknown;
};

type GitHubReadmeResponse = {
  content?: unknown;
  encoding?: unknown;
};

const GITHUB_API = "https://api.github.com";
const REQUEST_HEADERS = {
  Accept: "application/vnd.github+json",
  "X-GitHub-Api-Version": "2022-11-28",
  "User-Agent": "Ahsan-Project",
};

/**
 * Accept only the ordinary repository URL somebody can copy from GitHub.
 *
 * Keeping this narrow is intentional: this value is later used to build an
 * upstream request, so accepting arbitrary hosts would turn a helpful import
 * button into an SSRF primitive.
 */
export function parseGitHubRepositoryUrl(value: string): GitHubRepository | null {
  try {
    const url = new URL(value.trim());
    if (url.protocol !== "https:" || (url.hostname !== "github.com" && url.hostname !== "www.github.com")) {
      return null;
    }

    const parts = url.pathname.split("/").filter(Boolean);
    if (parts.length !== 2 || !parts[0] || !parts[1]) return null;

    const [owner, rawRepo] = parts;
    const repo = rawRepo.replace(/\.git$/i, "");
    if (!repo) return null;

    return {
      owner,
      repo,
      url: `https://github.com/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`,
    };
  } catch {
    return null;
  }
}

export function isGitHubRepositoryUrl(value: string): boolean {
  return parseGitHubRepositoryUrl(value) !== null;
}

/** Reads public repository metadata plus its README, without saving anything. */
export async function getGitHubProjectDraft(
  repoUrl: string,
  request: typeof fetch = fetch,
): Promise<GitHubProjectDraft> {
  const repository = parseGitHubRepositoryUrl(repoUrl);
  if (!repository) {
    throw new Error("Use a public GitHub repository URL, for example https://github.com/organization/project.");
  }

  const path = `/repos/${encodeURIComponent(repository.owner)}/${encodeURIComponent(repository.repo)}`;
  const response = await githubRequest(request, `${GITHUB_API}${path}`);
  if (response.status === 404) throw new Error("That GitHub repository was not found or is not public.");
  if (response.status === 403) throw new Error("GitHub is limiting requests. Please try again shortly.");
  if (!response.ok) throw new Error("GitHub repository data could not be read. Please try again shortly.");

  const data = (await response.json()) as GitHubRepositoryResponse;
  const readmeResponse = await githubRequest(request, `${GITHUB_API}${path}/readme`);
  if (!readmeResponse.ok && readmeResponse.status !== 404) {
    throw new Error("The GitHub README could not be read. Please try again shortly.");
  }
  const readme = readmeResponse.ok ? readmeText((await readmeResponse.json()) as GitHubReadmeResponse) : "";

  return {
    title: clip(markdownTitle(readme) || stringValue(data.name), 60),
    tagline: clip(firstParagraph(readme) || stringValue(data.description), 140),
    problem: clip(section(readme, ["masalah", "problem"]), 2000),
    solution: clip(section(readme, ["solusi", "solution", "what we build", "what we're building"]), 2000),
    audience: clip(section(readme, ["untuk siapa", "audience", "target users", "who is it for"]), 600),
    now: clip(section(readme, ["status", "what's next", "selanjutnya", "roadmap"]), 200),
    tags: topics(data.topics),
    liveUrl: publicUrl(data.homepage),
    readmeFound: Boolean(readme),
  };
}

/** A third-party import should never keep the form busy indefinitely. */
function githubRequest(request: typeof fetch, url: string): Promise<Response> {
  return request(url, { headers: REQUEST_HEADERS, signal: AbortSignal.timeout(4_500) });
}

function readmeText(value: GitHubReadmeResponse): string {
  if (value.encoding !== "base64" || typeof value.content !== "string") return "";

  try {
    return Buffer.from(value.content.replace(/\n/g, ""), "base64").toString("utf8");
  } catch {
    return "";
  }
}

function markdownTitle(markdown: string): string {
  const match = markdown.match(/^\s*#\s+(.+)$/m);
  return match ? plainText(match[1]) : "";
}

function firstParagraph(markdown: string): string {
  const withoutTitle = markdown.replace(/^\s*#\s+.+$/m, "");
  const paragraphs = withoutTitle
    .split(/\n\s*\n/)
    .map(plainText)
    .filter((paragraph) => paragraph.length >= 20 && !/^(\[!\[|https?:\/\/)/i.test(paragraph));
  return paragraphs[0] || "";
}

/** Returns the copy under a named Markdown heading, stopping at its next peer. */
function section(markdown: string, names: string[]): string {
  const headings = [...markdown.matchAll(/^(#{1,6})\s+(.+)$/gm)];
  const matchIndex = headings.findIndex((heading) => names.includes(normaliseHeading(heading[2])));
  if (matchIndex === -1) return "";

  const match = headings[matchIndex];
  const level = match[1].length;
  const start = (match.index || 0) + match[0].length;
  const next = headings.slice(matchIndex + 1).find((heading) => heading[1].length <= level);
  const end = next?.index ?? markdown.length;
  return plainText(markdown.slice(start, end));
}

function normaliseHeading(value: string): string {
  return plainText(value).toLowerCase().replace(/[.:!?]+$/g, "").trim();
}

function plainText(value: string): string {
  return value
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/`{1,3}([^`]+)`{1,3}/g, "$1")
    .replace(/^\s{0,3}[-*+]\s+/gm, "")
    .replace(/^\s*\d+\.\s+/gm, "")
    .replace(/^\s*>\s?/gm, "")
    .replace(/<[^>]+>/g, "")
    .replace(/[\*_~]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function topics(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter((topic): topic is string => typeof topic === "string").map((topic) => topic.trim().toLowerCase()).filter(Boolean))].slice(0, 6);
}

function stringValue(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function publicUrl(value: unknown): string {
  const url = stringValue(value);
  return isHttpUrl(url) ? url : "";
}

function clip(value: string, maximum: number): string {
  return value.slice(0, maximum).trim();
}

export type GitHubRepositoryStats = {
  stars: number;
  openIssues: number;
  language: string;
  pushedAt: string;
  archived: boolean;
};

type GitHubRepositoryStatsResponse = {
  stargazers_count?: unknown;
  open_issues_count?: unknown;
  language?: unknown;
  pushed_at?: unknown;
  archived?: unknown;
};

/**
 * The few numbers the open source listing shows beside a curated entry.
 *
 * Returns null rather than throwing: these numbers decorate a listing that is
 * complete without them, so a rate limit or a renamed repository costs the
 * numbers on one card and nothing else. `owner` and `repo` come from the
 * curated catalogue, never from a request, but are encoded all the same.
 */
export async function getGitHubRepositoryStats(
  owner: string,
  repo: string,
  request: typeof fetch = fetch,
  token = "",
): Promise<GitHubRepositoryStats | null> {
  try {
    const response = await request(
      `${GITHUB_API}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`,
      {
        headers: token ? { ...REQUEST_HEADERS, Authorization: `Bearer ${token}` } : REQUEST_HEADERS,
        signal: AbortSignal.timeout(4_500),
      },
    );
    if (!response.ok) return null;

    const data = (await response.json()) as GitHubRepositoryStatsResponse;
    return {
      stars: numberValue(data.stargazers_count),
      openIssues: numberValue(data.open_issues_count),
      language: stringValue(data.language),
      pushedAt: stringValue(data.pushed_at),
      archived: data.archived === true,
    };
  } catch {
    return null;
  }
}

function numberValue(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}
