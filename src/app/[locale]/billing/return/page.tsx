import { HomeHeader } from "@/components/shared/home-header";
import { HomeFooter } from "@/components/shared/home-footer";
import { BillingReturnContent } from "@/components/billing/return-content";

export { generateMetadata } from "@/lib/billing/metadata";
export default function BillingReturnPage() {
  return <div className="flex min-h-screen flex-col"><HomeHeader /><main id="main" className="flex-1"><BillingReturnContent /></main><HomeFooter /></div>;
}
