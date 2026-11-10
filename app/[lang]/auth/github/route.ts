import type { NextRequest } from "next/server";
import { startOAuth } from "../../../lib/oauth-start";

/**
 * Starts the GitHub sign-in — or, for somebody already signed in, links
 * GitHub to their account.
 */
export function GET(request: NextRequest) {
  return startOAuth(request, "github");
}
