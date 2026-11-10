import { HeaderShell } from "../../../components/shell";
import { PageScrollTop } from "../../../components/project-scroll-top";
import { LoadingNote, Skeleton } from "../../../components/skeleton";

/** A profile's skeleton keeps the identity-to-project hierarchy stable while loading. */
export default function Loading() {
  return (
    <>
      <PageScrollTop />
      <HeaderShell />
      <section className="profile-band">
        <div className="profile-band-inner profile-hero">
          <div className="profile-hero-top">
            <div>
              <Skeleton height={11} width={170} style={{ marginBottom: 18, opacity: .35 }} />
              <Skeleton height={60} width={340} style={{ marginBottom: 18, opacity: .35 }} />
              <Skeleton height={12} width={150} style={{ marginBottom: 12, opacity: .35 }} />
              <Skeleton height={19} width={420} style={{ marginBottom: 28, opacity: .35 }} />
              <Skeleton height={34} width={260} style={{ opacity: .35 }} />
            </div>
            <aside className="profile-contributions">
              <Skeleton height={10} width={110} style={{ marginBottom: 14, opacity: .35 }} />
              <div className="profile-project-icon-list">
                {[0, 1, 2, 3, 4].map((slot) => (
                  <Skeleton height={42} width={42} key={slot} style={{ borderRadius: 10, opacity: .35 }} />
                ))}
              </div>
            </aside>
          </div>
          <section className="profile-summary">
            <div>
              <Skeleton height={10} width={92} style={{ marginBottom: 14, opacity: .35 }} />
              <Skeleton height={13} style={{ marginBottom: 9, opacity: .35 }} />
              <Skeleton height={13} width="78%" style={{ opacity: .35 }} />
            </div>
            <div>
              <Skeleton height={26} width="76%" style={{ marginBottom: 17, opacity: .35 }} />
              <Skeleton height={42} style={{ opacity: .35 }} />
            </div>
          </section>
        </div>
      </section>
      <main id="main-content" className="profile-page">
        <LoadingNote />
        <div className="profile-content">
          <Skeleton height={22} width={180} style={{ marginBottom: 20 }} />
          <div className="profile-project-grid">
            {[0, 1].map((slot) => (
              <div className="skeleton-card profile-project-skeleton" key={slot}>
                <Skeleton height={62} width={62} style={{ borderRadius: 12, marginBottom: 20 }} />
                <Skeleton height={22} width="70%" style={{ marginBottom: 12 }} />
                <Skeleton height={14} style={{ marginBottom: 8 }} />
                <Skeleton height={14} width="70%" style={{ marginBottom: 22 }} />
                <Skeleton height={12} width={92} style={{ marginBottom: 8 }} />
                <Skeleton height={13} style={{ marginBottom: 6 }} />
                <Skeleton height={13} width="80%" />
              </div>
            ))}
          </div>
        </div>
      </main>
    </>
  );
}
