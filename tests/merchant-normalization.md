# Merchant mapping clear safeguards

Issue: [#53](https://github.com/story-has-you/bank-statement-converter/issues/53).

The panel uses a confirmation dialog before clearing the entire file. There is
no undo snapshot or edit history. Cancelling the dialog, including Escape,
does not call the workspace update handler or change the current selection,
search, page, or name input. Initial focus is on **Keep mappings**.

The impact count is the sum of saved mapping entries in every table, including
entries outside the current search/page. The same source text mapped in two
tables counts twice. Affected transactions count only rows with a confirmed
mapping in their own table; an unconfirmed occurrence in another table does
not count. A retained mapping without a matching row counts as one mapping and
zero transactions.

The three actions have different effects:

| Action                   | Selection                             | Saved mappings                              |
| ------------------------ | ------------------------------------- | ------------------------------------------- |
| Clear selection          | Cleared                               | Kept                                        |
| Remove selected mappings | Cleared                               | Selected source names removed               |
| Clear all file mappings  | Kept until confirmation, then cleared | Every table cleared only after confirmation |

## Automated regression checks

```bash
pnpm test:merchants
pnpm test:exports
pnpm exec tsc --noEmit
pnpm lint
pnpm build
```

The merchant suite and export suite also run in GitHub Actions. Merchant tests
cover cross-table counts, repeated transactions, aliases beyond the first
page, partially confirmed shared names, retained mappings without rows,
empty mappings, prototype-property source names, and all supported locales.

## Browser acceptance

Recorded on 2026-10-20 with Chromium 141.0.7390.37 against the production
build, using only the synthetic `createMerchantFixture()` in
`tests/fixtures/merchant-normalization.ts`:

1. Put the fixture into session storage under
   `bank-statement-converter:conversion-result` and open `/zh-CN/result`.
   There are two tables, 56 transactions, 54 distinct source names, four saved
   mappings and five affected transactions. The two tables use different
   source columns and include extraction risk flags.
2. Select `Shared`, enter an unapplied name and move to the second alias page.
   The clear dialog reports **4 mappings / 5 transactions**. Opening and
   cancelling do not change session storage, selection or the name input.
   Escape also cancels; focus returns to the trigger.
3. Clear selection and verify every saved mapping remains. Search for a value
   with no matches; the clear dialog still reports **4 / 5**.
4. Search for `Merchant 51` and remove its mapping. Only that mapping is
   deleted. A subsequent whole-file confirmation reports **3 / 4**.
5. At 1440 px desktop and 390 px mobile widths, verify that the entire dialog,
   description and both actions fit the viewport. Confirm clearing while
   filtering to `Other`. Both tables' aliases become empty, their source
   columns remain selected, the selection clears and the trigger is disabled.
6. Compare the stored result before and after clearing. Original transaction
   values, extraction risks and source positions are identical. Reload:
   mappings stay cleared and the dialog is closed.
7. Download real XLSX and JSON files. Read the workbook back and verify both
   logical tables, source text and `DISCREPANCY` flags remain. JSON equals the
   original parse result after clearing. Cleared merchant names are absent
   from the workbook.
8. Reset via **Convert again** and accept leaving. Session storage is cleared.
   Load a new synthetic result: the dialog starts closed and reports its own
   **4 / 5** mappings and transactions. No browser runtime errors occur.

All checks above passed. No production conversion or real statement was used.

## Hidden selection acceptance — Issue #52

Issue: [#52](https://github.com/story-has-you/bank-statement-converter/issues/52).
The implementation was already merged: fix `cae4aff`, merge `2e52abd`.
Revalidated on 2026-10-21 (Asia/Shanghai), at `master` commit `fe422f0`,
using the existing local Next.js development server on port 3000 and
Chromium 156.0.0.0 through agent-browser 0.39.1. No application code changes
were needed.

Use the same `createMerchantFixture()` and session storage key described
above. These checks exercise the real result page at `/zh-CN/result` and
`/result`, without PDF uploads, model calls or production conversions.

| Scenario                             | Observed result                                                                                                                                                                                                                                                                                |
| ------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Select `Shared`, then search `Other` | Total: one selected name / three transactions. Hidden: one name / three transactions. The expanded selected list shows `Shared`, both existing names and both source tables.                                                                                                                   |
| Keyboard controls                    | Enter opens the selected list; Space closes it. Focusing **Clear selection** and pressing Enter clears the selection. Search `Other`, unapplied name `UNAPPLIED NAME` and the complete stored payload remain unchanged.                                                                        |
| Cross-page selection                 | Select `Shared` on page one and `Merchant 51` on page two: total two names / four transactions. Hidden scope is one name / three transactions on page two, and one name / one transaction on page one.                                                                                         |
| No search matches                    | Search `DOES_NOT_EXIST`: total and hidden scope both remain two names / four transactions. The selected list still contains both names and confirmation stays enabled. Clearing the search restores page one with `Shared` checked and `Merchant 51` retained in the selected list.            |
| Deselect before confirming           | In the expanded selected list, deselect `Merchant 51`, then confirm `CONFIRMED SHARED`. In both Chinese and English, only the `Shared` mapping in each table changes. `Merchant 51` and `Other` keep their existing mappings; selection and name input clear.                                  |
| Original data preservation           | Read the actual browser session payload after confirmation and compare it with the fixture using deep equality: the entire parse result is identical, including original values, risks and source positions. The normalization equals the fixture with only the two `Shared` entries replaced. |
| Responsive layout                    | Chinese and English checked at 1440 × 1000 and 390 × 844. Hidden-scope text, selected names and actions remain usable. Tables scroll inside their containers; the mobile document width stays 390 px and all action buttons fit the viewport.                                                  |

All scenarios passed; the browser reported no uncaught page errors.
Screenshots are local evidence in the ignored `docs/issue-52-acceptance/`
directory: `01-zh-desktop-hidden-selection.png`,
`02-zh-desktop-no-matches.png`, `03-zh-mobile-no-matches.png`,
`04-zh-mobile-applied.png`, `05-en-mobile-hidden-selection.png`,
`06-en-desktop-hidden-selection.png` and `07-en-desktop-applied.png`.
They are not included in Git and do not establish production acceptance.

Additional checks passed: the five existing merchant tests, ten existing
export tests, ESLint for both merchant components, and Prettier for those
components and all message files. All 12 locales format `hiddenSelected`,
`viewSelected` and `clearSelection`, including counts 0, 1, 2 and 54.
No new unit tests were added.

Repository-wide `pnpm exec tsc --noEmit` remains blocked by an unrelated
baseline problem: `src/components/editorial/benchmark-results.tsx` imports
the missing `public/research/bank-statement-parsing-benchmark.json`, causing
TS2307 and five TS7006 diagnostics. This acceptance does not claim a passing
repository-wide type check or production build.
