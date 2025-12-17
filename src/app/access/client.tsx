"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { SignedIn, SignedOut, SignInButton, useAuth } from "@clerk/nextjs";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import {
  DeviceOrientationControls,
  Html,
  Billboard,
} from "@react-three/drei";
import { Vector3, Raycaster } from "three";
import type { Group } from "three";
import type { Database } from "@/database.types";
import { toggleDeviceStatus, listRoutines, executeRoutine, listDevices } from "../actions";
import { useStore } from "@/hooks/useStore";
import { useDeviceSync } from "@/hooks/useDeviceSync";
import { useWebGazer } from "@/hooks/useWebGazer";
import { useWebGazerCalibration } from "@/hooks/useWebGazerCalibration";
import { trackEvent } from "@/lib/analytics";

// Web Speech API 타입 정의
interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  onstart: ((this: SpeechRecognition, ev: Event) => any) | null;
  onresult: ((this: SpeechRecognition, ev: SpeechRecognitionEvent) => any) | null;
  onerror: ((this: SpeechRecognition, ev: SpeechRecognitionErrorEvent) => any) | null;
  onend: ((this: SpeechRecognition, ev: Event) => any) | null;
}

interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList;
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string;
}

interface SpeechRecognitionResultList {
  length: number;
  item(index: number): SpeechRecognitionResult;
  [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionResult {
  length: number;
  item(index: number): SpeechRecognitionAlternative;
  [index: number]: SpeechRecognitionAlternative;
  isFinal: boolean;
}

interface SpeechRecognitionAlternative {
  transcript: string;
  confidence: number;
}

declare var SpeechRecognition: {
  new (): SpeechRecognition;
};

declare var webkitSpeechRecognition: {
  new (): SpeechRecognition;
};

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
  inputMode: "eye" | "mouse" | "switch" | "voice";
  initialRoutines: Routine[];
};

export default function AccessClient({
  initialDevices,
  inputMode,
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
  
  // 드웰 시간 설정 (1-10초)
  const [dwellTime, setDwellTime] = useState<number>(2); // 초 단위
  
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
    if (!userId) {
      console.error("[access] 루틴 실행 실패: 사용자 ID 없음");
      alert("로그인이 필요합니다.");
      return;
    }

    setExecutingRoutineId(routineId);
    startTransition(async () => {
      try {
        console.log("[access] 루틴 실행 시작", { routineId });
        await executeRoutine({ routineId });
        console.log("[access] 루틴 실행 완료, 기기 목록 새로고침");
        
        // 루틴 실행 후 기기 목록을 다시 불러와서 클라이언트 상태 업데이트
        const updatedDevices = await listDevices({ clerkUserId: userId });
        if (updatedDevices) {
          setDevices(updatedDevices);
          console.log("[access] 기기 목록 업데이트 완료", { count: updatedDevices.length });
        }
        
        trackEvent({ name: "routine_executed", properties: { routineId } });
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
  const isVoiceMode = inputMode === "voice";

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

  // 스위치 모드: 스캔 방식 (순차적으로 하이라이트) - 기기와 루틴 모두 포함
  const [switchIndex, setSwitchIndex] = useState(0);
  const [scanSpeed, setScanSpeed] = useState<number>(2); // 1-10초 선택 가능
  const switchIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // 스캔 대상: 루틴 + 기기 (루틴을 먼저 배치)
  const scanItems = useMemo(() => {
    const items: Array<{ type: "device"; data: typeof devices[0] } | { type: "routine"; data: Routine }> = [];
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

  useEffect(() => {
    if (isSwitchMode && scanItems.length > 0) {
      const intervalMs = scanSpeed * 1000; // 스캔 속도에 따라 간격 조정
      switchIntervalRef.current = setInterval(() => {
        setSwitchIndex((prev) => (prev + 1) % scanItems.length);
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
  }, [isSwitchMode, scanItems.length, scanSpeed]);

  // 스위치 모드: 스페이스바 또는 엔터 키로 선택
  useEffect(() => {
    if (!isSwitchMode) return;

    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.key === " " || e.key === "Enter") {
        e.preventDefault();
        if (scanItems.length === 0) return;
        const item = scanItems[switchIndex];
        if (item.type === "device") {
          handleMouseClick(item.data);
        } else if (item.type === "routine") {
          handleExecuteRoutine(item.data.id);
        }
      }
    };

    window.addEventListener("keydown", handleKeyPress);
    return () => {
      window.removeEventListener("keydown", handleKeyPress);
    };
  }, [isSwitchMode, scanItems, switchIndex, handleMouseClick, handleExecuteRoutine]);

  // 음성 인식 모드: Web Speech API 사용
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<SpeechRecognition | null>(null);

  useEffect(() => {
    if (!isVoiceMode) {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
        setIsListening(false);
      }
      return;
    }

    // Web Speech API 지원 확인
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      console.warn("[access] 음성 인식 API를 지원하지 않는 브라우저입니다.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.lang = "ko-KR";

    recognition.onstart = () => {
      console.log("[access] 음성 인식 시작");
      setIsListening(true);
    };

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      const lastResult = event.results[event.results.length - 1];
      const transcript = lastResult[0].transcript.trim().toLowerCase();
      console.log("[access] 음성 인식 결과:", transcript);

      // 기기 이름 매칭 (예: "거실 전등 켜", "전등 켜기", "TV 끄기" 등)
      for (const device of devices) {
        const deviceName = device.name.toLowerCase();
        const isOnCommand = transcript.includes(deviceName) && (transcript.includes("켜") || transcript.includes("켜기") || transcript.includes("on"));
        const isOffCommand = transcript.includes(deviceName) && (transcript.includes("끄") || transcript.includes("끄기") || transcript.includes("off"));

        if (isOnCommand && !device.is_active) {
          console.log("[access] 음성 명령: 켜기", device.name);
          handleMouseClick(device);
          trackEvent({
            name: "device_clicked",
            properties: {
              deviceId: device.id,
              deviceName: device.name,
              method: "voice",
            },
          });
          return;
        }

        if (isOffCommand && device.is_active) {
          console.log("[access] 음성 명령: 끄기", device.name);
          handleMouseClick(device);
          trackEvent({
            name: "device_clicked",
            properties: {
              deviceId: device.id,
              deviceName: device.name,
              method: "voice",
            },
          });
          return;
        }
      }
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      console.error("[access] 음성 인식 오류", event.error);
      if (event.error === "not-allowed") {
        alert("음성 인식 권한이 거부되었습니다. 브라우저 설정에서 마이크 권한을 허용해주세요.");
      }
      setIsListening(false);
    };

    recognition.onend = () => {
      console.log("[access] 음성 인식 종료");
      setIsListening(false);
      // 음성 인식 모드가 활성화되어 있으면 자동으로 재시작
      if (isVoiceMode) {
        setTimeout(() => {
          try {
            recognition.start();
          } catch (err) {
            console.error("[access] 음성 인식 재시작 실패", err);
          }
        }, 100);
      }
    };

    recognitionRef.current = recognition;

    // 음성 인식 시작
    try {
      recognition.start();
    } catch (err) {
      console.error("[access] 음성 인식 시작 실패", err);
    }

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
        recognitionRef.current = null;
      }
      setIsListening(false);
    };
  }, [isVoiceMode, devices, handleMouseClick]);

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
              <div className="flex items-center gap-3 px-3 py-2 rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800">
                <span className="text-sm text-blue-700 dark:text-blue-300 font-medium whitespace-nowrap">스캐닝 속도:</span>
                <div className="flex items-center gap-3 min-w-[200px]">
                  <input
                    type="range"
                    min="1"
                    max="10"
                    value={scanSpeed}
                    onChange={(e) => setScanSpeed(Number(e.target.value))}
                    className="flex-1 h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-600"
                    style={{
                      background: `linear-gradient(to right, #3b82f6 0%, #3b82f6 ${((scanSpeed - 1) / 9) * 100}%, #e5e7eb ${((scanSpeed - 1) / 9) * 100}%, #e5e7eb 100%)`
                    }}
                  />
                  <span className="text-sm text-blue-700 dark:text-blue-300 font-bold min-w-[30px] text-right">
                    {scanSpeed}초
                  </span>
                </div>
              </div>
            </div>
          )}
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
            {routines.map((routine, routineIdx) => {
              const isExecuting = executingRoutineId === routine.id;
              const isMorning = routine.time_type === "morning";
              const isEvening = routine.time_type === "evening";
              // 스캔 모드에서 현재 선택된 루틴인지 확인
              const currentScanItem = scanItems[switchIndex];
              const isSwitchActive = isSwitchMode && currentScanItem?.type === "routine" && currentScanItem.data.id === routine.id;
              return (
                <div
                  key={routine.id}
                  className={`rounded-2xl border p-5 transition-all duration-200 ${
                    isSwitchActive
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
                          : isSwitchActive
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

      {/* SLAM 기기 제어 섹션: 3D 공간에서 기기 제어 */}
      <section className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-h2 bg-gradient-to-r from-gray-900 to-gray-700 dark:from-gray-100 dark:to-gray-300 bg-clip-text text-transparent">
            기기 제어
          </h2>
          {isEyeMode && (
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
          )}
        </div>
        
        {devices.length === 0 ? (
          <div className="text-center py-12 text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-900/50 rounded-2xl border border-dashed border-gray-300 dark:border-gray-700">
            배치된 기기가 없습니다. 관리자 모드에서 기기를 배치해주세요.
          </div>
        ) : (
          <div className="rounded-xl border border-gray-300 dark:border-gray-700 p-0 overflow-hidden bg-black">
              <div className="relative w-full h-[500px] md:h-[600px]">
                <Canvas
                  camera={{ position: [0, 0, 0], fov: 75 }}
                  frameloop="always"
                  dpr={[1, 2]}
                  performance={{ min: 0.5 }}
                >
                  <ambientLight intensity={0.8} />
                  <directionalLight position={[2, 2, 2]} intensity={0.6} />
                  {/* 참조 그리드 (디버깅용) */}
                  <gridHelper args={[10, 10, "#444444", "#222222"]} />
                  {/* 원점 표시 */}
                  <mesh position={[0, 0, 0]}>
                    <sphereGeometry args={[0.05, 16, 16]} />
                    <meshBasicMaterial color="#ff0000" />
                  </mesh>
                  {/* 기기 마커 렌더링 */}
                  {devices.map((device) => (
                    <DeviceMarkerMesh
                      key={device.id}
                      device={device}
                      isActive={isEyeMode && snappedDeviceId === device.id}
                      isSwitchActive={isSwitchMode && scanItems[switchIndex]?.type === "device" && (scanItems[switchIndex].data as typeof devices[0]).id === device.id}
                      onDeviceClick={handleMouseClick}
                      dwellProgress={isEyeMode && snappedDeviceId === device.id ? dwellPercent : 0}
                    />
                  ))}
                  <axesHelper args={[2]} />
                  <DeviceOrientationControls />
                </Canvas>
              </div>
            </div>
        )}
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

      {/* 입력 방식 표시: 하단 고정 (모든 입력 방식 공통) */}
      <div className="fixed bottom-0 left-0 right-0 bg-blue-50 dark:bg-blue-950/30 border-t border-blue-200 dark:border-blue-800 shadow-lg z-40 px-6 md:px-10 py-3">
        <div className="max-w-7xl mx-auto flex items-center justify-center">
          <div className="px-4 py-2 rounded-lg text-xl bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-800 font-medium">
            입력 방식: {inputMode === "mouse" ? "마우스 클릭" : inputMode === "switch" ? "스캐닝" : inputMode === "voice" ? "음성 인식" : "시선 추적"}
            {isVoiceMode && (
              <span className={`ml-2 px-2 py-1 rounded text-sm ${isListening ? "bg-green-500 text-white" : "bg-gray-300 text-gray-700"}`}>
                {isListening ? "🎤 듣는 중..." : "⏸️ 대기 중"}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* 스캔 모드 하단 고정 UI */}
      {isSwitchMode && scanItems.length > 0 && (
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
                        : (scanItems[switchIndex].data as typeof devices[0]).name || "없음"}
                    </div>
                    <div className="text-xs opacity-75 mt-0.5">
                      {scanItems[switchIndex]?.type === "routine" ? (
                        <span>
                          {(scanItems[switchIndex].data as Routine).routine_devices.length}개 기기 ·{" "}
                          {(scanItems[switchIndex].data as Routine).time_type === "morning" ? "🌅 아침" : (scanItems[switchIndex].data as Routine).time_type === "evening" ? "🌙 저녁" : "⚙️ 일반"}
                        </span>
                      ) : (
                        <span>
                          {(scanItems[switchIndex].data as typeof devices[0]).icon_type} · {(scanItems[switchIndex].data as typeof devices[0]).is_active ? "On" : "Off"}
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
                      handleMouseClick(item.data);
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
  );
}

// 사용자 모드용 기기 마커: 클릭으로 온오프 제어
function DeviceMarkerMesh({
  device,
  isActive,
  isSwitchActive,
  onDeviceClick,
  dwellProgress,
}: {
  device: Device;
  isActive: boolean;
  isSwitchActive: boolean;
  onDeviceClick: (device: Device) => void;
  dwellProgress: number;
}) {
  const color = device.is_active ? "#22c55e" : "#6b7280";
  const highlightColor = isActive || isSwitchActive ? "#3b82f6" : color;
  
  // 기기 위치 (null 체크 및 기본값)
  const posX = device.position_x ?? 0;
  const posY = device.position_y ?? 0;
  const posZ = device.position_z ?? -2;
  
  return (
    <group position={[posX, posY, posZ]}>
      {/* 빌보드 스프라이트: 항상 카메라를 향해 회전 */}
      <Billboard>
        <mesh
          onClick={(e) => {
            e.stopPropagation();
            onDeviceClick(device);
          }}
          onPointerOver={(e) => {
            e.stopPropagation();
            document.body.style.cursor = "pointer";
          }}
          onPointerOut={() => {
            document.body.style.cursor = "default";
          }}
        >
          <circleGeometry args={[0.2, 16]} />
          <meshBasicMaterial 
            color={highlightColor}
            transparent
            opacity={isActive || isSwitchActive ? 1 : 0.9}
          />
        </mesh>
        {/* 하이라이트 링 (선택됨) */}
        {(isActive || isSwitchActive) && (
          <mesh>
            <ringGeometry args={[0.2, 0.3, 32]} />
            <meshBasicMaterial 
              color="#3b82f6"
              transparent
              opacity={0.8}
            />
          </mesh>
        )}
      </Billboard>
      
      {/* 기기 정보 라벨 - zIndex로 겹침 방지 */}
      <Html 
        distanceFactor={4} 
        position={[0.2, 0.2, 0]}
        zIndexRange={[100, 200]}
        style={{ pointerEvents: "none" }}
      >
        <div className={`rounded-lg px-3 py-2 text-xs shadow-xl whitespace-nowrap transition-all ${
          isActive || isSwitchActive
            ? "bg-blue-600 text-white border-2 border-blue-400 scale-110"
            : "bg-black/90 text-white border border-gray-600"
        }`}>
          <div className="font-bold">{device.name}</div>
          <div className="text-[10px] opacity-90 mt-0.5">
            {device.icon_type} · {device.is_active ? "On" : "Off"}
          </div>
          {/* 드웰 진행도 (시선 추적 모드) */}
          {isActive && dwellProgress > 0 && (
            <div className="mt-1.5 h-1 w-full bg-white/20 rounded-full overflow-hidden">
              <div
                className="h-full bg-white transition-all duration-100"
                style={{ width: `${dwellProgress}%` }}
              />
            </div>
          )}
        </div>
      </Html>
      
      {/* 위치 마킹: 3D 공간에 위치 표시 (시각적으로 보이지 않지만 3D 뷰에 마킹됨) */}
      <mesh visible={false}>
        <sphereGeometry args={[0.01, 8, 8]} />
        <meshBasicMaterial color="#000000" transparent opacity={0} />
      </mesh>
    </group>
  );
}

