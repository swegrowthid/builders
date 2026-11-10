import { ImageResponse } from "next/og";
import { requestLocale } from "../lib/locale-server";
import { tx } from "../lib/locale";
import { isOss, site } from "../lib/site";

export const alt = site.name;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OpenGraphImage() {
  const locale = await requestLocale();
  return new ImageResponse(
    <div
      style={{
        alignItems: "stretch",
        background: "#f3f6f4",
        color: "#173d32",
        display: "flex",
        fontFamily: "Arial, sans-serif",
        height: "100%",
        overflow: "hidden",
        padding: "68px 76px",
        position: "relative",
        width: "100%",
      }}
    >
      <div
        style={{
          border: "1px solid rgba(23, 61, 50, .1)",
          borderRadius: "50%",
          display: "flex",
          height: 330,
          position: "absolute",
          right: -70,
          top: -80,
          width: 330,
        }}
      />
      <div
        style={{
          border: "1px solid rgba(241, 104, 75, .14)",
          borderRadius: "50%",
          bottom: -80,
          display: "flex",
          height: 210,
          left: -45,
          position: "absolute",
          width: 210,
        }}
      />

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          position: "relative",
          width: "100%",
        }}
      >
        <div style={{ alignItems: "center", display: "flex", gap: 18 }}>
          <div
            style={{
              alignItems: "center",
              background: "#173d32",
              borderRadius: 15,
              display: "flex",
              height: 62,
              justifyContent: "center",
              width: 62,
            }}
          >
            {/* The same mark as the favicon: a pull request on the open source site. */}
            {isOss ? (
              <svg width="44" height="44" viewBox="-1 -1 26 26" fill="none">
                <g stroke="#f3f0e8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="6" cy="6" r="2.5" />
                  <circle cx="6" cy="18" r="2.5" />
                  <circle cx="18" cy="18" r="2.5" />
                  <path d="M6 8.5v7M18 15.5V10a3 3 0 0 0-3-3h-4M13 4.5 10.5 7 13 9.5" />
                </g>
              </svg>
            ) : (
              <svg width="44" height="44" viewBox="0 0 40 40" fill="none">
                <g transform="translate(20 20.6) scale(.74) translate(-20 -20)">
                  <path
                    d="M6.8 32C7.6 28 8 24.6 9.4 21.2 11 17 17.2 14.6 20 7.6 22.8 14.6 29 17 30.6 21.2 32 24.6 32.4 28 33.2 32"
                    stroke="#f3f0e8"
                    strokeWidth="3.4"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </g>
              </svg>
            )}
          </div>
          <div style={{ display: "flex", fontSize: 32, fontWeight: 800, letterSpacing: "-1.5px" }}>
            {site.id}<span style={{ color: "#315f51", display: "flex", fontWeight: 650 }}>.swegrowth</span>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <div
            style={{
              color: "#ef684b",
              display: "flex",
              fontSize: 18,
              fontWeight: 800,
              letterSpacing: "4px",
              textTransform: "uppercase",
            }}
          >
            {isOss ? tx(locale, "Kontribusi open source, bareng-bareng", "Open source contribution, together") : tx(locale, "Indeks publik untuk karya nyata", "A public index of real work")}
          </div>
          <div
            style={{
              display: "flex",
              fontSize: 70,
              fontWeight: 800,
              letterSpacing: "-4px",
              lineHeight: 1.02,
              maxWidth: 960,
            }}
          >
            {isOss ? tx(locale, "Temukan repo yang nerima kontributor. Kirim PR. Biar kelihatan.", "Find repos that take contributors. Send a PR. Let it be seen.") : tx(locale, "Tampilkan karyamu. Bangun portofolio. Jadilah mudah ditemukan.", "Show your work. Build your portfolio. Get discovered.")}
          </div>
        </div>

        <div style={{ color: "#667970", display: "flex", fontSize: 22 }}>{site.url.replace(/^https?:\/\//, "")}</div>
      </div>
    </div>,
    size,
  );
}
