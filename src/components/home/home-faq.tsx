import { getLocale, getTranslations } from "next-intl/server";

import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import type { AppLocale } from "@/i18n/routing";
import { getHomeFaq } from "@/lib/geo/faq";

export async function HomeFaq() {
  const locale = (await getLocale()) as AppLocale;
  const [t, questions] = await Promise.all([getTranslations({ locale, namespace: "HomeFaq" }), getHomeFaq(locale)]);

  return (
    <section id="faq" className="border-t border-border bg-muted/35" aria-labelledby="faq-title">
      <div className="mx-auto w-full max-w-4xl px-5 py-12 sm:px-8 sm:py-14">
        <h2 id="faq-title" className="text-xl font-semibold sm:text-2xl">
          {t("title")}
        </h2>
        <Accordion defaultValue={["quota"]} className="mt-5 border-t border-border">
          {questions.map((item) => (
            <AccordionItem key={item.id} value={item.id}>
              <AccordionTrigger className="py-4">{item.question}</AccordionTrigger>
              <AccordionContent keepMounted className="leading-6 text-muted-foreground">
                {item.answer}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </section>
  );
}
