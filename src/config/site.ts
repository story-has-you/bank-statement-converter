import { conversionLimits } from "@/config/conversion";

const environment = process.env.NODE_ENV === "production" ? process.env.NEXT_PUBLIC_APP_ENV : "development";
let url = "http://localhost:3000";
if (environment === "preview") {
  url = "https://statementxl-preview.reavid.workers.dev";
} else if (environment === "production") {
  url = "https://bankstatementconverter.xyz";
}
const domain = new URL(url).host;
const contactEmail = "support@mail.bankstatementconverter.xyz";

export const siteConfig = { domain, contactEmail, conversionLimits, url, contactHref: `mailto:${contactEmail}` } as const;
