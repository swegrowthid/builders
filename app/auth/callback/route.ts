import { type NextRequest, type NextResponse } from "next/server";
import { getSupabase } from "../../lib/supabase";
import { siteOrigin } from "../../lib/origin";
import { sameOriginRedirect } from "../../lib/redirect";
import { pinnedOrigin, safeNextPath, startPath } from "../../lib/urls";
import { rememberGitHubToken } from "../../lib/github-token";
import type { Supabase } from "../../lib/supabase";
import type { Session } from "@supabase/supabase-js";

/**
 * Exchanges a provider's short-lived OAuth code — Google's or GitHub's — for
 * the session cookies used by the app. `via` names the provider; it is set by
 * `startOAuth` and only decides which failure to report and whether there is a
 * GitHub token to keep.
 */
export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const next = safeNextPath(request.nextUrl.searchParams.get("next"));
  const via = request.nextUrl.searchParams.get("via") === "github" ? "github" : "google";
  const supabase = await getSupabase();

  const failure = new URLSearchParams();

  if (code && supabase) {
    const { data: exchanged, error } = await supabase.auth.exchangeCodeForSession(code);
    // Stay on this host. The session cookies were just written here, and a
    // redirect to any other name for the site would arrive without them.
    if (!error) {
      if (via === "github") await keepGitHub(supabase, exchanged.session);
      return sameOriginRedirect(startPath(next));
    }

    // A code is single use, and a successful exchange clears the verifier it
    // was spent against. So the second visit to this URL — a refresh, a retry,
    // a browser replaying the navigation — fails in a way that looks exactly
    // like a sign-in that never worked. Ask who is here before believing that:
    // if a session exists, the exchange already happened and there is nothing
    // wrong to report.
    const { data } = await supabase.auth.getUser();
    if (data.user) return sameOriginRedirect(startPath(next));

    // Past that, the exchange genuinely failed. Say what Supabase said — the
    // message is the only way to tell these apart from the outside, and
    // guessing from the shape of it is how the wrong sentence gets shown.
    console.error(`[ahsan] OAuth code exchange failed: ${error.message}`, {
      code: error.code,
      status: error.status,
      origin: await siteOrigin(),
      invoked: request.nextUrl.origin,
    });

    // Only when the verifier is missing *and* nobody is signed in has the
    // journey plausibly changed origin along the way — the cookie is written
    // where the sign-in started and read here.
    const missingVerifier = /code[ _]verifier/i.test(error.message);
    failure.set("error", missingVerifier ? "origin-mismatch" : `${via}-failed`);
  } else {
    failure.set("error", `${via}-failed`);
  }

  if (next !== "/") failure.set("next", next);
  return retry(`/signin?${failure}`, failure.get("error") === "origin-mismatch");
}

/**
 * Sends a failed sign-in somewhere it can actually be retried.
 *
 * `origin-mismatch` means this callback is not on the host the sign-in left from,
 * so trying again from here would fail the same way. When the deployment names
 * one address for sign-in, hand them that address; otherwise stay put, because
 * a guessed host is worse than the one they are on.
 */
function retry(path: string, wrongHost: boolean): NextResponse | Response {
  const pinned = wrongHost ? pinnedOrigin(process.env) : null;
  return pinned ? Response.redirect(new URL(path, pinned), 307) : sameOriginRedirect(path);
}

/**
 * What a GitHub sign-in leaves behind besides the session: the token the Star
 * button uses — Supabase hands it over here, once, and never again — and the
 * person's GitHub handle on a profile that has none yet.
 */
async function keepGitHub(supabase: Supabase, session: Session | null): Promise<void> {
  if (!session) return;
  if (session.provider_token) await rememberGitHubToken(session.provider_token);
  // Without it every Star press sends them back through GitHub again, and
  // nothing on the page can say why.
  else console.warn("[ahsan] GitHub sign-in finished without a provider token; the Star button cannot work for this visitor.");

  const identity = session.user.identities?.find((item) => item.provider === "github");
  const handle = identity?.identity_data?.user_name;
  if (typeof handle !== "string" || !/^[a-z\d](?:[a-z\d-]{0,38})$/i.test(handle)) return;

  // Only fills an empty field: a handle somebody typed themselves wins.
  const { error } = await supabase
    .from("profiles")
    .update({ github: `https://github.com/${handle}` })
    .eq("id", session.user.id)
    .eq("github", "");
  if (error) console.warn(`[ahsan] Could not record the GitHub handle: ${error.message}`);
}
