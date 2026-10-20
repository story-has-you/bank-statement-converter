import { getLocale } from "next-intl/server";

import { AccountProfile } from "@/components/account/account-profile";
import { AccountQuota } from "@/components/account/account-quota";
import { AccountSubscriptions } from "@/components/account/account-subscriptions";
import { ClientMessages } from "@/components/shared/client-messages";
import { redirect } from "@/i18n/navigation";
import { getUserAvatarUrl } from "@/lib/account/avatar";
import { getAccountSnapshot } from "@/lib/account/server";
import { getRenderAuthContext } from "@/lib/supabase/server";

export async function AccountContent() {
  const locale = await getLocale();
  const { user } = await getRenderAuthContext();
  if (!user) {
    return redirect({ href: "/", locale });
  }
  const snapshot = await getAccountSnapshot(user);

  return (
    <ClientMessages namespaces={["Account"]}>
      <div className="grid gap-6">
        <AccountProfile
          email={user.email ?? null}
          imageUrl={getUserAvatarUrl(user.user_metadata)}
          tier={snapshot.currentTier}
          available={snapshot.subscriptions !== null}
        />
        <AccountQuota quota={snapshot.quota} />
        <AccountSubscriptions subscriptions={snapshot.subscriptions} />
      </div>
    </ClientMessages>
  );
}
