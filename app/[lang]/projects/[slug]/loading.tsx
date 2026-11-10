import { HeaderShell } from "../../../components/shell";
import { LoadingNote, Skeleton } from "../../../components/skeleton";

/** A project page's skeleton: hero panel, then the brief and the roles. */
export default function Loading() {
  return (
    <>
      <HeaderShell />
      <main id="main-content" className="project-page">
        <LoadingNote />
        <Skeleton height={12} width={220} style={{ marginBottom: 20 }} />
        <div className="skeleton-panel" style={{ minHeight: 300 }}>
          <Skeleton height={58} width={58} style={{ borderRadius: 16, marginBottom: 22 }} />
          <Skeleton height={56} width="55%" style={{ marginBottom: 16 }} />
          <Skeleton height={18} width="70%" />
        </div>
        <div className="project-main project-simple">
          <div className="skeleton-panel" style={{ minHeight: 260 }}>
            <Skeleton height={24} width={90} style={{ marginBottom: 22 }} />
            <Skeleton height={15} style={{ marginBottom: 9 }} />
            <Skeleton height={15} width="92%" style={{ marginBottom: 9 }} />
            <Skeleton height={15} width="70%" />
          </div>
          <div className="skeleton-panel" style={{ minHeight: 180 }}>
            <Skeleton height={24} width={140} style={{ marginBottom: 22 }} />
            <Skeleton height={15} width="80%" />
          </div>
        </div>
      </main>
    </>
  );
}
