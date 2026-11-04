import { getLocale, getTranslations } from "next-intl/server";

import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import type { AppLocale } from "@/i18n/routing";
import { getHomeFaq } from "@/lib/geo/faq";

export async function HomeFaq() {
  const locale = (await getLocale()) as AppLocale;
  const [t, questions] = await Promise.all([getTranslations({ locale, namespace: "HomeFaq" }), getHomeFaq(locale)]);

  return (
    <section id="faq" className="border-t border-border bg-muted/50" aria-labelledby="faq-title">
      <div className="mx-auto grid w-full max-w-7xl gap-8 px-5 py-12 sm:px-8 sm:py-16 lg:grid-cols-[minmax(0,0.7fr)_minmax(0,1.3fr)] lg:gap-16">
        <h2 id="faq-title" className="font-heading text-3xl font-medium sm:text-4xl">
          {t("title")}
        </h2>
        <Accordion className="border-t border-foreground/50">
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
