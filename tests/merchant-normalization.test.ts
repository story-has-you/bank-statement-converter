import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { createTranslator } from "next-intl";

import { routing } from "@/i18n/routing";
import { isParseResponse } from "@/lib/conversion-types";
import { getMerchantAliases, getMerchantMappingCounts, isMerchantNormalization } from "@/lib/merchant-normalization";
import { createMerchantFixture } from "./fixtures/merchant-normalization";

test("whole-file impact counts per-table mappings and repeated transactions beyond the first alias page", () => {
  const { result, merchantNormalization: normalization = {} } = createMerchantFixture();
  assert.equal(isParseResponse(result), true);
  assert.equal(isMerchantNormalization(normalization, result), true);
  assert.ok(getMerchantAliases(result, normalization).length > 50);
  const before = structuredClone({ result, normalization });
  assert.deepEqual(getMerchantMappingCounts(result, normalization), { mappings: 4, rows: 5 });
  assert.deepEqual({ result, normalization }, before);
});

test("a shared alias that is unconfirmed in one table does not inflate the affected transaction count", () => {
  const { result, merchantNormalization: normalization = {} } = createMerchantFixture();
  delete normalization["table-2"].aliases.Shared;
  assert.deepEqual(getMerchantMappingCounts(result, normalization), { mappings: 3, rows: 4 });
});

test("retained mappings with no matching transaction still count as mappings being removed", () => {
  const { result, merchantNormalization: normalization = {} } = createMerchantFixture();
  normalization["table-2"].aliases["No matching transaction"] = "Saved name";
  assert.deepEqual(getMerchantMappingCounts(result, normalization), { mappings: 5, rows: 5 });
});

test("missing or empty mappings have no impact and inherited names are not confirmed transactions", () => {
  const { result, merchantNormalization: normalization = {} } = createMerchantFixture();
  assert.deepEqual(getMerchantMappingCounts(result, {}), { mappings: 0, rows: 0 });
  for (const table of Object.values(normalization)) {
    table.aliases = {};
  }
  result.tables[0].rows[0].values.description = "constructor";
  assert.deepEqual(getMerchantMappingCounts(result, normalization), { mappings: 0, rows: 0 });
  Object.assign(normalization["table-1"].aliases, { ["constructor"]: "Confirmed literal name" });
  assert.deepEqual(getMerchantMappingCounts(result, normalization), { mappings: 1, rows: 1 });
});

test("clear confirmation and the three distinct actions have valid translations in every locale", () => {
  const directory = new URL("../messages/", import.meta.url);
  for (const locale of routing.locales) {
    const messages = JSON.parse(readFileSync(new URL(`${locale}.json`, directory), "utf8"));
    const t = createTranslator({
      locale,
      messages,
      namespace: "ConversionResult.merchant",
      onError: (error) => {
        throw error;
      },
    });
    const actions = ["clearSelection", "removeSelected", "clearAll"].map((key) => t(key));
    assert.equal(new Set(actions).size, 3, locale);
    for (const key of ["clearAllTitle", "clearAllCancel", "clearAllConfirm"]) {
      assert.ok(t(key).length > 0, `${locale}: ${key}`);
    }
    const description = t("clearAllDescription", { mappings: 17, rows: 23 });
    assert.ok(description.includes("17") && description.includes("23"), locale);
  }
});
