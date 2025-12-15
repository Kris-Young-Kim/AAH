"use client";

import { ClerkLoaded, useUser } from "@clerk/nextjs";
import { useEffect, useState } from "react";
import { syncUser } from "@/app/actions";

export default function SyncUser() {
  const { user, isSignedIn } = useUser();
  const [hasSynced, setHasSynced] = useState(false);

  useEffect(() => {
    if (!isSignedIn || !user || hasSynced) return;

    const email =
      user.primaryEmailAddress?.emailAddress ??
      user.emailAddresses[0]?.emailAddress ??
      null;

    syncUser({ clerkUserId: user.id, email }).catch((err) => {
      console.error("[syncUser] client 호출 실패", err);
    });
    setHasSynced(true);
  }, [hasSynced, isSignedIn, user]);

  return null;
}

