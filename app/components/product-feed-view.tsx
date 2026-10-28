"use client";

import { useCallback, useMemo, useRef } from "react";
import { useSearchParams } from "next/navigation";
import Link from "./responsive-link";
import { InstantLink, InstantNav } from "./instant-link";
import { ProjectLogo } from "./project-logo";
import { ReactionBar } from "./reaction-bar";
import { RelativeTime } from "./relative-time";
import { paginate } from "../lib/directory";
import {
  dayLabel,
  FEED_SHOWS,
  feedDays,
  feedLine,
  feedShowCounts,
  feedShowLabel,
  filterProductFeed,
  productFeedPath,
  readProductFeedQuery,
  type ProductDay,
} from "../lib/product-feed";
import { eventReactionKey, type ReactionCount } from "../lib/reactions";
import { tx, type Locale } from "../lib/locale";

export type FeedProductLook = { logoUrl: string; website: string };

/**
 * The builders site's activity: one card per product per day, saying what
 * happened on it in the trail's own words — added, moved to a stage, an
 * update, a role opened or filled — with reactions under each card. Laid out
 * like the open source site's PR feed (the `ax-` timeline), so the two read as
 * one family.
 *
 * The page hands it every card once; the kind chips and the pages are a
 * re-render in the browser, with the address following each choice
 * (`?show=`, `?page=`) so a filtered page can be shared and gone back from —
 * the same arrangement as ActivityView.
 */
export function ProductFeedView({
  entries,
  looks,
  reactions,
  viewerName,
  today,
  locale,
}: {
  entries: ProductDay[];
  looks: Record<string, FeedProductLook>;
  reactions: Record<string, ReactionCount[]>;
  viewerName: string | null;
  today: string;
  locale: Locale;
}) {
  const searchParams = useSearchParams();
  const asked = readProductFeedQuery(searchParams);
  const results = useRef<HTMLDivElement>(null);

  const navigate = useCallback((href: string) => {
    const url = new URL(href, window.location.href);
    const next = `${url.pathname}${url.search}`;
    // The choice already showing: nothing to add to the history.
    if (next === `${window.location.pathname}${window.location.search}`) return;
    window.history.pushState(null, "", next);
    // The list changed under the reader; if its top has scrolled away, bring it back.
    const list = results.current;
    if (list && list.getBoundingClientRect().top < 0) list.scrollIntoView({ block: "start" });
  }, []);

  const counts = useMemo(() => feedShowCounts(entries), [entries]);
  const matched = useMemo(() => filterProductFeed(entries, asked.show), [entries, asked.show]);
  // Paged by card, as the directory is, so one product's day never splits across pages.
  const { items: shown, page, pages } = paginate(matched, asked.page);

  if (entries.length === 0) {
    return (
      <div className="ax-note">
        <p>{tx(locale, "Belum ada kabar dari produk member.", "No news from members' products yet.")}</p>
        <p>
          {tx(locale, "Punya produk? ", "Building one? ")}
          <Link href="/new">{tx(locale, "Daftarkan, lalu tulis kabar terbarunya.", "List it, then post its latest news.")}</Link>
        </p>
      </div>
    );
  }

  return (
    <InstantNav navigate={navigate}>
      <div ref={results}>
        {/* What kind of news: small chips, each with what it would list. A kind
            with none is left out, unless it is the one the address asked for. */}
        <ul className="ax-chips pfeed-shows" aria-label={tx(locale, "Jenis kabar", "Kind of news")}>
          {FEED_SHOWS.filter((show) => show === "all" || show === asked.show || counts[show] > 0).map((show) => (
            <li key={show}>
              <InstantLink href={productFeedPath(show)} aria-current={show === asked.show ? "page" : undefined}>
                {feedShowLabel(show, locale)} <span>{counts[show]}</span>
              </InstantLink>
            </li>
          ))}
        </ul>

        {shown.length === 0 ? (
          <div className="dx-empty ax-empty">
            <p>
              {tx(locale, "Belum ada kabar jenis ini. ", "No news of this kind yet. ")}
              <InstantLink href={productFeedPath("all")}>{tx(locale, "Lihat semua kabar", "See all news")}</InstantLink>
            </p>
          </div>
        ) : (
          <ProductTimeline entries={shown} looks={looks} reactions={reactions} viewerName={viewerName} today={today} locale={locale} />
        )}

        {pages > 1 ? (
          <nav className="dx-pager" aria-label={tx(locale, "Halaman", "Pages")}>
            {page > 1 ? (
              <InstantLink href={productFeedPath(asked.show, page - 1)} rel="prev">
                <span aria-hidden="true">←</span> {tx(locale, "Sebelumnya", "Previous")}
              </InstantLink>
            ) : (
              <span aria-hidden="true" />
            )}
            <p>{tx(locale, `Halaman ${page} dari ${pages}`, `Page ${page} of ${pages}`)}</p>
            {page < pages ? (
              <InstantLink href={productFeedPath(asked.show, page + 1)} rel="next">
                {tx(locale, "Berikutnya", "Next")} <span aria-hidden="true">→</span>
              </InstantLink>
            ) : (
              <span aria-hidden="true" />
            )}
          </nav>
        ) : null}
      </div>
    </InstantNav>
  );
}

function ProductTimeline({
  entries,
  looks,
  reactions,
  viewerName,
  today,
  locale,
}: {
  entries: ProductDay[];
  looks: Record<string, FeedProductLook>;
  reactions: Record<string, ReactionCount[]>;
  viewerName: string | null;
  today: string;
  locale: Locale;
}) {
  return (
    <div className="ax-timeline">
      {feedDays(entries).map(({ day, entries: onDay }) => (
        <section key={day} className="ax-day" aria-labelledby={`day-${day}`}>
          <h2 id={`day-${day}`} className="ax-day-title">
            {dayLabel(day, today, locale)}
          </h2>
          <ol className="ax-events">
            {onDay.map((entry) => {
              const key = eventReactionKey(entry.firstEventId);
              const look = looks[entry.product.slug];
              return (
                <li key={key} className="ax-event">
                  <ProjectLogo
                    className="pfeed-logo"
                    title={entry.product.title}
                    website={look?.website ?? ""}
                    logoUrl={look?.logoUrl ?? ""}
                    fallback={entry.product.title.slice(0, 1).toUpperCase()}
                  />
                  <div className="ax-event-body">
                    <p className="ax-event-line">
                      {entry.product.slug ? (
                        <Link className="ax-who" href={`/projects/${entry.product.slug}`}>
                          {entry.product.title}
                        </Link>
                      ) : (
                        <strong className="ax-who">{entry.product.title}</strong>
                      )}
                      <span className="ax-time">
                        <RelativeTime value={entry.at} locale={locale} />
                      </span>
                    </p>
                    <ul className="pfeed-lines">
                      {/* Oldest first within the day, so the card reads as it happened. */}
                      {[...entry.events].reverse().map((event) => (
                        <li key={event.id} className={`pfeed-line pfeed-${event.kind}`}>
                          {event.actor ? <Link href={`/u/${event.actor.username}`}>{event.actor.name || `@${event.actor.username}`}</Link> : tx(locale, "Seseorang", "Somebody")}{" "}
                          {feedLine(event, locale)}
                        </li>
                      ))}
                    </ul>
                    <ReactionBar url={key} initial={reactions[key] ?? []} viewerName={viewerName} />
                  </div>
                </li>
              );
            })}
          </ol>
        </section>
      ))}
    </div>
  );
}
