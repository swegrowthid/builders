import { HeaderShell } from "../components/shell";
import { LoadingNote, Skeleton } from "../components/skeleton";

export default function Loading() {
  return (
    <>
      <HeaderShell active="home" />
      <main id="main-content" className="dx-page">
        <LoadingNote />
        <div className="dx-head">
          <div style={{ width: "100%" }}>
            <Skeleton height={28} width={280} style={{ marginBottom: 10 }} />
            <Skeleton height={14} width="46%" />
          </div>
        </div>
        <div className="dx-layout">
          <div className="dx-side">
            <Skeleton height={220} style={{ borderRadius: 8 }} />
          </div>
          <div className="dx-results">
            <Skeleton height={40} style={{ borderRadius: 8, marginBottom: 14 }} />
            {[0, 1, 2, 3, 4, 5].map((slot) => <Skeleton key={slot} height={78} style={{ borderRadius: 0, marginBottom: 1 }} />)}
          </div>
        </div>
      </main>
    </>
  );
}
