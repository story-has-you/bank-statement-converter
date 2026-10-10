import type { ReactNode } from "react";

import { HomeFooter } from "@/components/shared/home-footer";
import { HomeHeader } from "@/components/shared/home-header";

export function LegalPageLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <HomeHeader />
      <main id="main" className="mx-auto w-full max-w-4xl flex-1 px-5 pb-20 pt-10 sm:px-8 sm:pt-14">
        {children}
      </main>
      <HomeFooter />
    </div>
  );
}
