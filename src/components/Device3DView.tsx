"use client";

import { Canvas } from "@react-three/fiber";
import { DeviceOrientationControls } from "@react-three/drei";
import { DeviceMarkerMesh } from "@/components/DeviceMarkerMesh";
import type { Database } from "@/database.types";

type Device = Database["public"]["Tables"]["devices"]["Row"];

interface Device3DViewProps {
  devices: Device[];
  onDeviceClick: (device: Device) => void;
  isActive?: (deviceId: string) => boolean;
  isSwitchActive?: (deviceId: string) => boolean;
  dwellProgress?: (deviceId: string) => number;
}

export function Device3DView({
  devices,
  onDeviceClick,
  isActive = () => false,
  isSwitchActive = () => false,
  dwellProgress = () => 0,
}: Device3DViewProps) {
  if (devices.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-900/50 rounded-2xl border border-dashed border-gray-300 dark:border-gray-700">
        배치된 기기가 없습니다. 관리자 모드에서 기기를 배치해주세요.
      </div>
    );
  }

  return (
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
              isActive={isActive(device.id)}
              isSwitchActive={isSwitchActive(device.id)}
              onDeviceClick={onDeviceClick}
              dwellProgress={dwellProgress(device.id)}
            />
          ))}
          <axesHelper args={[2]} />
          <DeviceOrientationControls />
        </Canvas>
      </div>
    </div>
  );
}

