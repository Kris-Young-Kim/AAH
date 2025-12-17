"use client";

import { useEffect, useState, useTransition, useMemo, useRef, useCallback } from "react";
import { useAuth } from "@clerk/nextjs";
import { toggleDeviceStatus, listDevices } from "../../actions";
import { useStore } from "@/hooks/useStore";
import { useDeviceSync } from "@/hooks/useDeviceSync";
import { useWebGazer } from "@/hooks/useWebGazer";
import { useWebGazerCalibration } from "@/hooks/useWebGazerCalibration";
import { Device3DView } from "@/components/Device3DView";
import { RoutineSection } from "@/components/RoutineSection";
import { trackEvent } from "@/lib/analytics";
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

export default function EyeClient({
  clerkUserId,
  initialDevices,
  initialRoutines,
}: Props) {
  const { isSignedIn, userId } = useAuth();
  const [pending, startTransition] = useTransition();
  const setDevices = useStore((s) => s.setDevices);
  const devices = useStore((s) => s.devices);
  const snappedDeviceId = useStore((s) => s.snappedDeviceId);
  const setSnappedDevice = useStore((s) => s.setSnappedDevice);
  const dwellProgressMs = useStore((s) => s.dwellProgressMs);
  const setDwellProgress = useStore((s) => s.setDwellProgress);
  const sensorReady = useStore((s) => s.sensorReady);
  const gaze = useStore((s) => s.gaze);
  const dwellStartRef = useRef<number | null>(null);
  const [mounted, setMounted] = useState(false);
  const [routines, setRoutines] = useState<Routine[]>(initialRoutines);
  
  // 드웰 시간 설정 (1-10초)
  const [dwellTime, setDwellTime] = useState<number>(2);
  
  const { status: calStatus, accuracy, startCalibration, resetCalibration } = useWebGazerCalibration();
  const cardRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const { startWebGazer, isLoaded: webgazerLoaded } = useWebGazer();

  useDeviceSync();

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    setDevices(initialDevices);
  }, [initialDevices, setDevices]);

  // WebGazer 시작
  useEffect(() => {
    if (mounted && webgazerLoaded) {
      startWebGazer().catch((err) => {
        console.error("[eye] WebGazer 시작 실패", err);
      });
    }
  }, [mounted, webgazerLoaded, startWebGazer]);

  // 가상 커서 + 마그네틱 스냅 (히트박스 강화: 3배 확대)
  useEffect(() => {
    if (!sensorReady) return;
    
    let rafId: number;
    const loop = () => {
      let nextSnap: string | null = null;
      devices.forEach((device) => {
        const el = cardRefs.current[device.id];
        if (!el) return;
        const rect = el.getBoundingClientRect();
        // 히트박스 3배 확대
        const expandedWidth = rect.width * 3;
        const expandedHeight = rect.height * 3;
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;
        const left = cx - expandedWidth / 2;
        const top = cy - expandedHeight / 2;
        const right = cx + expandedWidth / 2;
        const bottom = cy + expandedHeight / 2;
        // 확대된 히트박스 내부에 있으면 스냅
        if (gaze.x >= left && gaze.x <= right && gaze.y >= top && gaze.y <= bottom) {
          nextSnap = device.id;
        }
      });
      if (nextSnap !== snappedDeviceId) {
        setSnappedDevice(nextSnap);
      }
      rafId = requestAnimationFrame(loop);
    };
    rafId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafId);
  }, [devices, gaze.x, gaze.y, setSnappedDevice, snappedDeviceId, sensorReady]);

  // 드웰 클릭 처리
  useEffect(() => {
    if (snappedDeviceId) {
      dwellStartRef.current = performance.now();
      const interval = setInterval(() => {
        if (!dwellStartRef.current) return;
        const elapsed = performance.now() - dwellStartRef.current;
        setDwellProgress(elapsed);
        if (elapsed >= dwellTime * 1000) {
          const target = devices.find((d) => d.id === snappedDeviceId);
          if (target) {
            startTransition(async () => {
              console.log("[dwell] trigger", { deviceId: target.id });
              await toggleDeviceStatus({
                deviceId: target.id,
                isActive: !target.is_active,
              });
              trackEvent({
                name: "device_clicked",
                properties: {
                  deviceId: target.id,
                  deviceName: target.name,
                  method: "dwell",
                },
              });
            });
          }
          setSnappedDevice(null);
          setDwellProgress(0);
          clearInterval(interval);
        }
      }, 120);
      return () => clearInterval(interval);
    }
    setDwellProgress(0);
    dwellStartRef.current = null;
  }, [
    devices,
    setDwellProgress,
    setSnappedDevice,
    snappedDeviceId,
    startTransition,
    dwellTime,
  ]);

  const dwellPercent = useMemo(
    () => Math.min(100, Math.round((dwellProgressMs / (dwellTime * 1000)) * 100)),
    [dwellProgressMs, dwellTime]
  );

  const handleDeviceClick = useCallback((device: Device) => {
    startTransition(async () => {
      await toggleDeviceStatus({
        deviceId: device.id,
        isActive: !device.is_active,
      });
    });
  }, [startTransition]);

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
            사용자 모드 - 시선 추적
          </h1>
          <p className="text-body-2 text-gray-600 dark:text-gray-300 mt-2">
            웹캠으로 눈의 움직임을 추적하여 화면의 버튼을 제어합니다.
          </p>
        </div>

        {/* 캘리브레이션 섹션 */}
        <section className="relative rounded-2xl border border-gray-200 dark:border-gray-800 p-6 min-h-[320px] overflow-hidden">
          <div className="space-y-3">
            <h2 className="text-h2">간단 캘리브레이션</h2>
            <p className="text-body-2 text-gray-600 dark:text-gray-300">
              &quot;캘리브레이션 시작&quot;을 눌러 5개의 점을 각각 한 번씩 클릭하면 완료됩니다. 간단하게 설정할 수 있습니다.
            </p>
            <button
              onClick={() => startCalibration()}
              className="h-11 px-4 rounded-full bg-black text-white hover:opacity-90"
            >
              {calStatus === "running" ? "진행 중..." : "캘리브레이션 시작"}
            </button>
            {calStatus === "completed" && (
              <div className="text-emerald-600 text-body-2">
                캘리브레이션 완료! 정확도(평균 분산):{" "}
                {accuracy != null ? `${accuracy.toFixed(1)}px` : "측정 불가"}.
              </div>
            )}
            <button
              onClick={() => resetCalibration()}
              className="h-10 px-3 rounded-full border border-gray-300 dark:border-gray-700"
            >
              캘리브레이션 리셋
            </button>
          </div>
        </section>

        {/* 루틴 섹션 */}
        <RoutineSection
          routines={routines}
          onRoutineUpdate={handleRoutineUpdate}
        />

        {/* SLAM 기기 제어 섹션 */}
        <section className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-h2 bg-gradient-to-r from-gray-900 to-gray-700 dark:from-gray-100 dark:to-gray-300 bg-clip-text text-transparent">
              기기 제어
            </h2>
            <div className="flex items-center justify-between gap-3 text-sm bg-blue-50 dark:bg-blue-950/30 px-4 py-2 rounded-lg border border-blue-200 dark:border-blue-800">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-full border-2 border-blue-500 bg-white dark:bg-gray-800 flex items-center justify-center shadow-sm">
                  <span className="text-xs font-bold text-blue-600 dark:text-blue-400">{dwellPercent}%</span>
                </div>
                <span className="text-blue-700 dark:text-blue-400 font-medium">드웰 진행도</span>
              </div>
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min="1"
                  max="10"
                  value={dwellTime}
                  onChange={(e) => setDwellTime(Number(e.target.value))}
                  className="w-24 h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-600"
                  style={{
                    background: `linear-gradient(to right, #3b82f6 0%, #3b82f6 ${((dwellTime - 1) / 9) * 100}%, #e5e7eb ${((dwellTime - 1) / 9) * 100}%, #e5e7eb 100%)`,
                  }}
                />
                <div className="text-sm font-semibold text-blue-700 dark:text-blue-400 w-8 text-right">
                  {dwellTime}초
                </div>
              </div>
            </div>
          </div>
          <Device3DView
            devices={devices}
            onDeviceClick={handleDeviceClick}
            isActive={(deviceId) => snappedDeviceId === deviceId}
            dwellProgress={(deviceId) => snappedDeviceId === deviceId ? dwellPercent : 0}
          />
        </section>

        {/* 가상 커서 오버레이 */}
        {sensorReady && (
          <div className="pointer-events-none fixed inset-0">
            <div
              className={`absolute rounded-full z-50 ${
                snappedDeviceId 
                  ? "border-4 border-blue-500 shadow-[0_0_20px_rgba(59,130,246,1)]" 
                  : "border-4 border-red-500 shadow-[0_0_20px_rgba(239,68,68,1)]"
              }`}
              style={{
                width: "24px",
                height: "24px",
                left: `${Math.max(0, Math.min(window.innerWidth, gaze.x - 12))}px`,
                top: `${Math.max(0, Math.min(window.innerHeight, gaze.y - 12))}px`,
                transition: "left 50ms linear, top 50ms linear",
              }}
            />
            <div
              className={`absolute rounded-full z-50 ${
                snappedDeviceId ? "bg-blue-500" : "bg-red-500"
              }`}
              style={{
                width: "12px",
                height: "12px",
                left: `${Math.max(0, Math.min(window.innerWidth, gaze.x - 6))}px`,
                top: `${Math.max(0, Math.min(window.innerHeight, gaze.y - 6))}px`,
                transition: "left 50ms linear, top 50ms linear",
                boxShadow: "0 0 10px rgba(0,0,0,0.8)",
              }}
            />
          </div>
        )}

        {/* 디버그: gaze 좌표 표시 (개발용) */}
        {process.env.NODE_ENV === "development" && sensorReady && (
          <div className="fixed top-4 right-4 bg-black/70 text-white px-3 py-2 rounded text-xs font-mono z-50">
            Gaze: ({Math.round(gaze.x)}, {Math.round(gaze.y)})
          </div>
        )}

        {/* 입력 방식 표시: 하단 고정 */}
        <div className="fixed bottom-0 left-0 right-0 bg-blue-50 dark:bg-blue-950/30 border-t border-blue-200 dark:border-blue-800 shadow-lg z-40 px-6 md:px-10 py-3">
          <div className="max-w-7xl mx-auto flex items-center justify-center">
            <div className="px-4 py-2 rounded-lg text-xl bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-800 font-medium">
              입력 방식: 시선 추적
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

