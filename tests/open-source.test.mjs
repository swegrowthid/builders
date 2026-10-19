import assert from "node:assert/strict";
import test from "node:test";

import { OPEN_SOURCE_REPOS, REPO_REASONS, starterIssuesUrl } from "../app/lib/open-source.ts";
import { getGitHubRepositoryStats } from "../app/lib/github.ts";

test("every curated repo is complete, unique, and says why it is listed", () => {
  const seen = new Set();
  for (const repo of OPEN_SOURCE_REPOS) {
    const slug = `${repo.owner}/${repo.repo}`.toLowerCase();
    assert.ok(!seen.has(slug), `${slug} is listed twice`);
    seen.add(slug);
    assert.ok(repo.reasons.length > 0, `${slug} has no reason`);
    for (const reason of repo.reasons) assert.ok(REPO_REASONS.includes(reason), `${slug}: ${reason}`);
    assert.ok(repo.summary.id && repo.summary.en, `${slug} needs a summary in both languages`);
    assert.ok(repo.why.id && repo.why.en, `${slug} needs a why in both languages`);
    // "ours" is what internal means; a recommended repo carrying it is a typo.
    assert.equal(repo.reasons.includes("ours"), repo.list === "internal", `${slug}: list and "ours" disagree`);
  }
});

test("the starter link lands on the repo's labelled open issues", () => {
  const url = new URL(starterIssuesUrl({ owner: "acme", repo: "tool", starterLabel: "good first issue" }));
  assert.equal(url.origin + url.pathname, "https://github.com/acme/tool/issues");
  assert.equal(url.searchParams.get("q"), 'is:issue is:open label:"good first issue"');
  assert.equal(
    new URL(starterIssuesUrl({ owner: "acme", repo: "tool", starterLabel: "" })).searchParams.get("q"),
    "is:issue is:open",
  );
});

test("GitHub numbers are read when available and quietly skipped when not", async () => {
  const requests = [];
  const ok = async (url, init) => {
    requests.push({ url, auth: init.headers.Authorization });
    return Response.json({ stargazers_count: 42, open_issues_count: 3, language: "Go", pushed_at: "2026-10-01T00:00:00Z", archived: false });
  };
  assert.deepEqual(await getGitHubRepositoryStats("acme", "tool", ok, "secret"), {
    stars: 42,
    openIssues: 3,
    language: "Go",
    pushedAt: "2026-10-01T00:00:00Z",
    archived: false,
  });
  assert.equal(requests[0].url, "https://api.github.com/repos/acme/tool");
  assert.equal(requests[0].auth, "Bearer secret");

  assert.equal(await getGitHubRepositoryStats("acme", "tool", async () => new Response("", { status: 403 })), null);
  assert.equal(await getGitHubRepositoryStats("acme", "tool", async () => { throw new Error("offline"); }), null);
});
