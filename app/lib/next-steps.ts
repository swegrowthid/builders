/**
 * What a person still has to do before this place works for them.
 *
 * The site is a directory of projects to contribute to, and what makes it
 * more than a list of links is knowing who among us has been where. So the
 * steps a new account owes are the ones that put them on that map:
 *
 *   1. link GitHub — the account every contribution here is made with, and
 *      the face on a directory badge;
 *   2. list the repos you have contributed to or maintain — those become the
 *      "a friend has contributed" and "maintainer in our group" badges;
 *   3. say who you are — profession, skills, a line about you — so somebody
 *      who sees your face on a badge knows who to ask.
 *
 * Listing a product of your own is offered, never owed: most people here come
 * to contribute, not to found something.
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

export type NextStepId = "github" | "oss" | "talent" | "project" | "now" | "role";

export type NextStep = {
  id: NextStepId;
  title: string;
  blurb: string;
  href: string;
  cta: string;
  done: boolean;
  /** A step worth offering but never counted as owed. */
  optional?: boolean;
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
  ossCount = 0,
  locale = "en",
}: {
  person: StepPerson;
  owned: StepProject[];
  /** Rows in the person's open source record. */
  ossCount?: number;
  locale?: Locale;
}): NextStep[] {
  const steps: NextStep[] = [
    {
      id: "github",
      title: tx(locale, "Tautkan akun GitHub-mu", "Link your GitHub account"),
      blurb: tx(
        locale,
        "Akun yang kamu pakai untuk kirim PR. Fotonya muncul di badge direktori, jadi orang tahu ada teman yang bisa ditanya.",
        "The account you send PRs with. Its picture shows on directory badges, so people know there is a friend to ask.",
      ),
      href: "/account/profile#contact",
      cta: tx(locale, "Tambah GitHub", "Add GitHub"),
      done: githubHandle(person.github) !== "",
    },
    {
      id: "oss",
      title: tx(locale, "Catat repo yang pernah kamu kontribusi", "List the repos you have contributed to"),
      blurb: tx(
        locale,
        "Atau yang kamu maintain. Setiap repo yang kamu catat memberi badge di direktori — tanda bagi pemula bahwa ada teman yang sudah lewat jalan itu.",
        "Or the ones you maintain. Every repo you list puts a badge on the directory — a sign to newcomers that a friend has been there.",
      ),
      href: "/account/profile#open-source",
      cta: tx(locale, "Catat repo", "List a repo"),
      done: ossCount > 0,
    },
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
      title: tx(locale, "Punya produk yang butuh kontributor?", "Have a product that needs contributors?"),
      blurb: tx(
        locale,
        "Daftarkan, sebutkan peran yang kamu cari atau buka untuk PR, dan produkmu muncul di direktori.",
        "List it, name the roles you need or open it to PRs, and it shows up in the directory.",
      ),
      href: "/new",
      cta: tx(locale, "Daftarkan produk", "List a product"),
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
        "Cukup satu kalimat. Inilah yang membedakan produk aktif dari daftar ide yang terbengkalai.",
        "One sentence. This is what separates a living product from an abandoned idea list.",
      ),
      href: `/projects/${quiet.slug}`,
      cta: tx(locale, "Tulis kabar terbaru", "Write the update"),
      done: owned.some((project) => project.nowText !== ""),
      optional: true,
    });

    const seatless = owned.find((project) => project.openSeatCount === 0) ?? owned[0];
    steps.push({
      id: "role",
      title: tx(locale, "Buka peran saat kamu membutuhkan bantuan", "Open a role when you need help"),
      blurb: tx(
        locale,
        "Jelaskan pekerjaannya dan perkiraan waktunya — produkmu lalu muncul di jalur \"Peran lain\" di direktori.",
        "Name the work and its estimated time — your product then shows up on the directory's \"Other roles\" path.",
      ),
      href: `/projects/${seatless.slug}?tab=collaboration`,
      cta: tx(locale, "Buka peran", "Open a role"),
      done: owned.some((project) => project.openSeatCount > 0),
      optional: true,
    });
  }

  return steps;
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
