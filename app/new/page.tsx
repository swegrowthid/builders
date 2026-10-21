import type { Metadata } from "next";
import { SiteFooter, SiteHeader } from "../components/shell";
import { CreateForm } from "../components/create-form";
import { SignInInline } from "../components/sign-in-inline";
import { currentViewer } from "../lib/session";
import { currentLocale } from "../lib/locale-server";
import { tx } from "../lib/locale";

/*
 * Allowed to block.
 *
 * This page decides what to render — or whether to redirect — from who is
 * signed in, and there is no useful shell to show before that answer arrives:
 * a visitor who is about to be sent elsewhere should not watch this page paint
 * first. Nothing here is cacheable and nothing here is indexed, so blocking on
 * the session costs a request that was always going to be per-visitor.
 */
export const instant = false;

export async function generateMetadata(): Promise<Metadata> {
  const locale = await currentLocale();
  return {
    title: tx(locale, "Tambahkan proyekmu — Builders", "Add your project — Builders"),
    description: tx(locale, "Mulai dari tautan yang sudah ada, atau tulis deskripsi singkat jika proyekmu masih berupa ide.", "Start from an existing link, or write a short description if your project is still an idea."),
    alternates: { canonical: "/new" },
  };
}

export default async function NewProject() {
  const [viewer, locale] = await Promise.all([currentViewer(), currentLocale()]);

  return (
    <>
      <SiteHeader returnTo="/new" />

      <main id="main-content" className="page-narrow">
        <p className="eyebrow">
          <span /> {tx(locale, "Tambahkan proyekmu", "Add your project")}
        </p>
        <h1>{tx(locale, "Tampilkan proyek atau idemu.", "Show your project or idea.")}</h1>
        <p className="lede">{tx(locale, "Mulai dari tautan, atau ceritakan idenya jika belum punya tautan.", "Start from a link, or describe the idea if it does not have one yet.")}</p>

        {viewer ? (
          <CreateForm />
        ) : (
          <SignInInline
            next="/new"
            locale={locale}
            message={tx(locale, "Masuk dulu untuk menambahkan proyek — kamu kembali ke sini sesudahnya.", "Sign in to add your project — you come straight back here.")}
          />
        )}
      </main>

      <SiteFooter />
    </>
  );
}
