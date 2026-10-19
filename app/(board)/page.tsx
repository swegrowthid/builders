import type { Metadata } from "next";
import Link from "@/app/components/responsive-link";
import { shareCard } from "../content";
import { initials } from "../components/pieces";
import { Arrow, SiteFooter, SiteHeader } from "../components/shell";
import { ProjectLogo } from "../components/project-logo";
import { RepoCard } from "../components/open-source";
import { listPeopleAtWork, listProjects, type PersonAtWork, type ProjectSummary } from "../lib/data";
import { readPublicly } from "../lib/public-read";
import { projectBlurb } from "../lib/brief";
import { communityGroup } from "../lib/community";
import { listOpenSourceRepos } from "../lib/open-source-live";
import { primaryProfession } from "../lib/people";
import { roleLabel } from "../lib/roles";
import { stageLabel } from "../lib/stages";
import { currentLocale } from "../lib/locale-server";
import { tx, type Locale } from "../lib/locale";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await currentLocale();
  const title = tx(locale, "Builders — Mulai Kontribusi Open Source Pertamamu", "Builders — Start Your First Open Source Contribution");
  const description = tx(
    locale,
    "Repo open source milik kami dan yang kami rekomendasikan, komunitas calon kontributor, dan produk builders yang butuh bantuan.",
    "Open source repos we maintain and recommend, a community of would-be contributors, and builders' products that need a hand.",
  );
  return { title, description, alternates: { canonical: "/" }, openGraph: shareCard({ title, description, url: "/" }) };
}

/** The path from "I want to contribute" to a merged PR, in the order it happens. */
const FIRST_PR = [
  [
    "Pilih repo",
    "Pick a repo",
    "Mulai dari repo milik kami — reviewer-nya kenal kamu. Atau pilih rekomendasi yang alasannya cocok denganmu.",
    "Start with one of ours — the reviewer knows you. Or pick a recommendation whose reason fits you.",
  ],
  [
    "Baca CONTRIBUTING",
    "Read CONTRIBUTING",
    "Cara menjalankan proyek, gaya kode, dan aturan PR. Sepuluh menit di sini menghemat satu putaran review.",
    "How to run it, the code style, the PR rules. Ten minutes here saves a review round.",
  ],
  [
    "Ambil satu isu pemula",
    "Take one starter issue",
    "Komentari isunya dulu agar tidak dikerjakan dua orang. Kecil itu bagus: yang penting selesai.",
    "Comment on the issue first so two people don't do it. Small is good: what matters is finishing.",
  ],
  [
    "Kirim PR, tanggapi review",
    "Send the PR, answer review",
    "Review bukan penilaian. Tanyakan di komunitas kalau ada yang bikin bingung.",
    "Review is not a verdict. Ask the community when something is confusing.",
  ],
  [
    "Tautkan GitHub di profil",
    "Link GitHub on your profile",
    "Kamu masuk grup calon kontributor, dan founder bisa menemukanmu.",
    "You join the contributors group, and founders can find you.",
  ],
] as const;

export default async function Home() {
  const [reposResult, peopleResult, projectsResult, locale] = await Promise.all([
    readPublicly("open source repos on the home page", () => listOpenSourceRepos(), []),
    readPublicly("community on the home page", () => listPeopleAtWork(1000), []),
    readPublicly("products on the home page", () => listProjects({ lane: "active" }), []),
    currentLocale(),
  ]);
  const repos = reposResult.value;
  const internal = repos.filter((repo) => repo.list === "internal");
  const recommended = repos.filter((repo) => repo.list === "recommended");
  const contributors = communityGroup(peopleResult.value, "contributors");
  const founders = communityGroup(peopleResult.value, "founders");
  // Only products that ask for something — a pull request or a named role —
  // and those open to pull requests first: on an open source page, they are
  // the ones a visitor can help without asking anybody for a seat.
  const products = projectsResult.value
    .filter((project) => project.openForGitHubContributions || project.openSeatCount > 0)
    .sort((a, b) => Number(b.openForGitHubContributions) - Number(a.openForGitHubContributions))
    .slice(0, 3);
  const dataUnavailable = [reposResult, peopleResult, projectsResult].some((result) => result.unavailable);

  return (
    <>
      <SiteHeader returnTo="/" active="home" />

      <main id="main-content" className="landing-page oss-home">
        <section className="landing-hero oss-hero" aria-labelledby="landing-title">
          <div className="landing-hero-copy">
            <p className="home-eyebrow">{tx(locale, "Open source · dari Indonesia", "Open source · from Indonesia")}</p>
            <h1 id="landing-title">
              {tx(locale, "Kontribusi open source pertamamu", "Your first open source contribution")}{" "}
              <em>{tx(locale, "dimulai di sini.", "starts here.")}</em>
            </h1>
            <p className="landing-hero-lead">
              {tx(
                locale,
                "Kami kurasi repo milik kami dan repo yang kami rekomendasikan — lengkap dengan alasannya dan isu pemulanya — supaya software engineer bisa langsung kirim PR, bukan bingung mulai dari mana.",
                "We curate the repos we maintain and the ones we recommend — each with its reason and its starter issues — so software engineers can send a PR instead of wondering where to begin.",
              )}
            </p>

            <div className="home-hero-actions" aria-label={tx(locale, "Mulai berkontribusi", "Start contributing")}>
              <Link className="home-hero-primary" href="/open-source">
                {tx(locale, "Cari repo untuk dikontribusi", "Find a repo to contribute to")} <Arrow />
              </Link>
              <Link className="home-hero-secondary" href="/community">
                {tx(locale, "Gabung komunitas kontributor", "Join the contributor community")}
              </Link>
            </div>

            <div className="landing-counts oss-counts" aria-label={tx(locale, "Isi Builders saat ini", "What Builders holds today")}>
              <span className="landing-count">
                <strong>{internal.length}</strong>
                <span>{tx(locale, "repo kami", "our repos")}</span>
              </span>
              <span className="landing-count">
                <strong>{recommended.length}</strong>
                <span>{tx(locale, "rekomendasi", "recommended")}</span>
              </span>
              <span className="landing-count">
                <strong>{contributors.length}</strong>
                <span>{tx(locale, "kontributor", "contributors")}</span>
              </span>
              <span className="landing-count">
                <strong>{projectsResult.value.length}</strong>
                <span>{tx(locale, "produk", "products")}</span>
              </span>
            </div>
          </div>
        </section>

        {dataUnavailable ? (
          <p className="public-data-notice" role="status">
            {tx(locale, "Sebagian data terbaru tidak dapat dimuat.", "Some live data could not be loaded.")} <Link href="/">{tx(locale, "Muat ulang halaman ini", "Refresh this page")}</Link>.
          </p>
        ) : null}

        <section className="oss-section" aria-labelledby="internal-title">
          <div className="landing-project-feature-head">
            <div>
              <p className="home-eyebrow">01 · {tx(locale, "Open source kami", "Our open source")}</p>
              <h2 id="internal-title">{tx(locale, "PR pertama paling mudah: di repo yang kami review sendiri.", "The easiest first PR: on a repo we review ourselves.")}</h2>
            </div>
            <p>
              {tx(
                locale,
                "Repo milik internal kami. Kamu tidak mengirim PR ke orang asing — kamu bisa bertanya langsung di komunitas, dan review-nya datang dari orang yang mau kamu berhasil.",
                "Repos we maintain. You are not sending a PR to strangers — you can ask in the community, and review comes from people who want you to succeed.",
              )}
            </p>
          </div>
          <div className="oss-grid">
            {internal.map((repo) => <RepoCard key={`${repo.owner}/${repo.repo}`} repo={repo} locale={locale} />)}
          </div>
          <Link className="landing-inline-link" href="/open-source?list=internal">
            {tx(locale, "Semua repo milik kami", "All our repos")} <Arrow />
          </Link>
        </section>

        <section className="oss-section oss-section-tinted" aria-labelledby="recommended-title">
          <div className="landing-project-feature-head">
            <div>
              <p className="home-eyebrow">02 · {tx(locale, "Rekomendasi kami", "Recommended by us")}</p>
              <h2 id="recommended-title">{tx(locale, "Repo di luar sana yang kami jamin, dan alasannya.", "Repos out there we vouch for, and why.")}</h2>
            </div>
            <p>
              {tx(
                locale,
                "Karena kami pernah PR ke sana, karena maintainer-nya orang Indonesia, karena itu stack kami sendiri, atau karena memang ramah pemula. Setiap kartu menyebutkan alasannya.",
                "Because we have sent PRs there, because the maintainers are Indonesian, because it is our own stack, or because it is simply beginner friendly. Every card says which.",
              )}
            </p>
          </div>
          <div className="oss-grid">
            {recommended.slice(0, 6).map((repo) => <RepoCard key={`${repo.owner}/${repo.repo}`} repo={repo} locale={locale} />)}
          </div>
          <Link className="landing-inline-link" href="/open-source?list=recommended">
            {tx(locale, `Lihat semua ${recommended.length} rekomendasi`, `See all ${recommended.length} recommendations`)} <Arrow />
          </Link>
        </section>

        <section className="how-it-works" aria-labelledby="how-title">
          <div className="how-heading">
            <div>
              <p className="home-eyebrow">03 · {tx(locale, "Dari nol sampai merged", "From zero to merged")}</p>
              <h2 id="how-title">{tx(locale, "Lima langkah PR pertamamu.", "Five steps to your first PR.")}</h2>
            </div>
            <p>{tx(locale, "Tidak perlu jago dulu untuk mulai. Perbaikan typo di dokumentasi juga kontribusi.", "You don't need to be an expert to start. A typo fix in the docs is a contribution too.")}</p>
          </div>
          <ol className="how-steps how-steps-five">
            {FIRST_PR.map(([titleId, titleEn, bodyId, bodyEn], index) => (
              <li key={titleEn}>
                <span>{String(index + 1).padStart(2, "0")}</span>
                <div className="how-step-mark" aria-hidden="true">{index + 1}</div>
                <h3>{tx(locale, titleId, titleEn)}</h3>
                <p>{tx(locale, bodyId, bodyEn)}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className="oss-section oss-community" aria-labelledby="community-title">
          <div className="landing-project-feature-head">
            <div>
              <p className="home-eyebrow">04 · {tx(locale, "Komunitas", "Community")}</p>
              <h2 id="community-title">{tx(locale, "Calon kontributor dan founder, di satu tempat.", "Contributors and founders, in one place.")}</h2>
            </div>
            <p>
              {tx(
                locale,
                "Siapa pun yang mencantumkan GitHub di profilnya masuk grup calon kontributor. Founder adalah orang di balik produk yang terdaftar di sini.",
                "Anyone who puts their GitHub on their profile joins the contributors group. Founders are the people behind the products listed here.",
              )}
            </p>
          </div>

          <div className="oss-community-columns">
            <CommunityColumn
              title={tx(locale, "Calon kontributor", "Contributors")}
              count={contributors.length}
              members={contributors.slice(0, 4)}
              href="/community"
              empty={tx(locale, "Belum ada. Tautkan GitHub-mu dan jadi yang pertama.", "Nobody yet. Link your GitHub and be the first.")}
              locale={locale}
            />
            <CommunityColumn
              title={tx(locale, "Founder", "Founders")}
              count={founders.length}
              members={founders.slice(0, 4)}
              href="/community?group=founders"
              empty={tx(locale, "Belum ada founder dengan produk terdaftar.", "No founder has listed a product yet.")}
              locale={locale}
            />
          </div>

          <Link className="landing-inline-link" href="/account/profile">
            {tx(locale, "Tambahkan GitHub di profilmu", "Add GitHub to your profile")} <Arrow />
          </Link>
        </section>

        <section className="oss-section oss-products" aria-labelledby="products-title">
          <div className="landing-project-feature-head">
            <div>
              <p className="home-eyebrow">05 · {tx(locale, "Produk builders", "Builders' products")}</p>
              <h2 id="products-title">{tx(locale, "Produk dari komunitas yang butuh bantuan.", "Products from the community that need a hand.")}</h2>
            </div>
            <p>
              {tx(
                locale,
                "Setelah PR pertamamu, bantu produk sesama builder jadi lebih matang. Yang menerima pull request di GitHub tampil lebih dulu.",
                "After your first PR, help a fellow builder's product mature. Those that take pull requests on GitHub come first.",
              )}
            </p>
          </div>

          {products.length > 0 ? (
            <div className="landing-project-index">
              {products.map((project) => <ProductRow key={project.id} project={project} locale={locale} />)}
            </div>
          ) : (
            <p className="landing-data-empty">{tx(locale, "Belum ada produk yang meminta bantuan.", "No product is asking for help yet.")}</p>
          )}

          <div className="oss-products-links">
            <Link className="landing-inline-link" href="/explore">{tx(locale, "Semua produk builders", "All builders' products")} <Arrow /></Link>
            <Link className="landing-inline-link" href="/new">{tx(locale, "Daftarkan produkmu", "List your product")} <Arrow /></Link>
          </div>
        </section>

        <section className="landing-final-cta" aria-labelledby="final-cta-title">
          <p className="home-eyebrow">{tx(locale, "Mulai hari ini", "Start today")}</p>
          <h2 id="final-cta-title">{tx(locale, "Satu isu kecil hari ini lebih baik dari rencana besar bulan depan.", "One small issue today beats a big plan next month.")}</h2>
          <p>{tx(locale, "Pilih repo, ambil isu pemula, dan kirim PR. Komunitas ada untuk membantu kalau kamu tersangkut.", "Pick a repo, take a starter issue, send the PR. The community is here when you get stuck.")}</p>
          <div>
            <Link className="home-hero-primary" href="/open-source">{tx(locale, "Cari repo", "Find a repo")} <Arrow /></Link>
            <Link className="landing-final-secondary" href="/community">{tx(locale, "Kenalan dengan komunitas", "Meet the community")} <Arrow /></Link>
          </div>
          <small>{tx(locale, "Gratis untuk komunitas.", "Free for the community.")}</small>
        </section>
      </main>

      <SiteFooter />
    </>
  );
}

function CommunityColumn({
  title,
  count,
  members,
  href,
  empty,
  locale,
}: {
  title: string;
  count: number;
  members: PersonAtWork[];
  href: string;
  empty: string;
  locale: Locale;
}) {
  return (
    <div className="talent-preview oss-community-column">
      <div className="talent-preview-head">
        <span>{title} · {count}</span>
        <Link href={href}>{tx(locale, "Lihat semua", "View all")}</Link>
      </div>
      {members.length > 0 ? (
        <ul>
          {members.map(({ person, ...work }) => (
            <li key={person.id}>
              <Link href={`/u/${person.username}`}>
                <span className="talent-avatar" aria-hidden="true">{initials(person.name)}</span>
                <span className="talent-person-copy">
                  <strong>{person.name}</strong>
                  <small>{primaryProfession({ person, ...work }, locale) || `@${person.username}`}</small>
                </span>
                <span className="talent-skills">
                  {person.skills.slice(0, 2).map((skill) => <i key={skill}>{skill}</i>)}
                </span>
                <Arrow />
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <div className="talent-preview-empty"><p>{empty}</p></div>
      )}
    </div>
  );
}

function ProductRow({ project, locale }: { project: ProjectSummary; locale: Locale }) {
  const openRole = project.openRoles[0];
  return (
    <article className="landing-index-row">
      <ProjectLogo title={project.title} website={project.liveUrl} logoUrl={project.logoUrl} />
      <div className="landing-index-main">
        <p>
          <span>{stageLabel(project.stage, locale)}</span>
          {project.openForGitHubContributions ? ` · ${tx(locale, "Terbuka untuk PR", "Open to PRs")}` : ""}
          {project.tags[0] ? ` · ${project.tags[0]}` : ""}
        </p>
        <h3><Link className="card-cover-link" href={`/projects/${project.slug}`}>{project.title}</Link></h3>
        <p>{projectBlurb(project)}</p>
      </div>
      <div className="landing-index-role">
        <small>{openRole ? tx(locale, "Butuh bantuan", "Needs help with") : tx(locale, "Catatan pengembangan", "Build log")}</small>
        <strong>{openRole ? roleLabel(openRole, "", locale) : tx(locale, "Kontribusi via GitHub", "Contribute on GitHub")}</strong>
      </div>
      <Link className="landing-index-owner" href={`/u/${project.owner.username}`}>
        <span aria-hidden="true">{initials(project.owner.name)}</span>
        <small>{project.owner.name}</small>
      </Link>
    </article>
  );
}
