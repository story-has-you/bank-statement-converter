import { isParseResponse, type ConversionPayload, type ParseResponse } from "@/lib/conversion-types";
import { isMerchantNormalization, type MerchantNormalization } from "@/lib/merchant-normalization";

export const CONVERSION_STORAGE_KEY = "bank-statement-converter:conversion-result";

export function saveConversionPayload(filename: string, result: ParseResponse, merchantNormalization?: MerchantNormalization): void {
  const payload: ConversionPayload = { version: 1, filename, result, merchantNormalization };
  sessionStorage.setItem(CONVERSION_STORAGE_KEY, JSON.stringify(payload));
}

export function clearConversionPayload(): void {
  sessionStorage.removeItem(CONVERSION_STORAGE_KEY);
}

export function readConversionPayload(): ConversionPayload | null {
  try {
    const serialized = sessionStorage.getItem(CONVERSION_STORAGE_KEY);
    if (!serialized) {
      return null;
    }
    const value: unknown = JSON.parse(serialized);
    if (
      typeof value !== "object" ||
      value === null ||
      !("version" in value) ||
      value.version !== 1 ||
      !("filename" in value) ||
      typeof value.filename !== "string" ||
      !("result" in value) ||
      !isParseResponse(value.result)
    ) {
      return null;
    }
    const payload: ConversionPayload = { version: 1, filename: value.filename, result: value.result };
    if ("merchantNormalization" in value && isMerchantNormalization(value.merchantNormalization, value.result)) {
      payload.merchantNormalization = value.merchantNormalization;
    }
    return payload;
  } catch {
    return null;
  }
}
