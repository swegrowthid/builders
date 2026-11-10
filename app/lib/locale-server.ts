import { cache } from "react";
import { cookies } from "next/headers";
import { lang } from "next/root-params";
import { isLocale, LANGUAGE_COOKIE, type Locale } from "./locale";

/**
 * The language a page is rendered in: the `[lang]` segment proxy.ts rewrote
 * the request to. Reading it from the route rather than the cookie is what
 * lets a page prerender, once per language, instead of rendering per request.
 */
export const currentLocale = cache(async (): Promise<Locale> => {
  const value = await lang();
  return isLocale(value) ? value : "en";
});

/**
 * The visitor's language, from the cookie, where there is no route to read it
 * from: server actions and route handlers, which `next/root-params` does not
 * reach. English is the product default.
 */
export const requestLocale = cache(async (): Promise<Locale> => {
  const value = (await cookies()).get(LANGUAGE_COOKIE)?.value;
  return isLocale(value) ? value : "en";
});
