import "server-only";

import { auth, clerkClient, type User } from "@clerk/nextjs/server";
import { cache } from "react";

export function getVerifiedEmail(user: User): string | undefined {
  const address = user.primaryEmailAddress;
  return address?.verification?.status === "verified" ? address.emailAddress : undefined;
}

export const getSession = cache(auth);

export const getAccountUser = cache(async () => {
  const { userId } = await getSession();
  if (!userId) {
    return null;
  }
  const user = await (await clerkClient()).users.getUser(userId);
  return { id: user.id, email: getVerifiedEmail(user), avatarUrl: user.hasImage ? user.imageUrl : null };
});
