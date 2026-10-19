import { cacheLife } from "next/cache";
import { getGitHubRepositoryStats, type GitHubRepositoryStats } from "./github";
import { OPEN_SOURCE_REPOS, repoSlug, type OpenSourceRepo } from "./open-source";

export type LiveRepo = OpenSourceRepo & { stats: GitHubRepositoryStats | null };

/**
 * The curated catalogue with GitHub's current numbers attached.
 *
 * Cached for hours and shared by every visitor: unauthenticated, the GitHub
 * API allows sixty requests an hour per address, and a serverless function
 * shares its address with strangers. `GITHUB_TOKEN` (any read-only token) lifts
 * that limit; without it a refused request only costs that card its numbers.
 */
export async function listOpenSourceRepos(): Promise<LiveRepo[]> {
  "use cache";
  cacheLife("hours");

  const token = process.env.GITHUB_TOKEN ?? "";
  const stats = await Promise.all(
    OPEN_SOURCE_REPOS.map((repo) => getGitHubRepositoryStats(repo.owner, repo.repo, fetch, token)),
  );

  return OPEN_SOURCE_REPOS.map((repo, index) => {
    const live = stats[index];
    if (!live) console.warn(`[ahsan] GitHub numbers for ${repoSlug(repo)} were skipped.`);
    return {
      ...repo,
      // GitHub's own answer wins once it has one; the curated value is only
      // there for when it does not.
      language: live?.language || repo.language,
      stats: live,
    };
  });
}
