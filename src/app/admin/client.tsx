"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useAuth, SignedIn, SignedOut, SignInButton } from "@clerk/nextjs";
import type { Database } from "@/database.types";
import { saveDevice, toggleDeviceStatus } from "../actions";
import { useStore } from "@/hooks/useStore";
import { useDeviceSync } from "@/hooks/useDeviceSync";

type Device = Database["public"]["Tables"]["devices"]["Row"];

type Props = {
  clerkUserId: string;
  initialDevices: Device[];
};

function useOrientationVector() {
  const [orientation, setOrientation] = useState<{
    alpha: number;
    beta: number;
    gamma: number;
  }>({ alpha: 0, beta: 0, gamma: 0 });

  useEffect(() => {
    const handler = (event: DeviceOrientationEvent) => {
      setOrientation({
        alpha: event.alpha ?? 0,
        beta: event.beta ?? 0,
        gamma: event.gamma ?? 0,
      });
    };
    window.addEventListener("deviceorientation", handler);
    return () => window.removeEventListener("deviceorientation", handler);
  }, []);

  return useMemo(() => {
    const yaw = (orientation.alpha * Math.PI) / 180;
    const pitch = (orientation.beta * Math.PI) / 180;
    const x = Math.sin(yaw) * Math.cos(pitch) * 2;
    const y = Math.sin(pitch) * 2;
    const z = Math.cos(yaw) * Math.cos(pitch) * -2;
    return { x, y, z };
  }, [orientation]);
}

export default function AdminClient({ clerkUserId, initialDevices }: Props) {
  const { isSignedIn } = useAuth();
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState("");
  const [iconType, setIconType] = useState<"light" | "tv" | "fan">("light");
  const setDevices = useStore((s) => s.setDevices);
  const devices = useStore((s) => s.devices);
  const direction = useOrientationVector();

  useDeviceSync();

  useEffect(() => {
    setDevices(initialDevices);
  }, [initialDevices, setDevices]);

  const handleAdd = () => {
    if (!name) return;
    startTransition(async () => {
      console.log("[admin] saveDevice 요청", { name, iconType, direction });
      await saveDevice({
        clerkUserId,
        name,
        iconType,
        position: direction,
      });
      setName("");
    });
  };

  const handleToggle = (device: Device) => {
    startTransition(async () => {
      await toggleDeviceStatus({
        deviceId: device.id,
        isActive: !device.is_active,
      });
    });
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
    <div className="min-h-screen px-6 md:px-10 py-8 space-y-8">
      <div className="space-y-2">
        <h1 className="text-display-2">보호자 모드</h1>
        <p className="text-body-2 text-gray-600 dark:text-gray-300">
          카메라를 비추고 조준점에 맞춰 가상 버튼을 추가하세요. (방향벡터 기반
          2m 앞 위치 저장)
        </p>
        <div className="text-sm text-orange-600 dark:text-orange-400">
          iOS: 센서 권한을 위해 “시작하기” 버튼(아래 권한 안내)을 눌러주세요.
        </div>
      </div>

      <section className="rounded-2xl border border-gray-200 dark:border-gray-800 p-6 space-y-4">
        <div className="flex flex-wrap items-center gap-4">
          <div className="text-body-2 text-gray-600 dark:text-gray-300">
            현재 방향: x {direction.x.toFixed(2)}, y {direction.y.toFixed(2)}, z{" "}
            {direction.z.toFixed(2)}
          </div>
          <button
            className="h-10 px-3 rounded-full border border-gray-300 dark:border-gray-700"
            onClick={() => alert("디바이스를 향해 조준 후 추가 버튼을 눌러주세요.")}
          >
            조준 안내
          </button>
          <button
            className="h-10 px-3 rounded-full border border-gray-300 dark:border-gray-700"
            onClick={() => {
              if (typeof DeviceOrientationEvent?.requestPermission === "function") {
                DeviceOrientationEvent.requestPermission().catch((err) =>
                  console.error("권한 요청 실패", err)
                );
              }
            }}
          >
            시작하기(iOS 권한)
          </button>
        </div>

        <div className="grid gap-4 md:grid-cols-[1.2fr_1fr]">
          <div className="space-y-3">
            <label className="block">
              <span className="text-body-2-bold">기기 이름</span>
              <input
                className="mt-2 w-full rounded-xl border border-gray-300 dark:border-gray-700 bg-transparent px-3 py-3"
                placeholder="예: 거실 전등"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </label>
            <label className="block">
              <span className="text-body-2-bold">아이콘 타입</span>
              <select
                className="mt-2 w-full rounded-xl border border-gray-300 dark:border-gray-700 bg-transparent px-3 py-3"
                value={iconType}
                onChange={(e) => setIconType(e.target.value as any)}
              >
                <option value="light">light</option>
                <option value="tv">tv</option>
                <option value="fan">fan</option>
              </select>
            </label>
            <button
              disabled={pending}
              onClick={handleAdd}
              className="w-full h-12 rounded-xl bg-black text-white hover:opacity-90 disabled:opacity-60"
            >
              {pending ? "저장 중..." : "현재 방향으로 버튼 추가"}
            </button>
          </div>

          <div className="rounded-xl border border-dashed border-gray-300 dark:border-gray-700 p-4 flex items-center justify-center">
            <div className="text-center space-y-2">
              <div className="w-16 h-16 rounded-full border-4 border-blue-500/30 border-t-blue-500 animate-spin mx-auto" />
              <p className="text-body-2 text-gray-600 dark:text-gray-300">
                카메라 중앙 조준점에 맞춰 원하는 기기를 바라본 뒤 추가하세요.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-h2">기기 목록</h2>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {devices.map((device) => (
            <div
              key={device.id}
              className="rounded-xl border border-gray-200 dark:border-gray-800 p-4 flex flex-col gap-2"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-body-2-bold">{device.name}</p>
                  <p className="text-sm text-gray-500">
                    {device.icon_type} · {device.is_active ? "On" : "Off"}
                  </p>
                </div>
                <button
                  onClick={() => handleToggle(device)}
                  className={`h-9 px-3 rounded-full text-sm ${
                    device.is_active
                      ? "bg-emerald-500 text-white"
                      : "bg-gray-200 dark:bg-gray-800"
                  }`}
                  disabled={pending}
                >
                  {device.is_active ? "끄기" : "켜기"}
                </button>
              </div>
              <div className="text-xs text-gray-500">
                x: {device.position_x.toFixed(2)} / y: {device.position_y.toFixed(2)} / z:{" "}
                {device.position_z.toFixed(2)}
              </div>
            </div>
          ))}
          {devices.length === 0 && (
            <div className="text-gray-500">추가된 기기가 없습니다.</div>
          )}
        </div>
      </section>
    </div>
  );
}

