import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "@/app/components/responsive-link";
import { SiteFooter, SiteHeader } from "../components/shell";
import { MemberCard } from "../components/open-source";
import { Skeleton } from "../components/skeleton";
import { shareCard } from "../content";
import { listPeopleAtWork, type PersonAtWork } from "../lib/data";
import { readPublicly } from "../lib/public-read";
import { communityGroup, isCommunityGroup, type CommunityGroup } from "../lib/community";
import { currentLocale } from "../lib/locale-server";
import { tx, type Locale } from "../lib/locale";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await currentLocale();
  const title = tx(locale, "Komunitas — Builders", "Community — Builders");
  const description = tx(
    locale,
    "Calon kontributor open source dan founder produk di Builders — siapa mereka dan apa yang sedang mereka kerjakan.",
    "Would-be open source contributors and product founders on Builders — who they are and what they are working on.",
  );
  return { title, description, alternates: { canonical: "/community" }, openGraph: shareCard({ title, description, url: "/community" }) };
}

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const GROUP_COPY: Record<CommunityGroup, { titleId: string; titleEn: string; bodyId: string; bodyEn: string }> = {
  contributors: {
    titleId: "Calon kontributor",
    titleEn: "Contributors",
    bodyId: "Software engineer yang sudah mencantumkan akun GitHub di profilnya — siap diajak PR bareng.",
    bodyEn: "Software engineers who have put their GitHub account on their profile — ready to pair on a PR.",
  },
  founders: {
    titleId: "Founder",
    titleEn: "Founders",
    bodyId: "Orang di balik produk yang terdaftar di Builders, dan yang paling tahu bantuan apa yang dibutuhkan.",
    bodyEn: "The people behind the products listed on Builders, and who know best what help they need.",
  },
};

function readGroup(query: Record<string, string | string[] | undefined>): CommunityGroup {
  const value = one(query.group);
  return isCommunityGroup(value) ? value : "contributors";
}

function pathFor(group: CommunityGroup): string {
  return group === "contributors" ? "/community" : `/community?group=${group}`;
}

export default async function CommunityPage({ searchParams }: { searchParams?: SearchParams }) {
  const query = searchParams ?? Promise.resolve({});
  const locale = await currentLocale();

  return (
    <>
      <SiteHeader returnTo={query.then((value) => pathFor(readGroup(value)))} active="community" />

      <main id="main-content" className="oss-page community-page">
        <header className="oss-page-head">
          <p className="home-eyebrow">{tx(locale, "Komunitas", "Community")}</p>
          <h1>{tx(locale, "Kontribusi lebih mudah kalau tidak sendirian.", "Contributing is easier when you are not alone.")}</h1>
          <p>
            {tx(
              locale,
              "Temukan sesama calon kontributor untuk saling review, dan founder yang produknya bisa kamu bantu. Mau masuk daftar ini? Cantumkan akun GitHub di profilmu.",
              "Find fellow contributors to review each other's work, and founders whose products you can help. Want to be listed? Add your GitHub account to your profile.",
            )}
          </p>
          <div className="home-hero-actions">
            <Link className="home-hero-primary" href="/account/profile">
              {tx(locale, "Tambahkan GitHub di profil", "Add GitHub to your profile")}
            </Link>
            <Link className="home-hero-secondary" href="/people">
              {tx(locale, "Lihat talent pool lengkap", "See the full talent pool")}
            </Link>
          </div>
        </header>

        <Suspense fallback={<MembersSkeleton />}>
          <Members query={query} locale={locale} />
        </Suspense>
      </main>

      <SiteFooter />
    </>
  );
}

async function Members({ query, locale }: { query: SearchParams; locale: Locale }) {
  const group = readGroup(await query);
  const result = await readPublicly<PersonAtWork[]>("community page", () => listPeopleAtWork(1000), []);
  const contributors = communityGroup(result.value, "contributors");
  const founders = communityGroup(result.value, "founders");
  const members = group === "contributors" ? contributors : founders;
  const counts: Record<CommunityGroup, number> = { contributors: contributors.length, founders: founders.length };
  const copy = GROUP_COPY[group];

  return (
    <>
      {result.unavailable ? (
        <p className="public-data-notice" role="status">
          {tx(locale, "Daftar anggota tidak dapat dimuat saat ini.", "The member list could not be loaded right now.")}
        </p>
      ) : null}

      <nav className="oss-tabs" aria-label={tx(locale, "Grup komunitas", "Community groups")}>
        {(Object.keys(GROUP_COPY) as CommunityGroup[]).map((key) => (
          <Link
            key={key}
            className={group === key ? "is-active" : ""}
            aria-current={group === key ? "page" : undefined}
            href={pathFor(key)}
          >
            {tx(locale, GROUP_COPY[key].titleId, GROUP_COPY[key].titleEn)} <span>{counts[key]}</span>
          </Link>
        ))}
      </nav>

      <p className="oss-group-note">{tx(locale, copy.bodyId, copy.bodyEn)}</p>

      {members.length > 0 ? (
        <div className="member-grid">
          {members.map((entry) => <MemberCard key={entry.person.id} entry={entry} locale={locale} />)}
        </div>
      ) : (
        <div className="landing-data-empty">
          <p>
            {group === "contributors"
              ? tx(locale, "Belum ada yang mencantumkan GitHub. Jadilah yang pertama.", "Nobody has added their GitHub yet. Be the first.")
              : tx(locale, "Belum ada founder dengan produk terdaftar.", "No founder has listed a product yet.")}
          </p>
          <Link href={group === "contributors" ? "/account/profile" : "/new"}>
            {group === "contributors" ? tx(locale, "Lengkapi profil", "Complete your profile") : tx(locale, "Daftarkan produk", "List a product")}
          </Link>
        </div>
      )}
    </>
  );
}

function MembersSkeleton() {
  return (
    <div className="member-grid" aria-busy="true">
      {[0, 1, 2, 3, 4, 5].map((slot) => <Skeleton key={slot} height={170} style={{ borderRadius: 18 }} />)}
    </div>
  );
}

function one(value: string | string[] | undefined): string {
  return (Array.isArray(value) ? value[0] : value) ?? "";
}
