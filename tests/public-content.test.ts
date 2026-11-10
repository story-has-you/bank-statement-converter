import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { createFormatter, createTranslator } from "next-intl";

import { brandConfig } from "@/config/brand";
import { conversionLimits } from "@/config/conversion";
import { editorialPages } from "@/config/editorial-pages";
import { freeQuotaConfig, subscriptionConfig } from "@/config/plans";
import { publicContentPages, publicPaths } from "@/config/public-pages";
import { getResourceGroups, getResourcePage } from "@/config/resources";
import { getLocalizedAlternates } from "@/i18n/metadata";
import { routing } from "@/i18n/routing";

test("public content resolves translated facts and links in every supported language", () => {
  const values = {
    ...conversionLimits,
    url: brandConfig.url,
    anonymousPages: freeQuotaConfig.anonymous.pages,
    authenticatedPages: freeQuotaConfig.authenticated.pages,
  };
  for (const locale of routing.locales) {
    const messages = JSON.parse(readFileSync(new URL(`../messages/${locale}.json`, import.meta.url), "utf8"));
    const t = createTranslator({ locale, messages, onError(error) { throw error; } });
    const officialAnswer = t("HomeFaq.officialSite.answer", values);
    assert.ok(officialAnswer.includes(brandConfig.url), locale);
    assert.ok(t("Editorial.officialWebsite", values).includes(brandConfig.url), locale);
    for (const page of editorialPages) {
      const prefix = `Editorial.pages.${page.id}`;
      const content = messages.Editorial.pages[page.id];
      for (const key of ["title", "intro", "metaDescription"]) assert.ok(t(`${prefix}.${key}`), `${locale}: ${prefix}.${key}`);
      for (const [i, section] of content.sections.entries()) {
        const text = t(`${prefix}.sections.${i}.text`, values);
        assert.ok(text && !/\{\w+\}/.test(text), `${locale}: ${prefix}.sections.${i}`);
        if (!section.text.includes("{")) assert.equal(text, section.text);
        for (const link of section.links ?? []) {
          assert.ok(publicPaths.includes(link.href), `${locale}: broken link ${link.href}`);
          assert.ok(link.label);
        }
      }
      for (const [i] of content.faq.entries()) {
        assert.ok(t(`${prefix}.faq.${i}.question`));
        assert.ok(!/\{\w+\}/.test(t(`${prefix}.faq.${i}.answer`, values)), `${locale}: ${prefix}.faq.${i}`);
      }
      if (page.id === "about") {
        assert.ok(content.faq.some((item: { answer: string }) => item.answer === messages.HomeFaq.officialSite.answer));
      }
      if (page.kind === "comparison") {
        const competitors = page.id === "alternatives" ? ["docuclipper", "nanonets"] : [page.id];
        for (const id of ["statementxl", ...competitors]) {
          assert.ok(t(`Comparison.names.${id}`));
          for (const row of ["workflow", "processing", "review", "exports", "integration", "pricing"]) {
            assert.ok(t(`Comparison.${id}.${row}`, { price: "USD 9.90", pages: "500" }));
          }
        }
      }
    }
    const resources = getResourceGroups(locale).flatMap((group) => group.pageIds);
    for (const id of ["statementcheap", "flowparse", "capyparse"] as const) {
      const path = `/compare/statementxl-vs-${id}`;
      assert.ok(resources.includes(id), `${locale}: ${id} missing from resource/AI navigation`);
      assert.equal(getResourcePage(id).path, path);
      assert.ok(publicContentPages.some((page) => page.id === id && page.path === path));
      assert.ok(publicPaths.includes(path as (typeof publicPaths)[number]));
      assert.equal(Object.keys(getLocalizedAlternates(path, locale).languages).length, routing.locales.length + 1);
      assert.ok(t(`Resources.links.${id}`));
    }
    const format = createFormatter({ locale });
    const price = format.number(subscriptionConfig.standard.monthlyPrice, { style: "currency", currency: "USD", currencyDisplay: "code" });
    assert.ok(t("Comparison.statementxl.pricing", { price, pages: format.number(subscriptionConfig.standard.pages) }).includes(price));
  }
});
