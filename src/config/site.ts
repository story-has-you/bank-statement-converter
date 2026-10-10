const environment = process.env.NODE_ENV === "production" ? process.env.NEXT_PUBLIC_VERCEL_ENV : "development";
let url = "http://localhost:3000";
if (environment === "preview") {
  url = "https://preview.bankstatementconverter.xyz";
} else if (environment === "production") {
  url = "https://bankstatementconverter.xyz";
}
const domain = new URL(url).host;
const contactEmail = "support@bankstatementconverter.xyz";
const subscriptionPrices = {
  standard: 19.9,
  professional: 49.9,
  enterprise: 79.9,
} as const;

export const siteConfig = {
  domain,
  contactEmail,
  subscriptionPrices,
  conversionLimits: { megabytes: 4, pages: 50 },
  url,
  contactHref: `mailto:${contactEmail}`,
} as const;
