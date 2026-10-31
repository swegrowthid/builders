"use client";

import { useLayoutEffect, useRef, type ReactNode } from "react";

/**
 * The contribution graph's frame. Where a year of weeks is wider than the
 * screen it scrolls sideways, and it opens at the right end, on the latest
 * weeks, the way GitHub's does.
 */
export function CalendarScroll({ className, children }: { className: string; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const frame = ref.current;
    if (frame) frame.scrollLeft = frame.scrollWidth;
  }, []);

  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}
