import type { PersonAtWork } from "./data";
import { profileReady } from "./next-steps";

/**
 * A public profile only joins the talent pool once it contains the details the
 * directory can actually match: a profession, at least one skill, and a short
 * introduction. The same rule drives the onboarding step, so the promise made
 * there and the people shown here cannot drift apart.
 */
export function isTalentPoolMember(entry: PersonAtWork): boolean {
  return profileReady(entry.person);
}

/**
 * The terms other people already use, most common first.
 *
 * Offered in the profile editor under the skills field. Suggesting rather than
 * constraining: somebody typing "Riset Pengguna" when the rest of the site
 * writes "User Research" is two entries in the talent pool that should have
 * been one, and nobody can see that from inside their own form.
 */
export function termSuggestions(
  people: { skills: string[]; fields: string[] }[],
  key: "skills" | "fields",
  limit = 40,
): string[] {
  return countValues(people.flatMap((person) => person[key]))
    .slice(0, limit)
    .map((entry) => entry.value);
}

/** Comma/newline input as clean, display-ready, case-insensitively unique terms. */
export function normalisePeopleTerms(value: string, limit: number): string[] {
  const seen = new Set<string>();
  const terms: string[] = [];

  for (const raw of value.split(/[,\n]/)) {
    const term = raw.trim().replace(/\s+/g, " ").slice(0, 50);
    const key = searchable(term);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    terms.push(term);
    if (terms.length === limit) break;
  }

  return terms;
}

function countValues(values: string[]): { value: string; count: number }[] {
  const labels = new Map<string, { value: string; count: number }>();

  for (const raw of values) {
    const value = raw.trim();
    const key = searchable(value);
    if (!key) continue;
    const current = labels.get(key);
    labels.set(key, { value: current?.value ?? value, count: (current?.count ?? 0) + 1 });
  }

  return [...labels.values()].sort(
    (a, b) => b.count - a.count || a.value.localeCompare(b.value, "id"),
  );
}

function searchable(value: string): string {
  return value
    .toLocaleLowerCase("id")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}
