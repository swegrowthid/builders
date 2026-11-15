import type { Metadata } from "next";
import Link from "@/app/components/responsive-link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SiteFooter, SiteHeader } from "../../components/shell";
import { WaJoinLink } from "../../components/wa-join-link";
import { waCommunityUrl } from "../../content";
import { getPortfolio } from "../../lib/data";
import {
  WA_JOINED_COOKIE,
  isOnboardingPath,
  nextSteps,
  remainingSteps,
  stepsFor,
  type NextStep,
  type OnboardingPath,
} from "../../lib/next-steps";
import { currentViewer } from "../../lib/session";
import { signInPath } from "../../lib/urls";
import { currentLocale } from "../../lib/locale-server";
import { tx, type Locale } from "../../lib/locale";
import { isOss, site } from "../../lib/site";

/*
 * Allowed to block — same reason as /inbox. The whole page is one person's
 * own state, there is nothing cacheable to paint before knowing who is asking,
 * and a visitor about to be redirected should not watch it render first.
 */
export const instant = false;

export async function generateMetadata(): Promise<Metadata> {
  const locale = await currentLocale();
  return {
    title: tx(locale, `Langkah berikutnya — ${site.name}`, `Next steps — ${site.name}`),
    description: tx(locale, "Mau kontribusi atau cari kontributor? Pilih, lalu ikuti beberapa langkah singkat.", "Here to contribute, or to find contributors? Pick one, then follow a few short steps."),
    robots: { index: false },
  };
}

/**
 * Where signing in lands, until there is nothing left to do here.
 *
 * It asks first what somebody came for — to contribute, or to find
 * contributors for a product — and then shows only that path's steps, so a
 * contributor never wades through a founder's checklist. The choice lives in
 * the address (`?path=`), so there is nothing to store.
 *
 * Nothing here blocks anybody. Every step can be skipped, and once none are
 * owed the page forwards to the directory instead of standing in the way of
 * every future sign-in — `?all=1` keeps it reachable on purpose from the menu.
 */
export default async function StartPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [viewer, locale] = await Promise.all([currentViewer(), currentLocale()]);
  if (!viewer) redirect(signInPath("/get-started"));

  const query = (await searchParams) ?? {};
  const keepOpen = query.all === "1";
  // The open source site has no products to list, so there is nothing to choose.
  const path: OnboardingPath | null = isOss
    ? "contribute"
    : typeof query.path === "string" && isOnboardingPath(query.path)
      ? query.path
      : null;

  const [{ owned }, cookieStore] = await Promise.all([getPortfolio(viewer), cookies()]);
  const steps = nextSteps({
    person: viewer,
    owned,
    waUrl: waCommunityUrl,
    waJoined: cookieStore.get(WA_JOINED_COOKIE)?.value === "1",
    locale,
  });
  if (remainingSteps(steps).length === 0 && !keepOpen) redirect("/");

  const firstName = viewer.name.split(" ")[0];
  const pathHref = (to: OnboardingPath | null) => {
    const params = new URLSearchParams();
    if (to) params.set("path", to);
    if (keepOpen) params.set("all", "1");
    const search = params.toString();
    return `/get-started${search ? `?${search}` : ""}`;
  };

  return (
    <>
      <SiteHeader returnTo={pathHref(path)} />

      <main id="main-content" className="dx-page ob-page">
        <header className="ob-head">
          <p className="ob-kicker">{tx(locale, `Mulai di ${site.name}`, "Getting started")}</p>
          <h1>{tx(locale, `Halo, ${firstName}.`, `Hello, ${firstName}.`)}</h1>
          <p>
            {path === null
              ? tx(locale, "Apa yang ingin kamu lakukan di sini?", "What brings you here?")
              : path === "contribute"
                ? isOss
                  ? tx(locale, "Tiga langkah, lalu pilih proyek pertamamu.", "Three steps, then pick your first project.")
                  : tx(locale, "Dua langkah, lalu pilih proyek pertamamu.", "Two steps, then pick your first project.")
                : tx(locale, "Perkenalkan dirimu, lalu daftarkan proyekmu supaya kontributor bisa menemukannya.", "Introduce yourself, then list your project so contributors can find it.")}
          </p>
        </header>

        {path === null ? (
          <ul className="submit-choices">
            <li className="tone-account">
              <Link href={pathHref("contribute")}>
                <span className="submit-choice-icon" aria-hidden="true">
                  <svg viewBox="0 0 24 24">
                    <circle cx="6" cy="6" r="2.5" /><circle cx="6" cy="18" r="2.5" /><circle cx="18" cy="18" r="2.5" />
                    <path d="M6 8.5v7M18 15.5V9a3 3 0 0 0-3-3h-4m2-2.5L10.5 6 13 8.5" />
                  </svg>
                </span>
                <span className="submit-choice-copy">
                  <strong>{tx(locale, "Kontribusi ke proyek member", "Contribute to a member's project")}</strong>
                  <small>{tx(locale, "Gabung ke tim proyek lewat peranmu: kode, desain, product, riset, konten, atau QA.", "Join a project's team in your role: code, design, product, research, content or QA.")}</small>
                </span>
                <span className="submit-choice-arrow" aria-hidden="true">→</span>
              </Link>
            </li>
            <li className="tone-pick">
              <Link href={pathHref("founder")}>
                <span className="submit-choice-icon" aria-hidden="true">
                  <svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="3.5" /><path d="M5 20a7 7 0 0 1 14 0" /></svg>
                </span>
                <span className="submit-choice-copy">
                  <strong>{tx(locale, "Cari kontributor untuk proyekku", "Find contributors for my project")}</strong>
                  <small>{tx(locale, "Daftarkan proyekmu dan buka peran yang kamu butuhkan.", "List your project and open the roles you need.")}</small>
                </span>
                <span className="submit-choice-arrow" aria-hidden="true">→</span>
              </Link>
            </li>
          </ul>
        ) : (
          <PathSteps path={path} steps={stepsFor(path, steps)} locale={locale} />
        )}

        <p className="ob-skip">
          {path !== null && !isOss ? (
            <>
              <Link href={pathHref(null)}>{tx(locale, "Ganti tujuan", "Change what you came for")}</Link>
              {" · "}
            </>
          ) : null}
          <Link href="/directory">{tx(locale, "Lewati dulu, langsung ke direktori", "Skip for now and go to the directory")}</Link>
        </p>
      </main>

      <SiteFooter />
    </>
  );
}

function PathSteps({ path, steps, locale }: { path: OnboardingPath; steps: NextStep[]; locale: Locale }) {
  return (
    <>
      <ol className="ob-steps">
        {steps.map((step, index) => (
          <StepRow key={step.id} step={step} index={index + 1} locale={locale} />
        ))}
      </ol>
      {/* The point of the contributor path; a founder's last step is their product. */}
      {path === "contribute" ? (
        <div className="ob-next tone-done">
          <div>
            <strong>{isOss ? tx(locale, "Lalu: pilih proyek pertamamu", "Then: pick your first project") : tx(locale, "Lalu: pilih proyek pertamamu", "Then: pick your first project")}</strong>
            <span>
              {isOss
                ? tx(locale, "Repo yang sedang menerima PR, semuanya ada di direktori.", "Repos taking PRs right now, all in the directory.")
                : tx(locale, "Proyek yang sedang membuka peran, semuanya ada di direktori.", "Projects with open roles, all in the directory.")}
            </span>
          </div>
          <Link className="dx-action" href={isOss ? "/directory" : "/directory?open=roles"}>{tx(locale, "Buka direktori", "Open the directory")} <span aria-hidden="true">→</span></Link>
        </div>
      ) : null}
    </>
  );
}

/** Each step's colour, as on /how-it-works: account blue, WA green, a product amber, its updates plain, a filled role purple. */
const STEP_TONES: Record<NextStep["id"], string> = {
  github: "account",
  wa: "wa",
  talent: "account",
  project: "pick",
  now: "work",
  role: "done",
};

function StepRow({
  step,
  index,
  locale,
}: {
  step: NextStep;
  index?: number;
  locale: Locale;
}) {
  return (
    <li id={`step-${step.id}`} className={`ob-step tone-${STEP_TONES[step.id]} ${step.done ? "is-done" : ""}`}>
      <span className="ob-step-mark" aria-hidden="true">{step.done ? "✓" : index ?? "·"}</span>
      <div className="ob-step-copy">
        <h3>
          {step.title}
          {step.done ? <span className="ob-step-state">{tx(locale, "selesai", "done")}</span> : null}
        </h3>
        <p>{step.blurb}</p>
      </div>
      {step.external ? (
        <WaJoinLink className={step.done ? "ob-step-edit" : "dx-action"} href={step.href}>
          {step.done ? tx(locale, "Buka WA", "Open WA") : step.cta}
        </WaJoinLink>
      ) : (
        <Link className={step.done ? "ob-step-edit" : "dx-action"} href={step.href}>
          {step.done ? tx(locale, "Ubah", "Edit") : step.cta}
        </Link>
      )}
    </li>
  );
}
