"use client";

import { useEffect, useState, useTransition, useMemo, useRef, useCallback } from "react";
import { useAuth } from "@clerk/nextjs";
import { toggleDeviceStatus, listDevices, executeRoutine } from "../../actions";
import { useStore } from "@/hooks/useStore";
import { useDeviceSync } from "@/hooks/useDeviceSync";
import { Device3DView } from "@/components/Device3DView";
import { RoutineSection } from "@/components/RoutineSection";
import type { Database } from "@/database.types";

type Device = Database["public"]["Tables"]["devices"]["Row"];
type Routine = Database["public"]["Tables"]["routines"]["Row"] & {
  routine_devices: Array<{
    id: string;
    device_id: string;
    target_state: boolean;
    order_index: number;
    devices: Device | null;
  }>;
};

interface Props {
  clerkUserId: string;
  initialDevices: Device[];
  initialRoutines: Routine[];
}

export default function SwitchClient({
  clerkUserId,
  initialDevices,
  initialRoutines,
}: Props) {
  const { isSignedIn, userId } = useAuth();
  const [pending, startTransition] = useTransition();
  const setDevices = useStore((s) => s.setDevices);
  const devices = useStore((s) => s.devices);
  const [mounted, setMounted] = useState(false);
  const [routines, setRoutines] = useState<Routine[]>(initialRoutines);
  const [executingRoutineId, setExecutingRoutineId] = useState<string | null>(null);

  // 스위치 모드: 스캔 방식
  const [switchIndex, setSwitchIndex] = useState(0);
  const [scanSpeed, setScanSpeed] = useState<number>(2); // 1-10초 선택 가능
  const switchIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // 스캔 대상: 루틴 + 기기 (루틴을 먼저 배치)
  const scanItems = useMemo(() => {
    const items: Array<{ type: "device"; data: Device } | { type: "routine"; data: Routine }> = [];
    // 루틴 추가 (먼저 배치)
    routines.forEach((routine) => {
      items.push({ type: "routine", data: routine });
    });
    // 기기 추가 (나중에 배치)
    devices.forEach((device) => {
      items.push({ type: "device", data: device });
    });
    return items;
  }, [devices, routines]);

  useDeviceSync();

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    setDevices(initialDevices);
  }, [initialDevices, setDevices]);

  // 스캔 인터벌
  useEffect(() => {
    if (scanItems.length > 0) {
      const intervalMs = scanSpeed * 1000;
      switchIntervalRef.current = setInterval(() => {
        setSwitchIndex((prev) => (prev + 1) % scanItems.length);
      }, intervalMs);
      return () => {
        if (switchIntervalRef.current) {
          clearInterval(switchIntervalRef.current);
        }
      };
    }
  }, [scanItems.length, scanSpeed]);

  const handleDeviceClick = useCallback((device: Device) => {
    startTransition(async () => {
      await toggleDeviceStatus({
        deviceId: device.id,
        isActive: !device.is_active,
      });
    });
  }, [startTransition]);

  const handleExecuteRoutine = useCallback(async (routineId: string) => {
    if (!userId) return;
    setExecutingRoutineId(routineId);
    startTransition(async () => {
      try {
        await executeRoutine({ routineId });
        const updatedDevices = await listDevices({ clerkUserId });
        if (updatedDevices) {
          setDevices(updatedDevices);
        }
      } catch (error) {
        console.error("[switch] 루틴 실행 실패", error);
        alert("루틴 실행에 실패했습니다.");
      } finally {
        setExecutingRoutineId(null);
      }
    });
  }, [userId, clerkUserId, startTransition, setDevices]);

  // 스페이스바 또는 엔터 키로 선택
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.key === " " || e.key === "Enter") {
        e.preventDefault();
        if (scanItems.length === 0) return;
        const item = scanItems[switchIndex];
        if (item.type === "device") {
          handleDeviceClick(item.data);
        } else if (item.type === "routine") {
          handleExecuteRoutine(item.data.id);
        }
      }
    };

    window.addEventListener("keydown", handleKeyPress);
    return () => {
      window.removeEventListener("keydown", handleKeyPress);
    };
  }, [scanItems, switchIndex, handleDeviceClick, handleExecuteRoutine]);

  const handleRoutineUpdate = async () => {
    if (!userId) return;
    const updatedDevices = await listDevices({ clerkUserId });
    if (updatedDevices) {
      setDevices(updatedDevices);
    }
  };

  if (!mounted) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-body-1">로딩 중...</div>
      </div>
    );
  }

  if (!isSignedIn) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-body-1">로그인이 필요합니다.</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen px-6 md:px-10 py-8 space-y-6">
      <div className="max-w-7xl mx-auto space-y-8">
        <div>
          <h1 className="text-h1 bg-gradient-to-r from-gray-900 to-gray-700 dark:from-gray-100 dark:to-gray-300 bg-clip-text text-transparent">
            사용자 모드 - 스캐닝 모드
          </h1>
          <p className="text-body-2 text-gray-600 dark:text-gray-300 mt-2">
            스위치나 키보드로 버튼을 순차적으로 선택합니다. 버튼이 자동으로 하이라이트됩니다.
          </p>
        </div>

        {/* 스캐닝 속도 조절 */}
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-700 dark:text-gray-300 font-medium">스캐닝 속도:</span>
          <input
            type="range"
            min="1"
            max="10"
            value={scanSpeed}
            onChange={(e) => setScanSpeed(Number(e.target.value))}
            className="flex-1 h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-600"
            style={{
              background: `linear-gradient(to right, #3b82f6 0%, #3b82f6 ${((scanSpeed - 1) / 9) * 100}%, #e5e7eb ${((scanSpeed - 1) / 9) * 100}%, #e5e7eb 100%)`,
            }}
          />
          <div className="text-sm font-semibold text-blue-700 dark:text-blue-400 w-8 text-right">
            {scanSpeed}초
          </div>
        </div>

        {/* 루틴 섹션 */}
        <RoutineSection
          routines={routines}
          onRoutineUpdate={handleRoutineUpdate}
          isSwitchActive={(routineId) => 
            scanItems[switchIndex]?.type === "routine" && scanItems[switchIndex].data.id === routineId
          }
        />

        {/* SLAM 기기 제어 섹션 */}
        <section className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-h2 bg-gradient-to-r from-gray-900 to-gray-700 dark:from-gray-100 dark:to-gray-300 bg-clip-text text-transparent">
              기기 제어
            </h2>
          </div>
          <Device3DView
            devices={devices}
            onDeviceClick={handleDeviceClick}
            isSwitchActive={(deviceId) =>
              scanItems[switchIndex]?.type === "device" && scanItems[switchIndex].data.id === deviceId
            }
          />
        </section>

        {/* 입력 방식 표시: 하단 고정 */}
        <div className="fixed bottom-0 left-0 right-0 bg-blue-50 dark:bg-blue-950/30 border-t border-blue-200 dark:border-blue-800 shadow-lg z-40 px-6 md:px-10 py-3">
          <div className="max-w-7xl mx-auto flex items-center justify-center">
            <div className="px-4 py-2 rounded-lg text-xl bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-800 font-medium">
              입력 방식: 스캐닝
            </div>
          </div>
        </div>

        {/* 스캔 모드 하단 고정 UI */}
        {scanItems.length > 0 && (
          <div className="fixed bottom-12 left-0 right-0 bg-gradient-to-t from-blue-600 to-blue-500 dark:from-blue-700 dark:to-blue-600 text-white shadow-2xl z-50 border-t-4 border-blue-400 dark:border-blue-500">
            <div className="max-w-7xl mx-auto px-6 py-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-16 h-16 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center border-4 border-white/40 shadow-lg">
                      <span className="text-2xl font-bold">{switchIndex + 1}</span>
                    </div>
                    <div>
                      <div className="text-sm opacity-90">
                        {scanItems[switchIndex]?.type === "routine" ? "현재 선택된 루틴" : "현재 선택된 기기"}
                      </div>
                      <div className="text-xl font-bold">
                        {scanItems[switchIndex]?.type === "routine"
                          ? (scanItems[switchIndex].data as Routine).name
                          : (scanItems[switchIndex].data as Device).name || "없음"}
                      </div>
                      <div className="text-xs opacity-75 mt-0.5">
                        {scanItems[switchIndex]?.type === "routine" ? (
                          <span>
                            {(scanItems[switchIndex].data as Routine).routine_devices.length}개 기기 ·{" "}
                            {(scanItems[switchIndex].data as Routine).time_type === "morning" ? "🌅 아침" : (scanItems[switchIndex].data as Routine).time_type === "evening" ? "🌙 저녁" : "⚙️ 일반"}
                          </span>
                        ) : (
                          <span>
                            {(scanItems[switchIndex].data as Device).icon_type} · {(scanItems[switchIndex].data as Device).is_active ? "On" : "Off"}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="h-12 w-px bg-white/30" />
                  <div className="text-sm">
                    <div className="opacity-90">전체 항목</div>
                    <div className="text-lg font-semibold">
                      {switchIndex + 1} / {scanItems.length}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right text-sm">
                    <div className="opacity-90">스캐닝 속도</div>
                    <div className="text-lg font-semibold">{scanSpeed}초</div>
                  </div>
                  <button
                    onClick={() => {
                      if (scanItems.length === 0) return;
                      const item = scanItems[switchIndex];
                      if (item.type === "device") {
                        handleDeviceClick(item.data);
                      } else if (item.type === "routine") {
                        handleExecuteRoutine(item.data.id);
                      }
                    }}
                    className="h-14 px-8 rounded-xl bg-white text-blue-600 font-bold text-lg shadow-xl hover:shadow-2xl hover:scale-105 active:scale-95 transition-all duration-200 flex items-center gap-2"
                  >
                    <span>🔘</span>
                    <span>{scanItems[switchIndex]?.type === "routine" ? "실행" : "선택하기"}</span>
                  </button>
                  <div className="text-xs opacity-75 text-center">
                    <div>스페이스바</div>
                    <div>또는 엔터</div>
                    <div>또는 클릭</div>
                  </div>
                </div>
              </div>
              {/* 진행 바 */}
              <div className="mt-3 h-1.5 bg-white/20 rounded-full overflow-hidden">
                <div
                  className="h-full bg-white transition-all duration-300 ease-linear"
                  style={{
                    width: `${((switchIndex + 1) / scanItems.length) * 100}%`,
                  }}
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

