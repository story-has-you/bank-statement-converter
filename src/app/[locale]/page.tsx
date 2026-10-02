import { HomeFaq } from "@/components/home-faq";
import { HomeFeatures } from "@/components/home-features";
import { HomeFooter } from "@/components/home-footer";
import { HomeHeader } from "@/components/home-header";
import { HomeIntro } from "@/components/home-intro";
import { PdfUpload } from "@/components/pdf-upload";
import { UsageTiers } from "@/components/usage-tiers";

export default function HomePage() {
  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <HomeHeader />

      <main id="main" className="flex-1">
        <section className="mx-auto w-full max-w-4xl px-5 pb-16 pt-10 sm:px-8 sm:pb-8 sm:pt-8">
          <HomeIntro />
          <PdfUpload />
        </section>

        <HomeFeatures />
        <UsageTiers />
        <HomeFaq />
      </main>

      <HomeFooter />
    </div>
  );
}
