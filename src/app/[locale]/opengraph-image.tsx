import { ImageResponse } from "next/og";
import { getTranslations } from "next-intl/server";

import { brandConfig } from "@/config/brand";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export async function generateImageMetadata() {
  const t = await getTranslations({ locale: "en", namespace: "SocialImage" });
  return [{ id: "statementxl.png", alt: t("alt"), size, contentType }];
}

export default async function Image() {
  const t = await getTranslations({ locale: "en", namespace: "SocialImage" });

  return new ImageResponse(
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        width: "100%",
        height: "100%",
        padding: "64px 76px",
        background: "#faf7f2",
        color: "#282327",
        borderLeft: "18px solid #8e3438",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
        <div style={{ width: 28, height: 64, borderRadius: 8, background: "#8e3438" }} />
        <div style={{ fontSize: 72, fontWeight: 700, letterSpacing: -3 }}>{brandConfig.name}</div>
      </div>
      <div style={{ display: "flex", fontSize: 66, fontWeight: 700, lineHeight: 1.15, maxWidth: 980 }}>{t("tagline")}</div>
      <div style={{ display: "flex", borderTop: "2px solid #dfd6ce", paddingTop: 28, fontSize: 26, color: "#8e3438" }}>
        {new URL(brandConfig.url).host}
      </div>
    </div>,
    { ...size },
  );
}
