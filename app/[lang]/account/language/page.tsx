import type { Metadata } from "next";
import { SiteFooter, SiteHeader } from "../../../components/shell";
import { LanguagePicker } from "../../../components/language-picker";
import { currentLocale } from "../../../lib/locale-server";
import { tx } from "../../../lib/locale";
import { site } from "../../../lib/site";

/**
 * A settings page rather than the always-visible header toggle it replaced.
 *
 * Open to signed-out visitors on purpose: the language a visitor reads in has
 * nothing to do with having an account, and this page is the only route left
 * that changes it, so gating it behind sign-in would strand anyone browsing
 * anonymously. The account menu and the footer both link here.
 */
export async function generateMetadata(): Promise<Metadata> {
  const locale = await currentLocale();
  return {
    title: tx(locale, `Bahasa — ${site.name}`, `Language — ${site.name}`),
    description: tx(locale, `Pilih bahasa tampilan ${site.name}.`, `Choose the display language for ${site.name}.`),
    robots: { index: false },
  };
}

export default async function LanguageSettingsPage() {
  const locale = await currentLocale();

  return (
    <>
      <SiteHeader returnTo="/account/language" />

      <main id="main-content" className="page-narrow">
        <p className="eyebrow">
          <span /> {tx(locale, "Bahasa", "Language")}
        </p>
        <h1>{tx(locale, "Pilih bahasa tampilan.", "Choose your display language.")}</h1>
        <p className="lede">
          {tx(
            locale,
            `Berlaku di seluruh ${site.name} sampai kamu menggantinya lagi di sini.`,
            `Applies across ${site.name} until you change it again here.`,
          )}
        </p>

        <LanguagePicker />
      </main>

      <SiteFooter />
    </>
  );
}
