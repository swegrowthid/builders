"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { LANGUAGE_COOKIE, tx as selectCopy, type Locale } from "../lib/locale";

type LanguageContextValue = {
  locale: Locale;
  /** Remember the language just picked. The switch itself is a navigation. */
  choose: (locale: Locale) => void;
  tx: (id: string, en: string) => string;
};

const LanguageContext = createContext<LanguageContextValue | null>(null);

export function LanguageProvider({ locale: served, children }: { locale: Locale; children: ReactNode }) {
  // The prop is the language the document was served in, and this is the one
  // being read right now. They differ only between a pick in LanguagePicker
  // and the full page load it starts, so the choice shows at once.
  const [chosen, setChosen] = useState({ locale: served, from: served });
  if (chosen.from !== served) setChosen({ locale: served, from: served });
  const locale = chosen.locale;

  useEffect(() => {
    document.documentElement.lang = locale;
    // Every later request reads this: the plain URLs the rest of the site links
    // to carry no ?lang=. Writing it here rather than in proxy.ts is deliberate
    // — a prefetch of a ?lang= link would otherwise switch the site unasked. It
    // also means a shared ?lang= link is remembered once it is actually opened.
    document.cookie = `${LANGUAGE_COOKIE}=${locale}; Path=/; Max-Age=31536000; SameSite=Lax`;
  }, [locale]);

  const value = useMemo<LanguageContextValue>(
    () => ({
      locale,
      choose: (next) => setChosen((current) => ({ locale: next, from: current.from })),
      tx: (id, en) => selectCopy(locale, id, en),
    }),
    [locale],
  );

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage(): LanguageContextValue {
  const context = useContext(LanguageContext);
  if (!context) throw new Error("useLanguage must be used inside LanguageProvider");
  return context;
}
