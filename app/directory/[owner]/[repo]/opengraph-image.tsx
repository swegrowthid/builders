import { ImageResponse } from "next/og";
import { OG, OG_SIZE, OgBrand, OgPill, ogAvatar } from "../../../components/og-parts";
import { prTierLabel, scopeLabel, scopeOf } from "../../../lib/directory";
import { findListedRepo } from "../../../lib/directory-read";
import { listGitHubActivity } from "../../../lib/data";
import { repoCommunity, type GitHubActivityEntry } from "../../../lib/github-activity";
import { readPublicly } from "../../../lib/public-read";
import { currentLocale } from "../../../lib/locale-server";
import { tx } from "../../../lib/locale";
import { isOss, site } from "../../../lib/site";

/**
 * The share card for a repo's page: its name and what it is, where it stands
 * on pull requests, and the faces of the members merged there — what makes a
 * link in the group read as "people like us got in here".
 */
export const size = OG_SIZE;
export const contentType = "image/png";
export const alt = site.name;

const FACES = 6;

export default async function Image({ params }: { params: Promise<{ owner: string; repo: string }> }) {
  const [{ owner, repo }, locale] = await Promise.all([params, currentLocale()]);
  const entry = isOss ? await findListedRepo(locale, owner, repo) : null;

  if (!entry?.repo) {
    return new ImageResponse(
      (
        <div style={{ alignItems: "center", background: OG.paper, display: "flex", height: "100%", justifyContent: "center", width: "100%" }}>
          <OgBrand />
        </div>
      ),
      size,
    );
  }

  const activity = await readPublicly<GitHubActivityEntry[]>("github activity for a repo card", listGitHubActivity, []);
  const { merged } = repoCommunity(activity.value, entry.repo);
  const name = entry.links.find((link) => link.kind === "github")?.label ?? `${entry.owner}/${entry.name}`;
  const [ownerName, repoName] = name.split("/");
  const description = entry.description.length > 140 ? `${entry.description.slice(0, 140)}…` : entry.description;
  const stars = entry.stars ? new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(entry.stars) : "";

  return new ImageResponse(
    (
      <div
        style={{
          background: `linear-gradient(135deg, ${OG.paper} 55%, #f0fdf4 100%)`,
          color: OG.ink,
          display: "flex",
          flexDirection: "column",
          height: "100%",
          justifyContent: "space-between",
          padding: "44px 64px",
          width: "100%",
        }}
      >
        <div style={{ alignItems: "center", display: "flex", justifyContent: "space-between" }}>
          <OgBrand />
          {entry.prTier ? <OgPill text={prTierLabel(entry.prTier, locale)} /> : null}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <div style={{ alignItems: "center", display: "flex", gap: 24 }}>
            <img src={ogAvatar(ownerName, 88)} width={88} height={88} style={{ border: `1px solid ${OG.line}`, borderRadius: 18 }} alt="" />
            <div style={{ display: "flex", flexDirection: "column" }}>
              <div style={{ color: OG.muted, display: "flex", fontSize: 30 }}>{`${ownerName}/`}</div>
              <div style={{ display: "flex", fontSize: repoName.length > 22 ? 52 : 64, fontWeight: 800, letterSpacing: "-2px", lineHeight: 1.05 }}>
                {repoName}
              </div>
            </div>
          </div>
          {description ? <div style={{ color: OG.muted, display: "flex", fontSize: 28, lineHeight: 1.35 }}>{description}</div> : null}
          <div style={{ alignItems: "center", color: OG.ink, display: "flex", fontSize: 24, fontWeight: 600, gap: 28 }}>
            {entry.language ? <div style={{ display: "flex" }}>{entry.language}</div> : null}
            {/* The card's font has no ★, so the star is drawn. */}
            {stars ? (
              <div style={{ alignItems: "center", display: "flex", gap: 8 }}>
                <svg width="24" height="24" viewBox="0 0 24 24">
                  <path d="m12 3.5 2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.3-4.1 5.9-.9L12 3.5Z" fill="#d4a72c" />
                </svg>
                {stars}
              </div>
            ) : null}
            <div style={{ display: "flex" }}>{scopeLabel(scopeOf(entry), locale)}</div>
          </div>
        </div>

        <div style={{ alignItems: "center", borderTop: `1px solid ${OG.line}`, display: "flex", gap: 18, paddingTop: 22 }}>
          {merged.length > 0 ? (
            <div style={{ display: "flex" }}>
              {merged.slice(0, FACES).map((person, index) => (
                <img
                  key={person.id}
                  src={ogAvatar(person.handle, 44)}
                  width={44}
                  height={44}
                  style={{ border: `3px solid ${OG.paper}`, borderRadius: 22, marginLeft: index === 0 ? 0 : -12 }}
                  alt=""
                />
              ))}
            </div>
          ) : null}
          <div style={{ color: OG.ink, display: "flex", flex: 1, fontSize: 22, fontWeight: 600 }}>
            {merged.length > 0
              ? tx(locale, `${merged.length} member komunitas sudah di-merge di sini`, `${merged.length} community ${merged.length === 1 ? "member" : "members"} merged here`)
              : tx(locale, "Belum ada member yang di-merge. Jadi yang pertama!", "No member merged here yet. Be the first!")}
          </div>
          <div style={{ color: OG.muted, display: "flex", fontSize: 20 }}>{site.url.replace(/^https?:\/\//, "")}</div>
        </div>
      </div>
    ),
    size,
  );
}
