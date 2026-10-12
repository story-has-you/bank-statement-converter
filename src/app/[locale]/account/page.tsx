import { Suspense } from "react";

import { AccountContent } from "@/components/account/account-content";
import { AccountLoading } from "@/components/account/account-loading";
import { HomeFooter } from "@/components/shared/home-footer";
import { HomeHeader } from "@/components/shared/home-header";

export { generateMetadata } from "@/lib/account/metadata";

export default function AccountPage() {
  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <HomeHeader />
      <main id="main" className="mx-auto w-full max-w-6xl flex-1 px-5 py-10 sm:px-8 sm:py-14">
        <Suspense fallback={<AccountLoading />}>
          <AccountContent />
        </Suspense>
      </main>
      <HomeFooter />
    </div>
  );
}
