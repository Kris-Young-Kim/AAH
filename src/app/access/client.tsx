"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { SignedIn, SignedOut, SignInButton, useAuth } from "@clerk/nextjs";
import type { Database } from "@/database.types";
import { toggleDeviceStatus } from "../actions";
import { useStore } from "@/hooks/useStore";
import { useDeviceSync } from "@/hooks/useDeviceSync";
import { useWebGazer } from "@/hooks/useWebGazer";
import { useWebGazerCalibration } from "@/hooks/useWebGazerCalibration";

type Device = Database["public"]["Tables"]["devices"]["Row"];

type Props = {
  clerkUserId: string;
  initialDevices: Device[];
};

export default function AccessClient({ initialDevices }: Props) {
  const { isSignedIn } = useAuth();
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
  const { status: calStatus, accuracy, startCalibration, resetCalibration } =
    useWebGazerCalibration();
  const cardRefs = useRef<Record<string, HTMLDivElement | null>>({});

  useDeviceSync();
  useWebGazer();

  useEffect(() => {
    setDevices(initialDevices);
  }, [initialDevices, setDevices]);

  useEffect(() => {
    if (snappedDeviceId) {
      dwellStartRef.current = performance.now();
      const interval = setInterval(() => {
        if (!dwellStartRef.current) return;
        const elapsed = performance.now() - dwellStartRef.current;
        setDwellProgress(elapsed);
        if (elapsed >= 2000) {
          const target = devices.find((d) => d.id === snappedDeviceId);
          if (target) {
            startTransition(async () => {
              console.log("[dwell] trigger", { deviceId: target.id });
              await toggleDeviceStatus({
                deviceId: target.id,
                isActive: !target.is_active,
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
  ]);

  const dwellPercent = useMemo(
    () => Math.min(100, Math.round((dwellProgressMs / 2000) * 100)),
    [dwellProgressMs]
  );

  const requestSensorPermission = () => {
    if (typeof DeviceOrientationEvent?.requestPermission === "function") {
      DeviceOrientationEvent.requestPermission()
        .then((res) => console.log("orientation permission", res))
        .catch((err) => console.error("권한 요청 실패", err));
    }
  };
  const resetView = () => {
    setSnappedDevice(null);
    setDwellProgress(0);
  };

  // 가상 커서 + 마그네틱 스냅 (히트박스 1.5배)
  useEffect(() => {
    let rafId: number;
    const loop = () => {
      let nextSnap: string | null = null;
      devices.forEach((device) => {
        const el = cardRefs.current[device.id];
        if (!el) return;
        const rect = el.getBoundingClientRect();
        const expandedWidth = rect.width * 1.5;
        const expandedHeight = rect.height * 1.5;
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;
        const left = cx - expandedWidth / 2;
        const top = cy - expandedHeight / 2;
        const right = cx + expandedWidth / 2;
        const bottom = cy + expandedHeight / 2;
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
  }, [devices, gaze.x, gaze.y, setSnappedDevice, snappedDeviceId]);

  if (!isSignedIn) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <SignedOut>
          <div className="flex flex-col items-center gap-4">
            <p className="text-body-1">로그인이 필요합니다.</p>
            <SignInButton>
              <button className="h-11 px-5 rounded-full bg-black text-white">
                로그인하기
              </button>
            </SignInButton>
          </div>
        </SignedOut>
      </div>
    );
  }

  return (
    <div className="min-h-screen px-6 md:px-10 py-8 space-y-6">
      <div className="flex flex-wrap gap-3 items-center">
        <h1 className="text-display-2">사용자 모드</h1>
        <button
          className="h-10 px-3 rounded-full border border-gray-300 dark:border-gray-700"
          onClick={requestSensorPermission}
        >
          시작하기(센서 권한)
        </button>
        <button
          className="h-10 px-3 rounded-full border border-gray-300 dark:border-gray-700"
          onClick={resetView}
        >
          뷰 리셋
        </button>
        <span className="text-sm text-gray-500">
          센서 상태: {sensorReady ? "준비 완료" : "대기"}
        </span>
      </div>

      <section className="relative rounded-2xl border border-gray-200 dark:border-gray-800 p-6 min-h-[320px] overflow-hidden">
        <div className="space-y-3">
          <h2 className="text-h2">9점 캘리브레이션</h2>
          <p className="text-body-2 text-gray-600 dark:text-gray-300">
            “캘리브레이션 시작”을 눌러 9점 오버레이를 완료하면 정확도 피드백이 표시됩니다.
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

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-h2">기기 제어</h2>
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <div className="w-6 h-6 rounded-full border-2 border-blue-500 flex items-center justify-center">
              <span className="text-xs">{dwellPercent}%</span>
            </div>
            <span>드웰 진행도 (2초)</span>
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {devices.map((device) => {
            const active = snappedDeviceId === device.id;
            return (
              <div
                key={device.id}
                ref={(el) => {
                  cardRefs.current[device.id] = el;
                }}
                onMouseEnter={() => setSnappedDevice(device.id)}
                onMouseLeave={() => setSnappedDevice(null)}
                className={`rounded-xl border p-4 cursor-pointer transition ${
                  active
                    ? "border-blue-500 shadow-lg"
                    : "border-gray-200 dark:border-gray-800"
                } ${device.is_active ? "bg-yellow-50 dark:bg-yellow-950/40" : ""}`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-body-2-bold">{device.name}</p>
                    <p className="text-sm text-gray-500">
                      {device.icon_type} · {device.is_active ? "On" : "Off"}
                    </p>
                  </div>
                  <div className="text-xs text-gray-500">
                    스냅 반경 1.5x 적용
                  </div>
                </div>
                {active && (
                  <div className="mt-3 h-2 w-full rounded-full bg-gray-200 dark:bg-gray-800 overflow-hidden">
                    <div
                      className="h-full bg-blue-500 transition-[width]"
                      style={{ width: `${dwellPercent}%` }}
                    />
                  </div>
                )}
              </div>
            );
          })}
          {devices.length === 0 && (
            <div className="text-gray-500">배치된 기기가 없습니다.</div>
          )}
        </div>
      </section>

      {/* 가상 커서 오버레이 */}
      <div className="pointer-events-none fixed inset-0">
        <div
          className={`absolute w-5 h-5 rounded-full border-2 ${
            snappedDeviceId ? "border-blue-500 shadow-[0_0_12px_rgba(59,130,246,0.8)]" : "border-white shadow-[0_0_8px_rgba(255,255,255,0.6)]"
          } bg-white/20 backdrop-blur`}
          style={{
            transform: `translate(${gaze.x - 10}px, ${gaze.y - 10}px)`,
            transition: "transform 80ms linear",
          }}
        />
      </div>
    </div>
  );
}

