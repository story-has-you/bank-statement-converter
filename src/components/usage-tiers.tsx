import { useTranslations } from "next-intl";

export function UsageTiers() {
  const t = useTranslations("UsageTiers");

  return (
    <section id="plans" className="border-t border-border" aria-labelledby="plans-title">
      <div className="mx-auto w-full max-w-4xl px-5 py-12 sm:px-8 sm:py-14">
        <div className="flex flex-col gap-2">
          <h2 id="plans-title" className="text-xl font-semibold sm:text-2xl">{t("title")}</h2>
          <p className="text-sm leading-6 text-muted-foreground">
            {t("description")}
          </p>
        </div>
        <div className="mt-7 grid border-y border-border sm:grid-cols-3 sm:divide-x sm:divide-border">
          <div className="flex flex-col gap-3 py-5 sm:pr-6">
            <h3 className="text-sm font-medium text-muted-foreground">{t("anonymous")}</h3>
            <p className="text-3xl font-semibold">{t("anonymousAmount")}<span className="ml-1 text-sm font-normal text-muted-foreground">{t("perDay")}</span></p>
            <p className="text-sm text-muted-foreground">{t("anonymousDescription")}</p>
          </div>
          <div className="flex flex-col gap-3 border-t border-border py-5 sm:border-t-0 sm:px-6">
            <h3 className="text-sm font-medium text-muted-foreground">{t("signedIn")}</h3>
            <p className="text-3xl font-semibold">{t("signedInAmount")}<span className="ml-1 text-sm font-normal text-muted-foreground">{t("perDay")}</span></p>
            <p className="text-sm text-muted-foreground">{t("signedInDescription")}</p>
          </div>
          <div className="flex flex-col gap-3 border-t border-border py-5 sm:border-t-0 sm:pl-6">
            <h3 className="text-sm font-medium text-muted-foreground">{t("subscriber")}</h3>
            <p className="text-2xl font-semibold">{t("subscriberAmount")}</p>
            <p className="text-sm text-muted-foreground">{t("subscriberDescription")}</p>
          </div>
        </div>
      </div>
    </section>
  );
}
