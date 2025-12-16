"use client";

import { ClerkLoaded, useUser } from "@clerk/nextjs";
import { useEffect, useState } from "react";
import { syncUser } from "@/app/actions";
import { trackEvent } from "@/lib/analytics";

export default function SyncUser() {
  const { user, isSignedIn } = useUser();
  const [hasSynced, setHasSynced] = useState(false);

  useEffect(() => {
    if (!isSignedIn || !user || hasSynced) return;

    const email =
      user.primaryEmailAddress?.emailAddress ??
      user.emailAddresses[0]?.emailAddress ??
      null;

    syncUser({ clerkUserId: user.id, email })
      .then(() => {
        // 사용자 동기화 성공 이벤트
        // isNewUser는 서버에서 판단하기 어려우므로, 일단 false로 설정
        // 향후 개선: syncUser 반환값에 isNewUser 포함
        trackEvent({
          name: "user_synced",
          properties: {
            clerkUserId: user.id,
            isNewUser: false,
          },
        });
      })
      .catch((err) => {
        console.error("[syncUser] client 호출 실패", err);
      });
    setHasSynced(true);
  }, [hasSynced, isSignedIn, user]);

  return null;
}

