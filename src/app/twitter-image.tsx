import { ImageResponse } from "next/og";

export const alt = "ASC Studio — App Store Connect screenshots, designed in your browser";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: 80,
          background: "linear-gradient(135deg, #f4f8f7 0%, #d9ebe8 100%)",
          color: "#12202a",
        }}
      >
        <div style={{ fontSize: 34, color: "#0f766e", fontWeight: 600 }}>ASC Studio</div>
        <div style={{ fontSize: 72, fontWeight: 700, lineHeight: 1.05, marginTop: 20, maxWidth: 900 }}>
          App Store screenshots, designed in your browser.
        </div>
        <div style={{ fontSize: 30, color: "#5b6b72", marginTop: 28 }}>
          Every ASC size · Real device frames · Dual layouts · AI copy
        </div>
      </div>
    ),
    size,
  );
}
