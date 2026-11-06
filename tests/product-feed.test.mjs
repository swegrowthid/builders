import assert from "node:assert/strict";
import test from "node:test";

import {
  FEED_SHOWS,
  dropCutOffDay,
  feedDays,
  feedLine,
  feedShowCounts,
  feedStats,
  filterProductFeed,
  groupProductFeed,
  isFeedKind,
  isFeedShow,
  productFeedPath,
  readProductFeedQuery,
} from "../app/lib/product-feed.ts";
import { paginate } from "../app/lib/directory.ts";
import { eventReactionKey, isReactionTarget } from "../app/lib/reactions.ts";

const ana = { username: "ana", name: "Ana" };
const event = (id, over = {}) => ({
  id,
  kind: "update_posted",
  createdAt: "2026-10-25T03:00:00Z",
  projectSlug: "kopi",
  projectTitle: "Kopi",
  payload: {},
  actor: ana,
  ...over,
});

test("a product's events on one day are one entry, keyed by the day's first event", () => {
  const feed = groupProductFeed([
    event(10, { kind: "project_stage_changed", createdAt: "2026-10-25T09:00:00Z" }),
    event(7),
    event(5, { projectSlug: "teh", projectTitle: "Teh", createdAt: "2026-10-25T05:00:00Z" }),
  ]);
  assert.deepEqual(feed.map((entry) => entry.product.slug), ["kopi", "teh"]);
  assert.equal(feed[0].firstEventId, 7);
  assert.deepEqual(feed[0].events.map((e) => e.id), [10, 7]);
  assert.equal(feed[0].at, "2026-10-25T09:00:00Z");
});

test("days are counted in WIB, so an evening update stays on its evening", () => {
  // 18:00 UTC on the 24th is 01:00 WIB on the 25th.
  const feed = groupProductFeed([event(2, { createdAt: "2026-10-24T18:00:00Z" }), event(1, { createdAt: "2026-10-24T10:00:00Z" })]);
  assert.deepEqual(feed.map((entry) => entry.day), ["2026-10-25", "2026-10-24"]);
  assert.deepEqual(feedDays(feed).map((day) => day.day), ["2026-10-25", "2026-10-24"]);
});

test("only the product kinds make the feed", () => {
  assert.equal(isFeedKind("seat_filled"), true);
  assert.equal(isFeedKind("comment_posted"), false);
  assert.equal(groupProductFeed([event(1, { kind: "comment_posted" }), event(2, { kind: "boost_given" })]).length, 0);
});

test("a deleted product keeps its events under the recorded title", () => {
  const [entry] = groupProductFeed([event(1, { projectSlug: "", projectTitle: "Old idea" })]);
  assert.deepEqual(entry.product, { slug: "", title: "Old idea" });
});

test("the heading counts the last 30 days", () => {
  const now = new Date("2026-10-26T00:00:00Z");
  const stats = feedStats(
    [
      event(1),
      event(2, { kind: "seat_filled", projectSlug: "teh" }),
      event(3, { createdAt: "2026-08-01T00:00:00Z" }),
    ],
    now,
  );
  assert.deepEqual(stats, { products: 2, updates: 1, rolesFilled: 1 });
});

test("a product's day is something a reaction can be left on", () => {
  assert.equal(eventReactionKey(42), "event:42");
  assert.equal(isReactionTarget("event:42"), true);
  assert.equal(isReactionTarget("event:"), false);
  assert.equal(isReactionTarget("event:4x"), false);
});

test("a card's lines leave the product's name to the heading", () => {
  assert.equal(feedLine({ kind: "update_posted", payload: { update_title: "Rilis 1.0" } }, "id"), "mengirim kabar: “Rilis 1.0”");
  assert.equal(feedLine({ kind: "project_stage_changed", payload: { to: "live" } }, "en"), "moved it to Live.");
  assert.equal(feedLine({ kind: "project_created", payload: { title: "Kopi" } }, "id"), "mendaftarkan produk ini.");
});

test("a kind narrows the feed to the cards carrying it, and only those lines", () => {
  const feed = groupProductFeed([
    event(10, { kind: "seat_filled", createdAt: "2026-10-25T09:00:00Z" }),
    event(7, { createdAt: "2026-10-25T04:00:00Z" }),
    event(5, { projectSlug: "teh", projectTitle: "Teh", createdAt: "2026-10-25T05:00:00Z" }),
  ]);
  const updates = filterProductFeed(feed, "update");
  assert.deepEqual(updates.map((entry) => entry.product.slug), ["teh", "kopi"]);
  assert.deepEqual(updates[1].events.map((e) => e.id), [7]);
  // The card's reactions stay its whole day's.
  assert.equal(updates[1].firstEventId, 7);
  assert.equal(updates[1].at, "2026-10-25T04:00:00Z");
  assert.equal(filterProductFeed(feed, "all"), feed);
  assert.deepEqual(filterProductFeed(feed, "new"), []);
});

test("each choice counts the cards it would list", () => {
  const feed = groupProductFeed([event(2, { kind: "seat_filled" }), event(1), event(3, { projectSlug: "teh", projectTitle: "Teh" })]);
  assert.deepEqual(feedShowCounts(feed), { all: 2, new: 0, stage: 0, update: 2, "role-opened": 0, "role-filled": 1 });
});

test("pages are cards, never half a product's day, and clamp to the last", () => {
  const events = Array.from({ length: 5 }, (_, i) => event(i + 1, { projectSlug: `p${i}`, projectTitle: `P${i}` }));
  const feed = groupProductFeed([...events, event(9, { projectSlug: "p0", kind: "seat_opened" })]);
  assert.equal(feed.length, 5);
  const second = paginate(feed, 2, 2);
  assert.deepEqual([second.page, second.pages, second.items.length], [2, 3, 2]);
  assert.deepEqual(paginate(feed, 99, 2).page, 3);
  assert.deepEqual(paginate(feed, 0, 2).page, 1);
  assert.deepEqual(paginate([], 3).pages, 1);
  // p0's two events stay on one card.
  assert.equal(feed.find((entry) => entry.product.slug === "p0").events.length, 2);
});

test("a read that stopped at its limit leaves out the card it may have cut short", () => {
  const events = [event(5, { projectSlug: "teh", projectTitle: "Teh" }), event(4), event(3, { projectSlug: "susu", projectTitle: "Susu" })];
  const feed = groupProductFeed(events);
  // Fewer than asked for: the trail ends here, every day is whole.
  assert.equal(dropCutOffDay(feed, 3, 4), feed);
  // At the limit: the card holding the oldest event read (3) may have earlier ones unread.
  assert.deepEqual(dropCutOffDay(feed, 3, 3).map((entry) => entry.product.slug).sort(), ["kopi", "teh"]);
  assert.deepEqual(dropCutOffDay([], 3, 3), []);
});

test("the address carries the choice and the page, and drops what it does not know", () => {
  assert.deepEqual(readProductFeedQuery({ show: "role-filled", page: "3" }), { show: "role-filled", page: 3 });
  assert.deepEqual(readProductFeedQuery(new URLSearchParams("show=seat_filled&page=-2")), { show: "all", page: 1 });
  assert.deepEqual(readProductFeedQuery({ page: "1.5" }), { show: "all", page: 1 });
  assert.equal(productFeedPath("all"), "/");
  assert.equal(productFeedPath("update", 2), "/?show=update&page=2");
  assert.equal(productFeedPath("all", 1), "/");
  assert.ok(FEED_SHOWS.every((show) => show === "all" || isFeedShow(show)));
});
