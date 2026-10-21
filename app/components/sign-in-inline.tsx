import Link from "@/app/components/responsive-link";
import { ProviderButton } from "./auth-forms";
import { tx, type Locale } from "../lib/locale";

/**
 * The sign-in a form page asks for, on the page itself.
 *
 * It used to be a button to /signin, which then offered the GitHub button: a
 * whole page load — about a second from here — spent on a choice almost
 * everybody makes the same way. GitHub starts right here and comes back to
 * `next`; Google and email are still one link away, on /signin.
 */
export function SignInInline({ next, message, locale }: { next: string; message: string; locale: Locale }) {
  const other = (way: "google" | "email") => `/signin?${new URLSearchParams({ with: way, next })}`;
  return (
    <div className="sign-in-inline">
      <p>{message}</p>
      <div className="auth-form">
        <ProviderButton provider="github" next={next} />
      </div>
      <p className="signin-simple-alt">
        <Link href={other("google")}>{tx(locale, "Masuk dengan Google", "Sign in with Google")}</Link>
        {" · "}
        <Link href={other("email")}>{tx(locale, "pakai email", "use email")}</Link>
      </p>
    </div>
  );
}
