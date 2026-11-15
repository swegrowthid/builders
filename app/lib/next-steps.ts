/**
 * What a person still has to do before this place works for them.
 *
 * The site is a directory of projects to contribute to, and what makes it
 * more than a list of links is knowing who among us has been where. So the
 * steps a new account owes are the ones that put them on that map:
 *
 *   1. link GitHub and show its activity — the account every contribution
 *      here is made with, the face on a directory badge, and the merged PRs
 *      on /activity that make the next person try;
 *   2. join the WA Community — where the talking happens: questions, reviews,
 *      merged PRs cheered. Nobody here can see who is in a WhatsApp group, so
 *      it counts as done once the button has been pressed;
 *   3. say who you are — profession, skills, a line about you — so somebody
 *      who sees your face on a badge knows who to ask.
 *
 * The repos somebody has contributed to are not a step: GitHub records them
 * once the activity is shown, and older ones can still be typed in on the
 * profile.
 *
 * Listing a product of your own is offered, never owed: most people here come
 * to contribute, not to found something. /get-started asks which of the two
 * somebody came for first, and shows that path's steps — see `stepsFor`.
 *
 * Deliberately a list of named things rather than a percentage. A profile is
 * not a form to fill to 100%.
 *
 * No Next.js or Supabase imports: the inputs are structural, so `Person` and
 * `ProjectSummary` from `data.ts` satisfy them as they are, and
 * `tests/next-steps.test.mjs` can call this with plain objects.
 */

import { githubHandle } from "./oss";
import { tx, type Locale } from "./locale";
import { isOss } from "./site";

/** Set when the WA Community button on /get-started is pressed; read back as that step's `done`. */
export const WA_JOINED_COOKIE = "builders_wa_joined";

export type NextStepId = "github" | "wa" | "talent" | "project" | "now" | "role";

export type NextStep = {
  id: NextStepId;
  title: string;
  blurb: string;
  href: string;
  cta: string;
  done: boolean;
  /** A step worth offering but never counted as owed. */
  optional?: boolean;
  /** `href` leaves this site. */
  external?: boolean;
};

/** The half of a profile these steps read. */
export type StepPerson = {
  profession: string;
  headline: string;
  bio: string;
  skills: string[];
  website: string;
  publicEmail: string;
  github: string;
  linkedin: string;
  x: string;
  resume: string;
  /** Agreed to their GitHub activity being shown on /activity. */
  githubActivityShown?: boolean;
};

/** The half of a project these steps read. */
export type StepProject = {
  slug: string;
  nowText: string;
  openSeatCount: number;
};

export function nextSteps({
  person,
  owned,
  waUrl = "",
  waJoined = false,
  locale = "en",
}: {
  person: StepPerson;
  owned: StepProject[];
  /** The WA Community's invite; no step without one. */
  waUrl?: string;
  /** They pressed the WA Community button, on this browser. */
  waJoined?: boolean;
  locale?: Locale;
}): NextStep[] {
  const steps: NextStep[] = [
    {
      id: "github",
      title: tx(locale, "Tautkan GitHub & tampilkan aktivitasmu", "Link GitHub and show your activity"),
      blurb: tx(
        locale,
        "Akun yang kamu pakai untuk mengirim PR. Fotonya muncul di badge direktori, dan PR-mu yang di-merge muncul di halaman Aktivitas—supaya teman lain ikut semangat.",
        "The account you send PRs with. Its picture shows on directory badges, and your merged PRs show on the Activity page—so friends get the itch too.",
      ),
      href: "/account/profile#github-account",
      cta: tx(locale, "Tambah GitHub", "Add GitHub"),
      done: githubHandle(person.github) !== "" && person.githubActivityShown === true,
      // GitHub is the open source site's; nothing on builders asks for it.
      optional: !isOss,
    },
    ...(waUrl
      ? [
          {
            id: "wa" as const,
            title: tx(locale, "Gabung WA Community", "Join the WA Community"),
            blurb: tx(
              locale,
              isOss
                ? "Interaksi paling aktif ada di sana: tanya kalau mentok, cari reviewer, dan rayain PR yang di-merge."
                : "Interaksi paling aktif ada di sana: kenalan sama pemilik produk, tanya soal perannya, dan cerita progresmu.",
              isOss
                ? "Where most of the talking happens: ask when you are stuck, find a reviewer, and cheer merged PRs."
                : "Where most of the talking happens: meet the people behind the products, ask about a role, and share how it is going.",
            ),
            href: waUrl,
            cta: tx(locale, "Gabung WA", "Join on WA"),
            done: waJoined,
            external: true,
          },
        ]
      : []),
    {
      id: "talent",
      title: tx(locale, "Ceritakan siapa kamu", "Say who you are"),
      blurb: tx(
        locale,
        "Profesi, keahlian, dan satu kalimat tentang dirimu — supaya orang yang melihat fotomu di badge tahu harus bertanya apa.",
        "Your profession, skills, and a line about you — so somebody who sees your face on a badge knows what to ask you.",
      ),
      href: "/account/profile",
      cta: tx(locale, "Lengkapi profil", "Complete profile"),
      done: profileReady(person),
    },
    {
      id: "project",
      title: tx(locale, "Punya proyek yang mencari kontributor?", "Have a project looking for contributors?"),
      blurb: tx(
        locale,
        "Daftarkan, sebutkan peran yang kamu cari atau buka untuk PR, dan proyekmu muncul di direktori.",
        "List it, name the roles you are looking for or open it to PRs, and it shows up in the directory.",
      ),
      href: "/new",
      cta: tx(locale, "Daftarkan proyek", "List a project"),
      done: owned.length > 0,
      optional: true,
    },
  ];

  // These only make sense once there is a product to say them about.
  if (owned.length > 0) {
    const quiet = owned.find((project) => !project.nowText) ?? owned[0];
    steps.push({
      id: "now",
      title: tx(locale, "Ceritakan apa yang sedang kamu kerjakan", "Describe what you are working on"),
      blurb: tx(
        locale,
        "Cukup satu kalimat. Inilah yang membedakan proyek aktif dari daftar ide yang terbengkalai.",
        "One sentence. This is what separates a living project from an abandoned idea list.",
      ),
      href: `/projects/${quiet.slug}`,
      cta: tx(locale, "Tulis kabar terbaru", "Write the update"),
      done: owned.some((project) => project.nowText !== ""),
      optional: true,
    });

    const seatless = owned.find((project) => project.openSeatCount === 0) ?? owned[0];
    steps.push({
      id: "role",
      title: tx(locale, "Buka peran yang kamu cari", "Open the roles you are looking for"),
      blurb: tx(
        locale,
        "Jelaskan pekerjaannya dan perkiraan waktunya — proyekmu lalu muncul di jalur \"Peran lain\" di direktori.",
        "Name the work and its estimated time — your project then shows up on the directory's \"Other roles\" path.",
      ),
      href: `/projects/${seatless.slug}?tab=collaboration`,
      cta: tx(locale, "Buka peran", "Open a role"),
      done: owned.some((project) => project.openSeatCount > 0),
      optional: true,
    });
  }

  return steps;
}

/** Why somebody is here, asked first on /get-started. */
export const ONBOARDING_PATHS = ["contribute", "founder"] as const;
export type OnboardingPath = (typeof ONBOARDING_PATHS)[number];

export function isOnboardingPath(value: string): value is OnboardingPath {
  return (ONBOARDING_PATHS as readonly string[]).includes(value);
}

const PATH_STEPS: Record<OnboardingPath, NextStepId[]> = {
  // In the order /how-it-works tells it: code on the open source site, a role
  // on a member's product on builders, where a profile is what an owner reads.
  contribute: isOss ? ["github", "wa", "talent"] : ["talent", "wa"],
  // A founder needs people to know who they are and where to find them
  // before the product, which is the point of being here.
  founder: ["talent", "wa", "project", "now", "role"],
};

/** One path's steps, in that path's order; the ones it does not need are left out. */
export function stepsFor(path: OnboardingPath, steps: NextStep[]): NextStep[] {
  return PATH_STEPS[path].flatMap((id) => steps.filter((step) => step.id === id));
}

/** The steps still owed. Optional ones never appear here. */
export function remainingSteps(steps: NextStep[]): NextStep[] {
  return steps.filter((step) => !step.done && !step.optional);
}

/** Enough on a profile for the people directory to have something to match. */
export function profileReady(person: StepPerson): boolean {
  return (
    person.profession.trim() !== "" &&
    person.skills.length > 0 &&
    (person.bio.trim() !== "" || person.headline.trim() !== "")
  );
}

/** Whether anybody reading the profile could reach its owner. */
export function hasContact(person: StepPerson): boolean {
  return [
    person.website,
    person.publicEmail,
    person.github,
    person.linkedin,
    person.x,
    person.resume,
  ].some((value) => value.trim() !== "");
}
