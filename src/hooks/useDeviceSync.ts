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
  const retryCountRef = useRef<number>(0);
  const isSubscribedRef = useRef<boolean>(false);
  const devicesRef = useRef<typeof devices>(devices);

  // devices 변경 시 ref 동기화
  useEffect(() => {
    devicesRef.current = devices;
  }, [devices]);

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
        devicesRef.current = data;
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
              // ref 업데이트
              devicesRef.current = devicesRef.current.filter(
                (d) => d.id !== payload.old.id
              );
              return;
            }

            if (payload.eventType === "UPDATE") {
              updateDeviceState(next.id, next.is_active ?? false);
              // ref 업데이트
              devicesRef.current = devicesRef.current.map((d) =>
                d.id === next.id ? { ...d, ...next } : d
              );
            } else {
              upsertDevice(next);
              // ref 업데이트
              const index = devicesRef.current.findIndex((d) => d.id === next.id);
              if (index === -1) {
                devicesRef.current = [next, ...devicesRef.current];
              } else {
                devicesRef.current = [...devicesRef.current];
                devicesRef.current[index] = next;
              }
            }
          }
        )
        .subscribe((status) => {
          console.log("[sync] 구독 상태", status);
          if (status === "SUBSCRIBED") {
            lastSyncRef.current = Date.now();
            isSubscribedRef.current = true;
            retryCountRef.current = 0; // 성공 시 재시도 카운터 리셋
          } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
            isSubscribedRef.current = false;
            retryCountRef.current += 1;
            
            // 최대 5회까지만 재시도
            if (retryCountRef.current <= 5) {
              const delay = Math.min(3000 * retryCountRef.current, 30000); // 지수 백오프, 최대 30초
              console.warn(`[sync] 구독 오류(${status}), ${delay}ms 후 재구독 시도 (${retryCountRef.current}/5)`);
              if (isMounted) {
                setTimeout(() => {
                  if (isMounted && !isSubscribedRef.current) {
                    bootstrap();
                  }
                }, delay);
              }
            } else {
              console.error("[sync] 구독 재시도 한도 초과, 수동 새로고침 필요");
            }
          }
        });
    };

    bootstrap();

    // 주기적 불일치 검사는 별도 effect로 분리하여 devices 의존성 문제 해결
    const mismatchInterval = setInterval(async () => {
      if (!isMounted || !currentUserId) return;
      
      const currentDevices = devicesRef.current; // ref를 통해 최신 상태 가져오기
      
      const { data } = await supabase
        .from("devices")
        .select("id, is_active")
        .eq("user_id", currentUserId);

      if (!data) return;

      const serverIds = new Set(data.map((d) => d.id));
      const localIds = new Set(currentDevices.map((d) => d.id));

      // 서버에 있지만 로컬에 없는 경우
      const missing = data.filter((d) => !localIds.has(d.id));
      if (missing.length > 0) {
        console.warn("[sync] 불일치 감지: 서버에만 존재", missing);
        if (isMounted) bootstrap();
        return;
      }

      // 로컬에 있지만 서버에 없는 경우
      const extra = currentDevices.filter((d) => !serverIds.has(d.id));
      if (extra.length > 0) {
        console.warn("[sync] 불일치 감지: 로컬에만 존재", extra);
        if (isMounted) bootstrap();
        return;
      }

      // 상태 불일치 확인
      const stateMismatch = data.some((server) => {
        const local = currentDevices.find((d) => d.id === server.id);
        return local && local.is_active !== server.is_active;
      });

      if (stateMismatch) {
        console.warn("[sync] 상태 불일치 감지, 재조회");
        if (isMounted) bootstrap();
      }
    }, 30000);

    return () => {
      isMounted = false;
      isSubscribedRef.current = false;
      retryCountRef.current = 0;
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
      }
      clearInterval(mismatchInterval);
      if (channel) {
        void supabase.removeChannel(channel);
      }
    };
  }, [isSignedIn, removeDevice, setDevices, upsertDevice, updateDeviceState, userId]);
}

