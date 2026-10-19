import { HeaderShell } from "../components/shell";
import { LoadingNote, Skeleton } from "../components/skeleton";

export default function Loading() {
  return (
    <>
      <HeaderShell active="open-source" />
      <main id="main-content" className="oss-page">
        <LoadingNote />
        <div className="oss-page-head">
          <Skeleton height={11} width={160} style={{ marginBottom: 18 }} />
          <Skeleton height={52} width="88%" style={{ marginBottom: 18 }} />
          <Skeleton height={15} width="72%" />
        </div>
        <div className="oss-grid">
          {[0, 1, 2].map((slot) => <Skeleton key={slot} height={280} style={{ borderRadius: 20 }} />)}
        </div>
      </main>
    </>
  );
}
