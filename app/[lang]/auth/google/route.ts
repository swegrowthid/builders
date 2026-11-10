import type { NextRequest } from "next/server";
import { startOAuth } from "../../../lib/oauth-start";

/**
 * Starts the Google sign-in. Nothing changes state, so a plain GET is right —
 * and a link works with no JavaScript. See `startOAuth` for why this is a
 * route handler and not a server action.
 */
export function GET(request: NextRequest) {
  return startOAuth(request, "google");
}
