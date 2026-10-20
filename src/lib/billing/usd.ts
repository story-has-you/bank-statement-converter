declare const usdCentUnit: unique symbol;

/** Non-negative USD minor units, bounded by Number.MAX_SAFE_INTEGER. */
export type UsdCents = number & { readonly [usdCentUnit]: "usd-cent" };

/** SDK boundary: only integer cents are accepted; never infer dollars. */
export function usdFromMinorUnits(value: unknown): UsdCents {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) {
    throw new Error("USD minor units must be a non-negative safe integer");
  }
  return value as UsdCents;
}

/** REST boundary: unsigned decimal dollars with at most two fractional digits. */
export function usdFromDecimal(value: unknown): UsdCents {
  if (typeof value !== "string" || value.trim() !== value || !/^\d+(?:\.\d{1,2})?$/.test(value)) {
    throw new Error("USD amount must be a decimal string with at most two fractional digits");
  }
  const [dollars, fraction = ""] = value.split(".");
  // Assemble cents as digits to avoid floating-point multiplication and rounding.
  return usdFromMinorUnits(Number(dollars + fraction.padEnd(2, "0")));
}

export function usdToDecimal(value: UsdCents): string {
  const cents = usdFromMinorUnits(value);
  return `${Math.floor(cents / 100)}.${String(cents % 100).padStart(2, "0")}`;
}
