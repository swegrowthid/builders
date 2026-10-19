import assert from "node:assert/strict";
import test from "node:test";

import { filterDirectory, productEntry, repoEntry } from "../app/lib/directory.ts";
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

test("a repo goes straight to its starter issues, with GitHub's numbers when known", () => {
  const repo = OPEN_SOURCE_REPOS.find((entry) => entry.list === "internal");
  const entry = repoEntry({ ...repo, stats: { stars: 12, openIssues: 1, language: "Rust", pushedAt: "", archived: false } }, "en");
  assert.equal(entry.kind, "internal");
  assert.equal(entry.language, "Rust");
  assert.equal(entry.stars, 12);
  assert.ok(entry.external);
  assert.match(entry.contributeHref, /\/issues\?q=/);
  assert.ok(!entry.labels.includes("Ours"), "every internal entry is ours; the tab already says so");

  assert.equal(repoEntry(repo, "en").stars, null);
});

test("a product asking for nothing is left out of the directory", () => {
  assert.equal(productEntry(product(), describe, roleName, "en"), null);
  // Saying "open to PRs" without a GitHub repository to send them to is not an invitation either.
  assert.equal(productEntry(product({ openForGitHubContributions: true, repoUrl: "https://example.com" }), describe, roleName, "en"), null);
});

test("a product open to PRs links to its GitHub issues", () => {
  const entry = productEntry(
    product({ openForGitHubContributions: true, repoUrl: "https://github.com/ana/tool" }),
    describe,
    roleName,
    "en",
  );
  assert.equal(entry.contributeHref, "https://github.com/ana/tool/issues");
  assert.ok(entry.external);
  assert.deepEqual(entry.labels, ["Open to PRs"]);
});

test("a product that only names roles links to its page here", () => {
  const entry = productEntry(product({ openSeatCount: 2, openRoles: ["design", "qa", "pm"] }), describe, roleName, "en");
  assert.equal(entry.contributeHref, "/projects/tool");
  assert.equal(entry.external, false);
  assert.deepEqual(entry.labels, ["DESIGN", "QA"]);
});

test("filters by tab and by search, keeping the given order", () => {
  const entries = [
    ...OPEN_SOURCE_REPOS.map((repo) => repoEntry(repo, "en")),
    productEntry(product({ openSeatCount: 1, openRoles: ["design"] }), describe, roleName, "en"),
  ];
  assert.deepEqual(filterDirectory(entries, { kind: "product", q: "" }).map((entry) => entry.name), ["Tool"]);
  assert.ok(filterDirectory(entries, { kind: "recommended", q: "" }).every((entry) => entry.kind === "recommended"));
  assert.ok(filterDirectory(entries, { kind: "", q: "GO" }).some((entry) => entry.name === "heimdall"));
  assert.deepEqual(filterDirectory(entries, { kind: "", q: "ana" }).map((entry) => entry.name), ["Tool"]);
  assert.equal(filterDirectory(entries, { kind: "", q: "nothing like this" }).length, 0);
  assert.equal(filterDirectory(entries, { kind: "", q: "" }).length, entries.length);
});
