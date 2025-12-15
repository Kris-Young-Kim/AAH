import { create } from "zustand";
import type { Database } from "@/database.types";

type Device = Database["public"]["Tables"]["devices"]["Row"];

type GazePoint = {
  x: number;
  y: number;
};

type StoreState = {
  devices: Device[];
  gaze: GazePoint;
  snappedDeviceId: string | null;
  dwellProgressMs: number;
  sensorReady: boolean;
  inputMode: "eye" | "mouse" | "switch";
  calibrationStep: number;
  setDevices: (devices: Device[]) => void;
  upsertDevice: (device: Device) => void;
  removeDevice: (deviceId: string) => void;
  updateDeviceState: (deviceId: string, isActive: boolean) => void;
  setGaze: (gaze: GazePoint) => void;
  setSnappedDevice: (id: string | null) => void;
  setDwellProgress: (ms: number) => void;
  setSensorReady: (ready: boolean) => void;
  setInputMode: (mode: "eye" | "mouse" | "switch") => void;
  setCalibrationStep: (step: number) => void;
  /**
   * 고빈도 시선 업데이트용: React 렌더 최소화를 위해 replace=false로 상태만 갱신.
   * 구독 중인 컴포넌트가 없으면 렌더가 발생하지 않음.
   */
  setGazeFast: (gaze: GazePoint) => void;
};

export const useStore = create<StoreState>((set) => ({
  devices: [],
  gaze: { x: 0, y: 0 },
  snappedDeviceId: null,
  dwellProgressMs: 0,
  sensorReady: false,
  inputMode: "eye",
  calibrationStep: 0,
  setDevices: (devices) => set({ devices }),
  upsertDevice: (device) =>
    set((state) => {
      const index = state.devices.findIndex((d) => d.id === device.id);
      if (index === -1) return { devices: [device, ...state.devices] };
      const next = [...state.devices];
      next[index] = device;
      return { devices: next };
    }),
  removeDevice: (deviceId) =>
    set((state) => ({
      devices: state.devices.filter((d) => d.id !== deviceId),
    })),
  updateDeviceState: (deviceId, isActive) =>
    set((state) => ({
      devices: state.devices.map((d) =>
        d.id === deviceId ? { ...d, is_active: isActive } : d
      ),
    })),
  setGaze: (gaze) => set({ gaze }),
  setSnappedDevice: (id) => set({ snappedDeviceId: id }),
  setDwellProgress: (ms) => set({ dwellProgressMs: ms }),
  setSensorReady: (ready) => set({ sensorReady: ready }),
  setInputMode: (mode) => set({ inputMode: mode }),
  setCalibrationStep: (step) => set({ calibrationStep: step }),
  setGazeFast: (gaze) => set({ gaze }, false),
}));

