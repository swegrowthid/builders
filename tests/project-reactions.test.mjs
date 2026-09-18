import assert from "node:assert/strict";
import test from "node:test";

import { applyProjectReaction } from "../app/lib/project-reactions.ts";

const initial = { following: false, followerCount: 2, boosted: false, boostCount: 4 };

test("follow changes independently from support", () => {
  const following = applyProjectReaction(initial, { kind: "follow", active: true });
  assert.deepEqual(following, {
    following: true,
    followerCount: 3,
    boosted: false,
    boostCount: 4,
  });
  assert.equal(applyProjectReaction(following, { kind: "follow", active: true }).followerCount, 3);
  assert.equal(applyProjectReaction(following, { kind: "follow", active: false }).followerCount, 2);
});

test("support adjusts its count once for the requested state", () => {
  const boosted = applyProjectReaction(initial, { kind: "boost", active: true });
  assert.equal(boosted.boostCount, 5);
  assert.equal(applyProjectReaction(boosted, { kind: "boost", active: true }).boostCount, 5);
  assert.equal(applyProjectReaction(boosted, { kind: "boost", active: false }).boostCount, 4);
});

test("support counts never become negative", () => {
  const inconsistent = { ...initial, boosted: true, boostCount: 0 };
  assert.equal(applyProjectReaction(inconsistent, { kind: "boost", active: false }).boostCount, 0);
});
