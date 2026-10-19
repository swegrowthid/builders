import { HeaderShell } from "../components/shell";
import { LoadingNote, Skeleton } from "../components/skeleton";

export default function Loading() {
  return (
    <>
      <HeaderShell active="home" />
      <main id="main-content" className="landing-page oss-home">
        <LoadingNote />

        <section className="landing-hero oss-hero">
          <div className="landing-hero-copy">
            <Skeleton height={11} width={230} style={{ marginBottom: 20 }} />
            <Skeleton height={63} width="94%" style={{ marginBottom: 11 }} />
            <Skeleton height={63} width="78%" style={{ marginBottom: 27 }} />
            <Skeleton height={15} width="88%" style={{ marginBottom: 10 }} />
            <Skeleton height={15} width="72%" />
            <div className="home-hero-actions">
              <Skeleton height={50} width={240} />
              <Skeleton height={50} width={240} />
            </div>
          </div>
        </section>

        <section className="oss-section">
          <Skeleton height={11} width={190} style={{ marginBottom: 18 }} />
          <Skeleton height={48} width="64%" style={{ marginBottom: 30 }} />
          <div className="oss-grid">
            {[0, 1, 2].map((slot) => <Skeleton key={slot} height={320} style={{ borderRadius: 20 }} />)}
          </div>
        </section>
      </main>
    </>
  );
}
