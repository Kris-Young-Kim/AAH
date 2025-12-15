"use client";

import { useEffect } from "react";
import { useAuth } from "@clerk/nextjs";
import { supabase } from "@/lib/supabase/client";
import { useStore } from "./useStore";

export function useDeviceSync() {
  const { userId, isSignedIn } = useAuth();
  const setDevices = useStore((s) => s.setDevices);
  const updateDeviceState = useStore((s) => s.updateDeviceState);
  const upsertDevice = useStore((s) => s.upsertDevice);
  const removeDevice = useStore((s) => s.removeDevice);

  useEffect(() => {
    if (!isSignedIn || !userId) return;

    let isMounted = true;
    let channel: ReturnType<typeof supabase.channel> | null = null;

    const bootstrap = async () => {
      console.log("[sync] 초기 장치 불러오기");
      const { data: userRow, error: userError } = await supabase
        .from("users")
        .select("id")
        .eq("clerk_user_id", userId)
        .maybeSingle();

      if (userError) {
        console.error("[sync] 사용자 조회 실패", userError);
        return;
      }

      if (!userRow?.id) {
        console.warn("[sync] 사용자 없음, devices 조회 스킵");
        return;
      }

      const { data, error } = await supabase
        .from("devices")
        .select("*")
        .eq("user_id", userRow.id)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("[sync] devices 조회 실패", error);
        return;
      }

      if (isMounted && data) {
        setDevices(data);
      }

      channel = supabase
        .channel("device-changes")
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "devices" },
          (payload) => {
            const next = payload.new as any;
            if (!next?.user_id || next.user_id !== userRow.id) return;

            if (payload.eventType === "DELETE") {
              removeDevice(String(payload.old.id));
              return;
            }

            if (payload.eventType === "UPDATE") {
              updateDeviceState(next.id, next.is_active ?? false);
            } else {
              upsertDevice(next);
            }
          }
        )
        .subscribe();
    };

    bootstrap();

    return () => {
      isMounted = false;
      if (channel) {
        void supabase.removeChannel(channel);
      }
    };
  }, [isSignedIn, removeDevice, setDevices, upsertDevice, updateDeviceState, userId]);
}

