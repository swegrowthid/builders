import type { Metadata } from "next";
import { HowItWorks, SITE_TRACK, howItWorksMetadata } from "./how-it-works";

export function generateMetadata(): Promise<Metadata> {
  return howItWorksMetadata(SITE_TRACK);
}

export default function HowItWorksPage() {
  return <HowItWorks track={SITE_TRACK} />;
}
