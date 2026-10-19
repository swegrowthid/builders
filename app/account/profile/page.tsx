import type { Metadata } from "next";
import Link from "@/app/components/responsive-link";
import { redirect } from "next/navigation";
import { SiteFooter, SiteHeader } from "../../components/shell";
import { ProfileForm, type EditableProfile } from "../../components/profile-form";
import { listOssContributionsOf, listPeople } from "../../lib/data";
import { OssAddForm, OssRecordEmpty, OssRecordList } from "../../components/oss-record";
import { githubHandle } from "../../lib/oss";
import { termSuggestions } from "../../lib/people";
import { readPublicly } from "../../lib/public-read";
import { currentViewer, type Viewer } from "../../lib/session";
import { signInPath } from "../../lib/urls";
import { currentLocale } from "../../lib/locale-server";
import { tx } from "../../lib/locale";

/*
 * Allowed to block — same reason as the rest of /account. Nothing here is
 * cacheable or indexed: the page is one person's own form, and a visitor
 * about to be redirected should not watch it paint first.
 */
export const instant = false;

export async function generateMetadata(): Promise<Metadata> {
  const locale = await currentLocale();
  return {
    title: tx(locale, "Edit profil — Builders", "Edit profile — Builders"),
    description: tx(locale, "Edit profil, keahlian, dan tautan kontakmu di Builders.", "Edit your profile, skills, and contact links on Builders."),
    robots: { index: false },
  };
}

export default async function EditProfilePage({
  searchParams,
}: {
  searchParams: Promise<{ returnTo?: string | string[]; oss?: string | string[] }>;
}) {
  const [viewer, locale] = await Promise.all([currentViewer(), currentLocale()]);
  if (!viewer) redirect(signInPath("/account/profile"));
  const query = await searchParams;
  const requestedReturnTo = Array.isArray(query.returnTo) ? query.returnTo[0] : query.returnTo;
  // This is only a convenience after a blocked proposal, never an external
  // redirect destination supplied by a query string.
  const returnTo = requestedReturnTo?.startsWith("/projects/") ? requestedReturnTo : undefined;

  // Suggestions only. If the directory cannot be read the form still works —
  // it just stops proposing the words other people already use.
  const [people, records] = await Promise.all([
    readPublicly("profile term suggestions", () => listPeople(400), []),
    readPublicly("open source record in the editor", () => listOssContributionsOf(viewer.id), []),
  ]);
  const ossStatus = typeof query.oss === "string" ? query.oss : "";
  const handle = githubHandle(viewer.github);

  return (
    <>
      <SiteHeader returnTo="/account/profile" />

      <main id="main-content" className="page-narrow">
        <p className="eyebrow">
          <span /> {tx(locale, "Profil", "Profile")}
        </p>
        <h1>{tx(locale, "Lengkapi profilmu.", "Complete your profile.")}</h1>
        <p className="lede">
          {tx(locale, "Inilah yang dilihat orang di ", "This is what people see on ")}<Link href={`/u/${viewer.username}`}>{tx(locale, "halaman portofoliomu", "your portfolio page")}</Link>{" "}
          {tx(locale, "dan digunakan untuk menemukanmu di ", "and use to find you in the ")}<Link href="/people">talent pool</Link>{tx(locale, ", tempat recruiter, hiring manager, dan pembangun tim mencari talent berdasarkan bukti pengalaman. Kamu dapat memperbaruinya kapan saja.", ", where recruiters, hiring managers, and team builders look for talent through proof of experience. You can update it at any time.")}
        </p>

        {/* First, because it is what the directory is built from: every repo
            listed here becomes a badge on that repo's row. */}
        <section id="open-source" className="oss-editor" aria-labelledby="oss-editor-title">
          <h2 id="oss-editor-title">{tx(locale, "Kontribusi open source", "Open source contributions")}</h2>
          <p>
            {tx(
              locale,
              "Repo yang pernah kamu kontribusi atau kamu maintain. Masing-masing jadi badge di direktori — \"teman pernah kontribusi\" atau \"maintainer di grup kita\" — lengkap dengan fotomu.",
              "Repos you have contributed to or maintain. Each one becomes a badge in the directory — \"a friend has contributed\" or \"maintainer in our group\" — with your picture.",
            )}
          </p>
          {!handle ? (
            <p className="oss-editor-note">
              {tx(locale, "Isi GitHub-mu di bawah supaya fotomu muncul di badge dan orang bisa melihat PR-mu.", "Add your GitHub below so your picture shows on badges and people can see your PRs.")}{" "}
              <a href="#contact">{tx(locale, "Isi GitHub", "Add GitHub")}</a>
            </p>
          ) : null}
          {records.value.length > 0 ? (
            <OssRecordList records={records.value} handle={handle} editable locale={locale} />
          ) : (
            <OssRecordEmpty self={false} locale={locale} />
          )}
          <OssAddForm returnTo="/account/profile" status={ossStatus} locale={locale} />
        </section>

        <ProfileForm
          profile={toEditable(viewer)}
          skillSuggestions={termSuggestions(people.value, "skills")}
          fieldSuggestions={termSuggestions(people.value, "fields")}
          returnTo={returnTo}
        />

        <p className="hint">
          {tx(locale, "URL profilmu—", "Your profile URL—")}<code>/u/{viewer.username}</code>{tx(locale, "—dibuat oleh sistem dan tidak dapat diubah di sini. Ubah kata sandimu di ", "—is created by the system and cannot be changed here. Change your password on the ")}<Link href="/account/password">{tx(locale, "halaman kata sandi", "password page")}</Link>.
        </p>
      </main>

      <SiteFooter />
    </>
  );
}

/** The stored profile as the form's string fields. */
function toEditable(viewer: Viewer): EditableProfile {
  return {
    name: viewer.name,
    profession: viewer.profession,
    headline: viewer.headline,
    bio: viewer.bio,
    skills: viewer.skills.join(", "),
    yearsExperience: viewer.yearsExperience === null ? "" : String(viewer.yearsExperience),
    fields: viewer.fields.join(", "),
    availability: viewer.availability,
    website: viewer.website,
    publicEmail: viewer.publicEmail,
    github: viewer.github,
    linkedin: viewer.linkedin,
    x: viewer.x,
    resume: viewer.resume,
  };
}
