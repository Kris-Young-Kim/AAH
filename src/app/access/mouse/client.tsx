"use client";

import { useEffect, useState, useTransition } from "react";
import { useAuth } from "@clerk/nextjs";
import { toggleDeviceStatus, listDevices } from "../../actions";
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

export default function MouseClient({
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

  useDeviceSync();

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    setDevices(initialDevices);
  }, [initialDevices, setDevices]);

  const handleDeviceClick = (device: Device) => {
    startTransition(async () => {
      await toggleDeviceStatus({
        deviceId: device.id,
        isActive: !device.is_active,
      });
    });
  };

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
            사용자 모드 - 직접 선택
          </h1>
          <p className="text-body-2 text-gray-600 dark:text-gray-300 mt-2">
            마우스, 트랙패드, 터치스크린을 사용하여 기기를 직접 클릭하여 제어하세요.
          </p>
        </div>

        {/* 루틴 섹션 */}
        <RoutineSection
          routines={routines}
          onRoutineUpdate={handleRoutineUpdate}
        />

        {/* SLAM 기기 제어 섹션: 3D 공간에서 기기 제어 */}
        <section className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-h2 bg-gradient-to-r from-gray-900 to-gray-700 dark:from-gray-100 dark:to-gray-300 bg-clip-text text-transparent">
              기기 제어
            </h2>
          </div>
          <Device3DView
            devices={devices}
            onDeviceClick={handleDeviceClick}
          />
        </section>

        {/* 입력 방식 표시: 하단 고정 */}
        <div className="fixed bottom-0 left-0 right-0 bg-blue-50 dark:bg-blue-950/30 border-t border-blue-200 dark:border-blue-800 shadow-lg z-40 px-6 md:px-10 py-3">
          <div className="max-w-7xl mx-auto flex items-center justify-center">
            <div className="px-4 py-2 rounded-lg text-xl bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-800 font-medium">
              입력 방식: 직접 선택
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

