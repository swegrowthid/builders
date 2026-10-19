import { HeaderShell } from "../components/shell";
import { LoadingNote, Skeleton } from "../components/skeleton";

export default function Loading() {
  return (
    <>
      <HeaderShell active="home" />
      <main id="main-content" className="dir-page">
        <LoadingNote />
        <Skeleton height={40} width="50%" style={{ marginBottom: 12 }} />
        <Skeleton height={15} width="34%" style={{ marginBottom: 22 }} />
        <div className="dir-paths">
          <Skeleton height={74} style={{ borderRadius: 16 }} />
          <Skeleton height={74} style={{ borderRadius: 16 }} />
        </div>
        <Skeleton height={44} style={{ borderRadius: 12, margin: "16px 0 18px" }} />
        <div className="dir-grid">
          {[0, 1, 2, 3, 4, 5].map((slot) => <Skeleton key={slot} height={190} style={{ borderRadius: 16 }} />)}
        </div>
      </main>
    </>
  );
}
