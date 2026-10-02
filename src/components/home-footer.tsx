import { useTranslations } from "next-intl";

export function HomeFooter() {
  const t = useTranslations("HomeFooter");

  return (
    <footer className="border-t border-border px-5 py-5 text-xs text-muted-foreground">
      <div className="mx-auto flex w-full max-w-4xl items-center justify-between gap-4">
        <span>{t("brand")}</span>
        <div className="flex items-center gap-4">
          <a className="hover:text-foreground" href="#plans">{t("plans")}</a>
          <a className="hover:text-foreground" href="#faq">{t("faq")}</a>
        </div>
      </div>
    </footer>
  );
}
