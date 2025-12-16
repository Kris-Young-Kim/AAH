"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useAuth, SignedIn, SignedOut, SignInButton } from "@clerk/nextjs";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import {
  DeviceOrientationControls,
  Html,
  Billboard,
} from "@react-three/drei";
import { Vector3 } from "three";
import type { Database } from "@/database.types";
import { deleteDevice, saveDevice, toggleDeviceStatus, updateInputMode } from "../actions";
import { useStore } from "@/hooks/useStore";
import { useDeviceSync } from "@/hooks/useDeviceSync";
import { trackEvent } from "@/lib/analytics";

type Device = Database["public"]["Tables"]["devices"]["Row"];

type Props = {
  clerkUserId: string;
  initialDevices: Device[];
};

function DirectionTracker({
  onDirection,
}: {
  onDirection: (dir: { x: number; y: number; z: number }) => void;
}) {
  const { camera } = useThree();
  const dirRef = useRef(new Vector3());
  const frameRef = useRef(0);

  useFrame(() => {
    const dir = dirRef.current;
    camera.getWorldDirection(dir);
    dir.multiplyScalar(2); // 2m 앞 포인트
    frameRef.current += 1;
    // 너무 자주 setState하지 않도록 6프레임(≈100ms)마다 샘플
    if (frameRef.current % 6 === 0) {
      onDirection({ x: dir.x, y: dir.y, z: dir.z });
    }
  });

  return <DeviceOrientationControls />;
}

export default function AdminClient({
  clerkUserId,
  initialDevices,
  currentInputMode,
}: Props) {
  const { isSignedIn } = useAuth();
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState("");
  const [iconType, setIconType] = useState<"light" | "tv" | "fan">("light");
  const [inputMode, setInputMode] = useState<"eye" | "mouse" | "switch">(currentInputMode);
  const setDevices = useStore((s) => s.setDevices);
  const devices = useStore((s) => s.devices);
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
  const videoRef = useRef<HTMLVideoElement | null>(null);

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
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
        audio: false,
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setVideoReady(true);
        console.log("[admin] 웹캠 스트림 시작 (로컬 처리만, 서버 미전송)");
      }
    } catch (err) {
      console.error("웹캠 권한 요청 실패", err);
    }
  };

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
          iOS: 센서 권한을 위해 "시작하기" 버튼(아래 권한 안내)을 눌러주세요.
        </div>
      </div>

      {/* 입력 방식 선택 섹션 */}
      <section className="rounded-2xl border border-gray-200 dark:border-gray-800 p-6 space-y-4">
        <div>
          <h2 className="text-h2 mb-2">입력 방식 설정</h2>
          <p className="text-body-2 text-gray-600 dark:text-gray-300">
            사용자가 사용할 입력 방식을 선택하세요. 선택한 방식에 따라 사용자 모드의 인터페이스가 변경됩니다.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <button
            onClick={() => handleInputModeChange("eye")}
            disabled={pending}
            className={`h-12 px-6 rounded-full text-sm font-medium transition-all ${
              inputMode === "eye"
                ? "bg-blue-500 text-white shadow-lg"
                : "bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700"
            }`}
          >
            👁️ 시선 추적 (Eye Tracking)
          </button>
          <button
            onClick={() => handleInputModeChange("mouse")}
            disabled={pending}
            className={`h-12 px-6 rounded-full text-sm font-medium transition-all ${
              inputMode === "mouse"
                ? "bg-blue-500 text-white shadow-lg"
                : "bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700"
            }`}
          >
            🖱️ 마우스 클릭
          </button>
          <button
            onClick={() => handleInputModeChange("switch")}
            disabled={pending}
            className={`h-12 px-6 rounded-full text-sm font-medium transition-all ${
              inputMode === "switch"
                ? "bg-blue-500 text-white shadow-lg"
                : "bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700"
            }`}
          >
            🔘 스위치 클릭
          </button>
        </div>
        <div className="text-sm text-gray-500 dark:text-gray-400">
          현재 선택: <span className="font-medium">{inputMode === "eye" ? "시선 추적" : inputMode === "mouse" ? "마우스 클릭" : "스위치 클릭"}</span>
        </div>
      </section>

      <section className="rounded-2xl border border-gray-200 dark:border-gray-800 p-6 space-y-4">
        <div className="flex flex-wrap items-center gap-4">
          <div className="text-body-2 text-gray-600 dark:text-gray-300">
            현재 방향: x {direction.x.toFixed(2)}, y {direction.y.toFixed(2)}, z{" "}
            {direction.z.toFixed(2)}
          </div>
          <button
            className="h-10 px-3 rounded-full border border-gray-300 dark:border-gray-700"
            onClick={() =>
              alert("디바이스를 향해 조준 후 추가 버튼을 눌러주세요.")
            }
          >
            조준 안내
          </button>
          <button
            className="h-10 px-3 rounded-full border border-gray-300 dark:border-gray-700"
            onClick={() => {
              if (isIOSPermissionRequired) {
                (DeviceOrientationEvent as any)
                  .requestPermission()
                  .then((res: string) => {
                    console.log("iOS orientation permission:", res);
                  })
                  .catch((err: any) => console.error("권한 요청 실패", err));
              }
              void startVideo();
            }}
          >
            시작하기(iOS 센서/카메라)
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

          <div className="rounded-xl border border-dashed border-gray-300 dark:border-gray-700 p-0 overflow-hidden">
            <div className="relative w-full h-[260px]">
              <video
                ref={videoRef}
                className="absolute inset-0 w-full h-full object-cover opacity-60"
                autoPlay
                muted
                playsInline
              />
              {/* 
                보안: 카메라 스트림 및 시선 데이터는 클라이언트 메모리 내에서만 처리되며,
                서버로 전송되지 않습니다. 모든 처리는 로컬에서 수행됩니다.
              */}
              <Canvas
                camera={{ position: [0, 0, 0], fov: 75 }}
                frameloop="always"
                dpr={[1, 2]}
                performance={{ min: 0.5 }}
              >
                <ambientLight intensity={0.8} />
                <directionalLight position={[2, 2, 2]} intensity={0.6} />
                {/* 방향 참조 박스 */}
                <mesh position={[0, 0, -2]}>
                  <boxGeometry args={[0.2, 0.2, 0.2]} />
                  <meshStandardMaterial color="#22c55e" />
                </mesh>
                {/* 마커 렌더링: 빌보드 스프라이트로 FPS 30+ 유지 */}
                {devices.map((device) => (
                  <MarkerMesh key={device.id} device={device} />
                ))}
                <axesHelper args={[1]} />
                <DirectionTracker onDirection={setDirection} />
              </Canvas>
              {/* 중앙 조준점 */}
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                <div className="w-10 h-10 rounded-full border-2 border-white/80 shadow-[0_0_20px_rgba(255,255,255,0.5)]" />
                <div className="absolute w-1 h-8 bg-white/80" />
                <div className="absolute w-8 h-1 bg-white/80" />
              </div>
              <div className="absolute bottom-2 left-1/2 -translate-x-1/2 text-xs px-3 py-1 rounded-full bg-black/60 text-white">
                카메라가 바라보는 방향으로 2m 앞 위치를 저장합니다.
              </div>
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
                x: {device.position_x.toFixed(2)} / y:{" "}
                {device.position_y.toFixed(2)} / z:{" "}
                {device.position_z.toFixed(2)}
              </div>
              <div className="flex gap-2">
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
                <button
                  onClick={() => handleDelete(device.id)}
                  className="h-9 px-3 rounded-full text-sm bg-red-500 text-white"
                  disabled={pending}
                >
                  삭제
                </button>
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
