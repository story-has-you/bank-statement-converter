import { isParseResponse, type ConversionPayload, type ParseResponse } from "@/lib/conversion-types";

export const CONVERSION_STORAGE_KEY = "bank-statement-converter:conversion-result";

export function saveConversionPayload(filename: string, result: ParseResponse): void {
  const payload: ConversionPayload = { version: 1, filename, result };
  sessionStorage.setItem(CONVERSION_STORAGE_KEY, JSON.stringify(payload));
}

export function consumeConversionPayload(): ConversionPayload | null {
  try {
    const serialized = sessionStorage.getItem(CONVERSION_STORAGE_KEY);
    sessionStorage.removeItem(CONVERSION_STORAGE_KEY);
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

    return value as ConversionPayload;
  } catch {
    return null;
  }
}

export function readConversionPayload(): ConversionPayload | null {
  try {
    const serialized = sessionStorage.getItem(CONVERSION_STORAGE_KEY);
    if (!serialized) return null;
    const value: unknown = JSON.parse(serialized);
    if (
      typeof value !== "object" || value === null ||
      !("version" in value) || value.version !== 1 ||
      !("filename" in value) || typeof value.filename !== "string" ||
      !("result" in value) || !isParseResponse(value.result)
    ) return null;
    return value as ConversionPayload;
  } catch {
    return null;
  }
}
