import type { Metadata } from "next";
import { SiteFooter, SiteHeader } from "../../components/shell";
import { CreateForm } from "../../components/create-form";
import { SignInInline } from "../../components/sign-in-inline";
import { currentViewer } from "../../lib/session";
import { currentLocale } from "../../lib/locale-server";
import { tx } from "../../lib/locale";

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
    title: tx(locale, "Tambahkan produkmu — Builders", "Add your product — Builders"),
    description: tx(locale, "Tampilkan produkmu di direktori dan cari kontributor: lewat pull request di GitHub, atau untuk peran desain, produk, riset, dan lainnya.", "Show your product in the directory and find contributors: through pull requests on GitHub, or for design, product, research and other roles."),
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
          <span /> {tx(locale, "Tambahkan produkmu", "Add your product")}
        </p>
        <h1>{tx(locale, "Cari kontributor untuk produkmu.", "Find contributors for your product.")}</h1>
        <p className="lede">{tx(locale, "Tempel tautannya, pilih bantuan yang kamu cari, dan produkmu tampil di direktori. Cukup satu menit.", "Paste its link, pick the help you are looking for, and your product shows in the directory. It takes a minute.")}</p>

        {viewer ? (
          <CreateForm />
        ) : (
          <SignInInline
            next="/new"
            locale={locale}
            message={tx(locale, "Masuk dulu untuk menambahkan produk — kamu kembali ke sini sesudahnya.", "Sign in to add your product — you come straight back here.")}
          />
        )}
      </main>

      <SiteFooter />
    </>
  );
}
