"use client";

import { useEffect, useRef } from "react";
import { useAuth } from "@clerk/nextjs";
import { supabase } from "@/lib/supabase/client";
import { useStore } from "./useStore";

export function useDeviceSync() {
  const { userId, isSignedIn } = useAuth();
  const setDevices = useStore((s) => s.setDevices);
  const devices = useStore((s) => s.devices);
  const updateDeviceState = useStore((s) => s.updateDeviceState);
  const upsertDevice = useStore((s) => s.upsertDevice);
  const removeDevice = useStore((s) => s.removeDevice);
  const retryTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastSyncRef = useRef<number>(0);

  useEffect(() => {
    if (!isSignedIn || !userId) return;

    let isMounted = true;
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let currentUserId: string | null = null;

    const bootstrap = async () => {
      console.log("[sync] 초기 장치 불러오기");
      const { data: userRow, error: userError } = await supabase
        .from("users")
        .select("id")
        .eq("clerk_user_id", userId)
        .maybeSingle();

      if (userError) {
        console.error("[sync] 사용자 조회 실패", userError);
        if (isMounted) {
          retryTimeoutRef.current = setTimeout(bootstrap, 5000);
        }
        return;
      }

      if (!userRow?.id) {
        console.warn("[sync] 사용자 없음, devices 조회 스킵");
        return;
      }

      currentUserId = userRow.id;

      const { data, error } = await supabase
        .from("devices")
        .select("*")
        .eq("user_id", userRow.id)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("[sync] devices 조회 실패", error);
        if (isMounted) {
          retryTimeoutRef.current = setTimeout(bootstrap, 5000);
        }
        return;
      }

      if (isMounted && data) {
        setDevices(data);
        lastSyncRef.current = Date.now();
      }

      // 기존 채널 제거
      if (channel) {
        await supabase.removeChannel(channel);
      }

      channel = supabase
        .channel(`device-changes-${userRow.id}`)
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "devices" },
          (payload) => {
            const next = payload.new as any;
            if (!next?.user_id || next.user_id !== currentUserId) return;

            console.log("[sync] Realtime 이벤트", payload.eventType, next.id);

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
        .subscribe((status) => {
          console.log("[sync] 구독 상태", status);
          if (status === "SUBSCRIBED") {
            lastSyncRef.current = Date.now();
          } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
            console.warn("[sync] 구독 오류, 재구독 시도", status);
            if (isMounted) {
              setTimeout(() => {
                if (isMounted) bootstrap();
              }, 3000);
            }
          }
        });
    };

    // 주기적 불일치 검사 (30초마다)
    const checkMismatch = async () => {
      if (!isMounted || !currentUserId) return;
      
      const { data } = await supabase
        .from("devices")
        .select("id, is_active, updated_at")
        .eq("user_id", currentUserId);

      if (!data) return;

      const serverIds = new Set(data.map((d) => d.id));
      const localIds = new Set(devices.map((d) => d.id));

      // 서버에 있지만 로컬에 없는 경우
      const missing = data.filter((d) => !localIds.has(d.id));
      if (missing.length > 0) {
        console.warn("[sync] 불일치 감지: 서버에만 존재", missing);
        bootstrap();
        return;
      }

      // 로컬에 있지만 서버에 없는 경우
      const extra = devices.filter((d) => !serverIds.has(d.id));
      if (extra.length > 0) {
        console.warn("[sync] 불일치 감지: 로컬에만 존재", extra);
        bootstrap();
        return;
      }

      // 상태 불일치 확인
      const stateMismatch = data.some((server) => {
        const local = devices.find((d) => d.id === server.id);
        return local && local.is_active !== server.is_active;
      });

      if (stateMismatch) {
        console.warn("[sync] 상태 불일치 감지, 재조회");
        bootstrap();
      }
    };

    bootstrap();

    const mismatchInterval = setInterval(checkMismatch, 30000);

    return () => {
      isMounted = false;
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
      }
      clearInterval(mismatchInterval);
      if (channel) {
        void supabase.removeChannel(channel);
      }
    };
  }, [isSignedIn, removeDevice, setDevices, upsertDevice, updateDeviceState, userId, devices]);
}

