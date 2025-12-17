"use client";

import { Html, Billboard } from "@react-three/drei";
import type { Database } from "@/database.types";

type Device = Database["public"]["Tables"]["devices"]["Row"];

interface DeviceMarkerMeshProps {
  device: Device;
  isActive: boolean;
  isSwitchActive: boolean;
  onDeviceClick: (device: Device) => void;
  dwellProgress: number;
}

export function DeviceMarkerMesh({
  device,
  isActive,
  isSwitchActive,
  onDeviceClick,
  dwellProgress,
}: DeviceMarkerMeshProps) {
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

