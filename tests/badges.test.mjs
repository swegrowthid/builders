import assert from "node:assert/strict";
import test from "node:test";

import { BADGE_KINDS, PRODUCT_BADGES, badgeLabel, badgePeople } from "../app/lib/badges.ts";
import { OPEN_SOURCE_REPOS } from "../app/lib/open-source.ts";

test("only well-formed GitHub usernames are kept, once each", () => {
  assert.deepEqual(badgePeople({ kind: "friend-contributed", people: ["ana", "@ana", " budi ", "not a name", "-x", "../evil"] }), [
    "ana",
    "budi",
  ]);
  assert.deepEqual(badgePeople({ kind: "indonesian" }), []);
});

test("a badge naming people says how many", () => {
  assert.equal(badgeLabel({ kind: "friend-contributed", people: ["a", "b"] }, "id"), "2 teman pernah kontribusi");
  assert.equal(badgeLabel({ kind: "friend-contributed", people: ["a"] }, "en"), "1 friend has contributed");
  assert.equal(badgeLabel({ kind: "friend-contributed" }, "en"), "Friends have contributed");
});

test("every hand-set badge is a known kind and names people correctly", () => {
  const all = [...OPEN_SOURCE_REPOS.flatMap((repo) => repo.badges), ...Object.values(PRODUCT_BADGES).flat()];
  for (const badge of all) {
    assert.ok(BADGE_KINDS.includes(badge.kind), badge.kind);
    // A typo in a username would quietly drop that person's face.
    assert.equal(badgePeople(badge).length, (badge.people ?? []).length, JSON.stringify(badge));
  }
});
