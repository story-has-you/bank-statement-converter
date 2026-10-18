import Image from "next/image";
import { useTranslations } from "next-intl";

export function FooterLaunchLinks() {
  const t = useTranslations("HomeFooter");

  return (
    <div className="flex w-fit max-w-1/2 shrink-0 items-center gap-3">
      <a
        className="min-w-0 rounded-md transition-opacity hover:opacity-80 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
        href="https://tinylaunch.com"
        target="_blank"
        rel="noopener noreferrer"
      >
        <Image
          className="h-auto w-56 max-w-full dark:invert"
          src="/tinylaunch-launching-soon.svg"
          width={250}
          height={54}
          alt={t("tinyLaunchBadge")}
        />
      </a>
      <a
        className="min-w-0 rounded-md transition-opacity hover:opacity-80 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
        href="https://www.producthunt.com/products/statementxl?embed=true&utm_source=badge-featured&utm_medium=badge&utm_campaign=badge-statementxl"
        target="_blank"
        rel="noopener noreferrer"
      >
        <Image
          className="h-auto w-56 max-w-full dark:hidden"
          src="https://api.producthunt.com/widgets/embed-image/v1/featured.svg?post_id=1279950&theme=light"
          width={250}
          height={54}
          alt={t("productHuntBadge")}
          unoptimized
        />
        <Image
          className="hidden h-auto w-56 max-w-full dark:block"
          src="https://api.producthunt.com/widgets/embed-image/v1/featured.svg?post_id=1279950&theme=dark"
          width={250}
          height={54}
          alt={t("productHuntBadge")}
          unoptimized
        />
      </a>
    </div>
  );
}
