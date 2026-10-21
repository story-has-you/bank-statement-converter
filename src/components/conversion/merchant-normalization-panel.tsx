import { useRef, useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";

import { MerchantAliasList } from "@/components/conversion/merchant-alias-list";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { getColumnLabel, type ParseResponse } from "@/lib/conversion-types";
import {
  assignMerchantAliases,
  getMerchantAliases,
  getMerchantMappingCounts,
  getMerchantTable,
  hasMerchantNames,
  type MerchantNormalization,
} from "@/lib/merchant-normalization";

type MerchantNormalizationPanelProps = {
  result: ParseResponse;
  normalization: MerchantNormalization;
  onChange: (normalization: MerchantNormalization) => void;
};

const PAGE_SIZE = 50;

export function MerchantNormalizationPanel({ result, normalization, onChange }: MerchantNormalizationPanelProps) {
  const t = useTranslations("ConversionResult.merchant");
  const tableT = useTranslations("ConversionResult.excel");
  const columnT = useTranslations("ConversionResult.table");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [name, setName] = useState("");
  const [nameError, setNameError] = useState(false);
  const [notice, setNotice] = useState("");
  const [clearAllOpen, setClearAllOpen] = useState(false);
  const cancelClearRef = useRef<HTMLButtonElement>(null);
  const clearCounts = getMerchantMappingCounts(result, normalization);
  const aliases = getMerchantAliases(result, normalization);
  const filtered = aliases.filter((alias) => alias.value.toLocaleLowerCase().includes(search.toLocaleLowerCase()));
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const visibleAliases = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const visibleValues = new Set(visibleAliases.map((alias) => alias.value));
  const selectedAliases = aliases.filter((alias) => selected.has(alias.value));
  const selectedRows = selectedAliases.reduce((total, alias) => total + alias.rowCount, 0);
  const counts = { aliases: selectedAliases.length, rows: selectedRows };
  const hiddenAliases = selectedAliases.filter((alias) => !visibleValues.has(alias.value));
  const hiddenCounts = { aliases: hiddenAliases.length, rows: hiddenAliases.reduce((total, alias) => total + alias.rowCount, 0) };

  function changeSource(tableId: string, columnKey: string): void {
    const previous = getMerchantTable(normalization, tableId);
    if (previous && Object.keys(previous.aliases).length > 0 && !window.confirm(t("changeSourceConfirm"))) {
      return;
    }
    const next = columnKey ? { ...normalization, [tableId]: { columnKey, aliases: {} } } : { ...normalization };
    if (!columnKey) {
      delete next[tableId];
    }
    onChange(next);
    setSelected(new Set());
    setPage(1);
    setNotice("");
  }

  function toggleAlias(value: string, checked: boolean): void {
    setSelected((previous) => {
      const next = new Set(previous);
      if (checked) {
        next.add(value);
      } else {
        next.delete(value);
      }
      return next;
    });
    setNotice("");
  }

  function applyName(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    const merchantName = name.trim();
    if (!merchantName) {
      setNameError(true);
      return;
    }
    onChange(assignMerchantAliases(normalization, selectedAliases, merchantName));
    setNotice(t("applied", counts));
    setSelected(new Set());
    setName("");
    setNameError(false);
  }

  function removeSelectedMappings(): void {
    onChange(assignMerchantAliases(normalization, selectedAliases, null));
    setNotice(t("removed", counts));
    setSelected(new Set());
  }

  function clearAll(): void {
    onChange(Object.fromEntries(Object.entries(normalization).map(([id, table]) => [id, { ...table, aliases: {} }])));
    setClearAllOpen(false);
    setSelected(new Set());
    setNotice(t("cleared"));
  }

  return (
    <Accordion className="rounded-md border border-border bg-card px-4">
      <AccordionItem value="merchants">
        <AccordionTrigger>{t("title")}</AccordionTrigger>
        <AccordionContent>
          <div className="flex flex-col gap-5 py-2">
            <p className="text-sm text-muted-foreground">{t("description")}</p>
            <FieldGroup className="grid gap-4 sm:grid-cols-2">
              {result.tables.map((table, index) => (
                <Field key={table.id}>
                  <FieldLabel htmlFor={`${table.id}-merchant-source`}>
                    {t("sourceColumn", { table: tableT("sheetName", { index: index + 1 }) })}
                  </FieldLabel>
                  <NativeSelect
                    id={`${table.id}-merchant-source`}
                    value={getMerchantTable(normalization, table.id)?.columnKey ?? ""}
                    onChange={(event) => changeSource(table.id, event.target.value)}
                  >
                    <NativeSelectOption value="">{t("skipTable")}</NativeSelectOption>
                    {table.columns.map((column) => (
                      <NativeSelectOption key={column.key} value={column.key}>
                        {getColumnLabel(column, (column) => columnT("unnamedColumn", { column }))}
                      </NativeSelectOption>
                    ))}
                  </NativeSelect>
                </Field>
              ))}
            </FieldGroup>
            <Field>
              <FieldLabel htmlFor="merchant-search">{t("search")}</FieldLabel>
              <Input
                id="merchant-search"
                type="search"
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value);
                  setPage(1);
                }}
              />
              <FieldDescription>{t("aliasCount", { count: filtered.length })}</FieldDescription>
            </Field>
            {filtered.length > 0 ? (
              <MerchantAliasList aliases={visibleAliases} result={result} selected={selected} onToggle={toggleAlias} />
            ) : (
              <p className="text-sm text-muted-foreground">{t(aliases.length === 0 ? "noAliases" : "noMatches")}</p>
            )}
            {pageCount > 1 && (
              <nav className="flex flex-wrap items-center gap-3" aria-label={t("pagination")}>
                <Button type="button" variant="outline" size="sm" disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)}>
                  {t("previous")}
                </Button>
                <span className="text-sm">{t("page", { page: currentPage, pages: pageCount })}</span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={currentPage === pageCount}
                  onClick={() => setPage(currentPage + 1)}
                >
                  {t("next")}
                </Button>
              </nav>
            )}
            <form onSubmit={applyName} className="flex flex-col gap-3">
              <FieldGroup>
                <Field data-invalid={nameError || undefined}>
                  <FieldLabel htmlFor="merchant-name">{t("name")}</FieldLabel>
                  <Input
                    id="merchant-name"
                    value={name}
                    aria-invalid={nameError || undefined}
                    aria-describedby={nameError ? "merchant-name-error merchant-selected-count" : "merchant-selected-count"}
                    onChange={(event) => {
                      setName(event.target.value);
                      setNameError(false);
                    }}
                  />
                  {nameError && <FieldError id="merchant-name-error">{t("nameRequired")}</FieldError>}
                  <FieldDescription id="merchant-selected-count" role="status">
                    {t("selected", counts)}
                    {hiddenAliases.length > 0 && (
                      <span className="block font-medium text-foreground">{t("hiddenSelected", hiddenCounts)}</span>
                    )}
                  </FieldDescription>
                </Field>
              </FieldGroup>
              {selectedAliases.length > 0 && (
                <details className="rounded-md border border-border p-3">
                  <summary className="cursor-pointer rounded-sm text-sm font-medium focus-visible:outline-2 focus-visible:outline-ring">
                    {t("viewSelected", counts)}
                  </summary>
                  <div className="mt-3 max-h-80 overflow-auto" tabIndex={0} role="region" aria-label={t("viewSelected", counts)}>
                    <MerchantAliasList aliases={selectedAliases} result={result} selected={selected} onToggle={toggleAlias} />
                  </div>
                </details>
              )}
              <div className="flex flex-wrap gap-2">
                <Button type="submit" disabled={selectedAliases.length === 0}>
                  {t("apply", counts)}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={!selectedAliases.some((alias) => alias.names.some((name) => name !== null))}
                  onClick={removeSelectedMappings}
                >
                  {t("removeSelected")}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  disabled={selectedAliases.length === 0}
                  onClick={() => {
                    setSelected(new Set());
                    setNotice("");
                  }}
                >
                  {t("clearSelection")}
                </Button>
                <AlertDialog open={clearAllOpen} onOpenChange={setClearAllOpen}>
                  <AlertDialogTrigger render={<Button type="button" variant="ghost" disabled={!hasMerchantNames(normalization)} />}>
                    {t("clearAll")}
                  </AlertDialogTrigger>
                  <AlertDialogContent initialFocus={cancelClearRef}>
                    <AlertDialogHeader>
                      <AlertDialogTitle>{t("clearAllTitle")}</AlertDialogTitle>
                      <AlertDialogDescription>{t("clearAllDescription", clearCounts)}</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel ref={cancelClearRef} type="button">
                        {t("clearAllCancel")}
                      </AlertDialogCancel>
                      <AlertDialogAction type="button" variant="destructive" onClick={clearAll}>
                        {t("clearAllConfirm")}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
              <p role="status" className="text-sm text-muted-foreground">
                {notice}
              </p>
            </form>
          </div>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}

MerchantNormalizationPanel.displayName = "MerchantNormalizationPanel";
