"use server";

import { forgetGitHubToken, gitHubToken } from "./lib/github-token";

/**
 * Starring a repository on GitHub as the visitor, with the token their GitHub
 * sign-in left behind (see app/lib/github-token.ts). Nothing here touches the
 * database: a star lives on GitHub, and the count the directory shows catches
 * up on the next refresh of repo_signals.
 */

/** `owner/name` — the same narrow shape as repo_signals.repo. */
const REPO_KEY = /^[a-z0-9](?:[a-z0-9-]{0,38})\/[a-z0-9._-]{1,100}$/i;
/** More than a directory page ever shows; a bound on what one call may ask. */
const MAX_REPOS = 60;

export type StarResult = { ok: true; starred: boolean } | { ok: false; reason: "connect" | "failed" };

export async function setStar(repo: string, starred: boolean): Promise<StarResult> {
  if (!REPO_KEY.test(repo)) return { ok: false, reason: "failed" };
  const token = await gitHubToken();
  if (!token) return { ok: false, reason: "connect" };

  const response = await github(token, `/user/starred/${repo}`, starred ? "PUT" : "DELETE");
  if (response?.status === 204) return { ok: true, starred };
  if (response) await report(response, `${starred ? "Star" : "Unstar"} ${repo}`);
  if (response?.status === 401) {
    // Revoked or expired: asking again is the only fix, and a stale cookie
    // would only hide that. A 403 is not this — it is the GitHub App missing
    // the Starring permission, which no amount of reconnecting changes.
    await forgetGitHubToken();
    return { ok: false, reason: "connect" };
  }
  return { ok: false, reason: "failed" };
}

/** Which of `repos` the visitor has starred. Empty when GitHub is not connected. */
export async function starredAmong(repos: string[]): Promise<string[]> {
  const token = await gitHubToken();
  if (!token) return [];

  const asked = [...new Set(repos.filter((repo) => REPO_KEY.test(repo)))].slice(0, MAX_REPOS);
  const answers = await Promise.all(
    asked.map(async (repo) => ({ repo, status: (await github(token, `/user/starred/${repo}`, "GET"))?.status })),
  );
  if (answers.some(({ status }) => status === 401)) {
    await forgetGitHubToken();
    return [];
  }
  return answers.filter(({ status }) => status === 204).map(({ repo }) => repo);
}

/**
 * What GitHub said when it refused, in the function log. The button can only
 * say "Failed"; this is where the reason — a missing permission (403), a
 * token GitHub no longer accepts (401), a rate limit — can actually be read.
 */
async function report(response: Response, what: string): Promise<void> {
  const body = await response.text().catch(() => "");
  console.warn(`[ahsan] GitHub refused: ${what} → ${response.status} ${body.slice(0, 300)}`);
}

async function github(token: string, path: string, method: "GET" | "PUT" | "DELETE"): Promise<Response | null> {
  try {
    return await fetch(`https://api.github.com${path}`, {
      method,
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${token}`,
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "builders-swegrowth",
      },
      cache: "no-store",
      signal: AbortSignal.timeout(8_000),
    });
  } catch (error) {
    console.warn(`[ahsan] GitHub ${method} ${path} failed: ${error instanceof Error ? error.message : error}`);
    return null;
  }
}
