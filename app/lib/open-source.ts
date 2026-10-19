import type { Badge } from "./badges";
import { tx, type Locale } from "./locale";

/**
 * The open source repositories this site points people at.
 *
 * Curated by hand rather than collected from a form, and kept in the
 * repository on purpose: adding a repo is a pull request, which is exactly the
 * first contribution this list exists to encourage. Each entry says *why* it is
 * here — "it is popular" is not a reason anybody can act on, "the maintainers
 * are Indonesian and answer in Bahasa" is.
 *
 * Two lists:
 *
 *   - `internal` — repositories we maintain. Somebody opening a PR here gets a
 *     reviewer who knows them, which is the easiest first PR there is.
 *   - `recommended` — somebody else's repositories that we vouch for, each with
 *     the reasons that earned it the place.
 *
 * The directory on the home page (`app/lib/directory.ts`) lists these first,
 * ours before the recommendations. Live numbers (stars, language) come from GitHub through
 * `app/lib/open-source-live.ts`; everything here is what the page falls back
 * to when GitHub cannot be reached, so the listing never depends on it.
 */

export const REPO_LISTS = ["internal", "recommended"] as const;
export type RepoList = (typeof REPO_LISTS)[number];

/**
 * Why a repository earned its place. Deliberately a short closed set so the
 * listing can be filtered by it; the entry's `why` says the rest in words.
 */
export const REPO_REASONS = [
  "ours",
  "our-stack",
  "beginner-friendly",
  "local-impact",
] as const;
export type RepoReason = (typeof REPO_REASONS)[number];

export type LocalizedText = { id: string; en: string };

export type OpenSourceRepo = {
  owner: string;
  repo: string;
  list: RepoList;
  reasons: RepoReason[];
  /**
   * Trust signals about the people around it, set by hand — a friend has
   * contributed, a maintainer is in our group, the maintainers are
   * Indonesian. See `app/lib/badges.ts`.
   */
  badges: Badge[];
  /** What the project is, in one line. */
  summary: LocalizedText;
  /** Why it is on this list, in our own words. */
  why: LocalizedText;
  /** Main language, used until GitHub says otherwise. */
  language: string;
  topics: string[];
  /** The label its maintainers use for starter issues. */
  starterLabel: string;
};

const REASON_LABELS: Record<RepoReason, LocalizedText> = {
  ours: { id: "Milik kami", en: "Ours" },
  "our-stack": { id: "Stack yang kami pakai", en: "Part of our stack" },
  "beginner-friendly": { id: "Ramah pemula", en: "Beginner friendly" },
  "local-impact": { id: "Berdampak lokal", en: "Local impact" },
};

export const OPEN_SOURCE_REPOS: OpenSourceRepo[] = [
  {
    owner: "zikrulihsan",
    repo: "builders",
    list: "internal",
    reasons: ["ours", "beginner-friendly"],
    badges: [{ kind: "in-our-group", people: ["zikrulihsan"] }],
    summary: {
      id: "Situs yang sedang kamu buka: direktori project yang bisa dikontribusikan.",
      en: "The site you are looking at: a directory of projects you can contribute to.",
    },
    why: {
      id: "Kami yang me-review sendiri, jadi PR pertamamu dibaca orang yang kenal kamu. Next.js + Supabase, MIT.",
      en: "We review it ourselves, so your first PR is read by people who know you. Next.js + Supabase, MIT.",
    },
    language: "TypeScript",
    topics: ["nextjs", "supabase", "community"],
    starterLabel: "good first issue",
  },
  {
    owner: "firstcontributions",
    repo: "first-contributions",
    list: "recommended",
    reasons: ["beginner-friendly"],
    badges: [],
    summary: {
      id: "Latihan alur fork → branch → pull request dari nol, dengan panduan berbahasa Indonesia.",
      en: "Practise the fork → branch → pull request flow from zero, with a guide in Bahasa Indonesia.",
    },
    why: {
      id: "Belum pernah bikin PR sama sekali? Mulai di sini dulu — 15 menit, tanpa takut salah.",
      en: "Never opened a PR at all? Start here — fifteen minutes, nothing to break.",
    },
    language: "Markdown",
    topics: ["tutorial", "git", "first-pr"],
    starterLabel: "good first issue",
  },
  {
    owner: "vercel",
    repo: "next.js",
    list: "recommended",
    reasons: ["our-stack"],
    badges: [],
    summary: {
      id: "Framework React yang menjalankan situs ini.",
      en: "The React framework this site runs on.",
    },
    why: {
      id: "Kami memakainya tiap hari. Perbaikan dokumentasi dan contoh adalah pintu masuk yang realistis.",
      en: "We use it every day. Docs fixes and examples are a realistic way in.",
    },
    language: "JavaScript",
    topics: ["react", "framework", "web"],
    starterLabel: "good first issue",
  },
  {
    owner: "supabase",
    repo: "supabase",
    list: "recommended",
    reasons: ["our-stack"],
    badges: [],
    summary: {
      id: "Database Postgres, auth, dan storage yang dipakai Builders.",
      en: "The Postgres database, auth, and storage Builders runs on.",
    },
    why: {
      id: "Stack kami sendiri. Banyak isu dokumentasi dan UI dashboard yang cocok untuk kontributor baru.",
      en: "Our own stack. Plenty of docs and dashboard UI issues suit new contributors.",
    },
    language: "TypeScript",
    topics: ["postgres", "backend", "auth"],
    starterLabel: "good first issue",
  },
  {
    owner: "sastrawi",
    repo: "sastrawi",
    list: "recommended",
    reasons: ["local-impact"],
    badges: [{ kind: "indonesian" }],
    summary: {
      id: "Library PHP untuk stemming bahasa Indonesia.",
      en: "A PHP library for stemming Bahasa Indonesia.",
    },
    why: {
      id: "Dibuat developer Indonesia untuk bahasa kita sendiri — kontribusi yang manfaatnya terasa dekat.",
      en: "Built by Indonesian developers for our own language — a contribution whose use is close to home.",
    },
    language: "PHP",
    topics: ["nlp", "bahasa-indonesia", "stemmer"],
    starterLabel: "good first issue",
  },
  {
    owner: "IndoNLP",
    repo: "indonlu",
    list: "recommended",
    reasons: ["local-impact"],
    badges: [{ kind: "indonesian" }],
    summary: {
      id: "Benchmark dan model untuk pemahaman bahasa Indonesia.",
      en: "Benchmarks and models for understanding Bahasa Indonesia.",
    },
    why: {
      id: "Riset NLP dari peneliti Indonesia. Cocok kalau kamu di ML/data dan mau kontribusi di luar web.",
      en: "NLP research by Indonesian researchers. A fit if you work in ML or data and want something beyond the web.",
    },
    language: "Python",
    topics: ["nlp", "machine-learning", "bahasa-indonesia"],
    starterLabel: "good first issue",
  },
  {
    owner: "gojek",
    repo: "heimdall",
    list: "recommended",
    reasons: ["beginner-friendly"],
    badges: [{ kind: "indonesian" }],
    summary: {
      id: "HTTP client Go dengan retry dan circuit breaker, dari tim engineering Gojek.",
      en: "A Go HTTP client with retries and circuit breaking, from Gojek's engineering team.",
    },
    why: {
      id: "Open source dari perusahaan teknologi Indonesia. Codebase kecil, mudah dibaca dalam sehari.",
      en: "Open source from an Indonesian tech company. A small codebase you can read in a day.",
    },
    language: "Go",
    topics: ["go", "http", "resilience"],
    starterLabel: "good first issue",
  },
  {
    owner: "excalidraw",
    repo: "excalidraw",
    list: "recommended",
    reasons: ["beginner-friendly"],
    badges: [],
    summary: {
      id: "Papan gambar kolaboratif bergaya sketsa tangan.",
      en: "A collaborative whiteboard with a hand-drawn feel.",
    },
    why: {
      id: "Maintainer aktif me-review, isu dilabeli rapi, dan hasil kerjamu langsung terlihat di layar.",
      en: "Maintainers review actively, issues are well labelled, and your work shows up on screen right away.",
    },
    language: "TypeScript",
    topics: ["react", "canvas", "whiteboard"],
    starterLabel: "good first issue",
  },
];

export function repoSlug(repo: Pick<OpenSourceRepo, "owner" | "repo">): string {
  return `${repo.owner}/${repo.repo}`;
}

export function repoUrl(repo: Pick<OpenSourceRepo, "owner" | "repo">): string {
  return `https://github.com/${repo.owner}/${repo.repo}`;
}

/**
 * Where somebody starts: the open issues carrying the repo's starter label.
 * A repo without labelled issues still lands on its issue list, which is a
 * better first page than the README for somebody who came here to contribute.
 */
export function starterIssuesUrl(repo: Pick<OpenSourceRepo, "owner" | "repo" | "starterLabel">): string {
  const query = repo.starterLabel
    ? `is:issue is:open label:"${repo.starterLabel}"`
    : "is:issue is:open";
  return `${repoUrl(repo)}/issues?q=${encodeURIComponent(query)}`;
}

export function reasonLabel(reason: RepoReason, locale: Locale): string {
  const label = REASON_LABELS[reason];
  return tx(locale, label.id, label.en);
}

export function localized(text: LocalizedText, locale: Locale): string {
  return tx(locale, text.id, text.en);
}
