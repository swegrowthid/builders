import assert from "node:assert/strict";
import test from "node:test";

import { filterDirectory, productEntries, repoEntry } from "../app/lib/directory.ts";
import { OPEN_SOURCE_REPOS } from "../app/lib/open-source.ts";

const describe = (project) => project.tagline;
const roleName = (role) => role.toUpperCase();

function product(overrides = {}) {
  return {
    id: 1,
    slug: "tool",
    title: "Tool",
    tagline: "Does a thing",
    repoUrl: "",
    openForGitHubContributions: false,
    openSeatCount: 0,
    openRoles: [],
    tags: [],
    owner: { name: "Ana" },
    ...overrides,
  };
}

test("a repo is on the GitHub path and goes straight to its starter issues", () => {
  const repo = OPEN_SOURCE_REPOS.find((entry) => entry.list === "internal");
  const entry = repoEntry({ ...repo, stats: { stars: 12, openIssues: 1, language: "Rust", pushedAt: "", archived: false } }, "en");
  assert.equal(entry.track, "github");
  assert.equal(entry.source, "internal");
  assert.equal(entry.language, "Rust");
  assert.equal(entry.stars, 12);
  assert.ok(entry.external);
  assert.match(entry.actionHref, /\/issues\?q=/);
  assert.ok(!entry.labels.includes("Ours"), "every internal entry is ours; the source label already says so");

  assert.equal(repoEntry(repo, "en").stars, null);
});

test("a product asking for nothing is left out of the directory", () => {
  assert.deepEqual(productEntries(product(), describe, roleName, "en"), []);
  // Saying "open to PRs" without a GitHub repository to send them to is not an invitation either.
  assert.deepEqual(productEntries(product({ openForGitHubContributions: true, repoUrl: "https://example.com" }), describe, roleName, "en"), []);
});

test("a product open to PRs is on the GitHub path, linking to its issues", () => {
  const [entry, ...rest] = productEntries(
    product({ openForGitHubContributions: true, repoUrl: "https://github.com/ana/tool" }),
    describe,
    roleName,
    "en",
  );
  assert.equal(rest.length, 0);
  assert.equal(entry.track, "github");
  assert.equal(entry.actionHref, "https://github.com/ana/tool/issues");
  assert.ok(entry.external);
});

test("a product naming roles is on the role path, linking to its roles here", () => {
  const [entry, ...rest] = productEntries(product({ openSeatCount: 2, openRoles: ["design", "qa", "pm"] }), describe, roleName, "en");
  assert.equal(rest.length, 0);
  assert.equal(entry.track, "role");
  assert.equal(entry.actionHref, "/projects/tool?tab=collaboration#help-heading");
  assert.equal(entry.external, false);
  assert.deepEqual(entry.labels, ["DESIGN", "QA", "PM"]);
});

test("a product doing both is listed once on each path", () => {
  const entries = productEntries(
    product({ openForGitHubContributions: true, repoUrl: "https://github.com/ana/tool", openSeatCount: 1, openRoles: ["design"] }),
    describe,
    roleName,
    "en",
  );
  assert.deepEqual(entries.map((entry) => entry.track), ["github", "role"]);
  assert.equal(new Set(entries.map((entry) => entry.key)).size, 2);
});

test("filters by path and by search, keeping the given order", () => {
  const entries = [
    ...OPEN_SOURCE_REPOS.map((repo) => repoEntry(repo, "en")),
    ...productEntries(product({ openSeatCount: 1, openRoles: ["design"] }), describe, roleName, "en"),
  ];
  assert.deepEqual(filterDirectory(entries, { track: "role", q: "" }).map((entry) => entry.name), ["Tool"]);
  assert.ok(filterDirectory(entries, { track: "github", q: "" }).every((entry) => entry.track === "github"));
  assert.ok(filterDirectory(entries, { track: "", q: "GO" }).some((entry) => entry.name === "heimdall"));
  assert.deepEqual(filterDirectory(entries, { track: "", q: "design" }).map((entry) => entry.name), ["Tool"]);
  assert.equal(filterDirectory(entries, { track: "", q: "nothing like this" }).length, 0);
  assert.equal(filterDirectory(entries, { track: "", q: "" }).length, entries.length);
});
