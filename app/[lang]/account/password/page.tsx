import type { Metadata } from "next";
import Link from "@/app/components/responsive-link";
import { SiteFooter, SiteHeader } from "../../../components/shell";
import { NewPasswordForm } from "../../../components/auth-forms";
import { currentViewer } from "../../../lib/session";
import { supabaseConfigured } from "../../../lib/supabase";
import { currentLocale } from "../../../lib/locale-server";
import { tx } from "../../../lib/locale";
import { site } from "../../../lib/site";

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
    title: tx(locale, `Kata sandi baru — ${site.name}`, `New password — ${site.name}`),
    description: tx(locale, `Buat kata sandi baru untuk akun ${site.name}.`, `Set a new password for your ${site.name} account.`),
    robots: { index: false },
  };
}

/**
 * Where a recovery link lands, by way of /auth/confirm.
 *
 * A signed-in visitor here is either somebody who just opened that link, or
 * somebody changing their password on purpose — the same form serves both.
 * Without a session there is nothing to change, so this explains rather than
 * redirecting: being bounced to the sign-in page with no word about why is
 * how an expired link turns into a person giving up.
 */
export default async function NewPasswordPage() {
  const [viewer, locale] = await Promise.all([currentViewer(), currentLocale()]);

  return (
    <>
      <SiteHeader returnTo="/account/password" />

      <main id="main-content" className="page-narrow auth-page">
        <p className="eyebrow">
          <span /> {tx(locale, "Kata sandi", "Password")}
        </p>
        <h1>{tx(locale, "Buat kata sandi baru.", "Set a new password.")}</h1>

        {!supabaseConfigured() ? (
          <p className="form-error">
            {tx(locale, "Situs ini belum terhubung ke Supabase sehingga kata sandi belum dapat dibuat.", "This site is not connected to Supabase yet, so passwords cannot be set.")}
          </p>
        ) : viewer ? (
          <>
            <p className="lede">
              {tx(locale, "Setelah disimpan, kata sandi lamamu tidak akan dapat digunakan lagi.", "After saving, your old password will no longer work.")}
            </p>
            <NewPasswordForm />
          </>
        ) : (
          <>
            <p className="form-error" role="alert">
              {tx(locale, "Tautan ini telah kedaluwarsa atau sudah digunakan, jadi belum ada yang dapat diubah.", "This link has expired or has already been used, so there is nothing to change yet.")}
            </p>
            <p className="auth-switch">
              <Link href="/forgot-password">{tx(locale, "Minta tautan baru", "Request a new link")}</Link>.
            </p>
          </>
        )}
      </main>

      <SiteFooter />
    </>
  );
}
