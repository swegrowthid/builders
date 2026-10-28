import assert from "node:assert/strict";
import test from "node:test";
import { MILESTONES, boardWindow, milestoneWeeks, nextMilestone, seasonBoard, seasonLabel, seasonOf, weekStart } from "../app/lib/github-activity.ts";
import { activityPath, leaderboardPath, readActivityFilters } from "../app/lib/activity-url.ts";

const person = (handle, name = handle) => ({ id: handle, username: handle, name, handle });
const pr = (who, repo, state, ...ats) => ({
  kind: "pull_request",
  key: `${who.handle}:${repo}:${state}:${ats[0]}`,
  person: who,
  repo,
  url: `https://github.com/${repo}/pull/1`,
  state,
  // Each PR is a time, or [opened, merged] when it was merged later.
  pullRequests: ats.map((at, index) => {
    const [openedAt, done] = Array.isArray(at) ? at : [at, at];
    return { url: `https://github.com/${repo}/pull/${index + 1}`, number: index + 1, title: "t", at: done, openedAt };
  }),
  at: Array.isArray(ats[0]) ? ats[0][1] : ats[0],
});
const handles = (rows) => rows.map(({ person: who }) => who.handle);

test("a week starts on Monday", () => {
  assert.equal(weekStart("2026-10-27"), "2026-10-26", "a Tuesday's week began on Monday");
  assert.equal(weekStart("2026-10-26"), "2026-10-26", "a Monday is its own start");
  assert.equal(weekStart("2026-11-01"), "2026-10-26", "a Sunday's week can begin last month");
});

test("a season is a quarter: the weeks whose Monday falls in it", () => {
  const season = seasonOf("2026-10-27");
  assert.equal(season.quarter, 4);
  assert.equal(season.weeks.length, 13);
  assert.equal(season.weeks[0], "2026-10-05", "1 Oct is a Thursday: its week is the last season's");
  assert.equal(season.weeks.at(-1), "2026-12-28");
  assert.equal(season.current, 3);
  assert.equal(seasonLabel(season, "id"), "Okt–Des 2026");
  assert.equal(seasonOf("2026-10-02").quarter, 3, "the week of 28 Sep is still Jul–Sep");
  assert.equal(seasonOf("2027-01-03").year, 2026, "a Sunday in January ends December's week");
  assert.equal(seasonOf("2024-07-10").weeks.length, 14, "a quarter that starts and ends on a Monday");
});

test("the board counts weeks with a PR opened to other people's repos this season, not how many PRs", () => {
  const ana = person("ana", "Ana");
  const budi = person("budi", "Budi");
  const cici = person("cici", "Cici");
  // Today is Tuesday 27 Oct, the season's fourth week.
  const entries = [
    // Ana: one PR in each of the last three weeks.
    pr(ana, "acme/one", "merged", "2026-10-26T03:00:00Z", "2026-10-20T03:00:00Z", "2026-10-13T03:00:00Z"),
    // Budi: five PRs, all this week.
    pr(budi, "acme/one", "merged", "2026-10-26T03:00:00Z", "2026-10-26T04:00:00Z", "2026-10-27T01:00:00Z", "2026-10-27T02:00:00Z", "2026-10-27T03:00:00Z"),
    // In review counts too, the week it was opened; their own work never does.
    pr(cici, "acme/three", "open", "2026-10-27T03:00:00Z"),
    { kind: "commit_summary", key: "cici:own", person: cici, commits: 40, merged: 9, repos: [], since: "2026-09-27", at: "2026-10-27T03:00:00Z" },
  ];
  const board = seasonBoard(entries, "2026-10-27");
  assert.deepEqual(board.map(({ person: who, filled, streak, prs }) => [who.handle, filled, streak, prs]), [["ana", 3, 3, 3], ["budi", 1, 1, 5], ["cici", 1, 1, 1]]);
  assert.equal(board[0].weeks.length, 13);
  assert.deepEqual(board[0].weeks.slice(0, 5), [false, true, true, true, false], "oldest first; weeks to come are empty");
});

test("a merged PR counts for the week it was opened, not the week it landed", () => {
  const ana = person("ana");
  // Opened on 12 Oct, merged on the 27th: the week of the 12th is filled.
  const [row] = seasonBoard([pr(ana, "acme/one", "merged", ["2026-10-12T03:00:00Z", "2026-10-27T03:00:00Z"])], "2026-10-27");
  assert.deepEqual(row.weeks.slice(0, 4), [false, true, false, false]);
});

test("last season's weeks are off the board, but a streak runs across", () => {
  const ana = person("ana");
  // 30 Sep is the week of 28 Sep: last season.
  assert.deepEqual(seasonBoard([pr(ana, "acme/one", "merged", "2026-09-30T03:00:00Z")], "2026-10-27"), []);
  const [row] = seasonBoard([pr(ana, "acme/one", "merged", "2026-09-30T03:00:00Z", "2026-10-06T03:00:00Z", "2026-10-13T03:00:00Z", "2026-10-20T03:00:00Z")], "2026-10-27");
  assert.equal(row.filled, 3);
  assert.equal(row.streak, 4);
  assert.equal(row.prs, 3, "PRs and repos are the season's");
});

test("a streak waits for this week to end before it breaks", () => {
  const ana = person("ana");
  const lastTwo = pr(ana, "acme/one", "merged", "2026-10-19T03:00:00Z", "2026-10-12T03:00:00Z");
  assert.equal(seasonBoard([lastTwo], "2026-10-27")[0].streak, 2, "nothing yet this week: still 2");
  const gap = pr(ana, "acme/one", "merged", "2026-10-12T03:00:00Z", "2026-10-05T03:00:00Z");
  assert.equal(seasonBoard([gap], "2026-10-27")[0].streak, 0, "an empty last week breaks it");
});

test("weeks turn over on Monday in WIB", () => {
  const ana = person("ana");
  // Sunday 25 Oct 18:00 UTC is Monday 26 Oct 01:00 in Jakarta: this week.
  assert.deepEqual(seasonBoard([pr(ana, "acme/one", "merged", "2026-10-25T18:00:00Z")], "2026-10-27")[0].weeks.slice(2, 4), [false, true]);
});

test("ties go to the longer streak, then more repos, then more PRs", () => {
  const ana = person("ana");
  const budi = person("budi");
  const cici = person("cici");
  const entries = [
    // Two weeks each. Ana's are apart; Budi's and Cici's in a row.
    pr(ana, "acme/one", "merged", "2026-10-26T03:00:00Z", "2026-10-12T03:00:00Z"),
    pr(budi, "acme/one", "merged", "2026-10-26T03:00:00Z", "2026-10-19T03:00:00Z"),
    pr(cici, "acme/one", "merged", "2026-10-26T03:00:00Z"),
    pr(cici, "acme/two", "merged", "2026-10-19T03:00:00Z"),
  ];
  assert.deepEqual(handles(seasonBoard(entries, "2026-10-27")), ["cici", "budi", "ana"]);
});

test("the next milestone is the first not yet reached, while the season can still get there", () => {
  const season = seasonOf("2026-10-27");
  const next = (filled, done, at = season) => {
    const found = nextMilestone(filled, done, at);
    return found && [found.milestone.icon, found.needed];
  };
  assert.deepEqual(next(2, false), ["🌱", 2]);
  assert.deepEqual(next(4, true), ["🔥", 4]);
  assert.deepEqual(next(8, false), ["🏆", 5], "every week of the season");
  assert.equal(milestoneWeeks(MILESTONES[2], season), 13);
  // 22 Dec: this week and one more are left.
  const late = seasonOf("2026-12-22");
  assert.deepEqual(next(3, false, late), ["🌱", 1]);
  assert.equal(next(8, false, late), null, "a whole season is out of reach");
  assert.equal(next(13, true, late), null, "all reached");
});

test("the last four or eight weeks roll back across seasons, this week last", () => {
  assert.deepEqual(boardWindow("2026-10-27", "4"), { weeks: ["2026-10-05", "2026-10-12", "2026-10-19", "2026-10-26"], current: 3 });
  const eight = boardWindow("2026-10-27", "8");
  assert.equal(eight.weeks[0], "2026-09-07", "into last season");
  assert.equal(eight.current, 7);
  assert.deepEqual(boardWindow("2026-10-27", "season"), seasonOf("2026-10-27"));

  const ana = person("ana");
  const bo = person("bo");
  // Ana: two weeks last season and one this; Bo: one this season only.
  const entries = [
    pr(ana, "acme/one", "merged", "2026-09-15T03:00:00Z", "2026-09-22T03:00:00Z", "2026-10-06T03:00:00Z"),
    pr(bo, "acme/two", "open", "2026-10-13T03:00:00Z", "2026-10-20T03:00:00Z"),
  ];
  const season = seasonBoard(entries, "2026-10-27");
  assert.deepEqual(handles(season), ["bo", "ana"]);
  const rows = seasonBoard(entries, "2026-10-27", undefined, eight);
  assert.deepEqual(handles(rows), ["ana", "bo"], "eight weeks reach back to September");
  assert.equal(rows[0].filled, 3);
  assert.equal(rows[0].prs, 3);
  assert.equal(rows[0].weeks.length, 8);
});

test("the weeks counted travel in the address, the season left out", () => {
  assert.equal(readActivityFilters(new URLSearchParams("weeks=4")).weeks, "4");
  assert.equal(readActivityFilters(new URLSearchParams("weeks=52")).weeks, "season");
  assert.equal(activityPath({ weeks: "8", place: "local" }), "/?place=local&weeks=8");
  assert.equal(activityPath({ weeks: "season" }), "/");
  assert.equal(leaderboardPath("all", "season"), "/leaderboard");
  assert.equal(leaderboardPath("global", "4"), "/leaderboard?place=global&weeks=4");
});

test("the board's period is no longer in the address", () => {
  assert.equal(activityPath({ place: "local" }), "/?place=local");
  assert.equal("board" in readActivityFilters(new URLSearchParams("board=week")), false);
});

test("the own-work board counts PRs merged into their own repos, commits only breaking ties", async () => {
  const { ownLeaderboard } = await import("../app/lib/github-activity.ts");
  const summary = (who, merged, commits) => ({ kind: "commit_summary", key: `${who.handle}:own`, person: who, commits, merged, repos: [{ repo: `${who.handle}/x`, commits }], since: "2026-09-27", at: "2026-10-27T03:00:00Z" });
  const rows = ownLeaderboard([summary(person("ana"), 2, 5), summary(person("budi"), 2, 40), summary(person("cici"), 0, 90), summary(person("dodi"), 4, 1)]);
  assert.deepEqual(rows.map(({ person: who, prs }) => [who.handle, prs]), [["dodi", 4], ["budi", 2], ["ana", 2]], "no merged PR, no row");
});

test("local and global split pull requests by the directory's local repos", async () => {
  const { inPlace, placeCounts } = await import("../app/lib/github-activity.ts");
  const ana = person("ana");
  const local = new Set(["kawan/krs"]);
  const entries = [
    pr(ana, "kawan/krs", "merged", "2026-10-27T03:00:00Z"),
    pr(ana, "odoo/odoo", "merged", "2026-10-27T03:00:00Z", "2026-10-26T03:00:00Z"),
    { kind: "commit_summary", key: "ana:own", person: ana, commits: 3, merged: 1, repos: [], since: "2026-09-27", at: "2026-10-27T03:00:00Z" },
  ];
  assert.deepEqual(placeCounts(entries, local), { all: 2, local: 1, global: 1 });
  assert.equal(inPlace(entries, "all", local).length, 3);
  assert.deepEqual(inPlace(entries, "local", local).map((entry) => entry.repo), ["kawan/krs"]);
  assert.equal(seasonBoard(inPlace(entries, "global", local), "2026-10-27")[0].prs, 2);
  assert.equal(activityPath({ place: "local" }), "/?place=local");
  assert.equal(readActivityFilters(new URLSearchParams("place=moon")).place, "all");
});

test("one show choice stands for scope and kind, and old links land on the nearest", async () => {
  const { showOf, showFilters } = await import("../app/lib/activity-url.ts");
  const read = (search) => {
    const filters = readActivityFilters(new URLSearchParams(search));
    return [filters.scope, filters.kind, showOf(filters)];
  };
  assert.deepEqual(read(""), ["external", "all", "contributions"]);
  assert.deepEqual(read("show=merged"), ["external", "merged", "merged"]);
  assert.deepEqual(read("scope=own"), ["own", "all", "own"]);
  assert.deepEqual(read("show=commits"), ["own", "all", "own"], "summaries are members' own work");
  assert.deepEqual(read("scope=all&show=open"), ["external", "open", "open"], "both scopes at once is no longer offered");
  assert.deepEqual(read("scope=own&show=merged"), ["own", "all", "own"]);
  for (const show of ["contributions", "merged", "open", "own"]) assert.equal(showOf(showFilters(show)), show);
  assert.equal(activityPath({ ...showFilters("own") }), "/?scope=own");
  assert.equal(activityPath({ ...showFilters("open") }), "/?show=open");
});

test("where PRs went: newest first by default, or by PRs, or by people", async () => {
  const { repoSummaries } = await import("../app/lib/github-activity.ts");
  const ana = person("ana"), budi = person("budi"), cici = person("cici");
  const entries = [
    pr(ana, "big/one", "merged", "2026-10-01T03:00:00Z", "2026-10-02T03:00:00Z", "2026-10-03T03:00:00Z", "2026-10-04T03:00:00Z"),
    pr(ana, "many/hands", "merged", "2026-10-10T03:00:00Z"),
    pr(budi, "many/hands", "open", "2026-10-11T03:00:00Z"),
    pr(cici, "many/hands", "merged", "2026-10-09T03:00:00Z"),
    pr(budi, "new/one", "merged", "2026-10-26T03:00:00Z"),
  ];
  const names = (order) => repoSummaries(entries, order).map(({ repo }) => repo);
  assert.deepEqual(names(), ["new/one", "many/hands", "big/one"]);
  assert.deepEqual(names("prs"), ["big/one", "many/hands", "new/one"]);
  assert.deepEqual(names("people"), ["many/hands", "big/one", "new/one"], "then by PRs");
  const hands = repoSummaries(entries).find(({ repo }) => repo === "many/hands");
  assert.deepEqual(hands.people.map(({ handle }) => handle), ["budi", "ana", "cici"], "the most recent first");
  assert.equal(hands.prs, 3);
  assert.equal(hands.lastAt, "2026-10-11T03:00:00Z");
});
