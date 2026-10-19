import { HeaderShell } from "../components/shell";
import { LoadingNote, Skeleton } from "../components/skeleton";

export default function Loading() {
  return (
    <>
      <HeaderShell active="home" />
      <main id="main-content" className="dir-page">
        <LoadingNote />
        <Skeleton height={46} width="80%" style={{ marginBottom: 16 }} />
        <Skeleton height={16} width="64%" style={{ marginBottom: 30 }} />
        <Skeleton height={52} style={{ marginBottom: 12 }} />
        <Skeleton height={40} style={{ marginBottom: 14 }} />
        {[0, 1, 2, 3, 4].map((slot) => <Skeleton key={slot} height={92} style={{ borderRadius: 14, marginBottom: 8 }} />)}
      </main>
    </>
  );
}
