"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { SignedIn, SignedOut, SignInButton, useAuth } from "@clerk/nextjs";
import type { Database } from "@/database.types";
import { toggleDeviceStatus } from "../actions";
import { useStore } from "@/hooks/useStore";
import { useDeviceSync } from "@/hooks/useDeviceSync";
import { useWebGazer } from "@/hooks/useWebGazer";

type Device = Database["public"]["Tables"]["devices"]["Row"];

type Props = {
  clerkUserId: string;
  initialDevices: Device[];
};

const calibrationPoints = [
  { x: 10, y: 10 },
  { x: 50, y: 10 },
  { x: 90, y: 10 },
  { x: 10, y: 50 },
  { x: 50, y: 50 },
  { x: 90, y: 50 },
  { x: 10, y: 90 },
  { x: 50, y: 90 },
  { x: 90, y: 90 },
];

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
  const [calibrationStep, setCalibrationStep] = useState(0);
  const [calibrationDone, setCalibrationDone] = useState(false);
  const dwellStartRef = useRef<number | null>(null);

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
      DeviceOrientationEvent.requestPermission().catch((err) =>
        console.error("권한 요청 실패", err)
      );
    }
  };

  const handleCalibrationClick = () => {
    if (calibrationStep >= calibrationPoints.length - 1) {
      setCalibrationDone(true);
    }
    setCalibrationStep((prev) => Math.min(calibrationPoints.length - 1, prev + 1));
  };

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
        <span className="text-sm text-gray-500">
          센서 상태: {sensorReady ? "준비 완료" : "대기"}
        </span>
      </div>

      <section className="relative rounded-2xl border border-gray-200 dark:border-gray-800 p-6 min-h-[320px] overflow-hidden">
        {!calibrationDone && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div
              className="w-6 h-6 rounded-full bg-red-500 shadow-lg"
              style={{
                position: "absolute",
                left: `${calibrationPoints[calibrationStep].x}%`,
                top: `${calibrationPoints[calibrationStep].y}%`,
                transform: "translate(-50%, -50%)",
              }}
            />
          </div>
        )}
        <div className="space-y-3">
          <h2 className="text-h2">9점 캘리브레이션</h2>
          <p className="text-body-2 text-gray-600 dark:text-gray-300">
            표시된 점을 순서대로 응시하거나 클릭하세요. 끝나면 자동으로 제어 모드가
            활성화됩니다.
          </p>
          <button
            onClick={handleCalibrationClick}
            className="h-11 px-4 rounded-full bg-black text-white hover:opacity-90"
          >
            다음 점으로 이동 ({calibrationStep + 1}/9)
          </button>
          {calibrationDone && (
            <div className="text-emerald-600 text-body-2">
              캘리브레이션 완료! 아래 기기 목록을 응시하면 스냅/드웰이 작동합니다.
            </div>
          )}
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
    </div>
  );
}

