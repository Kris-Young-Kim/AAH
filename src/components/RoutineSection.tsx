"use client";

import { useState } from "react";
import { executeRoutine, listDevices } from "@/app/actions";
import { useAuth } from "@clerk/nextjs";
import type { Database } from "@/database.types";

type Routine = Database["public"]["Tables"]["routines"]["Row"] & {
  routine_devices: Array<{
    id: string;
    device_id: string;
    target_state: boolean;
    order_index: number;
    devices: Database["public"]["Tables"]["devices"]["Row"] | null;
  }>;
};

interface RoutineSectionProps {
  routines: Routine[];
  onRoutineUpdate?: () => void;
  isSwitchActive?: (routineId: string) => boolean;
}

export function RoutineSection({
  routines,
  onRoutineUpdate,
  isSwitchActive = () => false,
}: RoutineSectionProps) {
  const { userId } = useAuth();
  const [executingRoutineId, setExecutingRoutineId] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const handleExecuteRoutine = async (routineId: string) => {
    if (!userId) {
      console.error("[routine] 루틴 실행 실패: 사용자 ID 없음");
      return;
    }

    setPending(true);
    setExecutingRoutineId(routineId);
    try {
      console.log("[routine] 루틴 실행 시작", { routineId });
      await executeRoutine({ routineId });
      console.log("[routine] 루틴 실행 완료, 기기 목록 새로고침");
      
      // 루틴 실행 후 기기 목록을 다시 불러와서 클라이언트 상태 업데이트
      if (onRoutineUpdate) {
        await onRoutineUpdate();
      }
    } catch (error) {
      console.error("[routine] 루틴 실행 실패", error);
      alert("루틴 실행에 실패했습니다.");
    } finally {
      setPending(false);
      setExecutingRoutineId(null);
    }
  };

  if (routines.length === 0) {
    return null;
  }

  return (
    <section className="space-y-4">
      <h2 className="text-h2 bg-gradient-to-r from-gray-900 to-gray-700 dark:from-gray-100 dark:to-gray-300 bg-clip-text text-transparent">
        일상 루틴
      </h2>
      <div className="grid gap-4 md:grid-cols-2">
        {routines.map((routine) => {
          const isExecuting = executingRoutineId === routine.id;
          const isMorning = routine.time_type === "morning";
          const isEvening = routine.time_type === "evening";
          const isActive = isSwitchActive(routine.id);
          
          return (
            <div
              key={routine.id}
              className={`rounded-2xl border p-5 transition-all duration-200 ${
                isActive
                  ? "ring-4 ring-blue-500 dark:ring-blue-400 shadow-2xl scale-105"
                  : ""
              } ${
                isMorning
                  ? "bg-gradient-to-br from-yellow-50 to-orange-50 dark:from-yellow-950/30 dark:to-orange-950/30 border-yellow-200 dark:border-yellow-800"
                  : isEvening
                  ? "bg-gradient-to-br from-blue-50 to-purple-50 dark:from-blue-950/30 dark:to-purple-950/30 border-blue-200 dark:border-blue-800"
                  : "bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800"
              }`}
            >
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                    {isMorning ? "🌅" : isEvening ? "🌙" : "⚙️"} {routine.name}
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                    {routine.routine_devices.length}개 기기
                  </p>
                </div>
                <button
                  onClick={() => handleExecuteRoutine(routine.id)}
                  disabled={isExecuting || pending}
                  className={`h-10 px-4 rounded-xl text-sm font-medium transition-all duration-200 ${
                    isExecuting
                      ? "bg-gray-400 text-white cursor-not-allowed"
                      : isActive
                      ? "bg-gradient-to-r from-green-500 to-green-600 text-white shadow-lg shadow-green-500/30 hover:shadow-xl hover:shadow-green-500/40 hover:scale-105 active:scale-95"
                      : "bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-lg shadow-blue-500/30 hover:shadow-xl hover:shadow-blue-500/40 hover:scale-105 active:scale-95"
                  }`}
                >
                  {isExecuting ? "실행 중..." : "실행"}
                </button>
              </div>
              <div className="space-y-1">
                {routine.routine_devices
                  .sort((a, b) => a.order_index - b.order_index)
                  .slice(0, 3)
                  .map((rd, idx) => (
                    <div key={rd.id} className="text-xs text-gray-600 dark:text-gray-400">
                      {idx + 1}. {rd.devices?.name || "알 수 없음"} ({rd.target_state ? "켜기" : "끄기"})
                    </div>
                  ))}
                {routine.routine_devices.length > 3 && (
                  <div className="text-xs text-gray-500 dark:text-gray-500">
                    ... 외 {routine.routine_devices.length - 3}개
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

