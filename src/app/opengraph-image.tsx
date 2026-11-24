import { ImageResponse } from "next/og";

/** Link preview for Slack/Discord/etc. Rendered once at build time. */
export const alt = "LILA BLACK Player Journeys: telemetry explorer for level design";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const STATS = [
  ["796", "matches"],
  ["89k", "events"],
  ["3", "maps"],
  ["5", "days"],
] as const;

export default function OpengraphImage() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        background: "#0b0d10",
        color: "#e6e8eb",
        padding: 72,
        fontFamily: "sans-serif",
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
        <div style={{ display: "flex", fontSize: 30, letterSpacing: 8, fontWeight: 700 }}>
          LILA BLACK
        </div>
        <div style={{ display: "flex", fontSize: 76, fontWeight: 700, marginTop: 18 }}>
          Player Journeys
        </div>
        <div style={{ display: "flex", fontSize: 30, color: "#8b93a1", marginTop: 22, width: 620 }}>
          Replay matches, see where players loot, fight and die to the storm, and share any view as
          a link.
        </div>
        <div style={{ display: "flex", marginTop: "auto", gap: 44 }}>
          {STATS.map(([value, label]) => (
            <div key={label} style={{ display: "flex", flexDirection: "column" }}>
              <div style={{ display: "flex", fontSize: 54, fontWeight: 700, color: "#f5b83d" }}>
                {value}
              </div>
              <div style={{ display: "flex", fontSize: 24, color: "#8b93a1" }}>{label}</div>
            </div>
          ))}
        </div>
      </div>
      <svg width="380" height="486" viewBox="0 0 380 486">
        <rect width="380" height="486" rx="28" fill="#12151a" stroke="#252b35" strokeWidth="3" />
        <path
          d="M60 420 C 110 360, 120 330, 170 300 S 250 220, 230 160 S 290 90, 320 70"
          fill="none"
          stroke="#0b0d10"
          strokeWidth="14"
          strokeLinecap="round"
        />
        <path
          d="M60 420 C 110 360, 120 330, 170 300 S 250 220, 230 160 S 290 90, 320 70"
          fill="none"
          stroke="#3987e5"
          strokeWidth="8"
          strokeLinecap="round"
        />
        <path
          d="M70 120 C 120 150, 150 120, 190 170 S 260 260, 300 300"
          fill="none"
          stroke="#d6d5cf"
          strokeWidth="5"
          strokeDasharray="14 10"
          strokeLinecap="round"
        />
        <circle cx="60" cy="420" r="11" fill="#0b0d10" stroke="#3987e5" strokeWidth="5" />
        <polygon points="170,272 194,314 146,314" fill="#e66767" stroke="#0b0d10" strokeWidth="4" />
        <polygon
          points="300,280 322,302 300,324 278,302"
          fill="#9085e9"
          stroke="#0b0d10"
          strokeWidth="4"
        />
        <circle cx="232" cy="162" r="9" fill="#eda100" stroke="#0b0d10" strokeWidth="3" />
        <circle cx="320" cy="70" r="16" fill="none" stroke="#3987e5" strokeWidth="6" />
      </svg>
    </div>,
    size,
  );
}
