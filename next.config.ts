import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";
import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const appEnvironment = process.env.NEXT_PUBLIC_APP_ENV ?? "development";
const nextConfig: NextConfig = {
  env: { NEXT_PUBLIC_APP_ENV: appEnvironment },
  reactCompiler: true,
  async headers() {
    return appEnvironment === "preview"
      ? [{ source: "/:path*", headers: [{ key: "X-Robots-Tag", value: "noindex" }] }]
      : [];
  },
};

export default createNextIntlPlugin()(nextConfig);

initOpenNextCloudflareForDev();
