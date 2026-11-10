import { HeaderShell } from "../components/shell";
import { Skeleton } from "../components/skeleton";

/**
 * Catch-all route feedback for pages without a more specific skeleton.
 *
 * The real header, menu and bottom bar included, and a stable reading column
 * are enough to acknowledge navigation immediately without pretending to know
 * the destination page's exact shape.
 */
export default function Loading() {
  return (
    <>
      <HeaderShell />
      <main id="main-content" className="page-narrow generic-route-loading" aria-busy="true">
        <p className="sr-only">Memuat… / Loading…</p>
        <Skeleton height={11} width={150} style={{ marginBottom: 22 }} />
        <Skeleton height={58} width="78%" style={{ marginBottom: 14 }} />
        <Skeleton height={58} width="58%" style={{ marginBottom: 30 }} />
        <Skeleton height={16} width="92%" style={{ marginBottom: 10 }} />
        <Skeleton height={16} width="84%" style={{ marginBottom: 10 }} />
        <Skeleton height={16} width="65%" style={{ marginBottom: 34 }} />
        <div className="skeleton-panel" style={{ minHeight: 210 }}>
          <Skeleton height={20} width="34%" style={{ marginBottom: 22 }} />
          <Skeleton height={14} style={{ marginBottom: 10 }} />
          <Skeleton height={14} width="88%" style={{ marginBottom: 10 }} />
          <Skeleton height={14} width="72%" />
        </div>
      </main>
    </>
  );
}
