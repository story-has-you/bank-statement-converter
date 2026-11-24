import { getLocale } from "next-intl/server";

import { AccountProfile } from "@/components/account/account-profile";
import { AccountQuota } from "@/components/account/account-quota";
import { AccountSubscriptions } from "@/components/account/account-subscriptions";
import { ClientMessages } from "@/components/shared/client-messages";
import { redirect } from "@/i18n/navigation";
import { getAccountSnapshot } from "@/lib/account/server";
import { getAccountUser } from "@/lib/auth/server";

export async function AccountContent() {
  const locale = await getLocale();
  const user = await getAccountUser();
  if (!user) {
    return redirect({ href: "/", locale });
  }
  const snapshot = await getAccountSnapshot(user);

  return (
    <ClientMessages namespaces={["Account"]}>
      <div className="grid gap-6">
        <AccountProfile
          email={user.email ?? null}
          imageUrl={user.avatarUrl}
          tier={snapshot.currentTier}
          available={snapshot.subscriptions !== null}
        />
        <AccountQuota quota={snapshot.quota} />
        <AccountSubscriptions subscriptions={snapshot.subscriptions} />
      </div>
    </ClientMessages>
  );
}
