import { HomeHeader } from "@/components/shared/home-header";
import { HomeFooter } from "@/components/shared/home-footer";
import { ResourcesIntro } from "@/components/resources/resources-intro";
import { ResourceDirectory } from "@/components/resources/resource-directory";
import { ResourcesStructuredData } from "@/components/resources/resources-structured-data";

export function ResourcesPage() {
  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <ResourcesStructuredData />
      <HomeHeader />
      <main id="main" className="flex-1">
        <ResourcesIntro />
        <ResourceDirectory />
      </main>
      <HomeFooter />
    </div>
  );
}
