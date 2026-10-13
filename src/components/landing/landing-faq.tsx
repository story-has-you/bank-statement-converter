import { getTranslations } from "next-intl/server";

import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import type { LandingContent } from "@/lib/seo/landing-content";

export async function LandingFaq({ content }: { content: LandingContent }) {
  const t = await getTranslations("HomeFaq");
  return (
    <section id="faq" className="border-t border-border bg-muted/35" aria-labelledby="landing-faq-title">
      <div className="mx-auto w-full max-w-4xl px-5 py-12 sm:px-8">
        <h2 id="landing-faq-title" className="text-xl font-semibold">
          {t("title")}
        </h2>
        <Accordion className="mt-5 border-t border-border">
          {content.faq.map((item) => (
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
