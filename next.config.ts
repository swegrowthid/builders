import type { NextConfig } from "next";

/**
 * Cache Components is what makes this site cheap to serve.
 *
 * Every route used to carry `dynamic = "force-dynamic"`, so each page view
 * re-read Supabase from scratch — including the two story pages, which have no
 * database reads at all. With `cacheComponents` on, each route prerenders a
 * static shell, the public reads in `app/lib/data.ts` are cached and shared
 * across visitors, and only the parts that genuinely depend on who is looking
 * (the header, the inbox, an application state) stream in at request time.
 *
 * The profiles below name the shapes of data this site has, so a call site
 * reads as an intent rather than a number. All three are also invalidated on
 * demand: every write in `app/actions.ts` calls `updateTag`, so an edit shows
 * up immediately and the durations are only the ceiling for changes that
 * happen outside the app.
 */
const nextConfig: NextConfig = {
  cacheComponents: true,
  async redirects() {
    return [
      { source: "/kolaborasi", destination: "/explore", permanent: true },
      { source: "/orang", destination: "/people", permanent: true },
      { source: "/mulai", destination: "/get-started", permanent: true },
      { source: "/lupa-password", destination: "/forgot-password", permanent: true },
      { source: "/akun/profil", destination: "/account/profile", permanent: true },
      { source: "/akun/password", destination: "/account/password", permanent: true },
    ];
  },
  // Let a Link start upgrading an unseen dynamic detail route while it is in
  // view. That makes a click from Explore feel instant even when the project
  // was created after the last deployment and therefore was not pre-rendered
  // below yet.
  partialPrefetching: true,
  experimental: {
    // Going back to a page seen in the last two minutes — Home, Explore,
    // People, a profile — shows it from the browser instead of waiting on
    // the server again. Every write still clears this at once (updateTag and
    // revalidatePath in app/actions.ts), so it only ever repeats a page
    // nothing has changed since.
    staleTimes: { dynamic: 120 },
    // The stylesheet arrives inside the HTML instead of as a second request
    // the browser must wait for before it paints anything. On a first visit
    // over a high-latency mobile connection that request was ~0.4 s of blank
    // screen; the cost is ~30 KB (compressed) more HTML on each page load.
    inlineCss: true,
  },
  cacheLife: {
    // The board, the people directory, a project page. Someone posting a
    // project wants to see it appear; the tag invalidation covers that, and
    // this is the backstop for rows that changed in the database directly.
    board: {
      // Keep public discovery results in the browser Router Cache long enough
      // that moving among Home, Explore, and People does not fetch them again.
      // A write still clears this immediately through updateTag/revalidatePath.
      stale: 300,
      revalidate: 300,
      expire: 3600,
    },
    // Facets rebuilt from the same rows the board already reads: topic counts,
    // open-role suggestions. A new topic appearing a few minutes late costs
    // nothing, and these are the most expensive reads to repeat.
    facets: {
      stale: 300,
      revalidate: 900,
      expire: 86400,
    },
    // A person's public trail. Append-only in practice, and never urgent.
    trail: {
      stale: 300,
      revalidate: 1800,
      expire: 86400,
    },
  },
};

export default nextConfig;
