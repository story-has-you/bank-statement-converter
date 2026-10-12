import limits from "../../services/parser/app/conversion-limits.json";

export const conversionLimits = limits;
export const maxUploadBytes = conversionLimits.megabytes * 1024 * 1024;

export const MAX_RESPONSE_BYTES = 4 * 1024 * 1024;
