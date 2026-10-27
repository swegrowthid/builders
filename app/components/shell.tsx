import { Suspense } from "react";
import { cacheLife } from "next/cache";
import Link from "@/app/components/responsive-link";
import { Logo } from "../logo";
import { signOut } from "../auth-actions";
import { signInPath } from "../lib/urls";
import { currentViewer, type Viewer } from "../lib/session";
import { countIncomingApplications, countUnseenNotices, isSiteAdmin, listRepoSignals } from "../lib/data";
import { sourceRepo } from "../content";
import { readPublicly } from "../lib/public-read";
import { GitHubMark } from "./github-mark";
import { HeaderMenu } from "./header-menu";
import { ThemeToggle } from "./theme-toggle";
import { SignOutButton } from "./sign-out-button";
import { Skeleton } from "./skeleton";
import { currentLocale } from "../lib/locale-server";
import { tx, type Locale } from "../lib/locale";
import { isOss, site } from "../lib/site";

/**
 * What "add" means on this site: listing a project on builders, suggesting an
 * open source repo on oss, which has no products to list.
 */
const ADD_HREF = isOss ? "/recommend" : "/new";
function addLabel(locale: Locale): string {
  return isOss ? tx(locale, "Usulkan repo", "Suggest a repo") : tx(locale, "Tambah project", "Add a project");
}

/** Which top-level section the current page belongs to. */
export type Section = "directory" | "recommend" | "admin" | "activity" | "how" | "about" | "community" | "feedback" | "";

export function Arrow({ diagonal = false }: { diagonal?: boolean }) {
  return (
    <span className={`arrow ${diagonal ? "arrow-diagonal" : ""}`} aria-hidden="true">
      →
    </span>
  );
}

export function Brand({ footer = false, locale }: { footer?: boolean; locale: Locale }) {
  return (
    <Link className={`brand ${footer ? "footer-brand" : ""}`} href="/" aria-label={tx(locale, `Beranda ${site.name}`, `${site.name} home`)}>
      <Logo className="brand-mark" />
      {/* The header keeps the name short beside the menu; the footer credits the community in full. */}
      <span><strong>{site.id}</strong>{footer ? <span className="brand-alt">.swegrowth</span> : null}</span>
    </Link>
  );
}

type NavLink = { href: string; label: string; labelId: string; key: Section; icon: HeaderIconName };

/*
 * The main menu.
 *
 * The people come first: what members are doing — pull requests on the open
 * source site, products on builders — is the home page and the first place
 * in the menu, and on a phone the bottom bar. The directory comes second, as
 * what it is: on the open source site, repos we think are good places to
 * start, not a complete catalogue. Adding to it is the header's one button.
 */
const PRIMARY_LINKS: NavLink[] = [
  { href: "/", label: "Activity", labelId: "Aktivitas", key: "activity", icon: isOss ? "pull-request" : "pulse" },
  { href: "/directory", label: "Directory", labelId: "Direktori", key: "directory", icon: "directory" },
];

/* The pages that answer for the site — how it works, what this is, and where to say it is broken. */
const SECONDARY_LINKS: NavLink[] = [
  { href: "/how-it-works", label: "How it works", labelId: "Cara kerja", key: "how", icon: "steps" },
  { href: "/about", label: "About", labelId: "Tentang", key: "about", icon: "about" },
  { href: "/feedback", label: "Feedback", labelId: "Masukan", key: "feedback", icon: "feedback" },
];

/*
 * The WhatsApp group and its rules. Not in the laptop's header, which is full;
 * the phone's menu, the footer and /about lead to it.
 */
const COMMUNITY_LINK: NavLink = { href: "/community", label: "Community", labelId: "Komunitas", key: "community", icon: "community" };

type HeaderIconName =
  | "directory"
  | "pull-request"
  | "pulse"
  | "about"
  | "feedback"
  | "community"
  | "profile"
  | "edit"
  | "steps"
  | "inbox"
  | "add"
  | "language"
  | "signout"
  | "signin";

function HeaderIcon({ name }: { name: HeaderIconName }) {
  const paths: Record<HeaderIconName, React.ReactNode> = {
    directory: <><rect x="4" y="4" width="7" height="7" rx="1.5" /><rect x="13" y="4" width="7" height="7" rx="1.5" /><rect x="4" y="13" width="7" height="7" rx="1.5" /><rect x="13" y="13" width="7" height="7" rx="1.5" /></>,
    "pull-request": <><circle cx="6" cy="6" r="2.5" /><circle cx="6" cy="18" r="2.5" /><circle cx="18" cy="18" r="2.5" /><path d="M6 8.5v7M18 15.5V10a3 3 0 0 0-3-3h-4M13 4.5 10.5 7 13 9.5" /></>,
    pulse: <path d="M3 12h4l2.5-6 5 12 2.5-6h4" />,
    about: <><circle cx="12" cy="12" r="9" /><path d="M12 11.5v5M12 7.8h.01" /></>,
    feedback: <><path d="M4 5h16v11H10l-4 4v-4H4z" /><path d="M8 9h8M8 12.5h5" /></>,
    community: <><circle cx="9" cy="8.5" r="3" /><path d="M3.5 19a5.5 5.5 0 0 1 11 0" /><circle cx="17" cy="9.5" r="2.4" /><path d="M16.5 14.6A4.5 4.5 0 0 1 21 19" /></>,
    profile: <><circle cx="12" cy="8" r="3.5" /><path d="M5 20a7 7 0 0 1 14 0" /></>,
    inbox: <><path d="M4 5h16v13H4z" /><path d="M4 14h4l1.5 2h5l1.5-2h4" /></>,
    edit: <><path d="M4 20h4l10-10-4-4L4 16v4Z" /><path d="m14 6 4 4" /></>,
    steps: <><path d="M4 7h5v13H4zM9.5 12h5v8h-5zM15 4h5v16h-5z" /></>,
    add: <path d="M12 5v14M5 12h14" />,
    language: <><circle cx="12" cy="12" r="9" /><path d="M3 12h18" /><path d="M12 3a14 14 0 0 1 0 18 14 14 0 0 1 0-18Z" /></>,
    signout: <><path d="M10 5H5v14h5M14 8l4 4-4 4M9 12h9" /></>,
    signin: <><path d="M14 5h5v14h-5M10 8l-4 4 4 4M6 12h9" /></>,
  };

  return <svg className="menu-icon" viewBox="0 0 24 24" aria-hidden="true">{paths[name]}</svg>;
}

function MainNav({ active, locale }: { active: Section; locale: Locale }) {
  return (
    <nav className="desktop-nav" aria-label={tx(locale, "Navigasi utama", "Primary navigation")}>
      {[...PRIMARY_LINKS, ...SECONDARY_LINKS].map((link) => (
        <Link
          key={link.href}
          aria-current={active === link.key ? "page" : undefined}
          className={active === link.key ? "is-active" : ""}
          href={link.href}
        >
          {tx(locale, link.labelId, link.label)}
        </Link>
      ))}
    </nav>
  );
}

/**
 * The phone's bottom bar: the two places, then the visitor's own — their
 * profile, or the way in. `viewer` is undefined while the visitor is still
 * being worked out, and the third place waits as a placeholder rather than
 * flash the wrong one.
 */
function BottomNav({
  active,
  viewer,
  returnTo = "/",
  locale,
}: {
  active: Section;
  viewer?: Viewer | null;
  returnTo?: string;
  locale: Locale;
}) {
  return (
    <nav className="bottom-nav" aria-label={tx(locale, "Navigasi utama seluler", "Mobile primary navigation")}>
      {PRIMARY_LINKS.map((link) => (
        <Link
          key={link.href}
          aria-current={active === link.key ? "page" : undefined}
          className={active === link.key ? "is-active" : ""}
          href={link.href}
        >
          <HeaderIcon name={link.icon} />
          <span>{tx(locale, link.labelId, link.label)}</span>
        </Link>
      ))}
      {viewer === undefined ? (
        <span className="bottom-nav-placeholder" aria-hidden="true">
          <Skeleton height={20} width={20} round />
          <Skeleton height={10} width={36} />
        </span>
      ) : viewer ? (
        <Link
          href={`/u/${viewer.username}`}
          aria-current={onOwnProfile(viewer, returnTo) ? "page" : undefined}
          className={onOwnProfile(viewer, returnTo) ? "is-active" : ""}
        >
          <HeaderIcon name="profile" />
          <span>{tx(locale, "Profil", "Profile")}</span>
        </Link>
      ) : (
        <Link href={signInPath(returnTo)}>
          <HeaderIcon name="signin" />
          <span>{tx(locale, "Masuk", "Sign in")}</span>
        </Link>
      )}
    </nav>
  );
}

/** The viewer's own profile, or the page that edits it. */
function onOwnProfile(viewer: Viewer, path: string): boolean {
  const pathname = path.split(/[?#]/)[0];
  return pathname === `/u/${viewer.username}` || pathname.startsWith("/account/profile");
}

/**
 * This site's own repository, with its stars — the site is open source, and
 * says so where open source sites usually do. The count comes from the same
 * cached repo_signals the directory reads, so it costs no GitHub request; it
 * stays small and light beside the mark, and on a phone the mark stands alone.
 */
async function SourceLink({ locale }: { locale: Locale }) {
  const signals = await readPublicly("source stars in header", () => listRepoSignals(), {});
  const stars = signals.value[sourceRepo.toLowerCase()]?.stats?.stars ?? 0;
  const count = new Intl.NumberFormat(locale === "id" ? "id-ID" : "en-US", { notation: "compact", maximumFractionDigits: 1 }).format(stars);
  const label = stars > 0
    ? tx(locale, `Kode sumber di GitHub, ${stars} bintang`, `Source code on GitHub, ${stars} stars`)
    : tx(locale, "Kode sumber di GitHub", "Source code on GitHub");
  return (
    <a className="source-link" href={`https://github.com/${sourceRepo}`} target="_blank" rel="noopener noreferrer" aria-label={label} title={label}>
      <GitHubMark />
      {stars > 0 ? <span className="source-link-count" aria-hidden="true">{count}</span> : null}
    </a>
  );
}

/**
 * The header's static frame — same brand and links, no visitor yet.
 *
 * Every loading.tsx renders this so a navigation answers instantly with the
 * page's skeleton instead of a blank strip where the header will be. The real
 * SiteHeader streams in over it once the visitor is known.
 */
export async function HeaderShell({ active = "" }: { active?: Section }) {
  const locale = await currentLocale();
  return (
    <>
      <header className="site-header">
        <div className="topbar-inner">
          <Brand locale={locale} />
          <MainNav active={active} locale={locale} />
          <div className="header-actions header-shell-actions header-account-skeleton" aria-busy="true">
            <SourceLink locale={locale} />
            <Skeleton height={36} width={36} round />
            <Skeleton height={32} width={150} style={{ borderRadius: 6 }} />
            <span className="sr-only">{tx(locale, "Memuat kontrol akun…", "Loading account controls…")}</span>
          </div>
        </div>
      </header>
      <BottomNav active={active} locale={locale} />
    </>
  );
}

/**
 * The header, with the visitor streamed in.
 *
 * Who is looking is the one thing on most pages that cannot be cached or
 * prerendered — it comes from a cookie and a round trip to the auth server.
 * Holding the whole page open for it would make every route dynamic, which is
 * exactly what this site used to do. Behind this boundary the rest of the page
 * prerenders and ships immediately, and the header fills itself in.
 *
 * `HeaderShell` deliberately uses neutral placeholders for account controls.
 * Until the session resolves, we do not know whether the visitor should see a
 * sign-in link or an account menu, and rendering either would flash the wrong
 * state.
 */
export async function SiteHeader({
  returnTo = "/",
  active = "",
}: {
  returnTo?: string | Promise<string>;
  active?: Section;
}) {
  const locale = await currentLocale();
  return (
    <Suspense fallback={<HeaderShell active={active} />}>
      <VisitorHeader returnTo={returnTo} active={active} locale={locale} />
    </Suspense>
  );
}

async function VisitorHeader({
  returnTo = "/",
  active = "",
  locale,
}: {
  returnTo?: string | Promise<string>;
  active?: Section;
  locale: Locale;
}) {
  // `returnTo` may be a promise: on the pages whose address depends on the
  // filters in the URL, working it out means reading `searchParams`. Awaiting
  // it here rather than in the page keeps that read inside this boundary,
  // where the visitor is already being waited for, instead of holding up the
  // page's prerendered shell.
  const [viewer, destination] = await Promise.all([currentViewer(), returnTo]);
  // An application nobody sees is an application nobody answers, and a
  // decision nobody sees is the same — so both counts ride along in the header
  // rather than waiting to be found.
  const [incomingResult, unseenResult, adminResult] = viewer
    ? await Promise.all([
        readPublicly("incoming applications in header", () => countIncomingApplications(viewer.id), 0),
        readPublicly("notifications in header", () => countUnseenNotices(viewer.id), 0),
        readPublicly("admin check in header", () => isSiteAdmin(), false),
      ])
    : [
        { value: 0, unavailable: false },
        { value: 0, unavailable: false },
        { value: false, unavailable: false },
      ];
  const admin = adminResult.value;
  const incoming = incomingResult.value;
  const unseen = unseenResult.value;
  const waiting = incoming + unseen;

  // The bottom bar sits beside the header, not in it: the header's backdrop
  // blur would make it the containing block of anything fixed inside it.
  return (
    <>
      <header className="site-header">
        <div className="topbar-inner">
          <Brand locale={locale} />
          <MainNav active={active} locale={locale} />

          <div className="header-actions">
            <SourceLink locale={locale} />
            {viewer ? (
              <>
                {/* No proposals or notices on the open source site. */}
                {isOss ? null : (
                  <Link className="icon-button" href="/inbox" aria-label={inboxLabel(incoming, unseen, locale)}>
                    <svg className="icon" viewBox="0 0 24 24" aria-hidden="true">
                      <path d="M18 9a6 6 0 0 0-12 0c0 7-3 7-3 8h18c0-1-3-1-3-8M10 21h4" />
                    </svg>
                    {waiting > 0 ? <span className="notification-dot">{waiting}</span> : null}
                  </Link>
                )}
                <AccountMenu viewer={viewer} waiting={waiting} admin={admin} locale={locale} />
                <Link className="primary-action" href={ADD_HREF}>
                  <span aria-hidden="true">+</span> {addLabel(locale)}
                </Link>
              </>
            ) : (
              <>
                <Link className="nav-login" href={signInPath(destination)}>{tx(locale, "Masuk", "Sign in")}</Link>
                {/* A guest's first step is an account, whatever they came for: suggesting a
                    project needs one too. A plain sign-in lands on /get-started. */}
                <Link className="primary-action" href="/signin">
                  {tx(locale, "Gabung", "Join")}
                </Link>
              </>
            )}

            <MobileHeaderMenu active={active} returnTo={destination} viewer={viewer} waiting={waiting} admin={admin} locale={locale} />
          </div>
        </div>
      </header>
      <BottomNav active={active} viewer={viewer} returnTo={destination} locale={locale} />
    </>
  );
}

function AccountIdentity({ viewer }: { viewer: Viewer }) {
  return (
    <div className="account-identity">
      <span className="account-avatar" aria-hidden="true">{initialsOf(viewer.name)}</span>
      <span className="account-identity-copy">
        <strong>{viewer.name}</strong>
        <span>@{viewer.username}</span>
        {viewer.profession ? <small>{viewer.profession}</small> : null}
      </span>
    </div>
  );
}

function AccountMenu({ viewer, waiting, admin, locale }: { viewer: Viewer; waiting: number; admin: boolean; locale: Locale }) {
  return (
    <HeaderMenu
      className="account-menu"
      summaryClassName="avatar-button"
      summaryLabel={tx(locale, `Buka menu akun ${viewer.name}`, `Open ${viewer.name}'s account menu`)}
      summary={<span aria-hidden="true">{initialsOf(viewer.name)}</span>}
    >
      <div className="account-popover">
        <AccountIdentity viewer={viewer} />
        <nav className="account-menu-links" aria-label={tx(locale, "Menu akun", "Account menu")}>
          <Link href={`/u/${viewer.username}`}>
            <HeaderIcon name="profile" />
            <span>{tx(locale, "Profil publik", "Public profile")}</span>
          </Link>
          <Link href="/account/profile">
            <HeaderIcon name="edit" />
            <span>{tx(locale, "Edit profil", "Edit profile")}</span>
          </Link>
          <Link href="/get-started?all=1">
            <HeaderIcon name="steps" />
            <span>{tx(locale, "Langkah berikutnya", "Next steps")}</span>
          </Link>
          {isOss ? null : (
            <Link href="/inbox">
              <HeaderIcon name="inbox" />
              <span>{tx(locale, "Kotak masuk", "Inbox")}</span>
              {waiting > 0 ? <span className="menu-count">{waiting}</span> : null}
            </Link>
          )}
          <Link href={ADD_HREF}>
            <HeaderIcon name="add" />
            <span>{addLabel(locale)}</span>
          </Link>
          <Link href="/account/language">
            <HeaderIcon name="language" />
            <span>{tx(locale, "Bahasa", "Language")}</span>
          </Link>
          {admin ? (
            <Link href="/admin">
              <HeaderIcon name="steps" />
              <span>Admin</span>
            </Link>
          ) : null}
        </nav>
        <div className="menu-theme-row"><ThemeToggle row /></div>
        <form className="account-signout" action={signOut}>
          <SignOutButton />
        </form>
      </div>
    </HeaderMenu>
  );
}

function MobileHeaderMenu({
  active,
  returnTo,
  viewer,
  waiting,
  admin,
  locale,
}: {
  active: Section;
  returnTo: string;
  viewer?: Viewer | null;
  waiting: number;
  admin: boolean;
  locale: Locale;
}) {
  return (
    <HeaderMenu
      className="mobile-menu"
      summaryLabel={tx(locale, "Buka menu navigasi", "Open navigation menu")}
      summary={
        <>
          <i aria-hidden="true" />
          <i aria-hidden="true" />
        </>
      }
    >
      <div className="mobile-nav">
        {/* Directory, activity and the profile are on the bottom bar; the menu
            keeps only what is not, so it stays short enough for one screen. */}
        {viewer ? (
          <section className="mobile-account-section" aria-label={tx(locale, "Akun", "Account")}>
            <Link className="mobile-account-identity" href={`/u/${viewer.username}`}>
              <AccountIdentity viewer={viewer} />
            </Link>
            <nav className="mobile-account-links" aria-label={tx(locale, "Menu akun seluler", "Mobile account menu")}>
              <Link href="/account/profile">
                <HeaderIcon name="edit" />
                <span>{tx(locale, "Edit profil", "Edit profile")}</span>
              </Link>
              {isOss ? null : (
                <Link href="/inbox">
                  <HeaderIcon name="inbox" />
                  <span>{tx(locale, "Kotak masuk", "Inbox")}</span>
                  {waiting > 0 ? <span className="menu-count">{waiting}</span> : null}
                </Link>
              )}
              <Link href="/get-started?all=1">
                <HeaderIcon name="steps" />
                <span>{tx(locale, "Langkah berikutnya", "Next steps")}</span>
              </Link>
              {admin ? (
                <Link href="/admin">
                  <HeaderIcon name="steps" />
                  <span>Admin</span>
                </Link>
              ) : null}
            </nav>
          </section>
        ) : null}

        {viewer ? (
          <Link className="mobile-project-action" href={ADD_HREF}>
            <HeaderIcon name="add" />
            <span>{addLabel(locale)}</span>
          </Link>
        ) : (
          <Link className="mobile-project-action" href="/signin">
            <HeaderIcon name="profile" />
            <span>{tx(locale, `Gabung ke ${site.name}`, `Join ${site.name}`)}</span>
          </Link>
        )}

        <nav className="mobile-nav-pages" aria-label={tx(locale, "Menu seluler", "Mobile menu")}>
          {[COMMUNITY_LINK, ...SECONDARY_LINKS].map((link) => (
            <Link
              key={link.href}
              aria-current={active === link.key ? "page" : undefined}
              className={active === link.key ? "is-active" : ""}
              href={link.href}
            >
              <HeaderIcon name={link.icon} />
              <span>{tx(locale, link.labelId, link.label)}</span>
            </Link>
          ))}
        </nav>

        <div className="mobile-nav-settings">
          <Link href="/account/language">
            <HeaderIcon name="language" />
            <span>{tx(locale, "Bahasa", "Language")}</span>
          </Link>
          <ThemeToggle row />
          {viewer ? (
            <form className="account-signout" action={signOut}>
              <SignOutButton />
            </form>
          ) : (
            <Link href={signInPath(returnTo)}>
              <HeaderIcon name="signin" />
              <span>{tx(locale, "Masuk", "Sign in")}</span>
            </Link>
          )}
        </div>
      </div>
    </HeaderMenu>
  );
}

/** One badge, two meanings — the label says which, rather than just a number. */
function inboxLabel(incoming: number, unseen: number, locale: Locale): string {
  const parts = [
    incoming > 0 ? tx(locale, `${incoming} orang menunggu tanggapan`, `${incoming} people awaiting a response`) : "",
    unseen > 0 ? tx(locale, `${unseen} kabar baru`, `${unseen} new updates`) : "",
  ].filter(Boolean);

  return parts.length > 0
    ? `${tx(locale, "Kotak masuk", "Inbox")} — ${parts.join(", ")}`
    : tx(locale, "Kotak masuk", "Inbox");
}

function initialsOf(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

export async function SiteFooter() {
  const locale = await currentLocale();
  return (
    <footer>
      <div className="footer-brand-group">
        <Brand footer locale={locale} />
        <p>
          {isOss
            ? tx(locale, "Direktori repo open source yang bisa kamu kontribusikan.", "A directory of open source repos you can contribute to.")
            : tx(locale, "Direktori produk buatan member komunitas swegrowth.", "A directory of products built by swegrowth community members.")}
        </p>
      </div>
      {/* Only the pages the header leaves out: the directory, adding to it and
          GitHub are a click away up there already. */}
      <nav aria-label={tx(locale, "Navigasi footer", "Footer navigation")}>
        <Link href="/how-it-works">{tx(locale, "Cara kerjanya", "How it works")}</Link>
        <Link href="/about">{tx(locale, "Tentang Kami", "About Us")}</Link>
        <Link href="/community">{tx(locale, "Komunitas", "Community")}</Link>
        <Link href="/feedback">{tx(locale, "Masukan", "Feedback")}</Link>
        <Link href="/privacy">{tx(locale, "Privasi", "Privacy")}</Link>
      </nav>
      <div className="footer-end">
        {/* A signed-out visitor on a laptop has no account menu, so language
            and theme stay here for them, apart from the pages. */}
        <div className="footer-prefs">
          <Link href="/account/language">{tx(locale, "Bahasa", "Language")}</Link>
          <ThemeToggle row />
        </div>
        <small>© <CopyrightYear /> {site.name}</small>
      </div>
    </footer>
  );
}

/**
 * The year in the footer, cached.
 *
 * `new Date()` cannot be read while prerendering — it would freeze whatever
 * the build machine's clock said into the static shell. Caching it is the
 * honest fix: the year is the same for everybody, and re-reading it once a day
 * means the footer turns over within a day of New Year without any page here
 * having to be rendered per request to say so.
 */
async function CopyrightYear() {
  "use cache";
  cacheLife("days");

  return new Date().getFullYear();
}
