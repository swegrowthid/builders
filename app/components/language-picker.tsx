"use client";

import { Fragment, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { useLanguage } from "./language-provider";
import { LANGUAGE_PARAM, LOCALES, type Locale } from "../lib/locale";

const OPTION: Record<Locale, { label: string; nativeName: string }> = {
  id: { label: "Bahasa Indonesia", nativeName: "ID" },
  en: { label: "English", nativeName: "EN" },
};

/** A plain left-click with no modifier — the case we should drive ourselves. */
function isPlainClick(event: React.MouseEvent): boolean {
  return event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey;
}

/**
 * The full-page version of the language choice, for /account/language.
 *
 * Each option is a link to this same page carrying ?lang=, which proxy.ts
 * turns into that language's copy of the page (app/[lang]). The two copies
 * sit under different root layouts, so the switch is a full page load rather
 * than a client navigation: done in place, the router kept pages it had
 * already fetched in the old language and showed one of them for the next
 * link clicked. A plain `<a>` and `location.replace`, with the spinner shown
 * until the new page arrives.
 */
export function LanguagePicker() {
  const { locale, choose, tx } = useLanguage();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, setPending] = useState(false);

  function hrefFor(target: Locale): string {
    const params = new URLSearchParams(searchParams.toString());
    params.set(LANGUAGE_PARAM, target);
    return `${pathname}?${params}`;
  }

  function pick(event: React.MouseEvent, target: Locale) {
    if (!isPlainClick(event)) return; // let the browser open it in a new tab, etc.
    event.preventDefault();
    if (target === locale) return;
    choose(target);
    setPending(true);
    window.location.replace(hrefFor(target));
  }

  return (
    <div className="language-picker" role="radiogroup" aria-label={tx("Pilih bahasa", "Choose language")}>
      {LOCALES.map((target) => (
        <Fragment key={target}>
          <a
            href={hrefFor(target)}
            hrefLang={target}
            role="radio"
            aria-checked={locale === target}
            className={`language-option ${locale === target ? "is-active" : ""}`}
            onClick={(event) => pick(event, target)}
          >
            <span className="language-option-name">{OPTION[target].label}</span>
            <span className="language-option-code" aria-hidden="true">{OPTION[target].nativeName}</span>
            {isPending && locale === target ? (
              <>
                <span className="language-option-spinner" aria-hidden="true" />
                <span role="status" className="sr-only">{tx("Mengganti bahasa…", "Switching language…")}</span>
              </>
            ) : locale === target ? (
              <span className="language-option-check" aria-hidden="true">✓</span>
            ) : null}
          </a>
        </Fragment>
      ))}
    </div>
  );
}
