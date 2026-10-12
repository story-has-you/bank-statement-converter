export type ConversionErrorPayload = { code: string; message: string; period?: "day" | "month"; usedPages?: number; remainingPages?: number; limitPages?: number };

export class ConversionError extends Error {
  constructor(
    public readonly code: string,
    public readonly status = 502,
    public readonly quota?: Omit<ConversionErrorPayload, "code" | "message">,
    public readonly diagnostic?: string,
  ) {
    super(code);
    this.name = "ConversionError";
  }
}
