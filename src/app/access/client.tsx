"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { SignedIn, SignedOut, SignInButton, useAuth } from "@clerk/nextjs";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import {
  DeviceOrientationControls,
  Html,
  Billboard,
} from "@react-three/drei";
import { Vector3 } from "three";
import type { Database } from "@/database.types";
import { toggleDeviceStatus, listRoutines, executeRoutine } from "../actions";
import { useStore } from "@/hooks/useStore";
import { useDeviceSync } from "@/hooks/useDeviceSync";
import { useWebGazer } from "@/hooks/useWebGazer";
import { useWebGazerCalibration } from "@/hooks/useWebGazerCalibration";
import { trackEvent } from "@/lib/analytics";

type Device = Database["public"]["Tables"]["devices"]["Row"];

type RoutineDevice = {
  id: string;
  device_id: string;
  target_state: boolean;
  order_index: number;
  devices: {
    id: string;
    name: string;
    icon_type: string;
  } | null;
};

type Routine = {
  id: string;
  user_id: string;
  name: string;
  time_type: "morning" | "evening" | "custom";
  created_at: string;
  updated_at: string;
  routine_devices: RoutineDevice[];
};

type Props = {
  clerkUserId: string;
  initialDevices: Device[];
  inputMode: "eye" | "mouse" | "switch";
  initialRoutines: Routine[];
};

export default function AccessClient({
  initialDevices,
  inputMode,
  initialRoutines,
}: Props) {
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
  const { startWebGazer, isLoaded: webgazerLoaded } = useWebGazer();
  const setInputMode = useStore((s) => s.setInputMode);

  // 입력 방식 설정
  useEffect(() => {
    setInputMode(inputMode);
  }, [inputMode, setInputMode]);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    setDevices(initialDevices);
  }, [initialDevices, setDevices]);

  const [routines, setRoutines] = useState<Routine[]>(initialRoutines);
  const [executingRoutineId, setExecutingRoutineId] = useState<string | null>(null);
  const [videoReady, setVideoReady] = useState(false);
  const [videoError, setVideoError] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const handleExecuteRoutine = async (routineId: string) => {
    setExecutingRoutineId(routineId);
    startTransition(async () => {
      try {
        await executeRoutine({ routineId });
        trackEvent({ name: "routine_executed", properties: { routineId } });
        // 루틴 실행 후 기기 상태 동기화를 위해 잠시 대기
        await new Promise((resolve) => setTimeout(resolve, 500));
        setExecutingRoutineId(null);
      } catch (error) {
        console.error("[access] 루틴 실행 실패", error);
        alert("루틴 실행에 실패했습니다.");
        setExecutingRoutineId(null);
      }
    });
  };

  // 보안: 카메라 스트림은 클라이언트에서만 사용되며 서버로 전송되지 않습니다.
  const startVideo = async () => {
    setVideoError(null);
    
    // 기존 스트림이 있으면 먼저 정리
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user" },
        audio: false,
      });
      streamRef.current = stream;
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setVideoReady(true);
        console.log("[access] 웹캠 스트림 시작 (로컬 처리만, 서버 미전송)");
      }
    } catch (err: any) {
      console.error("[access] 웹캠 권한 요청 실패", err);
      setVideoReady(false);
      
      if (err.name === "NotAllowedError") {
        setVideoError(
          "웹캠 권한이 거부되었습니다.\n\n" +
          "해결 방법:\n" +
          "1. 브라우저 주소창 왼쪽의 자물쇠 아이콘을 클릭하세요\n" +
          "2. '카메라' 권한을 '허용'으로 변경하세요\n" +
          "3. 페이지를 새로고침한 후 다시 시도하세요"
        );
      } else if (err.name === "NotFoundError") {
        setVideoError("카메라를 찾을 수 없습니다. 카메라가 연결되어 있는지 확인해주세요.");
      } else if (err.name === "NotReadableError" || err.message?.includes("Device in use") || err.message?.includes("in use")) {
        setVideoError(
          "카메라가 다른 애플리케이션에서 사용 중입니다.\n\n" +
          "해결 방법:\n" +
          "1. 다른 애플리케이션(예: Zoom, Teams, 다른 브라우저 탭)에서 카메라를 종료하세요\n" +
          "2. 이 페이지를 새로고침하세요\n" +
          "3. 다시 'AR 뷰 시작' 버튼을 클릭하세요"
        );
      } else if (err.name === "OverconstrainedError") {
        setVideoError(
          "요청한 카메라 설정을 지원하지 않습니다.\n\n" +
          "다른 카메라를 사용하거나 브라우저 설정을 확인해주세요."
        );
      } else {
        setVideoError(
          `웹캠 권한 요청 실패: ${err.message || err.name}\n\n` +
          "브라우저 콘솔에서 자세한 오류 정보를 확인할 수 있습니다."
        );
      }
    }
  };

  // 컴포넌트 언마운트 시 스트림 정리
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
    };
  }, []);

  const isIOSPermissionRequired =
    typeof DeviceOrientationEvent !== "undefined" &&
    typeof (DeviceOrientationEvent as any).requestPermission === "function";

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
  ]);

  const dwellPercent = useMemo(
    () => Math.min(100, Math.round((dwellProgressMs / 2000) * 100)),
    [dwellProgressMs]
  );

  const [permissionError, setPermissionError] = useState<string | null>(null);

  const requestSensorPermission = async () => {
    setPermissionError(null);
    
    try {
      // iOS 센서 권한 요청
      if (typeof (DeviceOrientationEvent as any)?.requestPermission === "function") {
        const orientationResult = await (DeviceOrientationEvent as any).requestPermission();
        console.log("[access] orientation permission", orientationResult);
        
        if (orientationResult !== "granted") {
          setPermissionError("센서 권한이 거부되었습니다. 브라우저 설정에서 권한을 허용해주세요.");
          return;
        }
      }

      // WebGazer가 로드될 때까지 대기
      if (!webgazerLoaded) {
        setPermissionError("WebGazer가 아직 로드되지 않았습니다. 잠시 후 다시 시도해주세요.");
        return;
      }

      // 먼저 웹캠 권한을 명시적으로 요청 (사용자 인터랙션 후)
      let stream: MediaStream | null = null;
      try {
        console.log("[access] 웹캠 권한 요청 중...");
        stream = await navigator.mediaDevices.getUserMedia({ 
          video: { 
            facingMode: "user", // 전면 카메라 우선
            width: { ideal: 640 },
            height: { ideal: 480 }
          } 
        });
        console.log("[access] 웹캠 권한 허용됨");
        
        // 권한이 허용되면 스트림 종료 (WebGazer가 다시 요청할 것)
        stream.getTracks().forEach((track) => track.stop());
        stream = null;
      } catch (err: any) {
        if (err.name === "NotAllowedError") {
          setPermissionError(
            "웹캠 권한이 거부되었습니다.\n\n" +
            "해결 방법:\n" +
            "1. 브라우저 주소창 왼쪽의 자물쇠 아이콘을 클릭하세요\n" +
            "2. '카메라' 권한을 '허용'으로 변경하세요\n" +
            "3. 페이지를 새로고침한 후 다시 시도하세요"
          );
          return;
        } else if (err.name === "NotFoundError") {
          setPermissionError("카메라를 찾을 수 없습니다. 카메라가 연결되어 있는지 확인해주세요.");
          return;
        } else if (err.name === "NotReadableError" || err.message?.includes("Device in use") || err.message?.includes("in use")) {
          setPermissionError(
            "카메라가 다른 애플리케이션에서 사용 중입니다.\n\n" +
            "해결 방법:\n" +
            "1. 다른 애플리케이션(예: Zoom, Teams, 다른 브라우저 탭)에서 카메라를 종료하세요\n" +
            "2. 이 페이지를 새로고침하세요\n" +
            "3. 다시 '시작하기' 버튼을 클릭하세요"
          );
          return;
        } else if (err.name === "OverconstrainedError") {
          setPermissionError(
            "요청한 카메라 설정을 지원하지 않습니다.\n\n" +
            "다른 카메라를 사용하거나 브라우저 설정을 확인해주세요."
          );
          return;
        } else {
          setPermissionError(
            `웹캠 권한 요청 실패: ${err.message || err.name}\n\n` +
            "브라우저 콘솔에서 자세한 오류 정보를 확인할 수 있습니다."
          );
          return;
        }
      }

      // 권한이 허용된 후 WebGazer 시작
      try {
        console.log("[access] WebGazer 시작 중...");
        const success = await startWebGazer();
        if (success) {
          console.log("[access] WebGazer 시작 성공");
          setPermissionError(null);
        }
      } catch (err: any) {
        console.error("[access] WebGazer 시작 실패", err);
        if (err.message?.includes("권한")) {
          setPermissionError(err.message);
        } else {
          setPermissionError(`WebGazer 시작 실패: ${err.message || err.name}`);
        }
      }
    } catch (err: any) {
      setPermissionError(`권한 요청 중 오류가 발생했습니다: ${err.message}`);
      console.error("[access] 권한 요청 실패", err);
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

  // 입력 방식에 따른 처리
  const isEyeMode = inputMode === "eye";
  const isMouseMode = inputMode === "mouse";
  const isSwitchMode = inputMode === "switch";

  // 마우스 모드: 직접 클릭으로 기기 제어
  const handleMouseClick = useCallback((device: Device) => {
    startTransition(async () => {
      await toggleDeviceStatus({
        deviceId: device.id,
        isActive: !device.is_active,
      });
      trackEvent({
        name: "device_clicked",
        properties: {
          deviceId: device.id,
          deviceName: device.name,
          method: "mouse",
        },
      });
    });
  }, [startTransition]);

  // 스위치 모드: 스캔 방식 (순차적으로 하이라이트)
  const [switchIndex, setSwitchIndex] = useState(0);
  const [scanSpeed, setScanSpeed] = useState<1 | 2 | 3>(2); // 1초/2초/3초 선택 가능
  const switchIntervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (isSwitchMode && devices.length > 0) {
      const intervalMs = scanSpeed * 1000; // 스캔 속도에 따라 간격 조정
      switchIntervalRef.current = setInterval(() => {
        setSwitchIndex((prev) => (prev + 1) % devices.length);
      }, intervalMs);
      return () => {
        if (switchIntervalRef.current) {
          clearInterval(switchIntervalRef.current);
        }
      };
    } else {
      if (switchIntervalRef.current) {
        clearInterval(switchIntervalRef.current);
      }
    }
  }, [isSwitchMode, devices.length, scanSpeed]);

  // 스위치 모드: 스페이스바 또는 엔터 키로 선택
  useEffect(() => {
    if (!isSwitchMode) return;

    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.key === " " || e.key === "Enter") {
        e.preventDefault();
        if (devices.length === 0) return;
        const device = devices[switchIndex];
        handleMouseClick(device);
      }
    };

    window.addEventListener("keydown", handleKeyPress);
    return () => {
      window.removeEventListener("keydown", handleKeyPress);
    };
  }, [isSwitchMode, devices, switchIndex, handleMouseClick]);

  // Hydration 오류 방지: 클라이언트 마운트 후에만 조건부 렌더링
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

  const handleSwitchClick = () => {
    if (devices.length === 0) return;
    const device = devices[switchIndex];
    handleMouseClick(device);
  };

  return (
    <div className="min-h-screen px-6 md:px-10 py-8 space-y-6">
      <div className="space-y-4">
        <div className="flex flex-wrap gap-3 items-center">
          <h1 className="text-display-2 bg-gradient-to-r from-blue-600 via-purple-600 to-blue-600 bg-clip-text text-transparent">
            사용자 모드
          </h1>
        </div>
        <div className="flex flex-wrap gap-3 items-center">
          {isEyeMode && (
            <>
              <button
                className="h-11 px-5 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:border-blue-300 dark:hover:border-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/30 hover:shadow-md transition-all duration-200 font-medium"
                onClick={requestSensorPermission}
              >
                시작하기(센서 권한)
              </button>
              <button
                className="h-11 px-5 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:border-blue-300 dark:hover:border-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/30 hover:shadow-md transition-all duration-200 font-medium"
                onClick={resetView}
              >
                뷰 리셋
              </button>
              <div className={`px-4 py-2 rounded-lg text-sm font-medium ${
                sensorReady 
                  ? "bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800" 
                  : "bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-700"
              }`}>
                센서 상태: {sensorReady ? "✓ 준비 완료" : "대기"}
              </div>
            </>
          )}
          {isSwitchMode && (
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800">
                <span className="text-sm text-blue-700 dark:text-blue-300 font-medium">스캔 속도:</span>
                <div className="flex gap-1">
                  {([1, 2, 3] as const).map((speed) => (
                    <button
                      key={speed}
                      onClick={() => setScanSpeed(speed)}
                      className={`px-3 py-1 rounded text-xs font-medium transition-all ${
                        scanSpeed === speed
                          ? "bg-blue-600 text-white shadow-md"
                          : "bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-blue-100 dark:hover:bg-blue-900/50"
                      }`}
                    >
                      {speed}초
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
          <div className="px-4 py-2 rounded-lg text-sm bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-800 font-medium">
            입력 방식: {inputMode === "mouse" ? "마우스 클릭" : inputMode === "switch" ? "스위치 클릭" : "시선 추적"}
          </div>
        </div>
      </div>
      {permissionError && (
        <div className="rounded-xl border border-red-300 dark:border-red-700 bg-red-50 dark:bg-red-950/40 p-4">
          <p className="text-sm text-red-700 dark:text-red-300 font-medium mb-2">
            권한 오류
          </p>
          <pre className="text-sm text-red-600 dark:text-red-400 whitespace-pre-wrap font-sans">
            {permissionError}
          </pre>
          <button
            onClick={() => setPermissionError(null)}
            className="mt-3 h-9 px-4 rounded-full bg-red-600 text-white text-sm hover:bg-red-700 transition-colors"
          >
            닫기
          </button>
        </div>
      )}

      {/* 일상 루틴 섹션 */}
      {routines.length > 0 && (
        <section className="space-y-4">
          <h2 className="text-h2 bg-gradient-to-r from-gray-900 to-gray-700 dark:from-gray-100 dark:to-gray-300 bg-clip-text text-transparent">
            일상 루틴
          </h2>
          <div className="grid gap-4 md:grid-cols-2">
            {routines.map((routine) => {
              const isExecuting = executingRoutineId === routine.id;
              const isMorning = routine.time_type === "morning";
              const isEvening = routine.time_type === "evening";
              return (
                <div
                  key={routine.id}
                  className={`rounded-2xl border p-5 transition-all duration-200 ${
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
      )}

      {/* 시선 추적 모드: 캘리브레이션 섹션 */}
      {isEyeMode && (
        <section className="relative rounded-2xl border border-gray-200 dark:border-gray-800 p-6 min-h-[320px] overflow-hidden">
          <div className="space-y-3">
            <h2 className="text-h2">9점 캘리브레이션</h2>
            <p className="text-body-2 text-gray-600 dark:text-gray-300">
              &quot;캘리브레이션 시작&quot;을 눌러 9점 오버레이를 완료하면 정확도 피드백이 표시됩니다.
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
      )}

      <section className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-h2 bg-gradient-to-r from-gray-900 to-gray-700 dark:from-gray-100 dark:to-gray-300 bg-clip-text text-transparent">
            기기 제어
          </h2>
          {isEyeMode && (
            <div className="flex items-center gap-2 text-sm bg-blue-50 dark:bg-blue-950/30 px-4 py-2 rounded-lg border border-blue-200 dark:border-blue-800">
              <div className="w-7 h-7 rounded-full border-2 border-blue-500 bg-white dark:bg-gray-800 flex items-center justify-center shadow-sm">
                <span className="text-xs font-bold text-blue-600 dark:text-blue-400">{dwellPercent}%</span>
              </div>
              <span className="text-blue-700 dark:text-blue-400 font-medium">드웰 진행도 (2초)</span>
            </div>
          )}
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {devices.map((device, index) => {
            const active = isEyeMode && snappedDeviceId === device.id;
            const switchActive = isSwitchMode && switchIndex === index;
            const isHighlighted = active || switchActive;
            
            return (
              <div
                key={device.id}
                ref={(el) => {
                  cardRefs.current[device.id] = el;
                }}
                onMouseEnter={() => {
                  if (isMouseMode) {
                    setSnappedDevice(device.id);
                  }
                }}
                onMouseLeave={() => {
                  if (isMouseMode) {
                    setSnappedDevice(null);
                  }
                }}
                onClick={() => {
                  if (isMouseMode) {
                    handleMouseClick(device);
                  }
                }}
                className={`rounded-2xl border p-5 transition-all duration-200 ${
                  isHighlighted
                    ? "border-blue-500 shadow-xl ring-4 ring-blue-500/30 scale-105 bg-gradient-to-br from-blue-50 to-white dark:from-blue-950/30 dark:to-gray-900"
                    : "border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900"
                } ${device.is_active ? "bg-gradient-to-br from-yellow-50 to-emerald-50 dark:from-yellow-950/40 dark:to-emerald-950/20 border-emerald-300 dark:border-emerald-700" : ""} ${
                  isMouseMode ? "cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 hover:border-gray-300 dark:hover:border-gray-700 hover:shadow-md" : ""
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex-1">
                    <p className="text-body-2-bold text-gray-900 dark:text-gray-100">{device.name}</p>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                      {device.icon_type} · <span className={device.is_active ? "text-emerald-600 dark:text-emerald-400 font-medium" : "text-gray-500"}>{device.is_active ? "On" : "Off"}</span>
                    </p>
                  </div>
                  <div className={`w-3 h-3 rounded-full ${device.is_active ? "bg-emerald-500 shadow-lg shadow-emerald-500/50" : "bg-gray-300 dark:bg-gray-600"}`} />
                </div>
                {isEyeMode && (
                  <div className="text-xs text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-800/50 px-2 py-1 rounded">
                    {active ? "스냅됨" : "스냅 반경 1.5x"}
                  </div>
                )}
                {isSwitchMode && switchActive && (
                  <div className="text-xs text-blue-600 dark:text-blue-400 font-semibold bg-blue-50 dark:bg-blue-950/30 px-2 py-1 rounded border border-blue-200 dark:border-blue-800">
                    ✓ 선택됨
                  </div>
                )}
                {isEyeMode && active && (
                  <div className="mt-3 h-2.5 w-full rounded-full bg-gray-200 dark:bg-gray-800 overflow-hidden shadow-inner">
                    <div
                      className="h-full bg-gradient-to-r from-blue-500 to-blue-600 transition-[width] duration-100 shadow-sm"
                      style={{ width: `${dwellPercent}%` }}
                    />
                  </div>
                )}
              </div>
            );
          })}
          {devices.length === 0 && (
            <div className="col-span-full text-center py-12 text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-900/50 rounded-2xl border border-dashed border-gray-300 dark:border-gray-700">
              배치된 기기가 없습니다.
            </div>
          )}
        </div>
      </section>

      {/* 가상 커서 오버레이 (시선 추적 모드만) */}
      {isEyeMode && sensorReady && (
        <div className="pointer-events-none fixed inset-0">
          {/* 외곽 링 */}
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
          {/* 내부 점 */}
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

      {/* 스캔 모드 하단 고정 UI */}
      {isSwitchMode && devices.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 bg-gradient-to-t from-blue-600 to-blue-500 dark:from-blue-700 dark:to-blue-600 text-white shadow-2xl z-50 border-t-4 border-blue-400 dark:border-blue-500">
          <div className="max-w-7xl mx-auto px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-16 h-16 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center border-4 border-white/40 shadow-lg">
                    <span className="text-2xl font-bold">{switchIndex + 1}</span>
                  </div>
                  <div>
                    <div className="text-sm opacity-90">현재 선택된 기기</div>
                    <div className="text-xl font-bold">{devices[switchIndex]?.name || "없음"}</div>
                    <div className="text-xs opacity-75 mt-0.5">
                      {devices[switchIndex]?.icon_type} · {devices[switchIndex]?.is_active ? "On" : "Off"}
                    </div>
                  </div>
                </div>
                <div className="h-12 w-px bg-white/30" />
                <div className="text-sm">
                  <div className="opacity-90">전체 기기</div>
                  <div className="text-lg font-semibold">
                    {switchIndex + 1} / {devices.length}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="text-right text-sm">
                  <div className="opacity-90">스캔 속도</div>
                  <div className="text-lg font-semibold">{scanSpeed}초</div>
                </div>
                <button
                  onClick={() => {
                    if (devices.length === 0) return;
                    const device = devices[switchIndex];
                    handleMouseClick(device);
                  }}
                  className="h-14 px-8 rounded-xl bg-white text-blue-600 font-bold text-lg shadow-xl hover:shadow-2xl hover:scale-105 active:scale-95 transition-all duration-200 flex items-center gap-2"
                >
                  <span>🔘</span>
                  <span>선택하기</span>
                </button>
                <div className="text-xs opacity-75 text-center">
                  <div>스페이스바</div>
                  <div>또는 엔터</div>
                </div>
              </div>
            </div>
            {/* 진행 바 */}
            <div className="mt-3 h-1.5 bg-white/20 rounded-full overflow-hidden">
              <div
                className="h-full bg-white transition-all duration-300 ease-linear"
                style={{
                  width: `${((switchIndex + 1) / devices.length) * 100}%`,
                }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function MarkerMesh({ device }: { device: Device }) {
  const color = device.is_active ? "#22c55e" : "#3b82f6";
  return (
    <group position={[device.position_x, device.position_y, device.position_z]}>
      {/* 빌보드 스프라이트: 항상 카메라를 향해 회전, 가벼운 렌더링으로 FPS 30+ 유지 */}
      <Billboard>
        <mesh>
          <circleGeometry args={[0.1, 16]} />
          <meshBasicMaterial color={color} />
        </mesh>
      </Billboard>
      <Html distanceFactor={4} position={[0.12, 0.12, 0]}>
        <div className="rounded-md bg-black/70 text-white px-2 py-1 text-xs shadow-lg whitespace-nowrap">
          {device.name} · {device.icon_type}
        </div>
      </Html>
    </group>
  );
}

