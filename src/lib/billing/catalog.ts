import "server-only";

import { createTranslator } from "next-intl";
import { brandConfig } from "@/config/brand";
import messages from "../../../messages/en.json";
import type { MembershipTier } from "./types";

/** Shared provider products use English so visitors cannot overwrite each other's locale. */
export function getSubscriptionProductCopy(tier: MembershipTier): { name: string; description: string } {
  const t = createTranslator({ locale: "en", messages, namespace: "UsageTiers" });
  const name = t(`plans.${tier}.name`).trim();
  const description = t(`plans.${tier}.description`).trim();
  if (!name || !description) {
    throw new Error("Subscription product name and description must not be empty");
  }
  return { name: `${brandConfig.name} ${name}`, description };
}
