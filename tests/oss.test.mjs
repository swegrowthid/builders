import assert from "node:assert/strict";
import test from "node:test";

import { contributionEvidenceUrl, githubHandle, memberBadges, mergeBadges, parseRepoRef } from "../app/lib/oss.ts";

test("a repo reference is owner/name, lower-cased, from a slug or any GitHub URL inside it", () => {
  assert.equal(parseRepoRef("Vercel/Next.js"), "vercel/next.js");
  assert.equal(parseRepoRef("https://github.com/vercel/next.js"), "vercel/next.js");
  assert.equal(parseRepoRef("github.com/vercel/next.js.git"), "vercel/next.js");
  assert.equal(parseRepoRef("https://github.com/vercel/next.js/pull/123"), "vercel/next.js");
  assert.equal(parseRepoRef("  supabase/supabase/  "), "supabase/supabase");
});

test("anything that is not plainly a GitHub repository is refused", () => {
  for (const value of ["", "vercel", "a/b/c", "https://gitlab.com/a/b", "-bad/repo", "owner/..", "owner/has space", "https://github.com/onlyowner"]) {
    assert.equal(parseRepoRef(value), null, value);
  }
});

test("a GitHub handle is read from a URL, a bare name, or an @name", () => {
  assert.equal(githubHandle("https://github.com/zikrulihsan"), "zikrulihsan");
  assert.equal(githubHandle("@someone"), "someone");
  assert.equal(githubHandle("someone"), "someone");
  assert.equal(githubHandle("https://github.com/someone/repo"), "");
  assert.equal(githubHandle("https://example.com/someone"), "");
  assert.equal(githubHandle(""), "");
});

test("the evidence link is that person's pull requests on that repo", () => {
  const url = new URL(contributionEvidenceUrl("vercel/next.js", "ana"));
  assert.equal(url.origin + url.pathname, "https://github.com/vercel/next.js/pulls");
  assert.equal(url.searchParams.get("q"), "is:pr author:ana");
});

const member = (username, handle, contributions = []) => ({ username, name: username, handle, contributions });

test("members' records become a repo's badges", () => {
  const members = [
    member("ana", "ana-gh", [{ repo: "vercel/next.js", relation: "contributor" }]),
    member("budi", "", [{ repo: "vercel/next.js", relation: "contributor" }]),
    member("citra", "citra", [{ repo: "vercel/next.js", relation: "maintainer" }]),
    member("dodi", "dodi", [{ repo: "other/repo", relation: "contributor" }]),
  ];
  assert.deepEqual(memberBadges("Vercel/Next.js", members), [
    // Budi has no GitHub on his profile: counted and linked, but no face.
    { kind: "friend-contributed", people: ["ana-gh"], count: 2, profiles: ["ana", "budi"] },
    { kind: "in-our-group", people: ["citra"], count: 1, profiles: ["citra"] },
  ]);
  assert.deepEqual(memberBadges("nobody/here", members), []);
});

test("owning the repository on GitHub is being its maintainer, listed or not", () => {
  const badges = memberBadges("zikrulihsan/builders", [member("zikrul", "ZikrulIhsan")]);
  assert.deepEqual(badges, [{ kind: "in-our-group", people: ["ZikrulIhsan"], count: 1, profiles: ["zikrul"] }]);
});

test("hand-set and member badges merge per kind without counting a person twice", () => {
  const merged = mergeBadges(
    [{ kind: "in-our-group", people: ["zikrulihsan"] }, { kind: "indonesian" }],
    [{ kind: "in-our-group", people: ["zikrulihsan"], count: 1, profiles: ["zikrul"] }],
  );
  assert.deepEqual(merged, [
    { kind: "in-our-group", people: ["zikrulihsan"], profiles: ["zikrul"], count: 1 },
    { kind: "indonesian" },
  ]);
  assert.deepEqual(mergeBadges([], []), []);
});
