"use client";

import { useEffect, useState, useTransition, useRef, useCallback } from "react";
import { useAuth } from "@clerk/nextjs";
import { toggleDeviceStatus, listDevices } from "../../actions";
import { useStore } from "@/hooks/useStore";
import { useDeviceSync } from "@/hooks/useDeviceSync";
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

interface Props {
  clerkUserId: string;
  initialDevices: Device[];
  initialRoutines: Routine[];
}

export default function VoiceClient({
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
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<SpeechRecognition | null>(null);

  useDeviceSync();

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    setDevices(initialDevices);
  }, [initialDevices, setDevices]);

  const handleDeviceClick = useCallback((device: Device) => {
    startTransition(async () => {
      await toggleDeviceStatus({
        deviceId: device.id,
        isActive: !device.is_active,
      });
    });
  }, [startTransition]);

  // 음성 인식 초기화
  useEffect(() => {
    // Web Speech API 지원 확인
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      console.warn("[voice] 음성 인식 API를 지원하지 않는 브라우저입니다.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.lang = "ko-KR";

    recognition.onstart = () => {
      console.log("[voice] 음성 인식 시작");
      setIsListening(true);
    };

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      const lastResult = event.results[event.results.length - 1];
      const transcript = lastResult[0].transcript.trim().toLowerCase();
      console.log("[voice] 음성 인식 결과:", transcript);

      // 기기 이름 매칭
      for (const device of devices) {
        const deviceName = device.name.toLowerCase();
        const isOnCommand = transcript.includes(deviceName) && (transcript.includes("켜") || transcript.includes("켜기") || transcript.includes("on"));
        const isOffCommand = transcript.includes(deviceName) && (transcript.includes("끄") || transcript.includes("끄기") || transcript.includes("off"));

        if (isOnCommand && !device.is_active) {
          console.log("[voice] 음성 명령: 켜기", device.name);
          handleDeviceClick(device);
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
          console.log("[voice] 음성 명령: 끄기", device.name);
          handleDeviceClick(device);
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
      console.error("[voice] 음성 인식 오류", event.error);
      if (event.error === "not-allowed") {
        alert("음성 인식 권한이 거부되었습니다. 브라우저 설정에서 마이크 권한을 허용해주세요.");
      }
      setIsListening(false);
    };

    recognition.onend = () => {
      console.log("[voice] 음성 인식 종료");
      setIsListening(false);
      // 자동으로 재시작
      setTimeout(() => {
        try {
          recognition.start();
        } catch (err) {
          console.error("[voice] 음성 인식 재시작 실패", err);
        }
      }, 100);
    };

    recognitionRef.current = recognition;

    // 음성 인식 시작
    try {
      recognition.start();
    } catch (err) {
      console.error("[voice] 음성 인식 시작 실패", err);
    }

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
        recognitionRef.current = null;
      }
      setIsListening(false);
    };
  }, [devices, handleDeviceClick]);

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
            사용자 모드 - 음성 인식
          </h1>
          <p className="text-body-2 text-gray-600 dark:text-gray-300 mt-2">
            음성 명령으로 기기를 제어합니다. 예: &quot;거실 전등 켜&quot;, &quot;TV 끄기&quot;
          </p>
        </div>

        {/* 음성 인식 상태 */}
        <div className="flex items-center gap-3 text-sm bg-blue-50 dark:bg-blue-950/30 px-4 py-2 rounded-lg border border-blue-200 dark:border-blue-800">
          <span className="text-blue-700 dark:text-blue-400 font-medium">음성 인식 상태:</span>
          <span className={`px-3 py-1 rounded text-sm font-semibold ${
            isListening ? "bg-green-500 text-white" : "bg-gray-300 text-gray-700"
          }`}>
            {isListening ? "🎤 듣는 중..." : "⏸️ 대기 중"}
          </span>
        </div>

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
              입력 방식: 음성 인식
              <span className={`ml-2 px-2 py-1 rounded text-sm ${
                isListening ? "bg-green-500 text-white" : "bg-gray-300 text-gray-700"
              }`}>
                {isListening ? "🎤 듣는 중..." : "⏸️ 대기 중"}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

