"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useAuth, SignedIn, SignedOut, SignInButton } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { DeviceOrientationControls, OrbitControls, Html, Billboard } from "@react-three/drei";
import { Vector2, Vector3, Raycaster } from "three";
import type { Group } from "three";
import type { Database } from "@/database.types";
import {
  deleteDevice,
  saveDevice,
  toggleDeviceStatus,
  updateInputMode,
  updateDevicePosition,
  listRoutines,
  createRoutine,
  updateRoutine,
  deleteRoutine,
} from "../actions";
import { useStore } from "@/hooks/useStore";
import { useDeviceSync } from "@/hooks/useDeviceSync";
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
  currentInputMode: "eye" | "mouse" | "switch" | "voice";
  initialRoutines: Routine[];
};

// 8방향 기준점 정의 (정규화된 방향 벡터)
const SCAN_DIRECTIONS = [
  { name: "앞", dir: [0, 0, -1], color: "#22c55e" },
  { name: "뒤", dir: [0, 0, 1], color: "#ef4444" },
  { name: "좌", dir: [-1, 0, 0], color: "#3b82f6" },
  { name: "우", dir: [1, 0, 0], color: "#f59e0b" },
  { name: "위", dir: [0, 1, 0], color: "#8b5cf6" },
  { name: "아래", dir: [0, -1, 0], color: "#ec4899" },
  { name: "좌상", dir: [-0.7, 0.7, -0.7], color: "#06b6d4" },
  { name: "우상", dir: [0.7, 0.7, -0.7], color: "#84cc16" },
];

function DirectionTracker({
  onDirection,
  onSensorReady,
  scanning,
  scanProgress,
  onScanProgress,
  useMouseControls,
  onUseMouseControls,
}: {
  onDirection: (dir: { x: number; y: number; z: number }) => void;
  onSensorReady?: (ready: boolean) => void;
  scanning?: boolean;
  scanProgress?: { currentIndex: number; completed: boolean[] };
  onScanProgress?: (progress: { currentIndex: number; completed: boolean[] }) => void;
  useMouseControls?: boolean;
  onUseMouseControls?: (use: boolean) => void;
}) {
  const { camera } = useThree();
  const dirRef = useRef(new Vector3());
  const frameRef = useRef(0);
  const controlsRef = useRef<any>(null);
  const lastDirectionRef = useRef({ x: 0, y: 0, z: -2 });
  const sensorCheckTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // 센서 사용 가능 여부 확인
  useEffect(() => {
    if (useMouseControls) return;
    
    // DeviceOrientation 이벤트가 발생하는지 확인
    const checkSensor = () => {
      let sensorDetected = false;
      const handler = () => {
        sensorDetected = true;
        if (onSensorReady) onSensorReady(true);
        if (onUseMouseControls) onUseMouseControls(false);
      };
      
      window.addEventListener('deviceorientation', handler, { once: true });
      
      // 3초 후에도 센서 이벤트가 없으면 마우스 컨트롤로 전환
      sensorCheckTimeoutRef.current = setTimeout(() => {
        if (!sensorDetected) {
          if (onUseMouseControls) onUseMouseControls(true);
          if (onSensorReady) onSensorReady(true); // 마우스 컨트롤도 "센서 작동"으로 간주
        }
        window.removeEventListener('deviceorientation', handler);
      }, 3000);
    };
    
    checkSensor();
    
    return () => {
      if (sensorCheckTimeoutRef.current) {
        clearTimeout(sensorCheckTimeoutRef.current);
      }
    };
  }, [useMouseControls, onSensorReady, onUseMouseControls]);

  useFrame(() => {
    const dir = dirRef.current;
    camera.getWorldDirection(dir);
    dir.normalize(); // 정규화
    frameRef.current += 1;
    
    // 센서가 작동하는지 확인 (방향이 변경되면 센서 작동 중)
    const dirChanged = 
      Math.abs(dir.x - lastDirectionRef.current.x) > 0.01 ||
      Math.abs(dir.y - lastDirectionRef.current.y) > 0.01 ||
      Math.abs(dir.z - lastDirectionRef.current.z) > 0.01;
    
    if (dirChanged && onSensorReady) {
      onSensorReady(true);
      lastDirectionRef.current = { x: dir.x, y: dir.y, z: dir.z };
    }
    
    // 스캔 모드일 때 방향 체크
    if (scanning && scanProgress && onScanProgress) {
      const currentTarget = SCAN_DIRECTIONS[scanProgress.currentIndex];
      if (currentTarget) {
        const targetDir = new Vector3(...currentTarget.dir);
        const angle = dir.angleTo(targetDir);
        const threshold = Math.PI / 6; // 30도 이내
        
        if (angle < threshold && !scanProgress.completed[scanProgress.currentIndex]) {
          const newCompleted = [...scanProgress.completed];
          newCompleted[scanProgress.currentIndex] = true;
          
          // 다음 방향으로 이동
          let nextIndex = scanProgress.currentIndex;
          for (let i = 0; i < SCAN_DIRECTIONS.length; i++) {
            const checkIndex = (scanProgress.currentIndex + 1 + i) % SCAN_DIRECTIONS.length;
            if (!newCompleted[checkIndex]) {
              nextIndex = checkIndex;
              break;
            }
          }
          
          onScanProgress({
            currentIndex: nextIndex,
            completed: newCompleted,
          });
        }
      }
    }
    
    // 2m 앞 포인트 계산 (방향 표시용)
    const worldDir = dir.clone().multiplyScalar(2);
    
    // 너무 자주 setState하지 않도록 6프레임(≈100ms)마다 샘플
    if (frameRef.current % 6 === 0) {
      onDirection({ x: worldDir.x, y: worldDir.y, z: worldDir.z });
    }
  });

  // 마우스 컨트롤 사용 시 OrbitControls, 아니면 DeviceOrientationControls
  if (useMouseControls) {
    return (
      <OrbitControls
        ref={controlsRef}
        enableZoom={false}
        enablePan={false}
        minPolarAngle={0}
        maxPolarAngle={Math.PI}
      />
    );
  }
  
  return <DeviceOrientationControls ref={controlsRef} />;
}

export default function AdminClient({
  clerkUserId,
  initialDevices,
  currentInputMode,
  initialRoutines,
}: Props) {
  const { isSignedIn } = useAuth();
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState("");
  const [iconType, setIconType] = useState<"light" | "tv" | "fan">("light");
  const [inputMode, setInputMode] = useState<"eye" | "mouse" | "switch" | "voice">(
    currentInputMode
  );
  const setDevices = useStore((s) => s.setDevices);
  const devices = useStore((s) => s.devices);
  const [routines, setRoutines] = useState<Routine[]>(initialRoutines);
  const [showRoutineForm, setShowRoutineForm] = useState(false);
  const [editingRoutine, setEditingRoutine] = useState<Routine | null>(null);
  const [routineName, setRoutineName] = useState("");
  const [routineTimeType, setRoutineTimeType] = useState<
    "morning" | "evening" | "custom"
  >("morning");
  const [selectedDevices, setSelectedDevices] = useState<
    Array<{ deviceId: string; targetState: boolean; orderIndex: number }>
  >([]);
  const [direction, setDirection] = useState<{
    x: number;
    y: number;
    z: number;
  }>({
    x: 0,
    y: 0,
    z: -2,
  });
  const [videoReady, setVideoReady] = useState(false);
  const [videoError, setVideoError] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const [placingMode, setPlacingMode] = useState(false);
  const [selectedPosition, setSelectedPosition] = useState<{
    x: number;
    y: number;
  } | null>(null);
  const [sensorReady, setSensorReady] = useState(false);
  const [useMouseControls, setUseMouseControls] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState<{
    currentIndex: number;
    completed: boolean[];
  }>({
    currentIndex: 0,
    completed: [false, false, false, false, false, false, false, false],
  });
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const arViewRef = useRef<HTMLDivElement | null>(null);
  const router = useRouter();

  useDeviceSync();

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    setDevices(initialDevices);
  }, [initialDevices, setDevices]);

  useEffect(() => {
    setRoutines(initialRoutines);
  }, [initialRoutines]);

  const handleAdd = () => {
    if (!name) {
      alert("기기 이름을 입력해주세요.");
      return;
    }

    // 배치 모드가 활성화되어 있고 위치가 선택된 경우
    if (placingMode && selectedPosition) {
      // 화면 좌표를 3D 공간 좌표로 변환 (간단한 변환)
      // 화면 중앙을 (0, 0, -2)로 가정하고 상대 좌표 계산
      const normalizedX = (selectedPosition.x - 0.5) * 4; // -2 ~ 2 범위
      const normalizedY = (0.5 - selectedPosition.y) * 4; // -2 ~ 2 범위 (Y축 반전)
      const position = {
        x: normalizedX,
        y: normalizedY,
        z: -2, // 카메라로부터 2m 앞
      };

      startTransition(async () => {
        console.log("[admin] saveDevice 요청 (화면 위치 기반)", {
          name,
          iconType,
          position,
          screenPos: selectedPosition,
        });
        await saveDevice({
          clerkUserId,
          name,
          iconType,
          position,
        });
        trackEvent({
          name: "device_saved",
          properties: {
            deviceName: name,
            iconType,
            position,
            screenPosition: selectedPosition,
          },
        });
        setName("");
        setPlacingMode(false);
        setSelectedPosition(null);
      });
    } else {
      // 기존 방식: 방향 벡터 기반
      startTransition(async () => {
        console.log("[admin] saveDevice 요청 (방향 벡터 기반)", {
          name,
          iconType,
          direction,
        });
        await saveDevice({
          clerkUserId,
          name,
          iconType,
          position: direction,
        });
        trackEvent({
          name: "device_saved",
          properties: {
            deviceName: name,
            iconType,
            position: direction,
          },
        });
        setName("");
      });
    }
  };

  // AR 뷰 클릭 핸들러: 화면 위치 선택
  const handleArViewClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!placingMode || !arViewRef.current) return;

    const rect = arViewRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;

    setSelectedPosition({ x, y });
    console.log("[admin] 화면 위치 선택", {
      x,
      y,
      clientX: e.clientX,
      clientY: e.clientY,
    });
  };

  const handleDelete = (deviceId: string) => {
    const device = devices.find((d) => d.id === deviceId);
    startTransition(async () => {
      await deleteDevice({ deviceId });
      if (device) {
        trackEvent({
          name: "device_deleted",
          properties: {
            deviceId,
            deviceName: device.name,
          },
        });
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
        video: { facingMode: "environment" },
        audio: false,
      });
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setVideoReady(true);
        console.log("[admin] 웹캠 스트림 시작 (로컬 처리만, 서버 미전송)");
      }
    } catch (err: any) {
      console.error("[admin] 웹캠 권한 요청 실패", err);
      setVideoReady(false);

      // 에러 타입별 상세 메시지
      if (err.name === "NotAllowedError" || err.name === "Permission denied") {
        setVideoError(
          "웹캠 권한이 거부되었습니다.\n\n" +
            "해결 방법:\n" +
            "1. 브라우저 주소창 왼쪽의 자물쇠 아이콘(🔒)을 클릭하세요\n" +
            "2. '카메라' 권한을 '허용'으로 변경하세요\n" +
            "3. 페이지를 새로고침(Ctrl+R 또는 F5)한 후 다시 '카메라 시작' 버튼을 클릭하세요\n\n" +
            "또는 브라우저 설정에서:\n" +
            "- Chrome: 설정 > 개인정보 및 보안 > 사이트 설정 > 카메라\n" +
            "- Edge: 설정 > 쿠키 및 사이트 권한 > 카메라"
        );
      } else if (err.name === "NotFoundError") {
        setVideoError(
          "카메라를 찾을 수 없습니다.\n\n" +
            "해결 방법:\n" +
            "1. 카메라가 연결되어 있는지 확인하세요\n" +
            "2. 다른 애플리케이션에서 카메라를 사용 중이 아닌지 확인하세요\n" +
            "3. 카메라 드라이버가 최신인지 확인하세요"
        );
      } else if (
        err.name === "NotReadableError" ||
        err.message?.includes("Device in use") ||
        err.message?.includes("in use")
      ) {
        setVideoError(
          "카메라가 다른 애플리케이션에서 사용 중입니다.\n\n" +
            "해결 방법:\n" +
            "1. 다른 애플리케이션(예: Zoom, Teams, 다른 브라우저 탭)에서 카메라를 종료하세요\n" +
            "2. 이 페이지를 새로고침(Ctrl+R 또는 F5)하세요\n" +
            "3. 다시 '카메라 시작' 버튼을 클릭하세요"
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

  const handleToggle = (device: Device) => {
    startTransition(async () => {
      const newStatus = !device.is_active;
      await toggleDeviceStatus({
        deviceId: device.id,
        isActive: newStatus,
      });
      trackEvent({
        name: "device_toggled",
        properties: {
          deviceId: device.id,
          deviceName: device.name,
          isActive: newStatus,
        },
      });
    });
  };

  const handleToggleAll = (targetState: boolean) => {
    startTransition(async () => {
      try {
        console.log("[admin] 일괄 토글 시작", { targetState, deviceCount: devices.length });
        
        // 모든 기기를 순차적으로 토글
        const promises = devices.map((device) =>
          toggleDeviceStatus({
            deviceId: device.id,
            isActive: targetState,
          })
        );
        
        await Promise.all(promises);
        
        console.log("[admin] 일괄 토글 완료", { targetState, deviceCount: devices.length });
        
        trackEvent({
          name: "device_toggled",
          properties: {
            deviceId: "all",
            deviceName: "일괄 제어",
            isActive: targetState,
          },
        });
      } catch (error) {
        console.error("[admin] 일괄 토글 실패", error);
        alert("일괄 제어에 실패했습니다.");
      }
    });
  };

  const handleInputModeChange = async (mode: "eye" | "mouse" | "switch" | "voice") => {
    if (pending) return;
    startTransition(async () => {
      await updateInputMode({ clerkUserId, inputMode: mode });
      setInputMode(mode);
      trackEvent({ name: "input_mode_changed", properties: { inputMode: mode } });
      // 사용자 모드 페이지도 새로고침하여 입력 방식 변경 반영
      router.refresh();
    });
  };

  // 루틴 관리 함수들
  const handleAddDeviceToRoutine = (deviceId: string, targetState: boolean) => {
    const newDevices = [
      ...selectedDevices,
      {
        deviceId,
        targetState,
        orderIndex: selectedDevices.length,
      },
    ];
    setSelectedDevices(newDevices);
  };

  const handleRemoveDeviceFromRoutine = (index: number) => {
    const newDevices = selectedDevices.filter((_, i) => i !== index);
    // orderIndex 재정렬
    const reorderedDevices = newDevices.map((device, i) => ({
      ...device,
      orderIndex: i,
    }));
    setSelectedDevices(reorderedDevices);
  };

  const handleCreateRoutine = async () => {
    if (!routineName || selectedDevices.length === 0) return;

    startTransition(async () => {
      try {
        console.log("[admin] createRoutine 요청", {
          routineName,
          routineTimeType,
          selectedDevices,
        });
        const newRoutine = await createRoutine({
          clerkUserId,
          name: routineName,
          timeType: routineTimeType,
          devices: selectedDevices.map((sd) => ({
            deviceId: sd.deviceId,
            targetState: sd.targetState,
            orderIndex: sd.orderIndex,
          })),
        });

        // 루틴 목록 업데이트
        const updatedRoutines = await listRoutines({ clerkUserId });
        setRoutines((updatedRoutines ?? []) as Routine[]);

        trackEvent({
          name: "routine_created",
          properties: {
            routineId: newRoutine,
            routineName,
            timeType: routineTimeType,
            deviceCount: selectedDevices.length,
          },
        });

        // 폼 초기화
        setShowRoutineForm(false);
        setEditingRoutine(null);
        setRoutineName("");
        setRoutineTimeType("morning");
        setSelectedDevices([]);
      } catch (error) {
        console.error("[admin] 루틴 생성 실패", error);
        alert("루틴 생성에 실패했습니다.");
      }
    });
  };

  const handleUpdateRoutine = async () => {
    if (!editingRoutine || !routineName || selectedDevices.length === 0) return;

    startTransition(async () => {
      try {
        console.log("[admin] updateRoutine 요청", {
          routineId: editingRoutine.id,
          routineName,
          routineTimeType,
          selectedDevices,
        });
        await updateRoutine({
          routineId: editingRoutine.id,
          name: routineName,
          timeType: routineTimeType,
          devices: selectedDevices.map((sd) => ({
            deviceId: sd.deviceId,
            targetState: sd.targetState,
            orderIndex: sd.orderIndex,
          })),
        });

        // 루틴 목록 업데이트
        const updatedRoutines = await listRoutines({ clerkUserId });
        setRoutines((updatedRoutines ?? []) as Routine[]);

        trackEvent({
          name: "routine_updated",
          properties: {
            routineId: editingRoutine.id,
            routineName,
            timeType: routineTimeType,
            deviceCount: selectedDevices.length,
          },
        });

        // 폼 초기화
        setShowRoutineForm(false);
        setEditingRoutine(null);
        setRoutineName("");
        setRoutineTimeType("morning");
        setSelectedDevices([]);
      } catch (error) {
        console.error("[admin] 루틴 수정 실패", error);
        alert("루틴 수정에 실패했습니다.");
      }
    });
  };

  const handleEditRoutine = (routine: Routine) => {
    setEditingRoutine(routine);
    setRoutineName(routine.name);
    setRoutineTimeType(routine.time_type);

    // 루틴에 포함된 기기들을 selectedDevices로 변환
    const devices = routine.routine_devices
      .sort((a, b) => a.order_index - b.order_index)
      .map((rd) => ({
        deviceId: rd.device_id,
        targetState: rd.target_state,
        orderIndex: rd.order_index,
      }));
    setSelectedDevices(devices);
    setShowRoutineForm(true);
  };

  const handleDeleteRoutine = async (routineId: string) => {
    if (!confirm("정말 이 루틴을 삭제하시겠습니까?")) return;

    startTransition(async () => {
      try {
        console.log("[admin] deleteRoutine 요청", { routineId });
        await deleteRoutine({ routineId });

        // 루틴 목록 업데이트
        const updatedRoutines = await listRoutines({ clerkUserId });
        setRoutines((updatedRoutines ?? []) as Routine[]);

        trackEvent({
          name: "routine_deleted",
          properties: { routineId },
        });
      } catch (error) {
        console.error("[admin] 루틴 삭제 실패", error);
        alert("루틴 삭제에 실패했습니다.");
      }
    });
  };

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

  return (
    <div className="min-h-screen px-6 md:px-10 py-8 space-y-8">
      <div className="space-y-3">
        <h1 className="text-display-2 bg-gradient-to-r from-blue-600 via-purple-600 to-blue-600 bg-clip-text text-transparent">
          관리자 모드
        </h1>
        {/* iOS 지원: 추후 개발 예정 */}
        {isIOSPermissionRequired && (
          <div className="text-body-2 text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/30 px-4 py-2 rounded-lg border border-blue-200 dark:border-blue-900">
            ℹ️ iOS 지원은 추후 개발 예정입니다. 현재는 안드로이드 기기에서 최적화되어 있습니다.
          </div>
        )}
      </div>

      {/* 입력 방식 선택 섹션 */}
      <section className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-gradient-to-br from-white to-gray-50 dark:from-gray-900 dark:to-gray-950 p-6 space-y-4 shadow-sm">
        <div>
          <h2 className="text-h2 mb-2 bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
            사용자가 어떻게 조작할까요?
          </h2>
          <p className="text-body-2 text-gray-600 dark:text-gray-300">
            사용자의 상황에 맞는 조작 방식을 선택해주세요. 각 방식에 대한 설명을 확인하신 후 선택하시면 됩니다.
          </p>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <button
            onClick={() => handleInputModeChange("mouse")}
            disabled={pending}
            className={`h-auto p-4 rounded-xl text-left transition-all duration-200 ${
              inputMode === "mouse"
                ? "bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-lg shadow-blue-500/30 scale-[1.02]"
                : "bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-600 hover:shadow-md hover:scale-[1.01]"
            }`}
          >
            <div className="flex items-start gap-3">
              <span className="text-2xl">🖱️</span>
              <div className="flex-1">
                <div className="text-body-1 font-semibold mb-1">직접 선택</div>
                <div className={`text-sm ${inputMode === "mouse" ? "text-blue-50" : "text-gray-600 dark:text-gray-400"}`}>
                  마우스, 트랙패드, 터치스크린을 사용하여 화면의 버튼을 직접 클릭합니다. 가장 기본적인 조작 방식입니다.
                </div>
              </div>
            </div>
          </button>
          <button
            onClick={() => handleInputModeChange("switch")}
            disabled={pending}
            className={`h-auto p-4 rounded-xl text-left transition-all duration-200 ${
              inputMode === "switch"
                ? "bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-lg shadow-blue-500/30 scale-[1.02]"
                : "bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-600 hover:shadow-md hover:scale-[1.01]"
            }`}
          >
            <div className="flex items-start gap-3">
              <span className="text-2xl">🔘</span>
              <div className="flex-1">
                <div className="text-body-1 font-semibold mb-1">스캐닝 모드</div>
                <div className={`text-sm ${inputMode === "switch" ? "text-blue-50" : "text-gray-600 dark:text-gray-400"}`}>
                  스위치나 키보드로 버튼을 순차적으로 선택합니다. 버튼이 자동으로 하이라이트되며 스페이스바나 엔터로 선택합니다.
                </div>
              </div>
            </div>
          </button>
          <button
            onClick={() => handleInputModeChange("eye")}
            disabled={pending}
            className={`h-auto p-4 rounded-xl text-left transition-all duration-200 ${
              inputMode === "eye"
                ? "bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-lg shadow-blue-500/30 scale-[1.02]"
                : "bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-600 hover:shadow-md hover:scale-[1.01]"
            }`}
          >
            <div className="flex items-start gap-3">
              <span className="text-2xl">👁️</span>
              <div className="flex-1">
                <div className="text-body-1 font-semibold mb-1">눈으로 조작</div>
                <div className={`text-sm ${inputMode === "eye" ? "text-blue-50" : "text-gray-600 dark:text-gray-400"}`}>
                  웹캠으로 눈의 움직임을 추적하여 화면의 버튼을 제어합니다. 버튼을 일정 시간 응시하면 자동으로 실행됩니다.
                </div>
              </div>
            </div>
          </button>
          <button
            onClick={() => handleInputModeChange("voice")}
            disabled={pending}
            className={`h-auto p-4 rounded-xl text-left transition-all duration-200 ${
              inputMode === "voice"
                ? "bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-lg shadow-blue-500/30 scale-[1.02]"
                : "bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-600 hover:shadow-md hover:scale-[1.01]"
            }`}
          >
            <div className="flex items-start gap-3">
              <span className="text-2xl">🎤</span>
              <div className="flex-1">
                <div className="text-body-1 font-semibold mb-1">음성 인식</div>
                <div className={`text-sm ${inputMode === "voice" ? "text-blue-50" : "text-gray-600 dark:text-gray-400"}`}>
                  음성 명령으로 기기를 제어합니다. 예: &quot;거실 전등 켜&quot;, &quot;TV 끄기&quot; 등으로 말하면 자동으로 실행됩니다.
                </div>
              </div>
            </div>
          </button>
        </div>
        <div className="text-body-2 text-gray-500 dark:text-gray-400 bg-blue-50 dark:bg-blue-950/30 px-4 py-2 rounded-lg border border-blue-100 dark:border-blue-900">
          현재 선택:{" "}
          <span className="font-bold text-blue-600 dark:text-blue-400">
            {inputMode === "eye"
              ? "시선 추적"
              : inputMode === "mouse"
              ? "직접 선택"
              : inputMode === "switch"
              ? "스캐닝 모드"
              : "음성 인식"}
          </span>
        </div>
      </section>

      {/* SLAM 기능 섹션 */}
      <section className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-gradient-to-br from-white to-gray-50 dark:from-gray-900 dark:to-gray-950 p-6 space-y-4 shadow-sm">
        <div>
          <h2 className="text-h2 mb-2 bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
            3D 공간 매핑
          </h2>
          <p className="text-body-2 text-gray-600 dark:text-gray-300">
            카메라를 비추고 조준점에 맞춰 가상 버튼을 추가하세요. 디바이스 회전에 따라 버튼이 공간에 고정됩니다. (방향벡터 기반 2m 앞 위치 저장)
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <button
            className={`h-10 px-4 rounded-xl border transition-all duration-200 text-body-2 flex items-center justify-center ${
              videoReady
                ? "border-green-400 bg-green-50 dark:bg-green-950/30 text-green-700 dark:text-green-300 hover:bg-green-100 dark:hover:bg-green-950/50"
                : "border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:border-blue-300 dark:hover:border-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/30 hover:shadow-md"
            }`}
            onClick={async () => {
              try {
                // 카메라가 이미 켜져 있으면 중지
                if (videoReady && streamRef.current) {
                  streamRef.current.getTracks().forEach((track) => track.stop());
                  streamRef.current = null;
                  if (videoRef.current) {
                    videoRef.current.srcObject = null;
                  }
                  setVideoReady(false);
                  return;
                }

                // iOS 센서 권한 요청 (추후 개발용 - 현재는 안드로이드 중심)
                // TODO: iOS 지원 시 활성화
                if (isIOSPermissionRequired) {
                  try {
                    const orientationResult = await (DeviceOrientationEvent as any).requestPermission();
                    console.log("[admin] iOS orientation permission:", orientationResult);
                    
                    if (orientationResult !== "granted") {
                      setVideoError("iOS 센서 권한이 거부되었습니다. 브라우저 설정에서 권한을 허용해주세요. (iOS 지원은 추후 개발 예정)");
                      return;
                    }
                  } catch (err) {
                    console.warn("[admin] iOS 권한 요청 실패 (추후 개발 예정):", err);
                    // iOS 지원이 완료되지 않았으므로 경고만 표시하고 계속 진행
                  }
                }
                
                // 웹캠 권한 요청 (사용자 상호작용 컨텍스트에서 직접 호출)
                await startVideo();
              } catch (err: any) {
                console.error("[admin] 권한 요청 실패", err);
                // startVideo() 내부에서 이미 에러 메시지를 설정하므로
                // 여기서는 추가 처리만 수행 (중복 메시지 방지)
                if (!videoError) {
                  if (err.name === "NotAllowedError" || err.name === "Permission denied") {
                    setVideoError("권한이 거부되었습니다. 브라우저 설정에서 카메라 권한을 허용해주세요.");
                  } else {
                    setVideoError(`권한 요청 실패: ${err.message || err.name}`);
                  }
                }
              }
            }}
            >
            {videoReady ? "카메라 중지" : "카메라 시작"}
          </button>
          <button
            className={`h-10 px-4 rounded-xl border transition-all duration-200 text-body-2 flex items-center justify-center ${
              scanning
                ? "border-purple-400 bg-purple-50 dark:bg-purple-950/30 text-purple-700 dark:text-purple-300 hover:bg-purple-100 dark:hover:bg-purple-950/50 shadow-md"
                : "border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:border-purple-300 dark:hover:border-purple-600 hover:bg-purple-50 dark:hover:bg-purple-950/30"
            }`}
            onClick={() => {
              if (!videoReady) {
                alert("먼저 카메라를 시작해주세요.");
                return;
              }
              if (!sensorReady) {
                alert("센서가 작동하지 않습니다. 디바이스를 회전시켜 센서를 활성화해주세요.");
                return;
              }
              
              if (scanning) {
                // 스캔 종료
                setScanning(false);
                setScanProgress({
                  currentIndex: 0,
                  completed: [false, false, false, false, false, false, false, false],
                });
              } else {
                // 스캔 시작
                setScanning(true);
                setScanProgress({
                  currentIndex: 0,
                  completed: [false, false, false, false, false, false, false, false],
                });
              }
            }}
            disabled={!videoReady || !sensorReady}
          >
            {scanning ? "공간 스캔 종료" : "공간 스캔 시작"}
          </button>
          <button
            className={`h-10 px-4 rounded-xl border transition-all duration-200 text-body-2 flex items-center justify-center ${
              placingMode
                ? "border-yellow-400 bg-yellow-50 dark:bg-yellow-950/30 text-yellow-700 dark:text-yellow-300 hover:bg-yellow-100 dark:hover:bg-yellow-950/50 shadow-md"
                : "border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:border-blue-300 dark:hover:border-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/30"
            }`}
            onClick={() => {
              setPlacingMode(!placingMode);
              if (!placingMode) {
                setSelectedPosition(null);
              }
            }}
          >
            {placingMode ? "배치 모드 종료" : "화면에 버튼 배치"}
          </button>
        </div>

        <div className="grid gap-4 md:grid-cols-[1fr_2fr]">
          {/* 좌측: 웹캠 비디오 (촬영한 사진) */}
          <div className="rounded-xl border border-dashed border-gray-300 dark:border-gray-700 p-0 overflow-hidden bg-black">
            <div className="relative w-full h-[360px] md:h-[420px]">
              <video
                ref={videoRef}
                className="w-full h-full object-cover"
                autoPlay
                muted
                playsInline
              />
              {!videoReady && (
                <div className="absolute inset-0 flex items-center justify-center bg-gray-900/50">
                  <div className="text-center text-white">
                    <p className="text-body-2 mb-2">카메라 대기 중...</p>
                    <p className="text-sm text-gray-300">
                      &quot;카메라 시작&quot; 버튼을 눌러주세요
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* 우측: 3D 환경 렌더링 (측정된 환경) */}
          <div className="rounded-xl border border-dashed border-gray-300 dark:border-gray-700 p-0 overflow-hidden">
            {/* 방향 정보 표시 (AR 뷰 위쪽) */}
            <div className="px-4 py-2 bg-gray-50 dark:bg-gray-800/50 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                    카메라 방향 벡터 (3D 좌표)
                  </div>
                  <div className="text-sm text-gray-700 dark:text-gray-300 font-mono">
                    x: {direction.x.toFixed(2)}, y: {direction.y.toFixed(2)}, z: {direction.z.toFixed(2)}
                  </div>
                </div>
                <div className={`px-3 py-1 rounded-full text-xs font-medium ${
                  sensorReady 
                    ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 border border-green-300 dark:border-green-700"
                    : "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 border border-yellow-300 dark:border-yellow-700"
                }`}>
                  {sensorReady ? "✓ 센서 작동 중" : "⚠ 센서 대기 중"}
                </div>
              </div>
              {!sensorReady && !useMouseControls && (
                <div className="mt-2 text-xs text-yellow-600 dark:text-yellow-400">
                  💡 디바이스를 회전시켜보세요. 센서가 작동하면 표시가 변경됩니다.
                </div>
              )}
              {useMouseControls && (
                <div className="mt-2 text-xs text-blue-600 dark:text-blue-400">
                  🖱️ 마우스 모드: Canvas를 드래그하여 카메라를 회전시킬 수 있습니다.
                </div>
              )}
              {scanning && (
                <div className="mt-2">
                  <div className="text-xs text-purple-600 dark:text-purple-400 font-medium mb-1">
                    공간 스캔 진행 중: {scanProgress.completed.filter(c => c).length} / 8 방향 완료
                  </div>
                  <div className="flex gap-1">
                    {scanProgress.completed.map((completed, index) => (
                      <div
                        key={index}
                        className={`h-2 flex-1 rounded ${
                          completed
                            ? "bg-green-500"
                            : index === scanProgress.currentIndex
                            ? "bg-purple-500 animate-pulse"
                            : "bg-gray-300 dark:bg-gray-600"
                        }`}
                        title={SCAN_DIRECTIONS[index].name}
                      />
                    ))}
                  </div>
                  <div className="text-xs text-purple-700 dark:text-purple-300 mt-1">
                    현재 목표: <strong>{SCAN_DIRECTIONS[scanProgress.currentIndex].name}</strong> 방향을 바라보세요
                  </div>
                </div>
              )}
            </div>
            <div
              ref={arViewRef}
              className="relative w-full h-[360px] md:h-[420px] cursor-crosshair"
              onClick={handleArViewClick}
            >
              {/* 플로팅 입력 카드 (화면 내에서 바로 기기 추가 가능) */}
              <div
                className="absolute top-3 right-3 z-20 w-[240px] rounded-xl border border-gray-200/80 dark:border-gray-700/80 bg-white/50 dark:bg-gray-900/50 backdrop-blur-md shadow-lg"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="p-3 space-y-2">
                  <div className="text-body-2-bold text-gray-900 dark:text-gray-100">
                    빠른 기기 추가
                  </div>
                  <input
                    className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                    placeholder="예: 거실 전등"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                  <select
                    className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={iconType}
                    onChange={(e) => setIconType(e.target.value as any)}
                  >
                    <option value="light">light</option>
                    <option value="tv">tv</option>
                    <option value="fan">fan</option>
                  </select>
                  <button
                    disabled={pending || !name}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleAdd();
                    }}
                    className="w-full h-10 rounded-lg bg-gradient-to-r from-blue-500 to-blue-600 text-white text-sm font-medium shadow-md shadow-blue-500/30 hover:shadow-lg hover:shadow-blue-500/40 transition-all disabled:opacity-50"
                  >
                    {pending ? "저장 중..." : "바로 추가"}
                  </button>
                </div>
              </div>

              {/* 
                보안: 카메라 스트림 및 시선 데이터는 클라이언트 메모리 내에서만 처리되며,
                서버로 전송되지 않습니다. 모든 처리는 로컬에서 수행됩니다.
              */}
              <Canvas
                camera={{ position: [0, 0, 0], fov: 75 }}
                frameloop="always"
                dpr={[1, 2]}
                performance={{ min: 0.5 }}
                style={{ background: 'linear-gradient(to bottom, #1a1a2e, #16213e)' }}
              >
                <ambientLight intensity={0.6} />
                <directionalLight position={[2, 2, 2]} intensity={0.8} />
                <pointLight position={[0, 0, 0]} intensity={0.5} />
                
                {/* 참조 그리드 (3D 공간 시각화) */}
                <gridHelper args={[10, 10, "#4a5568", "#2d3748"]} />
                
                {/* 축 표시 */}
                <axesHelper args={[2]} />
                
                {/* 원점 표시 */}
                <mesh position={[0, 0, 0]}>
                  <sphereGeometry args={[0.1, 16, 16]} />
                  <meshStandardMaterial color="#ef4444" emissive="#ef4444" emissiveIntensity={0.5} />
                </mesh>
                
                {/* 방향 참조 박스 (카메라가 바라보는 방향 2m 앞) */}
                <mesh position={[0, 0, -2]}>
                  <boxGeometry args={[0.3, 0.3, 0.3]} />
                  <meshStandardMaterial 
                    color="#22c55e" 
                    emissive="#22c55e" 
                    emissiveIntensity={0.3}
                    metalness={0.5}
                    roughness={0.3}
                  />
                </mesh>
                
                {/* 마커 렌더링: 빌보드 스프라이트로 FPS 30+ 유지 */}
                {devices.map((device) => (
                  <MarkerMesh
                    key={device.id}
                    device={device}
                    onPositionChange={(newPosition) => {
                      startTransition(async () => {
                        await updateDevicePosition({
                          deviceId: device.id,
                          position: newPosition,
                        });
                      });
                    }}
                  />
                ))}
                
                <DirectionTracker 
                  onDirection={setDirection} 
                  onSensorReady={setSensorReady}
                  scanning={scanning}
                  scanProgress={scanProgress}
                  onScanProgress={setScanProgress}
                  useMouseControls={useMouseControls}
                  onUseMouseControls={setUseMouseControls}
                />
                
                {/* 스캔 모드: 현재 목표 방향 표시 */}
                {scanning && (
                  <mesh position={SCAN_DIRECTIONS[scanProgress.currentIndex].dir.map(d => d * 2) as [number, number, number]}>
                    <sphereGeometry args={[0.4, 16, 16]} />
                    <meshStandardMaterial 
                      color={SCAN_DIRECTIONS[scanProgress.currentIndex].color}
                      emissive={SCAN_DIRECTIONS[scanProgress.currentIndex].color}
                      emissiveIntensity={0.8}
                      metalness={0.3}
                      roughness={0.2}
                    />
                  </mesh>
                )}
                
                {/* 스캔 모드: 완료된 방향 표시 */}
                {scanning && scanProgress.completed.map((completed, index) => {
                  if (!completed || index === scanProgress.currentIndex) return null;
                  return (
                    <mesh key={index} position={SCAN_DIRECTIONS[index].dir.map(d => d * 2) as [number, number, number]}>
                      <sphereGeometry args={[0.2, 16, 16]} />
                      <meshStandardMaterial 
                        color={SCAN_DIRECTIONS[index].color}
                        emissive={SCAN_DIRECTIONS[index].color}
                        emissiveIntensity={0.3}
                        opacity={0.5}
                        transparent
                      />
                    </mesh>
                  );
                })}
              </Canvas>

              {/* 배치된 기기 버튼 오버레이 (2D) */}
              {devices.map((device) => {
                // 3D 좌표를 화면 좌표로 변환 (간단한 변환)
                const screenX = (device.position_x / 4 + 0.5) * 100;
                const screenY = (0.5 - device.position_y / 4) * 100;
                return (
                  <button
                    key={device.id}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (
                        confirm(`"${device.name}" 기기를 삭제하시겠습니까?`)
                      ) {
                        handleDelete(device.id);
                      }
                    }}
                    className="absolute transform -translate-x-1/2 -translate-y-1/2 w-16 h-16 rounded-full border-2 border-white shadow-lg flex items-center justify-center text-white text-sm font-medium transition-all hover:scale-110 hover:shadow-xl"
                    style={{
                      left: `${screenX}%`,
                      top: `${screenY}%`,
                      backgroundColor: device.is_active
                        ? "rgba(34, 197, 94, 0.8)"
                        : "rgba(59, 130, 246, 0.8)",
                      borderColor: device.is_active ? "#22c55e" : "#3b82f6",
                    }}
                    title={`${device.name} (${
                      device.is_active ? "ON" : "OFF"
                    }) - 클릭하여 삭제`}
                  >
                    <div className="text-center">
                      <div className="text-body-2 mb-0.5">
                        {device.icon_type === "light"
                          ? "💡"
                          : device.icon_type === "tv"
                          ? "📺"
                          : "🌀"}
                      </div>
                      <div className="text-xs leading-tight">
                        {device.name}
                      </div>
                    </div>
                  </button>
                );
              })}

              {/* 선택된 위치 표시 */}
              {placingMode && selectedPosition && (
                <div
                  className="absolute transform -translate-x-1/2 -translate-y-1/2 w-20 h-20 rounded-full border-4 border-yellow-400 shadow-[0_0_20px_rgba(250,204,21,0.8)] flex items-center justify-center bg-yellow-400/20 pointer-events-none"
                  style={{
                    left: `${selectedPosition.x * 100}%`,
                    top: `${selectedPosition.y * 100}%`,
                  }}
                >
                  <div className="w-3 h-3 rounded-full bg-yellow-400" />
                </div>
              )}

              {/* 중앙 조준점 */}
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                <div
                  className={`w-10 h-10 rounded-full border-2 ${
                    placingMode
                      ? "border-yellow-400 shadow-[0_0_20px_rgba(250,204,21,0.8)]"
                      : "border-white/80 shadow-[0_0_20px_rgba(255,255,255,0.5)]"
                  }`}
                />
                <div className="absolute w-1 h-8 bg-white/80" />
                <div className="absolute w-8 h-1 bg-white/80" />
              </div>

              {/* 안내 메시지 */}
              <div className="absolute bottom-2 left-1/2 -translate-x-1/2 text-sm px-4 py-2 rounded-lg bg-black/70 text-white max-w-md text-center">
                {scanning ? (
                  <div className="space-y-1">
                    <div className="font-medium text-purple-300">
                      공간 스캔 중: {SCAN_DIRECTIONS[scanProgress.currentIndex].name} 방향
                    </div>
                    <div className="text-xs opacity-90">
                      {SCAN_DIRECTIONS[scanProgress.currentIndex].name} 방향의 큰 구체를 바라보세요
                      {scanProgress.completed.every(c => c) && (
                        <div className="mt-1 text-green-400 font-bold">
                          ✓ 스캔 완료! 이제 기기를 배치할 수 있습니다.
                        </div>
                      )}
                    </div>
                  </div>
                ) : placingMode ? (
                  selectedPosition ? (
                    "선택된 위치에 기기 이름을 입력하고 추가 버튼을 누르세요"
                  ) : (
                    "화면을 클릭하여 버튼 위치를 선택하세요"
                  )
                ) : (
                  <div className="space-y-1">
                    <div className="font-medium">3D 공간 매핑 사용 방법</div>
                    <div className="text-xs opacity-90">
                      1. 카메라 시작 → 2. 공간 스캔 시작 (8방향)<br/>
                      3. 스캔 완료 후 조준점을 맞추고 기기 배치
                    </div>
                  </div>
                )}
              </div>

              {/* 배치 모드 활성화 표시 */}
              {placingMode && (
                <div className="absolute top-2 left-2 px-3 py-1 rounded-full bg-yellow-400 text-yellow-900 text-sm font-medium shadow-lg">
                  배치 모드 활성화
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* 일상 루틴 섹션 */}
      <section className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-gradient-to-br from-white to-gray-50 dark:from-gray-900 dark:to-gray-950 p-6 space-y-4 shadow-sm">
        <div className="flex items-center justify-between">
          <h2 className="text-h2 bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
            일상 루틴
          </h2>
          <button
            onClick={() => {
              setEditingRoutine(null);
              setRoutineName("");
              setRoutineTimeType("morning");
              setSelectedDevices([]);
              setShowRoutineForm(!showRoutineForm);
            }}
            className="h-10 px-4 rounded-xl bg-gradient-to-r from-blue-500 to-blue-600 text-white text-body-2 font-medium shadow-md shadow-blue-500/30 hover:shadow-lg hover:shadow-blue-500/40 hover:scale-105 transition-all duration-200"
          >
            {showRoutineForm ? "취소" : "+ 루틴 추가"}
          </button>
        </div>

        {/* 루틴 생성/수정 폼 */}
        {showRoutineForm && (
          <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6 space-y-4">
            <div>
              <label className="block text-body-2 font-medium text-gray-700 dark:text-gray-300 mb-2">
                루틴 이름
              </label>
              <input
                type="text"
                value={routineName}
                onChange={(e) => setRoutineName(e.target.value)}
                placeholder="예: 아침 루틴"
                className="w-full rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-3 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-body-2 font-medium text-gray-700 dark:text-gray-300 mb-2">
                루틴 타입
              </label>
              <select
                value={routineTimeType}
                onChange={(e) =>
                  setRoutineTimeType(
                    e.target.value as "morning" | "evening" | "custom"
                  )
                }
                className="w-full rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-3 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="morning">🌅 아침 루틴</option>
                <option value="evening">🌙 저녁 루틴</option>
                <option value="custom">⚙️ 커스텀</option>
              </select>
            </div>
            <div>
              <label className="block text-body-2 font-medium text-gray-700 dark:text-gray-300 mb-2">
                기기 선택 (순서대로 추가)
              </label>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {devices.map((device) => {
                  const isSelected = selectedDevices.some(
                    (sd) => sd.deviceId === device.id
                  );
                  return (
                    <div
                      key={device.id}
                      className="flex items-center gap-2 p-2 rounded-lg border border-gray-200 dark:border-gray-700"
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={(e) => {
                          if (e.target.checked) {
                            handleAddDeviceToRoutine(device.id, true);
                          } else {
                            const index = selectedDevices.findIndex(
                              (sd) => sd.deviceId === device.id
                            );
                            if (index !== -1)
                              handleRemoveDeviceFromRoutine(index);
                          }
                        }}
                        className="rounded"
                      />
                      <span className="flex-1 text-body-2 text-gray-700 dark:text-gray-300">
                        {device.name}
                      </span>
                      {isSelected && (
                        <select
                          value={
                            selectedDevices.find(
                              (sd) => sd.deviceId === device.id
                            )?.targetState
                              ? "on"
                              : "off"
                          }
                          onChange={(e) => {
                            const index = selectedDevices.findIndex(
                              (sd) => sd.deviceId === device.id
                            );
                            if (index !== -1) {
                              const newDevices = [...selectedDevices];
                              newDevices[index].targetState =
                                e.target.value === "on";
                              setSelectedDevices(newDevices);
                            }
                          }}
                          className="text-sm rounded-lg border border-gray-300 dark:border-gray-700 px-2 py-1"
                        >
                          <option value="on">켜기</option>
                          <option value="off">끄기</option>
                        </select>
                      )}
                    </div>
                  );
                })}
              </div>
              {selectedDevices.length > 0 && (
                <div className="mt-3 p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg">
                  <p className="text-sm font-medium text-blue-700 dark:text-blue-400 mb-2">
                    실행 순서:
                  </p>
                  <div className="space-y-1">
                    {selectedDevices
                      .sort((a, b) => a.orderIndex - b.orderIndex)
                      .map((sd, idx) => {
                        const device = devices.find(
                          (d) => d.id === sd.deviceId
                        );
                        return (
                          <div
                            key={sd.deviceId}
                            className="text-sm text-gray-600 dark:text-gray-400"
                          >
                            {idx + 1}. {device?.name} (
                            {sd.targetState ? "켜기" : "끄기"})
                          </div>
                        );
                      })}
                  </div>
                </div>
              )}
            </div>
            <div className="flex gap-2">
              <button
                onClick={
                  editingRoutine ? handleUpdateRoutine : handleCreateRoutine
                }
                disabled={
                  pending || !routineName || selectedDevices.length === 0
                }
                className="flex-1 h-10 rounded-xl bg-gradient-to-r from-blue-500 to-blue-600 text-white text-body-2 font-medium shadow-md hover:shadow-lg transition-all disabled:opacity-50"
              >
                {pending ? "저장 중..." : editingRoutine ? "수정" : "생성"}
              </button>
              <button
                onClick={() => {
                  setShowRoutineForm(false);
                  setEditingRoutine(null);
                  setRoutineName("");
                  setRoutineTimeType("morning");
                  setSelectedDevices([]);
                }}
                className="h-10 px-4 rounded-xl border border-gray-300 dark:border-gray-700 text-body-2"
              >
                취소
              </button>
            </div>
          </div>
        )}

        {/* 루틴 목록 */}
        <div className="grid gap-4 md:grid-cols-2">
          {routines.map((routine) => (
            <div
              key={routine.id}
              className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 space-y-3"
            >
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-body-2 font-bold text-gray-900 dark:text-gray-100">
                    {routine.name}
                  </h3>
                  <p className="text-body-2 text-gray-500 dark:text-gray-400">
                    {routine.time_type === "morning"
                      ? "🌅 아침"
                      : routine.time_type === "evening"
                      ? "🌙 저녁"
                      : "⚙️ 커스텀"}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleEditRoutine(routine)}
                    className="h-8 px-3 rounded-lg border border-gray-300 dark:border-gray-700 text-sm hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center justify-center"
                  >
                    수정
                  </button>
                  <button
                    onClick={() => handleDeleteRoutine(routine.id)}
                    className="h-8 px-3 rounded-lg bg-red-500 text-white text-sm hover:bg-red-600 flex items-center justify-center"
                  >
                    삭제
                  </button>
                </div>
              </div>
              <div className="space-y-1">
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                  포함된 기기:
                </p>
                {routine.routine_devices.length === 0 ? (
                  <p className="text-sm text-gray-400">기기가 없습니다.</p>
                ) : (
                  <div className="space-y-1">
                    {routine.routine_devices
                      .sort((a, b) => a.order_index - b.order_index)
                      .map((rd, idx) => (
                        <div
                          key={rd.id}
                          className="text-sm text-gray-600 dark:text-gray-400"
                        >
                          {idx + 1}. {rd.devices?.name || "알 수 없음"} (
                          {rd.target_state ? "켜기" : "끄기"})
                        </div>
                      ))}
                  </div>
                )}
              </div>
            </div>
          ))}
          {routines.length === 0 && (
            <div className="col-span-full text-center py-8 text-gray-500 dark:text-gray-400">
              루틴이 없습니다. &quot;+ 루틴 추가&quot; 버튼을 눌러 루틴을
              만들어보세요.
            </div>
          )}
        </div>
      </section>

      {/* 기기 목록 섹션 */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-h2 bg-gradient-to-r from-gray-900 to-gray-700 dark:from-gray-100 dark:to-gray-300 bg-clip-text text-transparent">
            기기 목록
          </h2>
          {devices.length > 0 && (
            <div className="flex gap-2">
              <button
                onClick={() => handleToggleAll(true)}
                disabled={pending}
                className="h-10 px-4 rounded-xl text-body-2 font-medium transition-all duration-200 flex items-center justify-center bg-gradient-to-r from-emerald-500 to-emerald-600 text-white shadow-md shadow-emerald-500/30 hover:shadow-lg hover:shadow-emerald-500/40 hover:scale-105 disabled:opacity-50"
              >
                전체 켜기
              </button>
              <button
                onClick={() => handleToggleAll(false)}
                disabled={pending}
                className="h-10 px-4 rounded-xl text-body-2 font-medium transition-all duration-200 flex items-center justify-center bg-gray-900 dark:bg-gray-950 text-white hover:bg-gray-800 dark:hover:bg-gray-900 shadow-md hover:shadow-lg disabled:opacity-50"
              >
                전체 끄기
              </button>
            </div>
          )}
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {devices.map((device) => (
            <div
              key={device.id}
              className={`rounded-2xl border p-5 flex flex-col gap-3 transition-all duration-200 ${
                device.is_active
                  ? "border-emerald-300 dark:border-emerald-700 bg-gradient-to-br from-emerald-50 to-white dark:from-emerald-950/30 dark:to-gray-900 shadow-md shadow-emerald-500/10"
                  : "border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 hover:border-gray-300 dark:hover:border-gray-700 hover:shadow-md"
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <p className="text-body-2-bold text-gray-900 dark:text-gray-100">
                    {device.name}
                  </p>
                  <p className="text-body-2 text-gray-600 dark:text-gray-400 mt-1">
                    {device.icon_type} ·{" "}
                    <span
                      className={
                        device.is_active
                          ? "text-emerald-600 dark:text-emerald-400 font-medium"
                          : "text-gray-500"
                      }
                    >
                      {device.is_active ? "On" : "Off"}
                    </span>
                  </p>
                </div>
                <div
                  className={`w-3 h-3 rounded-full ${
                    device.is_active
                      ? "bg-emerald-500 shadow-lg shadow-emerald-500/50"
                      : "bg-gray-300 dark:bg-gray-600"
                  }`}
                />
              </div>
              <div className="flex gap-2 pt-1">
                <button
                  onClick={() => handleToggle(device)}
                  className={`flex-1 h-10 px-4 rounded-xl text-body-2 font-medium transition-all duration-200 flex items-center justify-center ${
                    device.is_active
                      ? "bg-gray-900 dark:bg-gray-950 text-white hover:bg-gray-800 dark:hover:bg-gray-900 shadow-md hover:shadow-lg"
                      : "bg-gradient-to-r from-emerald-500 to-emerald-600 text-white shadow-md shadow-emerald-500/30 hover:shadow-lg hover:shadow-emerald-500/40 hover:scale-105"
                  }`}
                  disabled={pending}
                >
                  {device.is_active ? "끄기" : "켜기"}
                </button>
                <button
                  onClick={() => handleDelete(device.id)}
                  className="h-10 px-4 rounded-xl text-body-2 font-medium bg-gradient-to-r from-red-500 to-red-600 text-white shadow-md shadow-red-500/30 hover:shadow-lg hover:shadow-red-500/40 hover:scale-105 transition-all duration-200 disabled:opacity-50"
                  disabled={pending}
                >
                  삭제
                </button>
              </div>
            </div>
          ))}
          {devices.length === 0 && (
            <div className="col-span-full text-center py-12 text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-900/50 rounded-2xl border border-dashed border-gray-300 dark:border-gray-700">
              추가된 기기가 없습니다.
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

function MarkerMesh({
  device,
  onPositionChange,
}: {
  device: Device;
  onPositionChange: (position: { x: number; y: number; z: number }) => void;
}) {
  const color = device.is_active ? "#22c55e" : "#3b82f6";
  const [position, setPosition] = useState<[number, number, number]>([
    device.position_x ?? 0,
    device.position_y ?? 0,
    device.position_z ?? -2,
  ]);
  const groupRef = useRef<Group>(null);
  const isDragging = useRef(false);
  const { camera, gl } = useThree();
  const raycaster = useRef(new Raycaster());
  const dragPlane = useRef(new Vector3(0, 0, -2)); // Z축 평면 -2m

  // 기기 위치가 업데이트되면 로컬 상태도 업데이트
  useEffect(() => {
    setPosition([device.position_x ?? 0, device.position_y ?? 0, device.position_z ?? -2] as [number, number, number]);
    if (groupRef.current) {
      groupRef.current.position.set(
        device.position_x,
        device.position_y,
        device.position_z
      );
    }
  }, [device.position_x, device.position_y, device.position_z]);

  const handlePointerDown = (e: any) => {
    e.stopPropagation();
    isDragging.current = true;
    document.body.style.cursor = "grabbing";
  };

  const handlePointerMove = (e: any) => {
    // 전역 이벤트 리스너에서 처리
    e.stopPropagation();
  };

  const handlePointerUp = (e: any) => {
    if (!isDragging.current) return;
    e.stopPropagation();
    isDragging.current = false;
    document.body.style.cursor = "default";

    // 드래그 종료: 서버에 위치 저장
    if (groupRef.current) {
      const newPosition = {
        x: groupRef.current.position.x,
        y: groupRef.current.position.y,
        z: groupRef.current.position.z,
      };
      onPositionChange(newPosition);
    }
  };

  // 전역 이벤트 리스너 추가
  useEffect(() => {
    const handleGlobalMove = (e: MouseEvent) => {
      if (isDragging.current && groupRef.current) {
        const rect = gl.domElement.getBoundingClientRect();
        const mouse = new Vector2(
          ((e.clientX - rect.left) / rect.width) * 2 - 1,
          -((e.clientY - rect.top) / rect.height) * 2 + 1
        );

        raycaster.current.setFromCamera(mouse, camera);
        
        const planeNormal = new Vector3(0, 0, 1);
        const planePoint = dragPlane.current;
        const ray = raycaster.current.ray;
        
        const denom = planeNormal.dot(ray.direction);
        if (Math.abs(denom) > 0.0001) {
          const t = planePoint.clone().sub(ray.origin).dot(planeNormal) / denom;
          const intersection = ray.origin.clone().add(ray.direction.clone().multiplyScalar(t));
          
          groupRef.current.position.copy(intersection);
          setPosition([intersection.x, intersection.y, intersection.z] as [number, number, number]);
        }
      }
    };

    const handleGlobalUp = () => {
      if (isDragging.current) {
        isDragging.current = false;
        document.body.style.cursor = "default";

        if (groupRef.current) {
          const newPosition = {
            x: groupRef.current.position.x,
            y: groupRef.current.position.y,
            z: groupRef.current.position.z,
          };
          onPositionChange(newPosition);
        }
      }
    };

    window.addEventListener("mousemove", handleGlobalMove);
    window.addEventListener("mouseup", handleGlobalUp);

    return () => {
      window.removeEventListener("mousemove", handleGlobalMove);
      window.removeEventListener("mouseup", handleGlobalUp);
    };
  }, [camera, gl, onPositionChange]);

  return (
    <group
      ref={groupRef}
      position={position}
      onPointerOver={(e) => {
        e.stopPropagation();
        if (!isDragging.current) {
          document.body.style.cursor = "grab";
        }
      }}
      onPointerOut={() => {
        if (!isDragging.current) {
          document.body.style.cursor = "default";
        }
      }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
    >
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
