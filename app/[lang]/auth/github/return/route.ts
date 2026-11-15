import type { NextRequest } from "next/server";
import { sameOriginRedirect } from "../../../../lib/redirect";

/**
 * Where GitHub sends somebody after they authorize — see `viaOurDomain` in
 * app/lib/oauth-start.ts. Nothing is done here: GitHub's answer goes on,
 * untouched, to Supabase's own callback, which finishes the sign-in and comes
 * back to /auth/callback as it always did.
 */
const PASSED_ON = ["code", "state", "error", "error_description", "error_uri"];

export function GET(request: NextRequest) {
  const supabase = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!supabase) return sameOriginRedirect("/signin?error=github-failed");

  const callback = new URL("/auth/v1/callback", supabase);
  for (const name of PASSED_ON) {
    const value = request.nextUrl.searchParams.get(name);
    if (value) callback.searchParams.set(name, value);
  }
  return Response.redirect(callback, 302);
}
