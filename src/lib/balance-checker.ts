/** Two-decimal, ungrouped amounts; bounded so all intermediate cents stay exact. */
export function parseBalanceAmount(value: string, allowNegative: boolean): number | null {
  const text = value.trim();
  if (!/^-?\d{1,12}(?:[.,]\d{1,2})?$/.test(text) || (!allowNegative && text.startsWith("-"))) {
    return null;
  }
  const negative = text.startsWith("-");
  const [whole, fraction = ""] = text.replace(/^-/, "").split(/[.,]/);
  const cents = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  return negative ? -cents : cents;
}
