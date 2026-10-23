import { isBadgeKind } from "./badges";
import {
  isDirectoryOpening,
  isDirectorySort,
  isDirectoryScope,
  isDirectoryTrack,
  isPRTier,
  type DirectoryFilters,
} from "./directory";
import { isStage } from "./stages";

/**
 * The directory's address, both ways: what a URL asks for, and the URL for a
 * set of filters. Shared by the page on the server (the header's return
 * address) and the list in the browser, which filters without a round trip.
 */

type Query = Record<string, string | string[] | undefined> | URLSearchParams;

export function one(value: string | string[] | null | undefined): string {
  return (Array.isArray(value) ? value[0] : value) ?? "";
}

function read(query: Query, key: string): string {
  return query instanceof URLSearchParams ? one(query.get(key)) : one(query[key]);
}

/** How many values one group may carry: more than anybody picks, few enough to bound a hand-made URL. */
const MAX_VALUES = 10;

/** A group that takes several values, each its own `key=` in the URL; repeats dropped. */
function readAll(query: Query, key: string): string[] {
  const raw = query instanceof URLSearchParams ? query.getAll(key) : [query[key] ?? []].flat();
  return [...new Set(raw.filter(Boolean))].slice(0, MAX_VALUES);
}

/**
 * What the URL asks for. Software engineers are who the site is for first,
 * so with no choice made the GitHub path is the one showing.
 */
export function readFilters(query: Query): DirectoryFilters {
  const track = read(query, "track");
  // `source` was the sidebar's community-or-recommended group that the toggle
  // replaced; an old link keeps meaning roughly what it did.
  const legacy = read(query, "source");
  const scope = read(query, "scope") || (legacy === "community" ? "local" : legacy === "recommended" ? "global" : "");
  const badge = read(query, "badge");
  const open = read(query, "open");
  const sort = read(query, "sort");
  return {
    track: isDirectoryTrack(track) ? track : "github",
    scope: isDirectoryScope(scope) ? scope : "",
    open: isDirectoryOpening(open) ? open : "",
    pr: readAll(query, "pr").filter(isPRTier),
    badge: isBadgeKind(badge) ? badge : "",
    facet: readAll(query, "facet").map((value) => value.slice(0, 60)),
    // `phase`, not `stage`: `/?stage=` was the old board's address, and links
    // to it are still out there meaning something else.
    stage: readAll(query, "phase").filter(isStage),
    sort: isDirectorySort(sort) ? sort : "",
    q: read(query, "q").slice(0, 100),
  };
}

/** The page lives beside the filters; every filter link leaves it out, so a change starts from page one. */
export function readPage(query: Query): string {
  return read(query, "page");
}

export function pathFor(filters: DirectoryFilters, page = 1): string {
  const params = new URLSearchParams();
  if (filters.track !== "github") params.set("track", filters.track);
  if (filters.scope) params.set("scope", filters.scope);
  if (filters.open) params.set("open", filters.open);
  for (const tier of filters.pr ?? []) params.append("pr", tier);
  if (filters.badge) params.set("badge", filters.badge);
  for (const facet of filters.facet) params.append("facet", facet);
  for (const stage of filters.stage ?? []) params.append("phase", stage);
  if (filters.q) params.set("q", filters.q);
  if (filters.sort) params.set("sort", filters.sort);
  if (page > 1) params.set("page", String(page));
  const search = params.toString();
  return `/${search ? `?${search}` : ""}`;
}
