import { dayKey } from "./github-activity";
import { tx, type Locale } from "./locale";
import { roleLabel } from "./roles";
import { isStage, stageMeta } from "./stages";

/**
 * The builders site's /activity: what members' products did, read from the
 * trail `events` already keeps — a product added, moved to a new stage, an
 * update posted, a role opened or filled. The open source site's /activity
 * is members' pull requests instead; this is its counterpart for products.
 *
 * One entry per product per day, so a busy afternoon on one product reads as
 * one card rather than five. Days are counted in WIB, as on the PR feed.
 *
 * Pure, so the unit tests read it directly.
 */

/** Keep in step with `is_feed_event_kind` in supabase/migrations/20261101000000_product_feed_reactions.sql. */
export const FEED_KINDS = ["project_created", "project_stage_changed", "update_posted", "seat_opened", "seat_filled"] as const;
export type FeedKind = (typeof FEED_KINDS)[number];

export function isFeedKind(value: string): value is FeedKind {
  return (FEED_KINDS as readonly string[]).includes(value);
}

/** The half of a trail event the feed reads. */
export type FeedEvent = {
  id: number;
  kind: string;
  createdAt: string;
  projectSlug: string;
  projectTitle: string;
  payload: Record<string, string>;
  actor: { username: string; name: string } | null;
};

export type ProductDay = {
  /** The day's first event: what its reactions are keyed by, and so stable as the day goes on. */
  firstEventId: number;
  day: string;
  /** When the latest of the day's events happened. */
  at: string;
  product: { slug: string; title: string };
  /** Newest first. */
  events: FeedEvent[];
};

/**
 * The feed's entries, newest first: each product's events grouped by day.
 * A product deleted since keeps its events under the title they were
 * recorded with, and no link.
 */
export function groupProductFeed(events: FeedEvent[], timeZone = "Asia/Jakarta"): ProductDay[] {
  const byKey = new Map<string, ProductDay>();
  const newestFirst = [...events].filter((event) => isFeedKind(event.kind)).sort((a, b) => b.id - a.id);

  for (const event of newestFirst) {
    const day = dayKey(event.createdAt, timeZone);
    const key = `${event.projectSlug || event.projectTitle}|${day}`;
    const entry = byKey.get(key);
    if (entry) {
      entry.events.push(event);
      entry.firstEventId = Math.min(entry.firstEventId, event.id);
    } else {
      byKey.set(key, {
        firstEventId: event.id,
        day,
        at: event.createdAt,
        product: { slug: event.projectSlug, title: event.projectTitle },
        events: [event],
      });
    }
  }

  return [...byKey.values()].sort((a, b) => Date.parse(b.at) - Date.parse(a.at));
}

/**
 * The feed read whole only if fewer events came back than were asked for.
 * When the read stopped at its limit, the oldest event's card may be missing
 * the rest of its day — and with it the day's real first event, which its
 * reactions are keyed by — so that card is left out rather than shown under
 * the wrong key.
 */
export function dropCutOffDay(entries: ProductDay[], read: number, limit: number): ProductDay[] {
  if (read < limit || entries.length === 0) return entries;
  const oldest = Math.min(...entries.map((entry) => entry.firstEventId));
  return entries.filter((entry) => entry.firstEventId !== oldest);
}

/** The timeline's days, newest first, as the PR feed groups them. */
export function feedDays(entries: ProductDay[]): { day: string; entries: ProductDay[] }[] {
  const days: { day: string; entries: ProductDay[] }[] = [];
  for (const entry of entries) {
    const last = days[days.length - 1];
    if (last?.day === entry.day) last.entries.push(entry);
    else days.push({ day: entry.day, entries: [entry] });
  }
  return days;
}

/**
 * The feed's one "show" choice: every kind, or one. The address carries a
 * short name rather than the trail's own (`?show=update`, not
 * `?show=update_posted`), so a link reads as what it shows.
 */
export const FEED_SHOWS = ["all", "new", "stage", "update", "role-opened", "role-filled"] as const;
export type FeedShow = (typeof FEED_SHOWS)[number];

const SHOW_KIND: Record<Exclude<FeedShow, "all">, FeedKind> = {
  new: "project_created",
  stage: "project_stage_changed",
  update: "update_posted",
  "role-opened": "seat_opened",
  "role-filled": "seat_filled",
};

export function isFeedShow(value: string): value is FeedShow {
  return (FEED_SHOWS as readonly string[]).includes(value);
}

export function feedShowLabel(show: FeedShow, locale: Locale): string {
  switch (show) {
    case "all":
      return tx(locale, "Semua kabar", "All news");
    case "new":
      return tx(locale, "Produk baru", "New products");
    case "stage":
      return tx(locale, "Pindah tahap", "New stages");
    case "update":
      return tx(locale, "Kabar terbaru", "Updates");
    case "role-opened":
      return tx(locale, "Peran dibuka", "Roles opened");
    case "role-filled":
      return tx(locale, "Peran terisi", "Roles filled");
  }
}

type Query = Record<string, string | string[] | undefined> | URLSearchParams;

function read(query: Query, key: string): string {
  const value = query instanceof URLSearchParams ? query.get(key) : query[key];
  return (Array.isArray(value) ? value[0] : value) ?? "";
}

/** What the address asks the feed for; anything it does not know is the whole feed, page one. */
export function readProductFeedQuery(query: Query): { show: FeedShow; page: number } {
  const show = read(query, "show");
  const page = Number(read(query, "page"));
  return { show: isFeedShow(show) ? show : "all", page: Number.isInteger(page) && page > 1 ? page : 1 };
}

/** The address for a choice and a page; changing the choice goes back to page one. */
export function productFeedPath(show: FeedShow, page = 1): string {
  const params = new URLSearchParams();
  if (show !== "all") params.set("show", show);
  if (page > 1) params.set("page", String(page));
  const search = params.toString();
  return `/${search ? `?${search}` : ""}`;
}

/**
 * The cards with something of one kind on them, carrying only those lines.
 * Each keeps its own `firstEventId`, the whole day's, so its reactions are
 * the same ones it has unfiltered.
 */
export function filterProductFeed(entries: ProductDay[], show: FeedShow): ProductDay[] {
  if (show === "all") return entries;
  const kind = SHOW_KIND[show];
  return entries
    .flatMap((entry) => {
      const events = entry.events.filter((event) => event.kind === kind);
      return events.length > 0 ? [{ ...entry, at: events[0].createdAt, events }] : [];
    })
    // Ordered by the lines left, as the card's time now says.
    .sort((a, b) => Date.parse(b.at) - Date.parse(a.at));
}

/** How many cards each choice would list: the counts beside the chips. */
export function feedShowCounts(entries: ProductDay[]): Record<FeedShow, number> {
  const counts = Object.fromEntries(FEED_SHOWS.map((show) => [show, 0])) as Record<FeedShow, number>;
  counts.all = entries.length;
  for (const entry of entries) {
    const kinds = new Set(entry.events.map((event) => event.kind));
    for (const show of FEED_SHOWS) if (show !== "all" && kinds.has(SHOW_KIND[show])) counts[show] += 1;
  }
  return counts;
}

/** The numbers beside the heading, over the last 30 days. */
export function feedStats(events: FeedEvent[], now: Date = new Date()): { products: number; updates: number; rolesFilled: number } {
  const since = now.getTime() - 30 * 86_400_000;
  const recent = events.filter((event) => isFeedKind(event.kind) && Date.parse(event.createdAt) >= since);
  return {
    products: new Set(recent.map((event) => event.projectSlug || event.projectTitle)).size,
    updates: recent.filter((event) => event.kind === "update_posted").length,
    rolesFilled: recent.filter((event) => event.kind === "seat_filled").length,
  };
}

/** "Hari ini", "Kemarin", or the date, for a day key from groupProductFeed. */
export function dayLabel(day: string, today: string, locale: Locale): string {
  if (day === today) return tx(locale, "Hari ini", "Today");
  if (day === dayKey(new Date(Date.parse(`${today}T12:00:00+07:00`) - 86_400_000), "Asia/Jakarta")) return tx(locale, "Kemarin", "Yesterday");
  return new Intl.DateTimeFormat(locale === "id" ? "id-ID" : "en-US", { day: "numeric", month: "long", timeZone: "Asia/Jakarta" }).format(
    new Date(`${day}T12:00:00+07:00`),
  );
}

/**
 * One line of a product's card, after the actor's name. The card's heading
 * already names the product, so unlike the profile trail's activityParts
 * these leave it out: "membuka peran QA Engineer", not "… di Qala Temu".
 */
export function feedLine(event: Pick<FeedEvent, "kind" | "payload">, locale: Locale): string {
  const { payload } = event;
  const role = payload.role ? roleLabel(payload.role, "", locale) : "";
  const stage = payload.to && isStage(payload.to) ? tx(locale, stageMeta[payload.to].labelId, stageMeta[payload.to].label) : payload.to ?? "";

  switch (event.kind) {
    case "project_created":
      return tx(locale, "mendaftarkan produk ini.", "listed this product.");
    case "project_stage_changed":
      return tx(locale, `memindahkannya ke tahap ${stage}.`, `moved it to ${stage}.`);
    case "update_posted":
      return payload.update_title
        ? tx(locale, `mengirim kabar: “${payload.update_title}”`, `posted an update: “${payload.update_title}”`)
        : tx(locale, "mengirim kabar terbaru.", "posted an update.");
    case "seat_opened":
      return tx(locale, `membuka peran ${role}.`, `opened the ${role} role.`);
    case "seat_filled":
      return tx(locale, `bergabung sebagai ${role}.`, `joined as ${role}.`);
    default:
      return tx(locale, "berkontribusi.", "contributed.");
  }
}
