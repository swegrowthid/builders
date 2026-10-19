import type { MetadataRoute } from "next";
import { siteUrl } from "./content";
import { listPeople, listProjects } from "./lib/data";

/**
 * Every page worth finding from outside.
 *
 * Profiles are the point of this file as much as projects are: a portfolio
 * nobody can find is not doing any promoting. Pages behind a sign-in
 * (`/inbox`, `/new`, the edit form) are left out — they already say
 * `robots: noindex` for themselves.
 *
 * A database that is unreachable costs the listing, not the file: the static
 * routes still ship, so crawlers get something rather than a 500.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base: MetadataRoute.Sitemap = [
    { url: `${siteUrl}/`, changeFrequency: "daily", priority: 1 },
    { url: `${siteUrl}/explore`, changeFrequency: "daily", priority: 0.8 },
    { url: `${siteUrl}/people`, changeFrequency: "daily", priority: 0.6 },
    { url: `${siteUrl}/about`, changeFrequency: "monthly", priority: 0.6 },
    { url: `${siteUrl}/feedback`, changeFrequency: "monthly", priority: 0.4 },
  ];

  try {
    const [projects, people] = await Promise.all([listProjects(), listPeople()]);

    return [
      ...base,
      ...projects.map((project) => ({
        url: `${siteUrl}/projects/${project.slug}`,
        lastModified: new Date(project.createdAt),
        changeFrequency: "weekly" as const,
        priority: 0.8,
      })),
      ...people.map((person) => ({
        url: `${siteUrl}/u/${person.username}`,
        changeFrequency: "weekly" as const,
        priority: 0.7,
      })),
    ];
  } catch (error) {
    console.warn("[ahsan] Sitemap was published without project and people listings:", error);
    return base;
  }
}
