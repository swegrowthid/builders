import assert from "node:assert/strict";
import test from "node:test";

import {
  badgeCounts,
  directoryFacets,
  filterDirectory,
  isNew,
  isQuiet,
  openingCounts,
  paginate,
  prTier,
  prTierCounts,
  productEntries,
  repoEntry,
  stageCounts,
} from "../app/lib/directory.ts";
// Fixtures, not the catalogue: the catalogue lives in the database now.
const repo = (over = {}) => ({
  id: 1,
  owner: "acme",
  repo: "tool",
  list: "recommended",
  reasons: ["beginner-friendly"],
  why: "Maintainer-nya responsif.",
  summary: "A tool.",
  indonesian: false,
  starterLabel: "good first issue",
  status: "approved",
  submittedBy: { username: "ana", name: "Ana" },
  createdAt: "2026-10-21T00:00:00Z",
  ...over,
});
const OPEN_SOURCE_REPOS = [
  repo({ id: 1, owner: "zikrulihsan", repo: "builders", list: "internal", indonesian: false }),
  repo({ id: 2, owner: "vercel", repo: "next.js", reasons: ["our-stack"], stats: { stars: 9, description: "", openIssues: 0, language: "JavaScript", pushedAt: "", archived: false } }),
  repo({ id: 3, owner: "gojek", repo: "heimdall", indonesian: true, summary: "Bahasa Go HTTP client.", stats: { stars: 1, description: "", openIssues: 0, language: "Go", pushedAt: "", archived: false } }),
];

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
  const entry = repoEntry({ ...repo, stats: { stars: 12, description: "", openIssues: 1, language: "Rust", pushedAt: "", archived: false } }, "en");
  assert.equal(entry.track, "github");
  // Our own repositories count as the community's, alongside members' products.
  assert.equal(entry.source, "community");
  assert.equal(entry.kind, "repo");
  assert.equal(entry.welcomesPRs, true);
  assert.equal(entry.language, "Rust");
  assert.equal(entry.stars, 12);
  assert.ok(entry.external);
  assert.match(entry.actionHref, /\/issues\?q=/);
  assert.equal(entry.why, "Maintainer-nya responsif.");
  assert.deepEqual(entry.submittedBy, { username: "ana", name: "Ana" });

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

test("a product with a GitHub repo is on the code path even before it opens to PRs", () => {
  const [entry, ...rest] = productEntries(product({ repoUrl: "https://github.com/ana/tool" }), describe, roleName, "en");
  assert.equal(rest.length, 0);
  assert.equal(entry.track, "github");
  assert.equal(entry.actionKind, "repo");
  assert.equal(entry.actionHref, "https://github.com/ana/tool");
  assert.deepEqual(entry.labels, []);
  assert.equal(entry.welcomesPRs, false);

  const [open] = productEntries(
    product({ repoUrl: "https://github.com/ana/tool", openForGitHubContributions: true }),
    describe,
    roleName,
    "en",
  );
  assert.equal(open.actionKind, "issues");
  assert.equal(open.welcomesPRs, true);
});

test("a product's code-path row carries GitHub's details and its name opens the repo", () => {
  const stats = { stars: 42, description: "From GitHub", openIssues: 3, language: "TypeScript", pushedAt: "", archived: false };
  const [entry] = productEntries(
    product({ repoUrl: "https://github.com/ana/tool", openSeatCount: 1, openRoles: ["design"], repoStats: stats }),
    describe,
    roleName,
    "en",
  );
  assert.equal(entry.href, "https://github.com/ana/tool");
  assert.deepEqual(entry.links.map((link) => link.label), ["ana/tool"]);
  assert.equal(entry.language, "TypeScript");
  assert.equal(entry.stars, 42);
  assert.equal(entry.description, "Does a thing");

  // The role-path row of the same product still opens its page here.
  const [, role] = productEntries(product({ repoUrl: "https://github.com/ana/tool", openSeatCount: 1, openRoles: ["design"] }), describe, roleName, "en");
  assert.equal(role.href, "/projects/tool");
  // It still shows where the code lives, as a link with GitHub's mark.
  assert.deepEqual(role.links, [{ kind: "github", href: "https://github.com/ana/tool", label: "ana/tool" }]);

  // GitHub's description fills in when the product has none; no stats leaves the numbers empty.
  const [bare] = productEntries(product({ tagline: "", repoUrl: "https://github.com/ana/tool", repoStats: stats }), describe, roleName, "en");
  assert.equal(bare.description, "From GitHub");
  const [unknown] = productEntries(product({ repoUrl: "https://github.com/ana/tool" }), describe, roleName, "en");
  assert.equal(unknown.stars, null);
  assert.equal(unknown.language, "");
});

test("a product's website is a link and its logo rides along; a repo shows its owner's avatar", () => {
  const [entry] = productEntries(
    product({ openSeatCount: 1, openRoles: ["design"], liveUrl: "https://www.tool.example/app", logoUrl: "https://cdn.example/logo.png" }),
    describe,
    roleName,
    "en",
  );
  assert.deepEqual(entry.links, [{ kind: "website", href: "https://www.tool.example/app", label: "tool.example" }]);
  assert.equal(entry.logoUrl, "https://cdn.example/logo.png");
  assert.equal(entry.website, "https://www.tool.example/app");

  // Anything that is not an ordinary web address is not offered as one.
  const [unsafe] = productEntries(product({ openSeatCount: 1, openRoles: ["design"], liveUrl: "javascript:alert(1)" }), describe, roleName, "en");
  assert.deepEqual(unsafe.links, []);

  // GitHub's generic Octocat is no logo: the owner's avatar stands in when there is no website either.
  const [octocat] = productEntries(
    product({ repoUrl: "https://github.com/ana/tool", logoUrl: "https://github.githubassets.com/assets/pinned-octocat.svg" }),
    describe,
    roleName,
    "en",
  );
  assert.equal(octocat.logoUrl, "https://github.com/ana.png?size=80");

  const repo = OPEN_SOURCE_REPOS[0];
  assert.equal(repoEntry(repo, "en").logoUrl, `https://github.com/${repo.owner}.png?size=80`);
});

test("a product taking both PRs and people says so on both paths, and can be filtered by either", () => {
  const both = productEntries(
    product({ repoUrl: "https://github.com/ana/tool", openForGitHubContributions: true, openSeatCount: 1, openRoles: ["design"] }),
    describe,
    roleName,
    "en",
  );
  const codeOnly = productEntries(product({ id: 2, slug: "two", repoUrl: "https://github.com/ana/two" }), describe, roleName, "en");
  const rolesOnly = productEntries(product({ id: 3, slug: "three", openSeatCount: 1, openRoles: ["qa"] }), describe, roleName, "en");
  const entries = [...both, ...codeOnly, ...rolesOnly];

  assert.ok(both.every((entry) => entry.welcomesPRs && entry.hasOpenRoles && entry.kind === "product"));
  const none = { source: "", badge: "", facet: [], q: "" };
  assert.deepEqual(filterDirectory(entries, { ...none, track: "github", open: "prs" }).map((e) => e.name), ["Tool"]);
  assert.deepEqual(filterDirectory(entries, { ...none, track: "github", open: "roles" }).map((e) => e.name), ["Tool"]);
  assert.deepEqual(filterDirectory(entries, { ...none, track: "role", open: "prs" }).map((e) => e.name), ["Tool"]);

  // A filter is offered only where it narrows: every role-path entry has open roles,
  // and on the code path pull requests are filtered by tier instead.
  assert.deepEqual(openingCounts(entries, "github"), [{ open: "roles", count: 1 }]);
  assert.deepEqual(openingCounts(entries, "role"), [{ open: "prs", count: 1 }]);
});

const DAY = 86_400_000;
const NOW = Date.parse("2026-10-19T00:00:00Z");
const pushed = (daysAgo) => ({ pushedAt: new Date(NOW - daysAgo * DAY).toISOString(), archived: false });
const asked = (outsidePRs) => ({ outsidePRs, checkedAt: NOW });

test("a repo's PR tier is measured on GitHub, not taken from the checkbox", () => {
  assert.equal(prTier(true, pushed(1), asked(210)), "active");
  assert.equal(prTier(true, pushed(41), asked(0)), "first");
  assert.equal(prTier(true, pushed(41), asked(null)), "open", "unknown is not the same as none");
  assert.equal(prTier(true, undefined, undefined), "open");
  assert.equal(prTier(false, pushed(1), asked(210)), "unopened");
  // Ticked five years ago and untouched since is not an invitation.
  assert.equal(prTier(true, pushed(1719), asked(0)), "inactive");
  assert.equal(prTier(true, pushed(121), asked(3)), "inactive");
  assert.equal(prTier(true, pushed(119), asked(3)), "active");
  assert.equal(prTier(true, { pushedAt: pushed(1).pushedAt, archived: true }, asked(9)), "inactive");
});

test("the code path ranks by PR tier and offers the tiers as a filter", () => {
  const make = (id, slug, extra) =>
    productEntries(product({ id, slug, title: slug, repoUrl: `https://github.com/ana/${slug}`, ...extra }), describe, roleName, "en")[0];
  const entries = [
    make(1, "closed", {}),
    make(2, "dead", { openForGitHubContributions: true, repoStats: pushed(500), repoActivity: asked(0) }),
    make(3, "waiting", { openForGitHubContributions: true, repoStats: pushed(3), repoActivity: asked(0) }),
    make(4, "busy", { openForGitHubContributions: true, repoStats: pushed(3), repoActivity: asked(4) }),
  ];
  const none = { source: "", badge: "", facet: [], q: "" };

  assert.deepEqual(filterDirectory(entries, { ...none, track: "github" }).map((e) => e.name), ["busy", "waiting", "closed", "dead"]);
  assert.deepEqual(filterDirectory(entries, { ...none, track: "github", pr: ["first"] }).map((e) => e.name), ["waiting"]);
  assert.deepEqual(prTierCounts(entries).map(({ tier }) => tier), ["active", "first", "unopened", "inactive"]);
  assert.deepEqual(prTierCounts([entries[0]]), [], "one tier for everything is no filter");

  // Not taking PRs: still listed for its code, but the button opens the repo, not the issues.
  assert.equal(entries[0].actionKind, "repo");
  assert.equal(entries[1].actionKind, "repo");
  assert.equal(entries[3].actionKind, "issues");
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

test("one path at a time, narrowed by its chip and by search, keeping the given order", () => {
  const entries = [
    ...OPEN_SOURCE_REPOS.map((repo) => repoEntry(repo, "en")),
    ...productEntries(product({ openSeatCount: 1, openRoles: ["design"] }), describe, roleName, "en"),
  ];
  const none = { source: "", badge: "", facet: [], q: "" };
  assert.deepEqual(filterDirectory(entries, { ...none, track: "role" }).map((entry) => entry.name), ["Tool"]);
  assert.deepEqual(
    filterDirectory(entries, { ...none, track: "github" }).map((entry) => entry.name),
    OPEN_SOURCE_REPOS.map((repo) => repo.repo),
  );
  assert.deepEqual(filterDirectory(entries, { ...none, track: "github", facet: ["go"] }).map((entry) => entry.name), ["heimdall"]);
  assert.deepEqual(filterDirectory(entries, { ...none, track: "role", facet: ["DESIGN"] }).map((entry) => entry.name), ["Tool"]);
  assert.equal(filterDirectory(entries, { ...none, track: "role", facet: ["QA"] }).length, 0);
  assert.ok(filterDirectory(entries, { ...none, track: "github", q: "bahasa" }).length > 0);
  assert.equal(filterDirectory(entries, { ...none, track: "github", q: "nothing like this" }).length, 0);
  // Global is outside open source; a recommended repo with Indonesian maintainers counts as local.
  assert.deepEqual(filterDirectory(entries, { ...none, track: "github", scope: "global" }).map((entry) => entry.name), ["next.js"]);
  const local = filterDirectory(entries, { ...none, track: "github", scope: "local" }).map((entry) => entry.name);
  assert.ok(local.includes("heimdall") && local.includes("builders") && !local.includes("next.js"));
});

test("chips are the languages on the code path and the roles on the role path", () => {
  const entries = [
    ...OPEN_SOURCE_REPOS.map((repo) => repoEntry(repo, "en")),
    ...productEntries(product({ openSeatCount: 1, openRoles: ["design", "qa"] }), describe, roleName, "en"),
    ...productEntries(product({ id: 2, slug: "two", openSeatCount: 1, openRoles: ["design"] }), describe, roleName, "en"),
  ];
  assert.deepEqual(directoryFacets(entries, "role"), [
    { value: "DESIGN", count: 2 },
    { value: "QA", count: 1 },
  ]);
  const languages = directoryFacets(entries, "github").map((facet) => facet.value);
  assert.ok(languages.includes("Go") && !languages.includes("DESIGN"));
});

test("badges come from the catalogue row and members' records, are filtered on, and counted per path", () => {
  const repos = [
    repo({ id: 11, repo: "a", indonesian: true }),
    repo({ id: 12, repo: "b", indonesian: true }),
    repo({ id: 13, repo: "c" }),
  ];
  const members = [{ username: "ana", name: "Ana", handle: "ana", contributions: [{ repo: "acme/b", relation: "contributor" }] }];
  const entries = repos.map((entry) => repoEntry(entry, "en", members));
  assert.deepEqual(entries[0].badges, [{ kind: "indonesian" }]);

  const none = { source: "", badge: "", facet: [], q: "" };
  assert.deepEqual(filterDirectory(entries, { ...none, track: "github", badge: "indonesian" }).map((e) => e.name), ["a", "b"]);
  assert.deepEqual(filterDirectory(entries, { ...none, track: "github", badge: "friend-contributed" }).map((e) => e.name), ["b"]);
  assert.deepEqual(badgeCounts(entries, "github"), [
    { kind: "friend-contributed", count: 1 },
    { kind: "indonesian", count: 2 },
  ]);
  assert.deepEqual(badgeCounts(entries, "role"), []);
});

test("a product's badges come from the hand-kept list by slug, and default to none", () => {
  const [entry] = productEntries(product({ slug: "not-in-the-list", openSeatCount: 1, openRoles: ["design"] }), describe, roleName, "en");
  assert.deepEqual(entry.badges, []);
});

test("a product's filled seats become its 'friends have been here' badge", () => {
  const [entry] = productEntries(
    product({ openSeatCount: 1, openRoles: ["design"], activeMemberCount: 3 }),
    describe,
    roleName,
    "en",
  );
  assert.deepEqual(entry.badges, [{ kind: "friend-contributed", count: 3 }]);
});

test("members' records reach a repo's row through the directory", () => {
  const next = OPEN_SOURCE_REPOS.find((entry) => entry.repo === "next.js");
  const members = [{ username: "ana", name: "Ana", handle: "ana", contributions: [{ repo: "vercel/next.js", relation: "contributor" }] }];
  const badge = repoEntry(next, "en", members).badges.find((entry) => entry.kind === "friend-contributed");
  assert.deepEqual(badge, { kind: "friend-contributed", people: ["ana"], count: 1, profiles: ["ana"], members: [{ username: "ana", name: "Ana", handle: "ana" }] });
});

test("paginate slices by page and clamps pages that do not exist", () => {
  const items = Array.from({ length: 45 }, (_, index) => index);
  assert.deepEqual(paginate(items, 1, 20), { items: items.slice(0, 20), page: 1, pages: 3 });
  assert.deepEqual(paginate(items, "3", 20).items, [40, 41, 42, 43, 44]);
  // An old link past the end lands on the last page, not an empty one.
  assert.equal(paginate(items, "9", 20).page, 3);
  // Nonsense lands on the first.
  for (const junk of ["", "0", "-2", "abc", "1.5"]) assert.equal(paginate(items, junk, 20).page, 1);
  // An empty list is still one (empty) page.
  assert.deepEqual(paginate([], "2", 20), { items: [], page: 1, pages: 1 });
});

test("the code path sorts by last push, stars or listing date when asked, unknowns last", () => {
  const make = (id, slug, stats, createdAt) => repoEntry(repo({ id, repo: slug, createdAt, stats }), "en");
  const stats = (stars, pushedAt) => ({ stars, description: "", openIssues: 0, language: "Go", pushedAt, archived: false });
  const entries = [
    make(1, "old", stats(50, "2026-01-01T00:00:00Z"), "2026-10-01T00:00:00Z"),
    make(2, "fresh", stats(5, "2026-10-20T00:00:00Z"), "2026-09-01T00:00:00Z"),
    make(3, "unknown", null, ""),
  ];
  const none = { track: "github", source: "", badge: "", facet: [], q: "" };
  const names = (sort) => filterDirectory(entries, { ...none, sort }).map((entry) => entry.name);
  assert.deepEqual(names("updated"), ["fresh", "old", "unknown"]);
  assert.deepEqual(names("stars"), ["old", "fresh", "unknown"]);
  assert.deepEqual(names("newest"), ["old", "fresh", "unknown"]);
  // Stars mean nothing on the role path: its own order stands.
  const roles = [product({ id: 1, title: "A", openSeatCount: 1 }), product({ id: 2, title: "B", openSeatCount: 1 })].flatMap((p) =>
    productEntries(p, describe, roleName, "en"),
  );
  assert.deepEqual(filterDirectory(roles, { ...none, track: "role", sort: "stars" }).map((entry) => entry.name), ["A", "B"]);
});

test("chips in one group widen, groups narrow, and stages filter the role path", () => {
  const make = (id, title, stage, roles) =>
    productEntries(product({ id, title, stage, openSeatCount: 1, openRoles: roles }), describe, roleName, "en")[0];
  const entries = [make(1, "A", "idea", ["design"]), make(2, "B", "live", ["product"]), make(3, "C", "live", ["design"])];
  const none = { track: "role", source: "", badge: "", facet: [], q: "" };
  const names = (extra) => filterDirectory(entries, { ...none, ...extra }).map((entry) => entry.name);
  assert.deepEqual(names({ facet: ["DESIGN", "PRODUCT"] }), ["A", "B", "C"]);
  assert.deepEqual(names({ stage: ["live"] }), ["B", "C"]);
  assert.deepEqual(names({ stage: ["live"], facet: ["DESIGN"] }), ["C"]);
  assert.deepEqual(stageCounts(entries, "role"), [{ stage: "idea", count: 1 }, { stage: "live", count: 2 }]);
  assert.deepEqual(stageCounts(entries, "github"), []);
});

test("a role card knows how fresh it is, and when it is new to the directory", () => {
  const now = Date.parse("2026-10-23T00:00:00Z");
  const [entry] = productEntries(
    product({ openSeatCount: 2, createdAt: "2026-10-15T00:00:00Z", lastActivityAt: "2026-10-20T00:00:00Z" }),
    describe,
    roleName,
    "en",
  );
  assert.equal(entry.openSeats, 2);
  assert.equal(isNew(entry, now), true);
  assert.equal(isQuiet(entry, now), false);
  const later = Date.parse("2027-01-01T00:00:00Z");
  assert.equal(isNew(entry, later), false);
  assert.equal(isQuiet(entry, later), true, "two months and more without activity recedes");
});

test("an admin's pick comes first in the path's own order, but only while it takes PRs", () => {
  const make = (id, slug, extra) =>
    productEntries(product({ id, slug, title: slug, repoUrl: `https://github.com/ana/${slug}`, ...extra }), describe, roleName, "en")[0];
  const entries = [
    make(1, "busy", { openForGitHubContributions: true, repoStats: pushed(3), repoActivity: asked(4) }),
    make(2, "picked", { openForGitHubContributions: true, repoStats: pushed(3), repoActivity: asked(0), adminPick: true }),
    make(3, "picked-closed", { adminPick: true }),
  ];
  const none = { track: "github", source: "", badge: "", facet: [], q: "" };
  assert.deepEqual(filterDirectory(entries, none).map((e) => e.name), ["picked", "busy", "picked-closed"]);
  // An order the visitor asked for is theirs, picks or not.
  assert.equal(filterDirectory(entries, { ...none, sort: "stars" })[0].name, "busy");
  assert.deepEqual(entries[1].badges.map((badge) => badge.kind), ["admin-pick"]);
  assert.deepEqual(filterDirectory(entries, { ...none, badge: "admin-pick" }).map((e) => e.name), ["picked", "picked-closed"]);

  const roles = [product({ id: 4, title: "A", openSeatCount: 1 }), product({ id: 5, title: "B", openSeatCount: 1, adminPick: true })].flatMap((p) =>
    productEntries(p, describe, roleName, "en"),
  );
  assert.deepEqual(filterDirectory(roles, { ...none, track: "role" }).map((e) => e.name), ["B", "A"]);
});
