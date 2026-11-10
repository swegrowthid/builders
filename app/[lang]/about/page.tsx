import type { Metadata } from "next";
import Link from "@/app/components/responsive-link";
import { Arrow, SiteFooter, SiteHeader } from "../../components/shell";
import { shareCard } from "../../content";
import { currentLocale } from "../../lib/locale-server";
import { tx } from "../../lib/locale";
import { isOss, site } from "../../lib/site";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await currentLocale();
  const title = tx(locale, `Tentang — ${site.name}`, `About — ${site.name}`);
  const description = tx(
    locale,
    isOss
      ? "Kontribusi ke open source, bareng-bareng. Temukan repo open source, lokal maupun global, yang siap menerima kontribusimu."
      : "Bangun produk, bareng-bareng. Temukan produk buatan member komunitas swegrowth, ikuti progresnya, dan bantu lewat peranmu.",
    isOss
      ? "Contributing to open source, together. Find open source repos, local and global, that are ready for your contribution."
      : "Building products, together. Find products by swegrowth community members, follow their progress, and help in your role.",
  );
  return {
    title,
    description,
    alternates: { canonical: "/about" },
    openGraph: shareCard({ title, description, url: "/about" }),
  };
}

/**
 * Who contributes what.
 *
 * Deliberately opened by a programmer-to-programmer example rather than the
 * usual "developers plus everyone else": the point of the page is that the
 * critique already being made in a group chat is the contribution, whoever is
 * making it. The last entry is left open on purpose — a fixed list of roles
 * would say the opposite of what the section is for.
 */
const ROLES: readonly (readonly [string, string, string, string])[] = [
  [
    "Programmer ke programmer",
    "Programmer to programmer",
    "Lihat performa web temennya kureng, nemu bug atau celah security-nya. Daripada jadi bahan ghibah di grup, mending gas contribute ke projectnya.",
    "You notice a friend's site is sluggish, or you spot a bug or a security hole. Instead of turning it into group-chat gossip, go contribute to the project.",
  ],
  [
    "Product manager",
    "Product manager",
    "Value proposition-nya masih ngambang? Bantu tulis ulang: ini masalah siapa, dan kenapa mereka mau pakai produknya.",
    "Value proposition still vague? Help rewrite it: whose problem this is, and why they would want to use the product.",
  ],
  [
    "Designer",
    "Designer",
    "Alur daftarnya kepanjangan? Kasih satu flow yang lebih pendek.",
    "Sign-up flow running long? Hand over a shorter one.",
  ],
  [
    "Marketing",
    "Marketing",
    "Produknya bagus tapi nggak ada yang tahu. Bantu rapiin distribusinya.",
    "The product is good but nobody knows it exists. Help tidy up its distribution.",
  ],
  [
    "Tim data",
    "Data team",
    "Bantu bikin pipeline datanya, lalu propose analisa yang bikin keputusan berikutnya lebih jelas.",
    "Build the data pipeline, then propose the analysis that makes the next decision obvious.",
  ],
  [
    "Peran kamu",
    "Your role",
    "Apalagi? Masih banyak. Kalau peranmu belum ada di daftar ini, besar kemungkinan ada project di sini yang lagi butuh.",
    "What else? Plenty. If your role is not on this list, chances are a project here still needs it.",
  ],
];

/**
 * Why the circle helps, not only the list: what being among people doing the
 * same thing gives you that a directory alone does not. Each point is
 * something the site already does — the friend badge, maintainers in the
 * group, the Activity feed — said as what it means for you. The builders site
 * says the same of building a product.
 */
const OSS_TOGETHER: readonly (readonly [string, string, string, string])[] = [
  [
    "Ada yang udah duluan",
    "Someone has been there",
    "Kalau ada teman yang pernah kontribusi ke repo itu, kamu bisa tanya langsung: setup-nya gimana, maintainer-nya suka PR yang kayak apa.",
    "When a friend has contributed to that repo, you can just ask them: how the setup goes, what kind of PR its maintainers like.",
  ],
  [
    "PR-mu dibaca orang yang kenal kamu",
    "Your PR is read by someone who knows you",
    "Banyak maintainer-nya ada di komunitas ini, jadi PR pertamamu nggak tenggelam di antrean orang asing.",
    "Many of the maintainers are in this community, so your first PR does not sink in a queue of strangers.",
  ],
  [
    "Kelihatan, lalu nular",
    "Seen, then catching",
    "Tiap PR yang di-merge muncul di halaman Aktivitas. Lihat teman ngirim PR minggu ini bikin kamu pengin nyoba juga.",
    "Every merged PR shows on the Activity page. Seeing a friend send a PR this week makes you want to try too.",
  ],
  [
    "Dua arah",
    "Both ways",
    "Kontributor dapat pengalaman dan rekam jejak yang nyata. Maintainer dan builder dapat bantuan yang selama ini nggak kunjung datang.",
    "Contributors get real experience and a real track record. Maintainers and builders get the help that never used to come.",
  ],
];

const BUILDERS_TOGETHER: readonly (readonly [string, string, string, string])[] = [
  [
    "Teman satu tim",
    "Teammates, not strangers",
    "Peran yang kamu buka dibaca orang satu komunitas. Yang ngajuin diri bukan orang asing, dan kamu bisa cek profil serta karyanya dulu.",
    "The roles you open are read by people from the same community. Whoever offers is no stranger, and you can look at their profile and work first.",
  ],
  [
    "Masukan lebih awal",
    "Feedback early",
    "Member lain nyobain produkmu dari tahap ide, jadi masukan datang sebelum kamu terlanjur jauh.",
    "Other members try your product from the idea stage, so feedback comes before you have gone too far.",
  ],
  [
    "Progres yang kelihatan",
    "Progress you can see",
    "Tiap kabar terbaru dan tahap baru tercatat di produk dan profilmu. Lihat produk teman bergerak bikin kamu ikut ngegas.",
    "Every update and every new stage is recorded on your product and profile. Seeing a friend's product move makes you push yours too.",
  ],
  [
    "Dua arah",
    "Both ways",
    "Yang membantu dapat pengalaman dan portofolio nyata. Builder dapat bantuan yang selama ini nggak kunjung datang.",
    "Those who help get real experience and a real portfolio. Builders get the help that never used to come.",
  ],
];

const TOGETHER = isOss ? OSS_TOGETHER : BUILDERS_TOGETHER;

/** Each point's colour, in TOGETHER's order: a friend's badge, a known reviewer, the Activity feed, both sides helped. */
const TOGETHER_TONES = ["tone-pick", "tone-account", "tone-done", "tone-wa"];

/**
 * Who the place is for: contributors first — engineers, then every other role
 * — and builders listing a project. The open source site has no products or
 * roles, so it speaks to engineers and to maintainers with a repo to share.
 */
const ALL_AUDIENCES: readonly (readonly [string, string, string, string, string])[] = [
  [
    "tone-account",
    "Engineer",
    "Engineers",
    isOss
      ? "Cari repo yang beneran nerima PR, lokal maupun global, lengkap dengan bahasa, isu pemula, dan status PR-nya."
      : "Gabung ke tim produk member sebagai engineer, atau bangun produkmu sendiri dan cari teman tim di sini.",
    isOss
      ? "Find repos that genuinely take PRs, local or global, with their language, starter issues and PR status."
      : "Join a member's product team as an engineer, or build your own and find teammates here.",
  ],
  [
    "tone-pick",
    "Peran lain",
    "Every other role",
    "Desain, produk, riset, penulisan, marketing, QA—project dari builder Indonesia juga nyari semua itu. Lihat mana yang lagi buka peranmu.",
    "Design, product, research, writing, marketing, QA—projects from Indonesian builders look for all of it. See which are opening your role.",
  ],
  [
    "tone-done",
    "Builder",
    "Builders",
    "Punya produk? Daftarin di sini, tulis progresnya, dan buka peran yang kamu cari.",
    "Building a product? List it here, write how it is going, and open the roles you are looking for.",
  ],
  [
    "tone-done",
    "Maintainer",
    "Maintainers",
    "Punya repo open source yang nerima PR? Usulkan di sini, biar kontributor dari komunitas bisa nemu.",
    "Maintain an open source repo that takes PRs? Suggest it here, so contributors from the community find it.",
  ],
];

const AUDIENCES = ALL_AUDIENCES.filter(([, titleId]) => (isOss ? titleId === "Engineer" || titleId === "Maintainer" : titleId !== "Maintainer"));

/** Questions about products and their roles, which only the builders site has. */
const BUILDERS_ONLY_FAQ = new Set([
  "I am not a programmer. Can I still contribute?",
  "My project is still a messy idea. Can I post it?",
  "Do I have to open a role?",
]);

/** Questions about open source repos and GitHub, which only the open source site has. */
const OSS_ONLY_FAQ = new Set(["A repo I know is missing. Can I suggest it?", "Why sign in with GitHub?"]);

const ALL_FAQ: readonly (readonly [string, string, string, string])[] = [
  [
    `${site.name} itu apa?`,
    `What is ${site.name}?`,
    isOss
      ? "Platform komunitas swegrowth buat nemuin repo open source yang terbuka buat kontributor, berkontribusi, dan bikin kontribusinya kelihatan."
      : "Platform komunitas swegrowth buat member yang lagi bangun produk: tunjukin progresnya, buka peran, dan temuin teman tim—dari ide sampai rilis.",
    isOss
      ? "The swegrowth community's platform for finding open source repos open to contributors, contributing, and making that contribution visible."
      : "The swegrowth community's platform for members building products: show the progress, open roles, and find teammates—from idea to launch.",
  ],
  [
    `Bedanya ${site.name} sama WA Community?`,
    `How is ${site.name} different from the WA Community?`,
    `WA Community itu tempat ngobrol: tanya soal issue, cari reviewer, kabar terbaru. ${site.name} itu platformnya: daftar ${isOss ? "repo" : "project"}, profilmu, dan kontribusimu yang tercatat. Keduanya saling melengkapi.`,
    `The WA Community is where we talk: questions about an issue, finding a reviewer, news. ${site.name} is the platform: the ${isOss ? "repo" : "project"} list, your profile, and your contributions on record. Each needs the other.`,
  ],
  [
    "Siapa yang ngelola?",
    "Who runs it?",
    "Komunitas Software Engineer Growth (swegrowth). Kodenya juga open source—kalau nemu yang kurang, kamu bisa langsung kontribusi ke situs ini.",
    "The Software Engineer Growth (swegrowth) community. The code is open source too—if something is missing, you can contribute to this site directly.",
  ],
  [
    "Saya bukan programmer. Masih bisa kontribusi?",
    "I am not a programmer. Can I still contribute?",
    "Bisa. Produk member sering nyari desainer, PM, peneliti, penulis, atau marketing—pilih “Lagi cari bantuan” di direktori.",
    "Yes. Members' products often look for designers, PMs, researchers, writers or marketers—pick “Looking for help” in the directory.",
  ],
  [
    "Project saya masih ide dan berantakan. Boleh ditaruh?",
    "My project is still a messy idea. Can I post it?",
    "Boleh. Tulis aja masalahnya, buat siapa, dan sekarang sudah sampai mana. Perbarui seiring jalan—jejaknya justru jadi bukti kerjamu.",
    "Yes. Just write down the problem, who it is for, and where it stands today. Update it as it moves—that trail becomes the proof of your work.",
  ],
  [
    "Wajib buka peran, nggak?",
    "Do I have to open a role?",
    "Nggak. Project boleh dibiarin jadi catatan pengembangan publik dulu, dan peran dibuka kapan pun kamu siap nerima bantuan.",
    "No. A project can stay a public build log for as long as you like, and you can open a role whenever you are ready for help.",
  ],
  [
    "Komunitas saya mau ikut. Gimana caranya?",
    "My community wants to join in. How?",
    "Gabung ke WA Community lewat tombol di bawah, lalu kabarin admin. Ceritain komunitasmu, nanti kita obrolin bareng.",
    "Join the WA Community with the button below, then let the admin know. Tell us about your community, and we will work it out together.",
  ],
  [
    "Repo yang saya tahu belum ada. Bisa diusulin?",
    "A repo I know is missing. Can I suggest it?",
    isOss
      ? "Bisa. Klik “Usulkan repo”, lalu pilih alasan kenapa repo itu layak. Setelah dicek admin, repo-nya masuk direktori."
      : "Bisa. Klik “Tambah project”, pilih “Repo open source”, lalu pilih alasan kenapa repo itu layak. Setelah dicek admin, repo-nya masuk direktori.",
    isOss
      ? "Yes. Press “Suggest a repo” and pick why it belongs. Once an admin has checked it, the repo joins the directory."
      : "Yes. Press “Add a project”, choose “An open source repo”, and pick why it belongs. Once an admin has checked it, the repo joins the directory.",
  ],
  [
    "Kenapa masuknya pakai GitHub?",
    "Why sign in with GitHub?",
    "Karena kebanyakan yang datang ke sini mau kontribusi kode, dan username GitHub-mu langsung terisi di profil. Izin yang diminta cuma email—nggak bisa nyentuh kode atau repo-mu. Lebih suka Google? Tautannya ada di bawah tombol GitHub.",
    "Because most people here come to contribute code, and your GitHub username fills in on your profile. It asks only for your email—nothing that can touch your code or repositories. Prefer Google? The link is just below the GitHub button.",
  ],
  [
    "Berbayar?",
    "Is there a cost?",
    "Nggak. Gratis untuk komunitas.",
    "No. Free for the community.",
  ],
];

const FAQ = ALL_FAQ.filter(([, questionEn]) => !(isOss ? BUILDERS_ONLY_FAQ : OSS_ONLY_FAQ).has(questionEn));

export default async function AboutPage() {
  const locale = await currentLocale();

  return (
    <>
      <SiteHeader returnTo="/about" active="about" />

      <main id="main-content" className="ab-page">
        <header className="ab-intro" aria-labelledby="about-title">
          <h1 id="about-title">{tx(locale, "Kontribusi dan bawa dampak, bareng-bareng.", "Contribute and deliver impact, together.")}</h1>
          {/* The problem from both sides, told as the story, then what the place does about it. */}
          <div className="ab-story">
            <p>
              <strong>{tx(locale, "Bikin project sendirian itu melelahkan.", "Building a project alone is exhausting.")}</strong>{" "}
              {isOss
                ? tx(
                    locale,
                    "Maintainer open source nungguin kontributor yang nggak kunjung datang, dan solo builder ngerjain semuanya sendiri—kode, desain, sampai nyari user pertama.",
                    "Open source maintainers wait for contributors who never come, and solo builders do everything themselves—the code, the design, even finding the first users.",
                  )
                : tx(
                    locale,
                    "Solo builder ngerjain semuanya sendiri—kode, desain, sampai nyari user pertama—dan progresnya nggak ada yang lihat.",
                    "Solo builders do everything themselves—the code, the design, even finding the first users—and nobody sees the progress.",
                  )}
            </p>
            <p>
              <strong>{tx(locale, "Mau kontribusi juga nggak gampang.", "Contributing isn't easy either.")}</strong>{" "}
              {tx(
                locale,
                "Banyak yang pengin nyalurin kemampuannya, tapi nggak tahu project mana yang terbuka, dan harus mulai dari mana.",
                "Plenty of people want to put their skills to use, but don't know which projects are open, or where to start.",
              )}
            </p>
            <p className="ab-quote">
              <span className="ab-quote-lead">{tx(locale, `${site.name} hadir buat nyambungin keduanya.`, `${site.name} is here to bring the two together.`)}</span>
              <strong>
                {isOss
                  ? tx(
                      locale,
                      "Temukan repo open source, lokal maupun global, yang siap menerima kontribusimu.",
                      "Find open source repos, local and global, that are ready for your contribution.",
                    )
                  : tx(
                      locale,
                      "Temukan produk buatan member komunitas yang lagi dibangun, ikuti progresnya, dan bantu lewat peranmu.",
                      "Find products community members are building, follow their progress, and help in your role.",
                    )}
              </strong>
            </p>
            <p>
              {isOss
                ? tx(
                    locale,
                    "Tiap repo nunjukin apakah lagi nerima PR dan isu mana yang cocok buat mulai. Tahu repo yang layak? Usulkan ke direktori.",
                    "Each repo shows whether it's taking PRs and where to start. Know one that belongs? Suggest it for the directory.",
                  )
                : tx(
                    locale,
                    "Tiap produk nunjukin tahapnya, kabar terbarunya, dan peran yang dicari. Lagi bikin produk sendiri? Daftarin ke direktori.",
                    "Each product shows its stage, its latest update, and the roles it's looking for. Building one yourself? List it in the directory.",
                  )}
            </p>
          </div>
        </header>

        {/* The question a newcomer actually asks, answered in one sentence before anything else. */}
        <section id="how" className="ab-section" aria-labelledby="how-title">
          <h2 id="how-title">{tx(locale, `Di ${site.name} ini kita ngapain sebenarnya?`, `So what do we actually do on ${site.name}?`)}</h2>
          <p className="ab-answer">
            {isOss
              ? tx(
                  locale,
                  `Kontribusi ke open source, bareng-bareng. ${site.name} itu komunitas orang yang sama-sama mau aktif di open source: kita nemuin project yang beneran nerima kontributor, ngirim kontribusi ke sana, dan saling lihat progres satu sama lain, biar yang lain ikut berani mulai.`,
                  `Contributing to open source, together. ${site.name} is a community of people who all want to be active in open source: we find projects that genuinely take contributors, send them contributions, and see each other's progress, so others find the nerve to start too.`,
                )
              : tx(
                  locale,
                  "Bangun produk, bareng-bareng. Builders itu tempat member swegrowth nunjukin produk yang lagi dibangun, nyari teman tim lewat peran, dan saling lihat progresnya.",
                  "Building products, together. Builders is where swegrowth members show the products they are building, find teammates through roles, and see each other's progress.",
                )}
          </p>
          <p className="ab-lead">
            {isOss
              ? tx(
                  locale,
                  `${site.name} itu platformnya; komunitasnya Software Engineer Growth (swegrowth). Ukuran yang kita pegang bukan jumlah pendaftar, tapi berapa member yang PR-nya di-merge ke project orang lain tiap bulan.`,
                  `${site.name} is the platform; the community behind it is Software Engineer Growth (swegrowth). The number we watch is not sign-ups but how many members get a PR merged into someone else's project each month.`,
                )
              : tx(
                  locale,
                  "Builders itu platformnya; komunitasnya Software Engineer Growth (swegrowth). Ukuran yang kita pegang bukan jumlah pendaftar, tapi berapa produk yang terus bergerak—kabar terbaru, tahap baru, peran terisi—tiap bulan.",
                  "Builders is the platform; the community behind it is Software Engineer Growth (swegrowth). The number we watch is not sign-ups but how many products keep moving—a new update, a new stage, a role filled—each month.",
                )}
          </p>
          <p className="hw-more">
            <Link className="ab-more" href="/how-it-works">
              {tx(locale, "Lihat cara kerjanya", "See how it works")} <Arrow />
            </Link>
            {/* Members' pull requests are the open source site's feed. */}
            {isOss ? (
              <Link className="ab-more" href="/">
                {tx(locale, "Lihat kontribusi member", "See members' contributions")} <Arrow />
              </Link>
            ) : null}
          </p>
        </section>

        <section id="why-together" className="ab-section" aria-labelledby="together-title">
          <h2 id="together-title">{tx(locale, "Kenapa harus bareng-bareng?", "Why together?")}</h2>
          <p className="ab-lead">
            {isOss
              ? tx(
                  locale,
                  "Kontribusi ke open source sendirian itu gampang berhenti di tengah jalan: nggak tahu mulai dari mana, PR nggak ada yang review, lama-lama lupa. Di sekumpulan ini, kamu nggak mulai dari nol.",
                  "Contributing to open source alone stalls easily: you don't know where to start, nobody reviews your PR, and after a while you forget. In this circle, you don't start from zero.",
                )
              : tx(
                  locale,
                  "Bangun produk sendirian itu gampang mandek di tengah jalan: nggak ada yang nyobain, nggak ada teman tim, lama-lama ditinggal. Di sekumpulan ini, kamu nggak mulai dari nol.",
                  "Building a product alone stalls easily: nobody tries it, there is no team, and after a while it is left behind. In this circle, you don't start from zero.",
                )}
          </p>
          <ul className="ab-cards ab-steps">
            {TOGETHER.map(([titleId, titleEn, bodyId, bodyEn], index) => (
              <li key={titleEn} className={`ab-card ${TOGETHER_TONES[index] ?? ""}`}>
                <h3>{tx(locale, titleId, titleEn)}</h3>
                <p>{tx(locale, bodyId, bodyEn)}</p>
              </li>
            ))}
          </ul>
          <p className="ab-answer">
            {isOss
              ? tx(
                  locale,
                  "Harapannya: makin banyak engineer Indonesia yang rutin kontribusi ke open source, dan project buatan kita nggak lagi dikerjain sendirian.",
                  "The hope: more and more Indonesian engineers contributing to open source as a habit, and the projects we build no longer built alone.",
                )
              : tx(
                  locale,
                  "Harapannya: makin banyak produk buatan member yang sampai ke rilis, dan nggak ada lagi yang dikerjain sendirian.",
                  "The hope: more and more members' products reaching launch, and none of them built alone.",
                )}
          </p>
        </section>

        <section className="ab-section" aria-labelledby="audience-title">
          <h2 id="audience-title">{tx(locale, "Buat siapa", "Who it is for")}</h2>
          <ul className="ab-cards">
            {AUDIENCES.map(([tone, titleId, titleEn, bodyId, bodyEn]) => (
              <li key={titleEn} className={`ab-card ${tone}`}>
                <h3>{tx(locale, titleId, titleEn)}</h3>
                <p>{tx(locale, bodyId, bodyEn)}</p>
              </li>
            ))}
          </ul>
        </section>

        {/* Roles on members' products, which only the builders site has. */}
        {isOss ? null : (
          <section className="ab-section" aria-labelledby="roles-title">
            <h2 id="roles-title">{tx(locale, "Selain kode", "Beyond code")}</h2>
            <p className="ab-lead">
              {tx(
                locale,
                "Sebuah project juga butuh hal lain selain kode supaya bisa dipakai orang. Tiap peran ngelihat hal yang beda, dan semuanya bisa jadi kontribusi.",
                "A project needs more than code before people can use it. Every role sees something different, and all of it can be a contribution.",
              )}
            </p>

            <ul className="ab-cards">
              {ROLES.map(([titleId, titleEn, bodyId, bodyEn]) => (
                <li key={titleEn} className="ab-card">
                  <h3>{tx(locale, titleId, titleEn)}</h3>
                  <p>{tx(locale, bodyId, bodyEn)}</p>
                </li>
              ))}
            </ul>

            <Link className="ab-more" href="/directory?open=roles">
              {tx(locale, "Lihat produk yang lagi cari bantuan", "See products looking for help")} <Arrow />
            </Link>
          </section>
        )}

        <section className="ab-section" aria-labelledby="faq-title">
          <h2 id="faq-title">{tx(locale, "Pertanyaan yang sering muncul", "Frequently asked questions")}</h2>

          <div className="ab-faq">
            {FAQ.map(([questionId, questionEn, answerId, answerEn]) => (
              <details key={questionEn}>
                <summary>{tx(locale, questionId, questionEn)}</summary>
                <p>{tx(locale, answerId, answerEn)}</p>
              </details>
            ))}
          </div>
        </section>

        <section className="ab-cta tone-account" aria-labelledby="about-cta-title">
          <h2 id="about-cta-title">{tx(locale, "Mulai dari satu kontribusi.", "Start with one contribution.")}</h2>
          <p>
            {tx(
              locale,
              isOss ? "Cari repo yang pas di direktori. Tahu repo yang layak? Usulkan juga." : "Cari produk yang pas di direktori. Punya produk sendiri? Daftarin juga.",
              isOss ? "Find a repo that fits in the directory. Know one that belongs? Suggest it too." : "Find a product that fits in the directory. Have one of your own? List it too.",
            )}
          </p>
          <div className="ab-cta-actions">
            <Link className="ab-button ab-button-primary" href="/directory">
              {tx(locale, "Lihat direktori", "Browse the directory")}
            </Link>
            <Link className="ab-button" href={isOss ? "/recommend" : "/new"}>
              <span aria-hidden="true">+</span> {isOss ? tx(locale, "Usulkan repo", "Suggest a repo") : tx(locale, "Tambah project", "Add a project")}
            </Link>
            {/* The group's rules come first, on /community, then the link to join. */}
            <Link className="ab-button" href="/community">
              {tx(locale, "Gabung komunitas", "Join the community")}
            </Link>
          </div>
        </section>
      </main>

      <SiteFooter />
    </>
  );
}
