import { atom } from "jotai/vanilla";

import type { ConversionPreview } from "@/lib/conversion-stream-client";
import type { ParseResponse } from "@/lib/conversion-types";

export type ConversionState =
  | { phase: "idle" }
  | { phase: "pending"; filename: string; preview: ConversionPreview }
  | { phase: "complete"; filename: string; result: ParseResponse; storageFailed: boolean }
  | { phase: "error"; filename: string; message: string };

export const conversionStateAtom = atom<ConversionState>({ phase: "idle" });
export const conversionRevisionAtom = atom(0);
export const conversionPendingAtom = atom((get) => get(conversionStateAtom).phase === "pending");
