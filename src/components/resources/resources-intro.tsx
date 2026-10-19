import { getTranslations } from "next-intl/server";

export async function ResourcesIntro() {
  const t = await getTranslations("Resources");
  return (
    <header className="mx-auto grid w-full max-w-4xl gap-4 px-5 pb-8 pt-12 sm:px-8">
      <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">{t("title")}</h1>
      <p className="text-base leading-8 text-muted-foreground">{t("intro")}</p>
    </header>
  );
}
