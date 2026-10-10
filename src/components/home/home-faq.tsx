import { useTranslations } from "next-intl";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { usageQuotaConfig } from "@/lib/usage/config";

const questionIds = ["banks", "accuracy", "quota", "scans", "storage", "failure"] as const;

export function HomeFaq() {
  const t = useTranslations("HomeFaq");

  return (
    <section id="faq" className="border-t border-border bg-muted/35" aria-labelledby="faq-title">
      <div className="mx-auto w-full max-w-4xl px-5 py-12 sm:px-8 sm:py-14">
        <h2 id="faq-title" className="text-xl font-semibold sm:text-2xl">{t("title")}</h2>
        <Accordion defaultValue={["quota"]} className="mt-5 border-t border-border">
          {questionIds.map((id) => (
            <AccordionItem key={id} value={id}>
              <AccordionTrigger className="py-4">{t(`${id}.question`)}</AccordionTrigger>
              <AccordionContent className="leading-6 text-muted-foreground">
                {id === "quota"
                  ? t("quota.answer", {
                      anonymousPages: usageQuotaConfig.anonymous.pages,
                      authenticatedPages: usageQuotaConfig.authenticated.pages,
                      standardPages: usageQuotaConfig.subscriptions.standard.pages,
                      professionalPages: usageQuotaConfig.subscriptions.professional.pages,
                      enterprisePages: usageQuotaConfig.subscriptions.enterprise.pages,
                    })
                  : t(`${id}.answer`)}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </section>
  );
}
