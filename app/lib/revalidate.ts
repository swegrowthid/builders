import { revalidatePath } from "next/cache";
import { LOCALES } from "./locale";

/**
 * revalidatePath for an address as visitors see it. Pages live under
 * app/[lang] and are cached once per language, so `/about` is really
 * `/en/about` and `/id/about`; both are dropped.
 */
export function revalidatePage(path: string, type?: "layout" | "page"): void {
  for (const locale of LOCALES) revalidatePath(`/${locale}${path === "/" ? "" : path}`, type);
}
