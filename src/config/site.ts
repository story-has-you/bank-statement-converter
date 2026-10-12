import { conversionLimits } from "@/config/conversion";

const environment = process.env.NODE_ENV === "production" ? process.env.NEXT_PUBLIC_VERCEL_ENV : "development";
let url = "http://localhost:3000";
if (environment === "preview") {
  url = "https://preview.bankstatementconverter.xyz";
} else if (environment === "production") {
  url = "https://bankstatementconverter.xyz";
}
const domain = new URL(url).host;
const contactEmail = "support@bankstatementconverter.xyz";

export const siteConfig = { domain, contactEmail, conversionLimits, url, contactHref: `mailto:${contactEmail}` } as const;
