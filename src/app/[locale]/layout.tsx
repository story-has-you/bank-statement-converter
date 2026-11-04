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
import { routing } from "@/i18n/routing";
import { siteConfig } from "@/config/site";
import { brandConfig } from "@/config/brand";
import "../globals.css";

const inter = Inter({ variable: "--font-body", subsets: ["latin"] });
const newsreader = Newsreader({ variable: "--font-editorial", subsets: ["latin"] });
const notoSerif = Noto_Serif_SC({ variable: "--font-editorial-cjk", weight: ["500", "600"], preload: false });

const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

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
    openGraph: { images: [brandConfig.socialImage] },
    twitter: { card: "summary_large_image", images: [brandConfig.socialImage] },
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
      </body>
      {process.env.NODE_ENV === "production" && (
        <Script src="https://app.pageview.app/js/script.js" data-domain="bankstatementconverter.xyz" strategy="afterInteractive" />
      )}
      <GoogleAnalytics gaId="G-93LC8N8C85" />
    </html>
  );
}
