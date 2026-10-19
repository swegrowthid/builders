import { Suspense } from "react";
import { cacheLife } from "next/cache";
import Link from "@/app/components/responsive-link";
import { Logo } from "../logo";
import { signOut } from "../auth-actions";
import { signInPath } from "../lib/urls";
import { currentViewer, type Viewer } from "../lib/session";
import { countIncomingApplications, countUnseenNotices } from "../lib/data";
import { readPublicly } from "../lib/public-read";
import { HeaderMenu } from "./header-menu";
import { SignOutButton } from "./sign-out-button";
import { Skeleton } from "./skeleton";
import { currentLocale } from "../lib/locale-server";
import { tx, type Locale } from "../lib/locale";

/** Which top-level section the current page belongs to. */
export type Section = "home" | "explore" | "people" | "about" | "feedback" | "";

export function Arrow({ diagonal = false }: { diagonal?: boolean }) {
  return (
    <span className={`arrow ${diagonal ? "arrow-diagonal" : ""}`} aria-hidden="true">
      →
    </span>
  );
}

export function Brand({ footer = false, locale }: { footer?: boolean; locale: Locale }) {
  return (
    <Link className={`brand ${footer ? "footer-brand" : ""}`} href="/" aria-label={tx(locale, "Beranda Builders", "Builders home")}>
      <Logo className="brand-mark" />
      <span><strong>builders</strong><span className="brand-alt">.swegrowth</span></span>
    </Link>
  );
}

/*
 * The main menu.
 *
 * The directory is the site, so the menu is short: the directory itself, then
 * the two pages that answer for the site — what this is, and where to say it
 * is broken. Listing a project is the header's button, not a menu entry.
 */
const LINKS: { href: string; label: string; labelId: string; key: Section; icon: HeaderIconName }[] = [
  { href: "/", label: "Directory", labelId: "Direktori", key: "home", icon: "home" },
  { href: "/about", label: "About", labelId: "Tentang", key: "about", icon: "about" },
  { href: "/feedback", label: "Feedback", labelId: "Masukan", key: "feedback", icon: "feedback" },
];

type HeaderIconName =
  | "home"
  | "explore"
  | "people"
  | "about"
  | "feedback"
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
    home: <><path d="m3 11 9-7 9 7" /><path d="M5.5 10v10h13V10M9 20v-6h6v6" /></>,
    explore: <><circle cx="12" cy="12" r="9" /><path d="m15.5 8.5-2 5-5 2 2-5 5-2Z" /></>,
    people: <><path d="M16 20v-1.5a4.5 4.5 0 0 0-4.5-4.5h-3A4.5 4.5 0 0 0 4 18.5V20" /><circle cx="10" cy="7" r="3.5" /><path d="M17 11a3 3 0 0 0 0-6M19 14.5a4 4 0 0 1 2 3.5v2" /></>,
    about: <><circle cx="12" cy="12" r="9" /><path d="M12 11.5v5M12 7.8h.01" /></>,
    feedback: <><path d="M4 5h16v11H10l-4 4v-4H4z" /><path d="M8 9h8M8 12.5h5" /></>,
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
      {LINKS.map((link) => (
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
 * The header's static frame — same brand and links, no visitor yet.
 *
 * Every loading.tsx renders this so a navigation answers instantly with the
 * page's skeleton instead of a blank strip where the header will be. The real
 * SiteHeader streams in over it once the visitor is known.
 */
export async function HeaderShell({ active = "" }: { active?: Section }) {
  const locale = await currentLocale();
  return (
    <header className="site-header">
      <div className="topbar-inner">
        <Brand locale={locale} />
        <MainNav active={active} locale={locale} />
        <div className="header-actions header-shell-actions header-account-skeleton" aria-busy="true">
          <Skeleton height={38} width={38} round />
          <Skeleton height={40} width={116} style={{ borderRadius: 999 }} />
          <span className="sr-only">{tx(locale, "Memuat kontrol akun…", "Loading account controls…")}</span>
        </div>
      </div>
    </header>
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
  const [incomingResult, unseenResult] = viewer
    ? await Promise.all([
        readPublicly("incoming applications in header", () => countIncomingApplications(viewer.id), 0),
        readPublicly("notifications in header", () => countUnseenNotices(viewer.id), 0),
      ])
    : [
        { value: 0, unavailable: false },
        { value: 0, unavailable: false },
      ];
  const incoming = incomingResult.value;
  const unseen = unseenResult.value;
  const waiting = incoming + unseen;

  return (
    <header className="site-header">
      <div className="topbar-inner">
        <Brand locale={locale} />
        <MainNav active={active} locale={locale} />

        <div className="header-actions">
          {viewer ? (
            <>
              <Link className="icon-button" href="/inbox" aria-label={inboxLabel(incoming, unseen, locale)}>
                <svg className="icon" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M18 9a6 6 0 0 0-12 0c0 7-3 7-3 8h18c0-1-3-1-3-8M10 21h4" />
                </svg>
                {waiting > 0 ? <span className="notification-dot">{waiting}</span> : null}
              </Link>
              <AccountMenu viewer={viewer} waiting={waiting} locale={locale} />
              <Link className="primary-action" href="/new">
                <span aria-hidden="true">+</span> {tx(locale, "Daftarkan project", "List a project")}
              </Link>
            </>
          ) : (
            <>
              <Link className="nav-login" href={signInPath(destination)}>{tx(locale, "Masuk", "Sign in")}</Link>
              <Link className="primary-action" href="/new">
                <span aria-hidden="true">+</span> {tx(locale, "Daftarkan project", "List a project")}
              </Link>
            </>
          )}

          <MobileHeaderMenu active={active} returnTo={destination} viewer={viewer} waiting={waiting} locale={locale} />
        </div>
      </div>
    </header>
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

function AccountMenu({ viewer, waiting, locale }: { viewer: Viewer; waiting: number; locale: Locale }) {
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
          <Link href="/inbox">
            <HeaderIcon name="inbox" />
            <span>{tx(locale, "Kotak masuk", "Inbox")}</span>
            {waiting > 0 ? <span className="menu-count">{waiting}</span> : null}
          </Link>
          <Link href="/new">
            <HeaderIcon name="add" />
            <span>{tx(locale, "Daftarkan project", "List a project")}</span>
          </Link>
          <Link href="/account/language">
            <HeaderIcon name="language" />
            <span>{tx(locale, "Bahasa", "Language")}</span>
          </Link>
        </nav>
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
  locale,
}: {
  active: Section;
  returnTo: string;
  viewer?: Viewer | null;
  waiting: number;
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
        <nav className="mobile-nav-primary" aria-label={tx(locale, "Navigasi utama seluler", "Mobile primary navigation")}>
          <p className="mobile-menu-label">{tx(locale, "Menu", "Menu")}</p>
          {LINKS.map((link) => (
            <Link
              key={link.href}
              aria-current={active === link.key ? "page" : undefined}
              className={active === link.key ? "is-active" : ""}
              href={link.href}
            >
              <HeaderIcon name={link.icon} />
              <span>{tx(locale, link.labelId, link.label)}</span>
              {active === link.key ? <span className="mobile-active-dot" aria-hidden="true" /> : null}
            </Link>
          ))}
        </nav>

        <Link className="mobile-project-action" href="/new">
          <HeaderIcon name="add" />
          <span>{tx(locale, "Daftarkan project", "List a project")}</span>
        </Link>

        {viewer ? (
          <section className="mobile-account-section" aria-label={tx(locale, "Akun", "Account")}>
            <AccountIdentity viewer={viewer} />
            <nav className="mobile-account-links" aria-label={tx(locale, "Menu akun seluler", "Mobile account menu")}>
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
              <Link href="/inbox">
                <HeaderIcon name="inbox" />
                <span>{tx(locale, "Kotak masuk", "Inbox")}</span>
                {waiting > 0 ? <span className="menu-count">{waiting}</span> : null}
              </Link>
              <Link href="/account/language">
                <HeaderIcon name="language" />
                <span>{tx(locale, "Bahasa", "Language")}</span>
              </Link>
            </nav>
            <form className="account-signout" action={signOut}>
              <SignOutButton />
            </form>
          </section>
        ) : (
          <div className="mobile-guest-actions">
            <Link href={signInPath(returnTo)}>
              <HeaderIcon name="signin" />
              <span>{tx(locale, "Masuk", "Sign in")}</span>
            </Link>
          </div>
        )}
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
      <Brand footer locale={locale} />
      <p>{tx(locale, "Direktori project yang bisa kamu kontribusikan.", "A directory of projects you can contribute to.")}</p>
      <nav aria-label={tx(locale, "Navigasi footer", "Footer navigation")}>
        <Link href="/">{tx(locale, "Direktori", "Directory")}</Link>
        <Link href="/new">{tx(locale, "Daftarkan project", "List a project")}</Link>
        <Link href="/about">{tx(locale, "Tentang Kami", "About Us")}</Link>
        <Link href="/feedback">{tx(locale, "Masukan", "Feedback")}</Link>
        <Link href="/privacy">{tx(locale, "Privasi", "Privacy")}</Link>
        {/* The only reach a signed-out visitor has left to change language,
            now that the header no longer carries the switcher directly. */}
        <Link href="/account/language">{tx(locale, "Bahasa", "Language")}</Link>
      </nav>
      <small>© <CopyrightYear /> Builders</small>
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
