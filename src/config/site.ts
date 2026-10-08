const domain = "bankstatementconverter.xyz";
const contactEmail = "fangxi.inori@gmail.com";
const subscriptionPrices = {
  standard: "$19.9",
  professional: "$49.9",
  enterprise: "$79.9",
} as const;

export const siteConfig = {
  domain,
  contactEmail,
  subscriptionPrices,
  url: `https://${domain}`,
  contactHref: `mailto:${contactEmail}`,
} as const;
