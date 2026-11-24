import { ClerkProvider } from "@clerk/nextjs";
import { deDE, enUS, esES, frFR, hiIN, idID, itIT, jaJP, koKR, nlNL, ptBR, zhCN } from "@clerk/localizations";
import { shadcn } from "@clerk/ui/themes";
import { GoogleAnalytics } from "@next/third-parties/google";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Geist_Mono, Inter, Newsreader, Noto_Serif_SC } from "next/font/google";
import Script from "next/script";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import { getMessages, getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";

import { OrganizationStructuredData } from "@/components/shared/organization-structured-data";
import { PublicAccountProvider } from "@/components/account/public-account-provider";
import { ConversionProvider } from "@/components/conversion/conversion-provider";
import { ThemeProvider } from "@/components/shared/theme-provider";
import { TooltipProvider } from "@/components/ui/tooltip";
import { routing, type AppLocale } from "@/i18n/routing";
import { getLocalizedPath } from "@/i18n/metadata";
import { analyticsMeasurementId, analyticsTestMode } from "@/config/analytics";
import { siteConfig } from "@/config/site";
import "../globals.css";
import "@clerk/ui/themes/shadcn.css";

const inter = Inter({ variable: "--font-body", subsets: ["latin"] });
const newsreader = Newsreader({ variable: "--font-editorial", subsets: ["latin"] });
const notoSerif = Noto_Serif_SC({ variable: "--font-editorial-cjk", weight: ["500", "600"], preload: false });

const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

const clerkLocales = {
  en: enUS, "zh-CN": zhCN, ja: jaJP, ko: koKR, de: deDE, fr: frFR,
  es: esES, "pt-BR": ptBR, it: itIT, nl: nlNL, hi: hiIN, id: idID,
} satisfies Record<AppLocale, typeof enUS>;

type LocaleLayoutProps = { children: ReactNode; params: Promise<{ locale: string }> };

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Metadata");
  return {
    verification: {
      google: process.env.GOOGLE_SITE_VERIFICATION,
      other: process.env.BING_SITE_VERIFICATION ? { "msvalidate.01": process.env.BING_SITE_VERIFICATION } : {},
    },
    metadataBase: new URL(siteConfig.url),
    title: t("title"),
    description: t("description"),
    twitter: { card: "summary_large_image" },
  };
}

export default async function RootLayout({ children, params }: LocaleLayoutProps) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  const { LanguageSwitcher, AuthControl, ThemeToggle, ConversionResult, ApiErrors } = await getMessages();

  return (
    <html
      lang={locale}
      className={`${inter.variable} ${newsreader.variable} ${notoSerif.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col">
        <ClerkProvider
          appearance={{ theme: shadcn }}
          localization={clerkLocales[locale]}
          signInUrl={getLocalizedPath(locale, "/sign-in")}
          signUpUrl={getLocalizedPath(locale, "/sign-up")}
          afterSignOutUrl={getLocalizedPath(locale, "/")}
        >
          <OrganizationStructuredData />
          <NextIntlClientProvider
            messages={{ LanguageSwitcher, AuthControl, ThemeToggle, ConversionResult: { stream: ConversionResult.stream }, ApiErrors }}
          >
            <ThemeProvider>
              <TooltipProvider>
                <PublicAccountProvider>
                  <ConversionProvider>{children}</ConversionProvider>
                </PublicAccountProvider>
              </TooltipProvider>
            </ThemeProvider>
          </NextIntlClientProvider>
        </ClerkProvider>
      </body>
      {process.env.NEXT_PUBLIC_APP_ENV === "production" && (
        <Script src="https://app.pageview.app/js/script.js" data-domain="bankstatementconverter.xyz" strategy="afterInteractive" />
      )}
      {analyticsMeasurementId && <GoogleAnalytics gaId={analyticsMeasurementId} debugMode={analyticsTestMode} />}
    </html>
  );
}
