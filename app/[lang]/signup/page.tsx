import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { safeNextPath } from "../../lib/urls";
import { currentLocale } from "../../lib/locale-server";
import { tx } from "../../lib/locale";
import { site } from "../../lib/site";

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
    title: tx(locale, `Buat akun — ${site.name}`, `Create an account — ${site.name}`),
    description: tx(locale, "Buat akun untuk menampilkan apa yang kamu bangun dan membantu proyek lain.", "Create an account to show what you are building and help with other projects."),
    robots: { index: false },
  };
}

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

/**
 * There is no separate sign-up any more: signing in with GitHub or Google
 * makes the account on first use. Old links land on the sign-in page.
 */
export default async function SignUpPage({ searchParams }: { searchParams?: SearchParams }) {
  const params = (await searchParams) ?? {};
  const next = safeNextPath(typeof params.next === "string" ? params.next : "/");
  redirect(next === "/" ? "/signin" : `/signin?next=${encodeURIComponent(next)}`);
}
