export type InputMode = 'pointer' | 'gaze' | 'switch' | 'face';

export interface Anchor {
  id: string;
  label: string;
  // The 'world' coordinates (yaw/pitch) where the anchor lives
  yaw: number;
  pitch: number;
  // Visual properties
  color: string;
  icon?: string;
}

export interface ViewState {
  yaw: number;   // Horizontal rotation (degrees)
  pitch: number; // Vertical rotation (degrees)
}

export interface ScreenPoint {
  x: number;
  y: number;
}