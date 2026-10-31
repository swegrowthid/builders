import assert from "node:assert/strict";
import test from "node:test";

import { buildAuthorQuery, buildProfileQuery, buildPullRequestQuery, calendarMonths, organisationsOf, parseProfile, pullRequestRepos, soloReposOf, weekdayOf } from "../app/lib/github-profile.ts";

const pr = (repo, extra = {}) => ({
  title: `Fix ${repo}`,
  url: `https://github.com/${repo}/pull/${extra.number ?? 1}`,
  number: extra.number ?? 1,
  createdAt: "2026-10-20T00:00:00Z",
  mergedAt: extra.mergedAt ?? null,
  isDraft: false,
  authorAssociation: extra.association ?? "CONTRIBUTOR",
  repository: { nameWithOwner: repo, url: `https://github.com/${repo}`, stargazerCount: 10, isPrivate: extra.private ?? false, owner: { login: repo.split("/")[0] } },
});

const profile = {
  data: {
    user: {
      login: "ana",
      databaseId: 42,
      organizations: { nodes: [{ login: "ana-org" }, { login: "bad name" }] },
      pinnedItems: { nodes: [
        { nameWithOwner: "ana/tool", url: "https://github.com/ana/tool", description: "A tool", stargazerCount: 5, isPrivate: false, primaryLanguage: { name: "Go", color: "#00ADD8" } },
        { nameWithOwner: "ana/secret", url: "https://github.com/ana/secret", isPrivate: true },
      ] },
      contributionsCollection: { contributionCalendar: { totalContributions: 500 }, totalCommitContributions: 300, totalPullRequestContributions: 40, totalPullRequestReviewContributions: 7 },
      repositoriesContributedTo: { totalCount: 9 },
    },
  },
};

test("the searches leave out the member's own repos and organisations", () => {
  assert.equal(buildProfileQuery("bad name"), null);
  const orgs = organisationsOf(profile);
  assert.deepEqual(orgs, ["ana-org"]);
  const { variables } = buildPullRequestQuery("ana", orgs);
  assert.match(variables.open, /is:open .*author:ana -user:ana -org:ana-org/);
  assert.match(variables.merged, /is:merged author:ana -user:ana -org:ana-org/);
});

test("open PRs, merged PRs by repo, pinned repos and the year's numbers", () => {
  const pulls = {
    data: {
      open: { nodes: [pr("big/project", { number: 7 }), pr("ana-org/inside", { association: "MEMBER" }), pr("x/private", { private: true })] },
      merged: {
        issueCount: 4,
        nodes: [
          pr("big/project", { number: 1, mergedAt: "2026-10-01T00:00:00Z" }),
          pr("big/project", { number: 2, mergedAt: "2026-10-09T00:00:00Z" }),
          pr("small/lib", { number: 3, mergedAt: "2026-10-05T00:00:00Z" }),
          pr("hidden/org", { number: 4, mergedAt: "2026-10-06T00:00:00Z", association: "MEMBER" }),
        ],
      },
    },
  };
  const result = parseProfile(profile, pulls, 42);
  assert.deepEqual(result.open.map((row) => [row.repo, row.number]), [["big/project", 7]]);
  assert.deepEqual(result.merged.repos.map((row) => [row.repo, row.merged, row.lastMergedAt]), [
    ["big/project", 2, "2026-10-09T00:00:00Z"],
    ["small/lib", 1, "2026-10-05T00:00:00Z"],
  ]);
  // GitHub counted four; one turned out to be their organisation's.
  assert.equal(result.merged.count, 3);
  assert.equal(result.merged.more, false);
  assert.deepEqual(result.pinned.map((row) => row.repo), ["ana/tool"]);
  assert.deepEqual(result.year, { contributions: 500, commits: 300, pullRequests: 40, reviews: 7 });
  assert.equal(result.reposContributedTo, 9);
});

test("an account that is not the linked one shows nothing", () => {
  assert.equal(parseProfile(profile, { data: {} }, 99), null);
  assert.equal(parseProfile({ data: { user: null } }, { data: {} }), null);
});

test("the profile README becomes the description, as words only", async () => {
  const { parseReadme } = await import("../app/lib/readme.ts");
  const blocks = parseReadme(`<h1 align="center">Hi, I'm Ana <img src="wave.gif" width="28"></h1>
<p align="center"><a href="https://ana.dev"><img src="https://img.shields.io/badge/site-blue"></a></p>

[![Stats](https://github-readme-stats.vercel.app/api?username=ana)](https://github.com/ana)

I build **developer tools** and <script>alert(1)</script>write about _Go_.

## Stack

| a | b |
|---|---|

## Projects
- **[tool](https://github.com/ana/tool)** — a tool
- [local](./docs) and \`code\`

\`\`\`js
console.log("stats")
\`\`\`
`);
  assert.deepEqual(blocks, [
    { kind: "paragraph", inlines: [{ kind: "text", text: "Hi, I'm Ana" }] },
    { kind: "paragraph", inlines: [{ kind: "text", text: "I build " }, { kind: "strong", text: "developer tools" }, { kind: "text", text: " and write about " }, { kind: "em", text: "Go" }, { kind: "text", text: "." }] },
    { kind: "heading", inlines: [{ kind: "text", text: "Projects" }] },
    { kind: "list", items: [
      [{ kind: "link", text: "tool", href: "https://github.com/ana/tool" }, { kind: "text", text: " — a tool" }],
      [{ kind: "text", text: "local" }, { kind: "text", text: " and " }, { kind: "code", text: "code" }],
    ] },
  ]);

  const withReadme = structuredClone(profile);
  withReadme.data.readme = { isPrivate: false, object: { text: "Hello there" } };
  assert.deepEqual(parseProfile(withReadme, { data: {} }, 42).readme, [{ kind: "paragraph", inlines: [{ kind: "text", text: "Hello there" }] }]);
  assert.deepEqual(parseProfile(profile, { data: {} }, 42).readme, []);
});

test("a repository the member wrote nearly alone is not somebody else's, whoever owns it", () => {
  const pulls = { data: {
    open: { nodes: [pr("ana-co/solo", { number: 1 })] },
    merged: { issueCount: 2, nodes: [pr("ana-co/solo", { number: 2, mergedAt: "2026-10-21T00:00:00Z" }), pr("big/project", { number: 3, mergedAt: "2026-10-22T00:00:00Z" })] },
  } };
  const repos = pullRequestRepos(pulls);
  assert.deepEqual(repos, ["ana-co/solo", "big/project"]);
  assert.match(buildAuthorQuery(repos).query, /a1: repository\(owner: "big", name: "project"\)/);
  const commits = (counts) => ({ defaultBranchRef: { target: { history: { nodes: Object.entries(counts).flatMap(([login, n]) => Array.from({ length: n }, () => ({ author: { user: { login } } }))) } } } });
  const solo = soloReposOf(repos, { data: { a0: commits({ Ana: 9, bot: 1 }), a1: commits({ ana: 70, maintainer: 30 }) } }, "ana");
  assert.deepEqual([...solo], ["ana-co/solo"]);

  const result = parseProfile(profile, pulls, 42, solo);
  assert.deepEqual(result.open, []);
  assert.deepEqual(result.merged.repos.map((repo) => repo.repo), ["big/project"]);
  assert.equal(result.merged.count, 1);
});

test("the contribution calendar comes through day by day, short weeks and all", () => {
  // Trimmed from a real answer: weeks from Sunday, the last one cut off at today.
  const withCalendar = structuredClone(profile);
  withCalendar.data.user.contributionsCollection.contributionCalendar = {
    totalContributions: 500,
    weeks: [
      { contributionDays: [
        { date: "2025-11-05", contributionCount: 11, contributionLevel: "FIRST_QUARTILE" },
        { date: "2025-11-06", contributionCount: 0, contributionLevel: "NONE" },
        { date: "not a day", contributionCount: 3, contributionLevel: "FIRST_QUARTILE" },
      ] },
      { contributionDays: [] },
      { contributionDays: [{ date: "2026-11-01", contributionCount: 24, contributionLevel: "FOURTH_QUARTILE" }] },
    ],
  };
  assert.deepEqual(parseProfile(withCalendar, { data: {} }, 42).calendar, [
    [{ date: "2025-11-05", count: 11, level: 1 }, { date: "2025-11-06", count: 0, level: 0 }],
    [{ date: "2026-11-01", count: 24, level: 4 }],
  ]);
  assert.deepEqual(parseProfile(profile, { data: {} }, 42).calendar, []);
  assert.equal(weekdayOf("2025-11-05"), 3);
  assert.equal(weekdayOf("2026-11-01"), 0);
});

test("month names sit where a month's first week starts, and only where they fit", () => {
  const weeksFrom = (sunday, count) => Array.from({ length: count }, (_, index) => {
    const date = new Date(Date.parse(`${sunday}T00:00:00Z`) + index * 7 * 86_400_000).toISOString().slice(0, 10);
    return [{ date, count: 0, level: 0 }];
  });
  // 2 Nov 2025 to 1 Nov 2026, as GitHub sent it on that day: the last week is
  // November's only one, so October is the last month named.
  const year = calendarMonths(weeksFrom("2025-11-02", 53));
  assert.equal(year.length, 12);
  assert.deepEqual(year[0], { column: 0, month: "2025-11" });
  assert.deepEqual(year[1], { column: 5, month: "2025-12" });
  assert.deepEqual(year.at(-1), { column: 48, month: "2026-10" });
  // A year that opens on the last two weeks of a month leaves that month unnamed.
  assert.deepEqual(calendarMonths(weeksFrom("2025-11-23", 6)).map((label) => label.month), ["2025-12"]);
});
